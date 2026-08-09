import { Router, type Request } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { type AuthenticatedRequest, requireAuth } from "../middleware/auth.js";
import {
  checkAllActiveSavedSearches,
  checkSavedSearch,
  saveSearchResultBatch
} from "../services/savedSearchChecker.js";

export const savedSearchesRouter = Router();

const phoneNumberSchema = z
  .string()
  .trim()
  .refine((phoneNumber) => /^[+\d\s().-]+$/.test(phoneNumber), {
    message: "contactPhone can only contain phone number characters."
  })
  .refine((phoneNumber) => {
    const digitCount = phoneNumber.replace(/\D/g, "").length;

    return digitCount >= 10 && digitCount <= 15;
  }, {
    message: "contactPhone must contain 10 to 15 digits."
  });

const savedSearchSchema = z
  .object({
    contactPhone: phoneNumberSchema.optional(),
    tripType: z.enum(["ROUND_TRIP", "ONE_WAY"]),
    originAirports: z.array(z.string().min(3)).min(1),
    destinationAirports: z.array(z.string().min(3)).min(1),
    earliestDepartDate: z.string().date(),
    latestDepartDate: z.string().date().optional(),
    latestReturnDate: z.string().date().optional(),
    minTripDays: z.coerce.number().int().positive().optional(),
    maxTripDays: z.coerce.number().int().positive().optional(),
    maxPrice: z.coerce.number().int().positive(),
    maxStops: z.coerce.number().int().min(0).optional()
  })
  .superRefine((search, ctx) => {
    if (
      search.tripType === "ONE_WAY" &&
      search.latestDepartDate &&
      getDayDifference(search.earliestDepartDate, search.latestDepartDate) < 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "latestDepartDate cannot be before earliestDepartDate.",
        path: ["latestDepartDate"]
      });
    }

    if (search.tripType !== "ROUND_TRIP") {
      return;
    }

    if (!search.latestReturnDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "latestReturnDate is required for round-trip saved searches.",
        path: ["latestReturnDate"]
      });
    }

    if (!search.minTripDays) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "minTripDays is required for round-trip saved searches.",
        path: ["minTripDays"]
      });
    }

    if (!search.latestReturnDate || !search.minTripDays) {
      return;
    }

    const availableTripDays = getDayDifference(search.earliestDepartDate, search.latestReturnDate);

    if (availableTripDays <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "latestReturnDate must be after earliestDepartDate.",
        path: ["latestReturnDate"]
      });
      return;
    }

    if (search.minTripDays > availableTripDays) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `minTripDays cannot be more than ${availableTripDays} for this date window.`,
        path: ["minTripDays"]
      });
    }

    if (search.maxTripDays && search.maxTripDays < search.minTripDays) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "maxTripDays cannot be less than minTripDays.",
        path: ["maxTripDays"]
      });
    }

    if (search.maxTripDays && search.maxTripDays > availableTripDays) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `maxTripDays cannot be more than ${availableTripDays} for this date window.`,
        path: ["maxTripDays"]
      });
    }
  });

const updateSavedSearchSchema = z.object({
  active: z.boolean()
});

const savedSearchDetailsSchema = z.object({
  contactPhone: z.union([phoneNumberSchema, z.literal(""), z.null()]).optional(),
  tripType: z.enum(["ROUND_TRIP", "ONE_WAY"]).optional(),
  originAirports: z.array(z.string().min(3)).min(1).optional(),
  destinationAirports: z.array(z.string().min(3)).min(1).optional(),
  earliestDepartDate: z.string().date().optional(),
  latestDepartDate: z.string().date().nullable().optional(),
  latestReturnDate: z.string().date().nullable().optional(),
  minTripDays: z.coerce.number().int().positive().nullable().optional(),
  maxTripDays: z.coerce.number().int().positive().nullable().optional(),
  maxPrice: z.coerce.number().int().positive().optional(),
  maxStops: z.coerce.number().int().min(0).nullable().optional()
});

