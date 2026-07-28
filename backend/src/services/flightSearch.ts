import { env } from "../config/env.js";
import { mockFlightProvider } from "./flightProviders/mockFlightProvider.js";
import {
  type FlightProvider,
  type FlightSearchInput,
  type Itinerary
} from "./flightProviders/types.js";
import { scoreFilterAndSortResults } from "./flightScoring.js";

const providers: Record<string, FlightProvider> = {
  mock: mockFlightProvider
};

export async function searchFlights(search: FlightSearchInput): Promise<Itinerary[]> {
  const provider = providers[env.FLIGHT_PROVIDER];

  if (!provider) {
    throw new Error(`Unsupported flight provider: ${env.FLIGHT_PROVIDER}`);
  }

  const providerResult = await provider.searchFlights(search);

  return scoreFilterAndSortResults(providerResult.itineraries, search);
}
