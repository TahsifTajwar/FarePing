export type TripType = "ROUND_TRIP" | "ONE_WAY";

export type FlightSearchRequest = {
  tripType: TripType;
  originAirports: string[];
  destinationAirports: string[];
  earliestDepartDate: string;
  latestDepartDate?: string;
  earliestReturnDate?: string;
  latestReturnDate?: string;
  minTripDays?: number;
  maxTripDays?: number;
  maxPrice: number;
  maxStops?: number;
  contactPhone?: string;
};

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

export type Itinerary = {
  id: string;
  type: "ROUND_TRIP" | "SPLIT_ONE_WAYS" | "ONE_WAY";
  totalPrice: number;
  currency: "USD";
  savingsComparedToRoundTrip: number | null;
  summary: string;
  totalDurationMinutes: number;
  dealScore: number;
  qualityLabel: string;
  warning: string | null;
  carryOnIncluded: boolean | null;
  bookingTokens?: string[];
  legs: ItineraryLeg[];
};

export type SearchDiagnostics = {
  provider: string;
  requestedProvider: string;
  providerDiagnostics: {
    datePairsSearched?: {
      departureDate: string;
      returnDate?: string;
    }[];
    estimatedApiRequests?: number;
    apiRequestsMade?: number;
    rawItinerariesFound?: number;
    rawItinerariesByType?: Partial<Record<Itinerary["type"], number>>;
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
  } | null;
  scoringDiagnostics: {
    rawItinerariesReceived: number;
    rawItinerariesByType: Partial<Record<Itinerary["type"], number>>;
    removedByRouteRules?: number;
    removedByStayRules: number;
    removedByStopsRules: number;
    removedByLayoverRules?: number;
    scoredItineraries: number;
    hiddenByScoreOrPriceRules: number;
    visibleItineraries: number;
    visibleItinerariesByType: Partial<Record<Itinerary["type"], number>>;
    cheapestRawPrice: number | null;
    shortestRawDurationMinutes: number | null;
    minVisibleDealScore: number | null;
    maxPriceOverBudgetShown: number;
    topScores: {
      id: string;
      type: Itinerary["type"];
      totalPrice: number;
      totalDurationMinutes: number;
      dealScore: number;
      visible: boolean;
    }[];
  };
};

export type CurrentResultsSession = {
  requestBody: FlightSearchRequest;
  results: Itinerary[];
  diagnostics?: SearchDiagnostics;
  searchedAt: string;
};

export const currentResultsStorageKey = "fareping-current-results";
export const currentResultsBackupStorageKey = "fareping-current-results-auth-backup";

const currentResultsBackupMaxAgeMs = 24 * 60 * 60 * 1000;

type CurrentResultsBackup = {
  backedUpAt: string;
  currentResults: CurrentResultsSession;
};

export function persistCurrentResultsSession(currentResults: CurrentResultsSession) {
  const serializedResults = JSON.stringify(currentResults);
  sessionStorage.setItem(currentResultsStorageKey, serializedResults);
  writeCurrentResultsBackup(currentResults);
}

export function backupCurrentResultsForAuth() {
  const storedSession = sessionStorage.getItem(currentResultsStorageKey);
  if (!storedSession) return;

  try {
    const currentResults = JSON.parse(storedSession) as CurrentResultsSession;
    if (isValidCurrentResults(currentResults)) {
      writeCurrentResultsBackup(currentResults);
    }
  } catch {
    sessionStorage.removeItem(currentResultsStorageKey);
  }
}