const currentResultLegSchema = z.object({
  direction: z.enum(["OUTBOUND", "RETURN"]),
  airline: z.string().min(1),
  originAirport: z.string().min(3),
  destinationAirport: z.string().min(3),
  price: z.coerce.number().int().nonnegative(),
  departDate: z.string().date(),
  departTime: z.string().optional(),
  arrivalTime: z.string().optional(),
  durationMinutes: z.coerce.number().int().positive().optional(),
  stops: z.coerce.number().int().min(0),
  bookingLink: z.string().url()
});

const currentResultSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["ROUND_TRIP", "SPLIT_ONE_WAYS", "ONE_WAY"]),
  totalPrice: z.coerce.number().int().positive(),
  currency: z.literal("USD"),
  savingsComparedToRoundTrip: z.coerce.number().int().nullable(),
  summary: z.string().min(1),
  totalDurationMinutes: z.coerce.number().int().positive(),
  carryOnIncluded: z.boolean().nullable(),
  dealScore: z.coerce.number().int().min(0),
  qualityLabel: z.string().min(1),
  warning: z.string().nullable(),
  legs: z.array(currentResultLegSchema).min(1)
});

const createSavedSearchSchema = savedSearchSchema.and(
  z.object({
    currentResults: z.array(currentResultSchema).optional()
  })
);

type CreateSavedSearchInput = z.infer<typeof savedSearchSchema> & {
  currentResults?: z.infer<typeof currentResultSchema>[];
};

savedSearchesRouter.post("/check-all", async (_req, res) => {
  const checkSummary = await checkAllActiveSavedSearches();

  res.status(201).json(checkSummary);
});

savedSearchesRouter.use(requireAuth);

savedSearchesRouter.post("/", async (req, res) => {
  const userId = getUserId(req);
  const parsedInput = createSavedSearchSchema.safeParse(req.body);

  if (!parsedInput.success) {
    res.status(400).json({
      message: "Saved search request is invalid.",
      issues: parsedInput.error.issues.map((issue) => ({
        path: issue.path,
        message: issue.message
      }))
    });
    return;
  }

  const input = parsedInput.data as CreateSavedSearchInput;

  const savedSearch = await prisma.savedSearch.create({
    data: {
      userId,
      contactPhone: input.contactPhone,
      tripType: input.tripType,
      originAirports: input.originAirports.map((airport) => airport.toUpperCase()),
      destinationAirports: input.destinationAirports.map((airport) => airport.toUpperCase()),
      earliestDepartDate: toDate(input.earliestDepartDate),
      latestDepartDate:
        input.tripType === "ONE_WAY" && input.latestDepartDate
          ? toDate(input.latestDepartDate)
          : null,
      latestReturnDate: input.latestReturnDate ? toDate(input.latestReturnDate) : null,
      minTripDays: input.minTripDays,
      maxTripDays: input.maxTripDays,
      maxPrice: input.maxPrice,
      maxStops: input.maxStops
    }
  });

  const resultBatch =
    input.currentResults && input.currentResults.length > 0
      ? await saveSearchResultBatch(savedSearch.id, input.currentResults)
      : null;

  res.status(201).json({
    savedSearch: resultBatch
      ? {
          ...savedSearch,
          resultBatches: [resultBatch]
        }
      : savedSearch
  });
});

