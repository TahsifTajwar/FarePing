import { Router } from "express";
import { z } from "zod";

export const flightsRouter = Router();

const flightSearchSchema = z.object({
  originAirports: z.array(z.string().min(3)).min(1),
  destinationAirports: z.array(z.string().min(3)).min(1),
  departStart: z.string().date(),
  departEnd: z.string().date(),
  returnStart: z.string().date().optional(),
  returnEnd: z.string().date().optional(),
  maxPrice: z.coerce.number().positive(),
  maxStops: z.coerce.number().int().min(0).optional()
});

flightsRouter.post("/search", (req, res) => {
  const search = flightSearchSchema.parse(req.body);
  const originAirport = search.originAirports[0];
  const destinationAirport = search.destinationAirports[0];

  res.json({
    results: [
      {
        airline: "Delta",
        originAirport,
        destinationAirport,
        price: Math.min(search.maxPrice, 218),
        currency: "USD",
        departDate: search.departStart,
        returnDate: search.returnStart ?? null,
        stops: 0,
        bookingLink: "https://example.com/book/delta"
      },
      {
        airline: "United",
        originAirport,
        destinationAirport,
        price: Math.min(search.maxPrice + 35, 253),
        currency: "USD",
        departDate: search.departEnd,
        returnDate: search.returnEnd ?? null,
        stops: 1,
        bookingLink: "https://example.com/book/united"
      },
      {
        airline: "JetBlue",
        originAirport,
        destinationAirport,
        price: Math.min(search.maxPrice + 52, 270),
        currency: "USD",
        departDate: search.departStart,
        returnDate: search.returnEnd ?? search.returnStart ?? null,
        stops: search.maxStops ?? 1,
        bookingLink: "https://example.com/book/jetblue"
      }
    ]
  });
});