export function readCurrentResultsSession() {
  const storedSession = sessionStorage.getItem(currentResultsStorageKey);

  if (storedSession) {
    try {
      const currentResults = JSON.parse(storedSession) as CurrentResultsSession;
      if (!isValidCurrentResults(currentResults)) {
        clearCurrentResultsSession();
        return null;
      }

      writeCurrentResultsBackup(currentResults);
      return currentResults;
    } catch {
      clearCurrentResultsSession();
      return null;
    }
  }

  const serializedBackup = localStorage.getItem(currentResultsBackupStorageKey);
  if (!serializedBackup) return null;

  try {
    const parsedBackup = JSON.parse(serializedBackup) as CurrentResultsBackup | CurrentResultsSession;
    const isTimestampedBackup = "currentResults" in parsedBackup;
    const currentResults = isTimestampedBackup ? parsedBackup.currentResults : parsedBackup;
    const backupTime = new Date(
      isTimestampedBackup ? parsedBackup.backedUpAt : currentResults.searchedAt
    ).getTime();

    if (
      !isValidCurrentResults(currentResults) ||
      !Number.isFinite(backupTime) ||
      Date.now() - backupTime > currentResultsBackupMaxAgeMs
    ) {
      clearCurrentResultsSession();
      return null;
    }

    sessionStorage.setItem(currentResultsStorageKey, JSON.stringify(currentResults));
    writeCurrentResultsBackup(currentResults);
    return currentResults;
  } catch {
    clearCurrentResultsSession();
    return null;
  }
}

export function clearCurrentResultsSession() {
  sessionStorage.removeItem(currentResultsStorageKey);
  localStorage.removeItem(currentResultsBackupStorageKey);
}

function writeCurrentResultsBackup(currentResults: CurrentResultsSession) {
  const backup: CurrentResultsBackup = {
    backedUpAt: new Date().toISOString(),
    currentResults
  };
  localStorage.setItem(currentResultsBackupStorageKey, JSON.stringify(backup));
}

function isValidCurrentResults(value: CurrentResultsSession) {
  return Boolean(
    value?.requestBody &&
    Array.isArray(value.results) &&
    Number.isFinite(new Date(value.searchedAt).getTime())
  );
}

export const itineraryLabels = {
  ROUND_TRIP: "Round trip",
  SPLIT_ONE_WAYS: "Split one-ways",
  ONE_WAY: "One way"
};

export function formatDuration(totalMinutes: number | null | undefined) {
  if (!totalMinutes) {
    return "Duration unavailable";
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

export function formatStops(stops: number) {
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

export function formatClockTime(time: string | null | undefined) {
  if (!time) {
    return "";
  }

  const [hourText, minuteText] = time.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return time;
  }

  const hour12 = hour % 12 || 12;
  const suffix = hour >= 12 ? "PM" : "AM";
  const paddedMinute = String(minute).padStart(2, "0");

  return `${hour12}:${paddedMinute} ${suffix}`;
}

export function formatTimeRange(departTime: string | null | undefined, arrivalTime: string | null | undefined) {
  const formattedDepartTime = formatClockTime(departTime);
  const formattedArrivalTime = formatClockTime(arrivalTime);

  if (formattedDepartTime && formattedArrivalTime) {
    return `${formattedDepartTime} -> ${formattedArrivalTime}`;
  }

  if (formattedDepartTime) {
    return `Leaves ${formattedDepartTime}`;
  }

  if (formattedArrivalTime) {
    return `Arrives ${formattedArrivalTime}`;
  }

  return "";
}

export function getItineraryRoute(itinerary: Itinerary) {
  const firstLeg = itinerary.legs[0];
  const lastLeg = itinerary.legs[itinerary.legs.length - 1];

  if (!firstLeg || !lastLeg) {
    return "Route unavailable";
  }

  if (itinerary.type === "ONE_WAY") {
    return `${firstLeg.originAirport} to ${firstLeg.destinationAirport}`;
  }

  return `${firstLeg.originAirport} to ${firstLeg.destinationAirport}, then back`;
}

export function getAirlineSummary(itinerary: Itinerary) {
  return [...new Set(itinerary.legs.map((leg) => leg.airline))].join(" + ");
}

export function getTotalStops(itinerary: Itinerary) {
  return Math.max(...itinerary.legs.map((leg) => leg.stops), 0);
}