savedSearchesRouter.get("/", async (req, res) => {
  const userId = getUserId(req);
  const savedSearches = await prisma.savedSearch.findMany({
    where: {
      userId
    },
    include: {
      resultBatches: {
        include: {
          itineraries: {
            include: {
              legs: true
            },
            orderBy: {
              dealScore: "desc"
            }
          }
        },
        orderBy: {
          checkedAt: "desc"
        },
        take: 1
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  res.json({
    savedSearches
  });
});

savedSearchesRouter.post("/:id/check", async (req, res) => {
  const userId = getUserId(req);
  const savedSearch = await prisma.savedSearch.findFirst({
    where: {
      id: req.params.id,
      userId
    }
  });

  if (!savedSearch) {
    res.status(404).json({
      message: "Saved search not found."
    });
    return;
  }

  const { resultBatch, notificationDecision } = await checkSavedSearch(savedSearch, env.FLIGHT_PROVIDER);

  res.status(201).json({
    resultBatch,
    notificationDecision
  });
});

savedSearchesRouter.patch("/:id", async (req, res) => {
  const userId = getUserId(req);
  const input = updateSavedSearchSchema.parse(req.body);

  const savedSearch = await prisma.savedSearch.findFirst({
    where: {
      id: req.params.id,
      userId
    }
  });

  if (!savedSearch) {
    res.status(404).json({
      message: "Saved search not found."
    });
    return;
  }

  const updatedSavedSearch = await prisma.savedSearch.update({
    where: {
      id: req.params.id
    },
    data: {
      active: input.active
    },
    include: {
      resultBatches: {
        include: {
          itineraries: {
            include: {
              legs: true
            },
            orderBy: {
              dealScore: "desc"
            }
          }
        },
        orderBy: {
          checkedAt: "desc"
        },
        take: 1
      }
    }
  });

  res.json({
    savedSearch: updatedSavedSearch
  });
});

savedSearchesRouter.patch("/:id/details", async (req, res) => {
  const userId = getUserId(req);
  const parsedInput = savedSearchDetailsSchema.safeParse(req.body);

  if (!parsedInput.success) {
    res.status(400).json({
      message: "Saved search update is invalid.",
      issues: parsedInput.error.issues.map((issue) => ({
        path: issue.path,
        message: issue.message
      }))
    });
    return;
  }

  const savedSearch = await prisma.savedSearch.findFirst({
    where: {
      id: req.params.id,
      userId
    }
  });

  if (!savedSearch) {
    res.status(404).json({
      message: "Saved search not found."
    });
    return;
  }

  const mergedSearch = buildMergedSavedSearchInput(savedSearch, parsedInput.data);
  const parsedMergedSearch = savedSearchSchema.safeParse(mergedSearch);

  if (!parsedMergedSearch.success) {
    res.status(400).json({
      message: "Saved search update is invalid.",
      issues: parsedMergedSearch.error.issues.map((issue) => ({
        path: issue.path,
        message: issue.message
      }))
    });
    return;
  }

  const input = parsedMergedSearch.data;
  const updatedSavedSearch = await prisma.savedSearch.update({
    where: {
      id: req.params.id
    },
    data: {
      contactPhone: input.contactPhone,
      tripType: input.tripType,
      originAirports: input.originAirports.map((airport) => airport.toUpperCase()),
      destinationAirports: input.destinationAirports.map((airport) => airport.toUpperCase()),
      earliestDepartDate: toDate(input.earliestDepartDate),
      latestDepartDate:
        input.tripType === "ONE_WAY" && input.latestDepartDate
          ? toDate(input.latestDepartDate)
          : null,
      latestReturnDate:
        input.tripType === "ROUND_TRIP" && input.latestReturnDate
          ? toDate(input.latestReturnDate)
          : null,
      minTripDays: input.tripType === "ROUND_TRIP" ? input.minTripDays : null,
      maxTripDays: input.tripType === "ROUND_TRIP" ? input.maxTripDays : null,
      maxPrice: input.maxPrice,
      maxStops: input.maxStops ?? null
    },
    include: {
      resultBatches: {
        include: {
          itineraries: {
            include: {
              legs: true
            },
            orderBy: {
              dealScore: "desc"
            }
          }
        },
        orderBy: {
          checkedAt: "desc"
        },
        take: 1
      }
    }
  });

  res.json({
    savedSearch: updatedSavedSearch
  });
});

savedSearchesRouter.delete("/:id", async (req, res) => {
  const userId = getUserId(req);
  const savedSearchId = req.params.id;
  const savedSearch = await prisma.savedSearch.findFirst({
    where: {
      id: savedSearchId,
      userId
    }
  });

  if (!savedSearch) {
    res.status(404).json({
      message: "Saved search not found."
    });
    return;
  }

  await prisma.$transaction(async (tx) => {
    const resultBatches = await tx.searchResultBatch.findMany({
      where: {
        savedSearchId
      },
      select: {
        id: true
      }
    });
    const resultBatchIds = resultBatches.map((resultBatch) => resultBatch.id);

    const itineraries = await tx.itineraryResult.findMany({
      where: {
        resultBatchId: {
          in: resultBatchIds
        }
      },
      select: {
        id: true
      }
    });
    const itineraryIds = itineraries.map((itinerary) => itinerary.id);

    await tx.notification.deleteMany({
      where: {
        savedSearchId
      }
    });

    await tx.priceHistory.deleteMany({
      where: {
        savedSearchId
      }
    });

    await tx.itineraryLeg.deleteMany({
      where: {
        itineraryResultId: {
          in: itineraryIds
        }
      }
    });

    await tx.itineraryResult.deleteMany({
      where: {
        resultBatchId: {
          in: resultBatchIds
        }
      }
    });

    await tx.searchResultBatch.deleteMany({
      where: {
        savedSearchId
      }
    });

    await tx.savedSearch.delete({
      where: {
        id: savedSearchId
      }
    });
  });

  res.status(204).send();
});

savedSearchesRouter.get("/:id", async (req, res) => {
  const userId = getUserId(req);
  const savedSearch = await prisma.savedSearch.findFirst({
    where: {
      id: req.params.id,
      userId
    },
    include: {
      resultBatches: {
        include: {
          itineraries: {
            include: {
              legs: true
            },
            orderBy: {
              dealScore: "desc"
            }
          }
        },
        orderBy: {
          checkedAt: "desc"
        },
        take: 1
      }
    }
  });

  if (!savedSearch) {
    res.status(404).json({
      message: "Saved search not found."
    });
    return;
  }

  res.json({
    savedSearch
  });
});

function getUserId(req: Request) {
  return (req as AuthenticatedRequest).user.id;
}

function toDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

function getDayDifference(startDate: string, endDate: string) {
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  const end = Date.parse(`${endDate}T00:00:00.000Z`);
  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return Math.round((end - start) / millisecondsPerDay);
}

function toDateInput(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : undefined;
}

function optionalValue<T>(value: T | null | undefined) {
  return value === null ? undefined : value;
}

function buildMergedSavedSearchInput(
  savedSearch: {
    contactPhone: string | null;
    tripType: "ROUND_TRIP" | "ONE_WAY";
    originAirports: string[];
    destinationAirports: string[];
    earliestDepartDate: Date;
    latestDepartDate: Date | null;
    latestReturnDate: Date | null;
    minTripDays: number | null;
    maxTripDays: number | null;
    maxPrice: number;
    maxStops: number | null;
  },
  updates: z.infer<typeof savedSearchDetailsSchema>
) {
  const tripType = updates.tripType ?? savedSearch.tripType;

  return {
    contactPhone:
      updates.contactPhone === undefined
        ? optionalValue(savedSearch.contactPhone)
        : optionalValue(updates.contactPhone),
    tripType,
    originAirports: updates.originAirports ?? savedSearch.originAirports,
    destinationAirports: updates.destinationAirports ?? savedSearch.destinationAirports,
    earliestDepartDate: updates.earliestDepartDate ?? toDateInput(savedSearch.earliestDepartDate),
    latestDepartDate:
      updates.latestDepartDate === undefined
        ? toDateInput(savedSearch.latestDepartDate)
        : optionalValue(updates.latestDepartDate),
    latestReturnDate:
      tripType === "ROUND_TRIP"
        ? updates.latestReturnDate === undefined
          ? toDateInput(savedSearch.latestReturnDate)
          : optionalValue(updates.latestReturnDate)
        : undefined,
    minTripDays:
      tripType === "ROUND_TRIP"
        ? updates.minTripDays === undefined
          ? optionalValue(savedSearch.minTripDays)
          : optionalValue(updates.minTripDays)
        : undefined,
    maxTripDays:
      tripType === "ROUND_TRIP"
        ? updates.maxTripDays === undefined
          ? optionalValue(savedSearch.maxTripDays)
          : optionalValue(updates.maxTripDays)
        : undefined,
    maxPrice: updates.maxPrice ?? savedSearch.maxPrice,
    maxStops:
      updates.maxStops === undefined
        ? optionalValue(savedSearch.maxStops)
        : optionalValue(updates.maxStops)
  };
}
