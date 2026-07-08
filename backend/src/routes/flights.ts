import { Router } from "express";
import { z } from "zod";

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

type Itinerary = {
  id: string;
  type: "ROUND_TRIP" | "SPLIT_ONE_WAYS" | "ONE_WAY";
  totalPrice: number;
  currency: "USD";
  savingsComparedToRoundTrip: number | null;
  summary: string;
  legs: {
    direction: "OUTBOUND" | "RETURN";
    airline: string;
    originAirport: string;
    destinationAirport: string;
    price: number;
    departDate: string;
    stops: number;
    bookingLink: string;
  }[];
};

flightsRouter.post("/search", (req, res) => {
  const search = flightSearchSchema.parse(req.body);
  const originAirport = search.originAirports[0];
  const destinationAirport = search.destinationAirports[0];

  const results =
    search.tripType === "ONE_WAY"
      ? buildOneWayResults(search, originAirport, destinationAirport)
      : buildRoundTripResults(search, originAirport, destinationAirport);

  res.json({
    results: filterAndSortByBudget(results, search.maxPrice)
  });
});

function buildOneWayResults(
  search: FlightSearch,
  originAirport: string,
  destinationAirport: string
): Itinerary[] {
  const maxStops = search.maxStops ?? 1;

  return [
    {
      id: "one-way-jetblue",
      type: "ONE_WAY",
      totalPrice: 164,
      currency: "USD",
      savingsComparedToRoundTrip: null,
      summary: "Cheapest one-way mock fare.",
      legs: [
        buildLeg(
          "OUTBOUND",
          "JetBlue",
          originAirport,
          destinationAirport,
          164,
          search.earliestDepartDate,
          0
        )
      ]
    },
    {
      id: "one-way-delta",
      type: "ONE_WAY",
      totalPrice: 188,
      currency: "USD",
      savingsComparedToRoundTrip: null,
      summary: "One-way mock fare with a full-service airline.",
      legs: [
        buildLeg(
          "OUTBOUND",
          "Delta",
          originAirport,
          destinationAirport,
          188,
          search.latestDepartDate ?? search.earliestDepartDate,
          maxStops
        )
      ]
    },
    {
      id: "one-way-united",
      type: "ONE_WAY",
      totalPrice: 213,
      currency: "USD",
      savingsComparedToRoundTrip: null,
      summary: "Backup one-way mock fare.",
      legs: [
        buildLeg("OUTBOUND", "United", originAirport, destinationAirport, 213, search.earliestDepartDate, maxStops)
      ]
    }
  ];
}

function buildRoundTripResults(
  search: FlightSearch,
  originAirport: string,
  destinationAirport: string
): Itinerary[] {
  const maxStops = search.maxStops ?? 1;
  const returnDate = search.latestReturnDate ?? search.earliestDepartDate;
  const roundTripPrice = 680;
  const splitOutboundPrice = 280;
  const splitReturnPrice = 240;
  const splitTotalPrice = splitOutboundPrice + splitReturnPrice;

  const roundTrip: Itinerary = {
    id: "round-trip-delta",
    type: "ROUND_TRIP",
    totalPrice: roundTripPrice,
    currency: "USD",
    savingsComparedToRoundTrip: null,
    summary: "Normal round-trip mock fare.",
    legs: [
      buildLeg("OUTBOUND", "Delta", originAirport, destinationAirport, 340, search.earliestDepartDate, maxStops),
      buildLeg("RETURN", "Delta", destinationAirport, originAirport, 340, returnDate, maxStops)
    ]
  };

  const splitOneWays: Itinerary = {
    id: "split-one-ways-jetblue-norse",
    type: "SPLIT_ONE_WAYS",
    totalPrice: splitTotalPrice,
    currency: "USD",
    savingsComparedToRoundTrip: roundTripPrice - splitTotalPrice,
    summary: "Split one-way mock fare using different airlines.",
    legs: [
      buildLeg(
        "OUTBOUND",
        "JetBlue",
        originAirport,
        destinationAirport,
        splitOutboundPrice,
        search.earliestDepartDate,
        0
      ),
      buildLeg("RETURN", "Norse", destinationAirport, originAirport, splitReturnPrice, returnDate, maxStops)
    ]
  };

  return [roundTrip, splitOneWays].sort((first, second) => first.totalPrice - second.totalPrice);
}

function buildLeg(
  direction: "OUTBOUND" | "RETURN",
  airline: string,
  originAirport: string,
  destinationAirport: string,
  price: number,
  departDate: string,
  stops: number
) {
  return {
    direction,
    airline,
    originAirport,
    destinationAirport,
    price,
    departDate,
    stops,
    bookingLink: `https://example.com/book/${airline.toLowerCase()}`
  };
}

function filterAndSortByBudget(results: Itinerary[], maxPrice: number) {
  return results
    .filter((result) => result.totalPrice <= maxPrice)
    .sort((first, second) => first.totalPrice - second.totalPrice);
}
