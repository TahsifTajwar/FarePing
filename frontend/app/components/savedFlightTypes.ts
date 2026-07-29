export type TripType = "ROUND_TRIP" | "ONE_WAY";

export type SavedSearch = {
  id: string;
  contactPhone: string | null;
  tripType: TripType;
  originAirports: string[];
  destinationAirports: string[];
  earliestDepartDate: string;
  latestDepartDate: string | null;
  latestReturnDate: string | null;
  minTripDays: number | null;
  maxTripDays: number | null;
  maxPrice: number;
  maxStops: number | null;
  active: boolean;
  createdAt: string;
  resultBatches?: SavedResultBatch[];
};

export type SavedResultBatch = {
  id: string;
  savedSearchId: string;
  checkedAt: string;
  bestPrice: number | null;
  itineraries: SavedItinerary[];
};

export type SavedItinerary = {
  id: string;
  type: "ROUND_TRIP" | "SPLIT_ONE_WAYS" | "ONE_WAY";
  totalPrice: number;
  currency: string;
  savingsComparedToRoundTrip: number | null;
  summary: string;
  totalDurationMinutes: number | null;
  dealScore: number | null;
  qualityLabel: string | null;
  warning: string | null;
  totalStops: number | null;
  legs: SavedItineraryLeg[];
};

export type SavedItineraryLeg = {
  id: string;
  direction: "OUTBOUND" | "RETURN";
  airline: string;
  originAirport: string;
  destinationAirport: string;
  price: number;
  departDate: string;
  durationMinutes: number | null;
  stops: number;
  bookingLink: string | null;
};

export const itineraryLabels = {
  ROUND_TRIP: "Round trip",
  SPLIT_ONE_WAYS: "Split one-ways",
  ONE_WAY: "One way"
};

export function formatDuration(totalMinutes: number | null) {
  if (!totalMinutes) {
    return "Duration unavailable";
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

export function formatStops(stops: number | null) {
  if (stops === null) {
    return "Stops unavailable";
  }

  if (stops === 0) {
    return "Nonstop";
  }

  if (stops === 1) {
    return "1 stop";
  }

  return `${stops} stops`;
}

export function formatShortDate(date: string) {
  const dateOnly = date.slice(0, 10);
  const parsedDate = new Date(`${dateOnly}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return dateOnly;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(parsedDate);
}

export function getSavedItineraryRoute(itinerary: SavedItinerary) {
  const firstLeg = itinerary.legs[0];

  if (!firstLeg) {
    return "Route unavailable";
  }

  if (itinerary.type === "ONE_WAY") {
    return `${firstLeg.originAirport} to ${firstLeg.destinationAirport}`;
  }

  return `${firstLeg.originAirport} to ${firstLeg.destinationAirport}, then back`;
}

export function getSavedAirlineSummary(itinerary: SavedItinerary) {
  return [...new Set(itinerary.legs.map((leg) => leg.airline))].join(" + ");
}
