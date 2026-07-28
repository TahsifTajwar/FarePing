import {
  type FlightSearchInput,
  type Itinerary,
  type UnscoredItinerary
} from "./flightProviders/types.js";

const MAX_PRICE_OVER_BUDGET = 50;
const MIN_VISIBLE_DEAL_SCORE = 600;

export function scoreFilterAndSortResults(
  results: UnscoredItinerary[],
  search: FlightSearchInput
): Itinerary[] {
  const allowedByStay = results.filter((result) => meetsStayRequirements(result, search));
  const maxStops = search.maxStops;
  const allowedByStops =
    maxStops === undefined
      ? allowedByStay
      : allowedByStay.filter((result) => result.legs.every((leg) => leg.stops <= maxStops));
  const shortestDuration = Math.min(...allowedByStops.map((result) => result.totalDurationMinutes));
  const cheapestPrice = Math.min(...allowedByStops.map((result) => result.totalPrice));

  return allowedByStops
    .map((result) => addDealScore(result, search, shortestDuration, cheapestPrice))
    .filter(
      (result) =>
        result.dealScore >= MIN_VISIBLE_DEAL_SCORE &&
        scorePrice(result.totalPrice, search.maxPrice, cheapestPrice) > 0
    )
    .sort((first, second) => second.dealScore - first.dealScore);
}

function addDealScore(
  itinerary: UnscoredItinerary,
  search: FlightSearchInput,
  shortestDuration: number,
  cheapestPrice: number
): Itinerary {
  const dealScore =
    scorePrice(itinerary.totalPrice, search.maxPrice, cheapestPrice) +
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

function scorePrice(totalPrice: number, maxPrice: number, cheapestPrice: number) {
  if (!Number.isFinite(cheapestPrice) || cheapestPrice <= 0) {
    return 0;
  }

  if (totalPrice <= maxPrice) {
    const budgetScore = 210 * clamp(1 - totalPrice / maxPrice, 0, 1);
    const cheapestResultScore = 140 * clamp(cheapestPrice / totalPrice, 0, 1);

    return Math.round(budgetScore + cheapestResultScore);
  }

  const amountOverBudget = totalPrice - maxPrice;
  return amountOverBudget <= MAX_PRICE_OVER_BUDGET
    ? Math.round(240 * clamp(1 - amountOverBudget / MAX_PRICE_OVER_BUDGET, 0, 1))
    : 0;
}

function scoreDuration(totalDurationMinutes: number, shortestDurationMinutes: number) {
  if (!Number.isFinite(shortestDurationMinutes) || shortestDurationMinutes <= 0) {
    return 275;
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

function scoreSplitTicketRisk(type: Itinerary["type"]) {
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
    warnings.push("Carry-on is not included in this fare.");
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
