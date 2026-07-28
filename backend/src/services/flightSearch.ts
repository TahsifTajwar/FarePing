import { env } from "../config/env.js";
import { amadeusFlightProvider } from "./flightProviders/amadeusFlightProvider.js";
import { mockFlightProvider } from "./flightProviders/mockFlightProvider.js";
import { serpApiFlightProvider } from "./flightProviders/serpApiFlightProvider.js";
import {
  type FlightProvider,
  type FlightSearchInput,
  type Itinerary
} from "./flightProviders/types.js";
import { scoreFilterAndSortResults } from "./flightScoring.js";

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

  return scoreFilterAndSortResults(providerResult.itineraries, search);
}
