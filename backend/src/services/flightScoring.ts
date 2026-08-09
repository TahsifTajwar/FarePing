import {
  type FlightSearchInput,
  type Itinerary,
  type ItineraryType,
  type UnscoredItinerary
} from "./flightProviders/types.js";
import { env } from "../config/env.js";

const MAX_PRICE_OVER_BUDGET = 50;

export function scoreFilterAndSortResults(
  results: UnscoredItinerary[],
  search: FlightSearchInput
): Itinerary[] {
  return scoreFilterAndSortResultsWithDiagnostics(results, search).results;
}

export function scoreFilterAndSortResultsWithDiagnostics(
  results: UnscoredItinerary[],
  search: FlightSearchInput
) {
  const allowedByStay = results.filter((result) => meetsStayRequirements(result, search));
  const maxStops = search.maxStops;
  const allowedByStops =
    maxStops === undefined
      ? allowedByStay
      : allowedByStay.filter((result) => result.legs.every((leg) => leg.stops <= maxStops));
  const shortestDuration = Math.min(...allowedByStops.map((result) => result.totalDurationMinutes));
  const cheapestPrice = Math.min(...allowedByStops.map((result) => result.totalPrice));

  const scoredResults = allowedByStops
    .map((result) => addDealScore(result, search, shortestDuration, cheapestPrice))
  const visibleResults = scoredResults.filter(
      (result) =>
      result.dealScore >= env.MIN_VISIBLE_DEAL_SCORE &&
      scorePrice(result.totalPrice, search.maxPrice, cheapestPrice) > 0
  );
  const sortedVisibleResults = sortVisibleResults(visibleResults, search);
  const topScoredResults = [...scoredResults].sort((first, second) => second.dealScore - first.dealScore);

  return {
    results: sortedVisibleResults,
    diagnostics: {
      rawItinerariesReceived: results.length,
      rawItinerariesByType: countByType(results),
      removedByStayRules: results.length - allowedByStay.length,
      removedByStopsRules: allowedByStay.length - allowedByStops.length,
      scoredItineraries: scoredResults.length,
      hiddenByScoreOrPriceRules: scoredResults.length - visibleResults.length,
      visibleItineraries: visibleResults.length,
      visibleItinerariesByType: countByType(visibleResults),
      cheapestRawPrice: Number.isFinite(cheapestPrice) ? cheapestPrice : null,
      shortestRawDurationMinutes: Number.isFinite(shortestDuration) ? shortestDuration : null,
      minVisibleDealScore: env.MIN_VISIBLE_DEAL_SCORE,
      maxPriceOverBudgetShown: MAX_PRICE_OVER_BUDGET,
      topScores: topScoredResults
        .slice(0, 10)
        .map((result) => ({
          id: result.id,
          type: result.type,
          totalPrice: result.totalPrice,
          totalDurationMinutes: result.totalDurationMinutes,
          dealScore: result.dealScore,
          visible: sortedVisibleResults.some((visibleResult) => visibleResult.id === result.id)
        }))
    }
  };
}

function countByType(results: { type: ItineraryType }[]) {
  return results.reduce<Partial<Record<ItineraryType, number>>>((counts, result) => {
    counts[result.type] = (counts[result.type] ?? 0) + 1;
    return counts;
  }, {});
}

function sortVisibleResults(results: Itinerary[], search: FlightSearchInput) {
  const scoreSortedResults = [...results].sort((first, second) =>
    compareItineraries(first, second, search)
  );

  if (search.tripType !== "ROUND_TRIP") {
    return scoreSortedResults;
  }

  const prioritizedResults: Itinerary[] = [];

  addUniqueResult(prioritizedResults, scoreSortedResults[0]);
  addUniqueResult(
    prioritizedResults,
    scoreSortedResults.find((result) => result.type === "ROUND_TRIP")
  );

  for (const result of scoreSortedResults) {
    addUniqueResult(prioritizedResults, result);
  }

  return prioritizedResults;
}

function compareItineraries(first: Itinerary, second: Itinerary, search: FlightSearchInput) {
  const firstOverBudget = first.totalPrice > search.maxPrice;
  const secondOverBudget = second.totalPrice > search.maxPrice;

  if (firstOverBudget !== secondOverBudget) {
    return firstOverBudget ? 1 : -1;
  }

  if (search.tripType === "ROUND_TRIP") {
    const scoreDifference = second.dealScore - first.dealScore;
    const closeEnoughToPreferRoundTrip = Math.abs(scoreDifference) <= 35;

    if (closeEnoughToPreferRoundTrip && first.type !== second.type) {
      if (first.type === "ROUND_TRIP") {
        return -1;
      }

      if (second.type === "ROUND_TRIP") {
        return 1;
      }
    }
  }

  if (first.dealScore !== second.dealScore) {
    return second.dealScore - first.dealScore;
  }

  if (first.totalPrice !== second.totalPrice) {
    return first.totalPrice - second.totalPrice;
  }

  return first.totalDurationMinutes - second.totalDurationMinutes;
}

function addUniqueResult(results: Itinerary[], nextResult: Itinerary | undefined) {
  if (!nextResult) {
    return;
  }

  if (!results.some((result) => result.id === nextResult.id)) {
    results.push(nextResult);
  }
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
    if (totalPrice === cheapestPrice) {
      return 350;
    }

    const priceRange = Math.max(maxPrice - cheapestPrice, 1);
    const relativeSavingsScore = 130 * clamp((maxPrice - totalPrice) / priceRange, 0, 1);
    const budgetComfortScore = 40 * clamp((maxPrice - totalPrice) / maxPrice, 0, 1);

    return Math.round(180 + relativeSavingsScore + budgetComfortScore);
  }

  const amountOverBudget = totalPrice - maxPrice;
  return amountOverBudget <= MAX_PRICE_OVER_BUDGET
    ? Math.round(120 * clamp(1 - amountOverBudget / MAX_PRICE_OVER_BUDGET, 0, 1))
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

function scoreCarryOn(carryOnIncluded: boolean | null) {
  if (carryOnIncluded === true) {
    return 50;
  }

  if (carryOnIncluded === false) {
    return 10;
  }

  return 30;
}

function scoreSplitTicketRisk(type: Itinerary["type"]) {
  if (type === "SPLIT_ONE_WAYS") {
    return 0;
  }

  return 25;
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

  if (itinerary.carryOnIncluded === false) {
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
