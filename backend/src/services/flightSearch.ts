import { env } from "../config/env.js";
import { amadeusFlightProvider } from "./flightProviders/amadeusFlightProvider.js";
import { mockFlightProvider } from "./flightProviders/mockFlightProvider.js";
import { serpApiFlightProvider } from "./flightProviders/serpApiFlightProvider.js";
import {
  type FlightProvider,
  type FlightSearchInput,
  type Itinerary,
  type UnscoredItinerary
} from "./flightProviders/types.js";
import {
  scoreFilterAndSortResults,
  scoreFilterAndSortResultsWithDiagnostics
} from "./flightScoring.js";

const providers: Record<string, FlightProvider> = {
  amadeus: amadeusFlightProvider,
  mock: mockFlightProvider,
  serpapi: serpApiFlightProvider
};

export async function searchFlights(
  search: FlightSearchInput,
  providerName = env.FLIGHT_PROVIDER
): Promise<Itinerary[]> {
  const provider = providers[providerName];

  if (!provider) {
    throw new Error(`Unsupported flight provider: ${providerName}`);
  }

  const providerResult = await provider.searchFlights(search);
  const routeFilteredItineraries = filterItinerariesByRequestedAirports(
    providerResult.itineraries,
    search
  );

  return scoreFilterAndSortResults(routeFilteredItineraries, search);
}

export async function searchFlightsWithDiagnostics(
  search: FlightSearchInput,
  providerName = env.FLIGHT_PROVIDER
) {
  const provider = providers[providerName];

  if (!provider) {
    throw new Error(`Unsupported flight provider: ${providerName}`);
  }

  const providerResult = await provider.searchFlights(search);
  const routeFilteredItineraries = filterItinerariesByRequestedAirports(
    providerResult.itineraries,
    search
  );
  const removedByRouteRules = providerResult.itineraries.length - routeFilteredItineraries.length;
  const scored = scoreFilterAndSortResultsWithDiagnostics(routeFilteredItineraries, search);

  return {
    results: scored.results,
    diagnostics: {
      provider: providerResult.provider,
      requestedProvider: providerName,
      providerDiagnostics: providerResult.diagnostics ?? null,
      scoringDiagnostics: {
        ...scored.diagnostics,
        removedByRouteRules
      }
    }
  };
}

function filterItinerariesByRequestedAirports(
  itineraries: UnscoredItinerary[],
  search: FlightSearchInput
) {
  const originAirports = new Set(search.originAirports);
  const destinationAirports = new Set(search.destinationAirports);

  return itineraries.filter((itinerary) => {
    const outboundLeg = itinerary.legs.find((leg) => leg.direction === "OUTBOUND");

    if (
      !outboundLeg ||
      !originAirports.has(outboundLeg.originAirport) ||
      !destinationAirports.has(outboundLeg.destinationAirport)
    ) {
      return false;
    }

    if (search.tripType === "ONE_WAY") {
      return itinerary.type === "ONE_WAY";
    }

    const returnLeg = itinerary.legs.find((leg) => leg.direction === "RETURN");

    return Boolean(
      returnLeg &&
        destinationAirports.has(returnLeg.originAirport) &&
        originAirports.has(returnLeg.destinationAirport)
    );
  });
}
