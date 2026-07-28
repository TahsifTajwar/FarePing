import { Router } from "express";
import { z } from "zod";
import { searchFlights } from "../services/flightSearch.js";

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
  });

type FlightSearch = z.infer<typeof flightSearchSchema>;

flightsRouter.post("/search", async (req, res) => {
  const search = flightSearchSchema.parse(req.body);
  const results = await searchFlights(search);

  res.json({
    results
  });
});
