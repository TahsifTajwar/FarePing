export type FlightSearchInput = {
  tripType: "ROUND_TRIP" | "ONE_WAY";
  originAirports: string[];
  destinationAirports: string[];
  earliestDepartDate: string;
  latestDepartDate?: string;
  latestReturnDate?: string;
  minTripDays?: number;
  maxTripDays?: number;
  maxPrice: number;
  maxStops?: number;
};

export type MockItinerary = {
  id: string;
  type: "ROUND_TRIP" | "SPLIT_ONE_WAYS" | "ONE_WAY";
  totalPrice: number;
  currency: "USD";
  savingsComparedToRoundTrip: number | null;
  summary: string;
  totalDurationMinutes: number;
  dealScore: number;
  qualityLabel: string;
  warning: string | null;
  carryOnIncluded: boolean;
  legs: MockItineraryLeg[];
};

export type MockItineraryLeg = {
  direction: "OUTBOUND" | "RETURN";
  airline: string;
  originAirport: string;
  destinationAirport: string;
  price: number;
  departDate: string;
  stops: number;
  bookingLink: string;
};

type UnscoredItinerary = Omit<MockItinerary, "dealScore" | "qualityLabel" | "warning">;

const MAX_PRICE_OVER_BUDGET = 50;
const MIN_VISIBLE_DEAL_SCORE = 600;

export function runMockFlightSearch(search: FlightSearchInput) {
  const originAirport = search.originAirports[0];
  const destinationAirport = search.destinationAirports[0];

  const results =
    search.tripType === "ONE_WAY"
      ? buildOneWayResults(search, originAirport, destinationAirport)
      : buildRoundTripResults(search, originAirport, destinationAirport);

  return scoreFilterAndSortResults(results, search);
}

function buildOneWayResults(
  search: FlightSearchInput,
  originAirport: string,
  destinationAirport: string
): UnscoredItinerary[] {
  const maxStops = search.maxStops ?? 1;

  return [
    {
      id: "one-way-jetblue",
      type: "ONE_WAY",
      totalPrice: 164,
      currency: "USD",
      savingsComparedToRoundTrip: null,
      summary: "Fast nonstop one-way mock fare.",
      totalDurationMinutes: 190,
      carryOnIncluded: true,
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
      summary: "One-way mock fare with a longer connection.",
      totalDurationMinutes: 300,
      carryOnIncluded: true,
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
      id: "one-way-united-long",
      type: "ONE_WAY",
      totalPrice: 213,
      currency: "USD",
      savingsComparedToRoundTrip: null,
      summary: "Cheap but slow one-way mock fare.",
      totalDurationMinutes: 720,
      carryOnIncluded: false,
      legs: [
        buildLeg("OUTBOUND", "United", originAirport, destinationAirport, 213, search.earliestDepartDate, maxStops)
      ]
    }
  ];
}

