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

export type ItineraryType = "ROUND_TRIP" | "SPLIT_ONE_WAYS" | "ONE_WAY";

export type ItineraryLeg = {
  direction: "OUTBOUND" | "RETURN";
  airline: string;
  originAirport: string;
  destinationAirport: string;
  price: number;
  departDate: string;
  durationMinutes?: number;
  stops: number;
  bookingLink: string;
};

export type UnscoredItinerary = {
  id: string;
  type: ItineraryType;
  totalPrice: number;
  currency: "USD";
  savingsComparedToRoundTrip: number | null;
  summary: string;
  totalDurationMinutes: number;
  carryOnIncluded: boolean;
  legs: ItineraryLeg[];
};

export type Itinerary = UnscoredItinerary & {
  dealScore: number;
  qualityLabel: string;
  warning: string | null;
};

export type FlightProviderResult = {
  provider: string;
  itineraries: UnscoredItinerary[];
};

export type FlightProvider = {
  name: string;
  searchFlights: (search: FlightSearchInput) => Promise<FlightProviderResult>;
};
