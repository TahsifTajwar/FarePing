import { Router } from "express";
import { z } from "zod";
import { searchFlightsWithDiagnostics } from "../services/flightSearch.js";

export const flightsRouter = Router();

const flightSearchSchema = z
  .object({
    tripType: z.enum(["ROUND_TRIP", "ONE_WAY"]),
    originAirports: z.array(z.string().min(3)).min(1),
    destinationAirports: z.array(z.string().min(3)).min(1),
    earliestDepartDate: z.string().date(),
    latestDepartDate: z.string().date().optional(),
    latestReturnDate: z.string().date().optional(),
    minTripDays: z.coerce.number().int().positive().optional(),
    maxTripDays: z.coerce.number().int().positive().optional(),
    maxPrice: z.coerce.number().positive(),
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
        message: "latestReturnDate is required for round-trip searches.",
        path: ["latestReturnDate"]
      });
    }

    if (!search.minTripDays) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "minTripDays is required for round-trip searches.",
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

type FlightSearch = z.infer<typeof flightSearchSchema>;

flightsRouter.post("/search", async (req, res) => {
  const parsedSearch = flightSearchSchema.safeParse(req.body);

  if (!parsedSearch.success) {
    res.status(400).json({
      message: "Flight search request is invalid.",
      issues: parsedSearch.error.issues.map((issue) => ({
        path: issue.path,
        message: issue.message
      }))
    });
    return;
  }

  const search = parsedSearch.data;
  try {
    const { results, diagnostics } = await searchFlightsWithDiagnostics(search);

    res.json({
      results,
      diagnostics
    });
  } catch (error) {
    res.status(502).json({
      message:
        error instanceof Error
          ? error.message
          : "Flight provider search failed. Please try again."
    });
  }
});

function getDayDifference(startDate: string, endDate: string) {
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  const end = Date.parse(`${endDate}T00:00:00.000Z`);
  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return Math.round((end - start) / millisecondsPerDay);
}
