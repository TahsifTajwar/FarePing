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

export type ItinerarySegment = {
  segmentOrder: number;
  airline: string;
  flightNumber?: string;
  originAirport: string;
  destinationAirport: string;
  departDate: string;
  departTime?: string;
  arrivalDate?: string;
  arrivalTime?: string;
  durationMinutes?: number;
  layoverAfterMinutes?: number;
};

export type ItineraryLeg = {
  direction: "OUTBOUND" | "RETURN";
  airline: string;
  originAirport: string;
  destinationAirport: string;
  price: number;
  departDate: string;
  departTime?: string;
  arrivalTime?: string;
  durationMinutes?: number;
  stops: number;
  bookingLink: string;
  segments?: ItinerarySegment[];
};

export type UnscoredItinerary = {
  id: string;
  type: ItineraryType;
  totalPrice: number;
  currency: "USD";
  savingsComparedToRoundTrip: number | null;
  summary: string;
  totalDurationMinutes: number;
  carryOnIncluded: boolean | null;
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
  diagnostics?: FlightProviderDiagnostics;
};

export type FlightProviderDiagnostics = {
  datePairsSearched?: {
    departureDate: string;
    returnDate?: string;
  }[];
  apiRequestsMade?: number;
  rawItinerariesFound?: number;
  rawItinerariesByType?: Partial<Record<ItineraryType, number>>;
  providerErrors?: string[];
  serpApiRoundTripDetails?: {
    outboundOptionsFound: number;
    outboundOptionsWithReturnToken: number;
    outboundOptionsFollowed: number;
    returnTokenSearchesMade: number;
    returnOptionsFound: number;
    roundTripItinerariesBuilt: number;
  };
  serpApiSplitOneWayDetails?: {
    outboundOptionsUsed: number;
    returnOptionsUsed: number;
    splitItinerariesBuilt: number;
  };
};

export type FlightProvider = {
  name: string;
  searchFlights: (search: FlightSearchInput) => Promise<FlightProviderResult>;
};