function buildRoundTripResults(
  search: FlightSearchInput,
  originAirport: string,
  destinationAirport: string
): UnscoredItinerary[] {
  const maxStops = search.maxStops ?? 1;
  const returnDate = search.latestReturnDate ?? search.earliestDepartDate;
  const roundTripPrice = 680;
  const fastRoundTripPrice = 640;
  const splitOutboundPrice = 280;
  const splitReturnPrice = 240;
  const splitTotalPrice = splitOutboundPrice + splitReturnPrice;

  const roundTrip: UnscoredItinerary = {
    id: "round-trip-delta",
    type: "ROUND_TRIP",
    totalPrice: roundTripPrice,
    currency: "USD",
    savingsComparedToRoundTrip: null,
    summary: "Normal round-trip mock fare.",
    totalDurationMinutes: 760,
    carryOnIncluded: true,
    legs: [
      buildLeg("OUTBOUND", "Delta", originAirport, destinationAirport, 340, search.earliestDepartDate, maxStops),
      buildLeg("RETURN", "Delta", destinationAirport, originAirport, 340, returnDate, maxStops)
    ]
  };

  const fastRoundTrip: UnscoredItinerary = {
    id: "round-trip-united-fast",
    type: "ROUND_TRIP",
    totalPrice: fastRoundTripPrice,
    currency: "USD",
    savingsComparedToRoundTrip: null,
    summary: "Fast round-trip mock fare that is slightly over budget.",
    totalDurationMinutes: 660,
    carryOnIncluded: true,
    legs: [
      buildLeg("OUTBOUND", "United", originAirport, destinationAirport, 320, search.earliestDepartDate, 0),
      buildLeg("RETURN", "United", destinationAirport, originAirport, 320, returnDate, 0)
    ]
  };

  const splitOneWays: UnscoredItinerary = {
    id: "split-one-ways-jetblue-norse",
    type: "SPLIT_ONE_WAYS",
    totalPrice: splitTotalPrice,
    currency: "USD",
    savingsComparedToRoundTrip: roundTripPrice - splitTotalPrice,
    summary: "Split one-way mock fare using different airlines.",
    totalDurationMinutes: 900,
    carryOnIncluded: false,
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

  return [roundTrip, fastRoundTrip, splitOneWays];
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

function scoreFilterAndSortResults(results: UnscoredItinerary[], search: FlightSearchInput): MockItinerary[] {
  const allowedByStay = results.filter((result) => meetsStayRequirements(result, search));
  const maxStops = search.maxStops;
  const allowedByStops =
    maxStops === undefined
      ? allowedByStay
      : allowedByStay.filter((result) => result.legs.every((leg) => leg.stops <= maxStops));
  const shortestDuration = Math.min(...allowedByStops.map((result) => result.totalDurationMinutes));

  return allowedByStops
    .map((result) => addDealScore(result, search, shortestDuration))
    .filter((result) => result.dealScore >= MIN_VISIBLE_DEAL_SCORE && scorePrice(result.totalPrice, search.maxPrice) > 0)
    .sort((first, second) => second.dealScore - first.dealScore);
}

function addDealScore(
  itinerary: UnscoredItinerary,
  search: FlightSearchInput,
  shortestDuration: number
): MockItinerary {
  const dealScore =
    scorePrice(itinerary.totalPrice, search.maxPrice) +
    scoreDuration(itinerary.totalDurationMinutes, shortestDuration) +
    scoreStops(itinerary.legs.reduce((totalStops, leg) => totalStops + leg.stops, 0)) +
    scoreStayFit(itinerary, search) +
    scoreCarryOn(itinerary.carryOnIncluded) +
    scoreSplitTicketRisk(itinerary.type);

  return {
    ...itinerary,
    dealScore,
    qualityLabel: buildQualityLabel(dealScore),
    warning: buildWarning(itinerary, search)
  };
}

function scorePrice(totalPrice: number, maxPrice: number) {
  if (totalPrice <= maxPrice) {
    const savingsRatio = clamp((maxPrice - totalPrice) / maxPrice, 0, 0.4);
    return Math.round(240 + (savingsRatio / 0.4) * 110);
  }

  const amountOverBudget = totalPrice - maxPrice;
  return amountOverBudget <= MAX_PRICE_OVER_BUDGET
    ? Math.round(240 * clamp(1 - amountOverBudget / MAX_PRICE_OVER_BUDGET, 0, 1))
    : 0;
}

function scoreDuration(totalDurationMinutes: number, shortestDurationMinutes: number) {
  if (!Number.isFinite(shortestDurationMinutes) || shortestDurationMinutes <= 0) {
    return 300;
  }

  const extraDuration = totalDurationMinutes - shortestDurationMinutes;
  const score = 275 * clamp(1 - extraDuration / (shortestDurationMinutes * 2.5), 0.05, 1);

  return Math.round(score);
}

function scoreStops(totalStops: number) {
  if (totalStops === 0) {
    return 150;
  }

  if (totalStops === 1) {
    return 95;
  }

  if (totalStops === 2) {
    return 25;
  }

  return 5;
}

function scoreStayFit(itinerary: UnscoredItinerary, search: FlightSearchInput) {
  if (search.tripType === "ONE_WAY") {
    return 100;
  }

  const outboundDate = itinerary.legs.find((leg) => leg.direction === "OUTBOUND")?.departDate;
  const returnDate = itinerary.legs.find((leg) => leg.direction === "RETURN")?.departDate;

  if (!outboundDate || !returnDate || !search.minTripDays) {
    return 110;
  }

  const stayDays = differenceInDays(outboundDate, returnDate);
  const minTripDays = search.minTripDays;
  const targetMaxTripDays = getTargetMaxTripDays(search, minTripDays);

  if (stayDays <= targetMaxTripDays) {
    const range = Math.max(targetMaxTripDays - minTripDays, 1);
    return Math.round(100 + clamp((stayDays - minTripDays) / range, 0, 1) * 50);
  }

  const extraDays = stayDays - targetMaxTripDays;
  return Math.round(clamp(150 - extraDays * 15, 45, 150));
}

function meetsStayRequirements(itinerary: UnscoredItinerary, search: FlightSearchInput) {
  if (search.tripType === "ONE_WAY" || !search.minTripDays) {
    return true;
  }

  const stayDays = getStayDays(itinerary);

  if (stayDays === null) {
    return true;
  }

  if (stayDays < search.minTripDays) {
    return false;
  }

  return search.maxTripDays === undefined ? true : stayDays <= search.maxTripDays;
}

function getStayDays(itinerary: UnscoredItinerary) {
  const outboundDate = itinerary.legs.find((leg) => leg.direction === "OUTBOUND")?.departDate;
  const returnDate = itinerary.legs.find((leg) => leg.direction === "RETURN")?.departDate;

  if (!outboundDate || !returnDate) {
    return null;
  }

  return differenceInDays(outboundDate, returnDate);
}

function getTargetMaxTripDays(search: FlightSearchInput, minTripDays: number) {
  if (search.maxTripDays) {
    return search.maxTripDays;
  }

  if (search.latestReturnDate) {
    return Math.max(minTripDays, differenceInDays(search.earliestDepartDate, search.latestReturnDate));
  }

  return minTripDays;
}

function scoreCarryOn(carryOnIncluded: boolean) {
  return carryOnIncluded ? 50 : 10;
}

function scoreSplitTicketRisk(type: MockItinerary["type"]) {
  return type === "SPLIT_ONE_WAYS" ? 18 : 25;
}

function buildQualityLabel(dealScore: number) {
  if (dealScore >= 900) {
    return "Best overall";
  }

  if (dealScore >= 800) {
    return "Great value";
  }

  if (dealScore >= 700) {
    return "Strong option";
  }

  return "Good option";
}

function buildWarning(itinerary: UnscoredItinerary, search: FlightSearchInput) {
  const warnings = [];

  if (itinerary.totalPrice > search.maxPrice) {
    warnings.push(`Slightly over your target price by USD ${itinerary.totalPrice - search.maxPrice}.`);
  }

  if (itinerary.type === "SPLIT_ONE_WAYS") {
    warnings.push("Separate one-way tickets can have different baggage, cancellation, and change rules.");
  }

  if (!itinerary.carryOnIncluded) {
    warnings.push("Carry-on is not included in this mock fare.");
  }

  return warnings.length > 0 ? warnings.join(" ") : null;
}

function differenceInDays(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00.000Z`).getTime();
  const end = new Date(`${endDate}T00:00:00.000Z`).getTime();
  const millisecondsInDay = 24 * 60 * 60 * 1000;

  return Math.max(0, Math.round((end - start) / millisecondsInDay));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
