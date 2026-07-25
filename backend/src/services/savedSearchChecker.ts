import { prisma } from "../db/prisma.js";
import {
  type FlightSearchInput,
  type MockItinerary,
  runMockFlightSearch
} from "./mockFlightSearch.js";

type SavedSearchForCheck = {
  tripType: "ROUND_TRIP" | "ONE_WAY";
  id: string;
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

  for (const savedSearch of activeSavedSearches) {
    const resultBatch = await checkSavedSearch(savedSearch);
    resultBatches.push(resultBatch);
  }

  return {
    checkedCount: activeSavedSearches.length,
    batchesCreated: resultBatches.length,
    bestPrices: resultBatches.map((resultBatch) => ({
      savedSearchId: resultBatch.savedSearchId,
      resultBatchId: resultBatch.id,
      bestPrice: resultBatch.bestPrice
    }))
  };
}

export async function checkSavedSearch(savedSearch: SavedSearchForCheck) {
  const mockResults = runMockFlightSearch(buildFlightSearchInput(savedSearch));

  return prisma.searchResultBatch.create({
    data: {
      savedSearchId: savedSearch.id,
      bestPrice: mockResults[0]?.totalPrice ?? null,
      itineraries: {
        create: mockResults.map((itinerary) => buildItineraryCreateInput(itinerary))
      }
    },
    include: {
      itineraries: {
        include: {
          legs: true
        },
        orderBy: {
          totalPrice: "asc"
        }
      }
    }
  });
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

function buildItineraryCreateInput(itinerary: MockItinerary) {
  return {
    type: itinerary.type,
    totalPrice: itinerary.totalPrice,
    currency: itinerary.currency,
    savingsComparedToRoundTrip: itinerary.savingsComparedToRoundTrip,
    summary: itinerary.summary,
    totalStops: itinerary.legs.reduce((totalStops, leg) => totalStops + leg.stops, 0),
    legs: {
      create: itinerary.legs.map((leg) => ({
        direction: leg.direction,
        airline: leg.airline,
        originAirport: leg.originAirport,
        destinationAirport: leg.destinationAirport,
        price: leg.price,
        departDate: toDate(leg.departDate),
        stops: leg.stops,
        bookingLink: leg.bookingLink
      }))
    }
  };
}

function toDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}
