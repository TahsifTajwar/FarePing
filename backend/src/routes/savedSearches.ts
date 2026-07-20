import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";

export const savedSearchesRouter = Router();

const savedSearchSchema = z
  .object({
    contactPhone: z.string().min(7).optional(),
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
  });

savedSearchesRouter.post("/", async (req, res) => {
  const input = savedSearchSchema.parse(req.body);

  const savedSearch = await prisma.savedSearch.create({
    data: {
      contactPhone: input.contactPhone,
      tripType: input.tripType,
      originAirports: input.originAirports.map((airport) => airport.toUpperCase()),
      destinationAirports: input.destinationAirports.map((airport) => airport.toUpperCase()),
      earliestDepartDate: toDate(input.earliestDepartDate),
      latestDepartDate: input.latestDepartDate ? toDate(input.latestDepartDate) : null,
      latestReturnDate: input.latestReturnDate ? toDate(input.latestReturnDate) : null,
      minTripDays: input.minTripDays,
      maxTripDays: input.maxTripDays,
      maxPrice: input.maxPrice,
      maxStops: input.maxStops
    }
  });

  res.status(201).json({
    savedSearch
  });
});

savedSearchesRouter.get("/", async (_req, res) => {
  const savedSearches = await prisma.savedSearch.findMany({
    orderBy: {
      createdAt: "desc"
    }
  });

  res.json({
    savedSearches
  });
});

savedSearchesRouter.get("/:id", async (req, res) => {
  const savedSearch = await prisma.savedSearch.findUnique({
    where: {
      id: req.params.id
    },
    include: {
      resultBatches: {
        include: {
          itineraries: {
            include: {
              legs: true
            }
          }
        },
        orderBy: {
          checkedAt: "desc"
        }
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

function toDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}
