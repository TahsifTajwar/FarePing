import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import {
  type FlightSearchInput,
  type Itinerary
} from "./flightProviders/types.js";
import { searchFlights } from "./flightSearch.js";
import { maybeCreateNotification } from "./notificationDecision.js";

type SavedSearchForCheck = {
  tripType: "ROUND_TRIP" | "ONE_WAY";
  id: string;
  userId: string | null;
  contactPhone: string | null;
  originAirports: string[];
  destinationAirports: string[];
  earliestDepartDate: Date;
  latestDepartDate: Date | null;
  latestReturnDate: Date | null;
  minTripDays: number | null;
  maxTripDays: number | null;
  maxPrice: number;
  maxStops: number | null;
};

export async function checkAllActiveSavedSearches() {
  const activeSavedSearches = await prisma.savedSearch.findMany({
    where: {
      active: true
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  const resultBatches = [];
  const notificationDecisions = [];

  for (const savedSearch of activeSavedSearches) {
    const { resultBatch, notificationDecision } = await checkSavedSearch(savedSearch);
    resultBatches.push(resultBatch);
    notificationDecisions.push(notificationDecision);
  }

  return {
    checkedCount: activeSavedSearches.length,
    batchesCreated: resultBatches.length,
    notificationsCreated: notificationDecisions.filter((decision) => decision.created).length,
    smsSent: notificationDecisions.filter((decision) => decision.smsResult?.sent).length,
    bestPrices: resultBatches.map((resultBatch) => ({
      savedSearchId: resultBatch.savedSearchId,
      resultBatchId: resultBatch.id,
      bestPrice: resultBatch.bestPrice
    }))
  };
}

export async function checkSavedSearch(
  savedSearch: SavedSearchForCheck,
  providerName = env.SCHEDULED_FLIGHT_PROVIDER
) {
  const flightResults = await searchFlights(buildFlightSearchInput(savedSearch), providerName);
  const resultBatch = await saveSearchResultBatch(savedSearch.id, flightResults);

  const notificationDecision = await maybeCreateNotification(savedSearch, resultBatch);

  return {
    resultBatch,
    notificationDecision
  };
}

export async function saveSearchResultBatch(savedSearchId: string, flightResults: Itinerary[]) {
  const resultBatch = await prisma.searchResultBatch.create({
    data: {
      savedSearchId,
      bestPrice: flightResults[0]?.totalPrice ?? null,
      itineraries: {
        create: flightResults.map((itinerary) => buildItineraryCreateInput(itinerary))
      }
    },
    include: {
      itineraries: {
        include: {
          legs: true
        },
        orderBy: {
          dealScore: "desc"
        }
      }
    }
  });

  return resultBatch;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildFlightSearchInput(savedSearch: SavedSearchForCheck): FlightSearchInput {
  return {
    tripType: savedSearch.tripType,
    originAirports: savedSearch.originAirports,
    destinationAirports: savedSearch.destinationAirports,
    earliestDepartDate: formatDate(savedSearch.earliestDepartDate),
    ...(savedSearch.latestDepartDate ? { latestDepartDate: formatDate(savedSearch.latestDepartDate) } : {}),
    ...(savedSearch.latestReturnDate ? { latestReturnDate: formatDate(savedSearch.latestReturnDate) } : {}),
    ...(savedSearch.minTripDays ? { minTripDays: savedSearch.minTripDays } : {}),
    ...(savedSearch.maxTripDays ? { maxTripDays: savedSearch.maxTripDays } : {}),
    maxPrice: savedSearch.maxPrice,
    ...(savedSearch.maxStops !== null ? { maxStops: savedSearch.maxStops } : {})
  };
}

function buildItineraryCreateInput(itinerary: Itinerary) {
  return {
    type: itinerary.type,
    totalPrice: itinerary.totalPrice,
    currency: itinerary.currency,
    savingsComparedToRoundTrip: itinerary.savingsComparedToRoundTrip,
    summary: itinerary.summary,
    totalDurationMinutes: itinerary.totalDurationMinutes,
    totalStops: itinerary.legs.reduce((totalStops, leg) => totalStops + leg.stops, 0),
    dealScore: itinerary.dealScore,
    qualityLabel: itinerary.qualityLabel,
    warning: itinerary.warning,
    legs: {
      create: itinerary.legs.map((leg) => ({
        direction: leg.direction,
        airline: leg.airline,
        originAirport: leg.originAirport,
        destinationAirport: leg.destinationAirport,
        price: leg.price,
        departDate: toDate(leg.departDate),
        departTime: leg.departTime ?? null,
        arrivalTime: leg.arrivalTime ?? null,
        durationMinutes: leg.durationMinutes,
        stops: leg.stops,
        bookingLink: leg.bookingLink
      }))
    }
  };
}

function toDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}
