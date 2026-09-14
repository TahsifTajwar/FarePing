import { env } from "../../config/env.js";
import { sumJourneyDurationMinutes } from "../flightDuration.js";
import {
  type FlightProvider,
  type ItineraryLeg,
  type ItineraryType,
  type UnscoredItinerary
} from "./types.js";
import { buildSerpApiSearchPlan } from "./serpApiSearchPlan.js";

type SerpApiFlightResponse = {
  search_metadata?: {
    google_flights_url?: string;
  };
  best_flights?: SerpApiFlightResult[];
  other_flights?: SerpApiFlightResult[];
  booking_options?: SerpApiBookingOption[];
  error?: string;
};

export type SerpApiBookingOptionPart = {
  book_with?: string;
  price?: number;
};

export type SerpApiBookingOption = {
  together?: SerpApiBookingOptionPart;
  departing?: SerpApiBookingOptionPart;
  returning?: SerpApiBookingOptionPart;
};

export type VerifiedBookingPrice = {
  totalPrice: number;
  currency: "USD";
  sellers: string[];
  requestsMade: number;
};

export type SerpApiBookingSelection = {
  bookingToken: string;
  tripType: "ROUND_TRIP" | "ONE_WAY";
  originAirport: string;
  destinationAirport: string;
  departureDate: string;
  returnDate?: string;
};

type SerpApiFlightResult = {
  flights?: SerpApiFlightSegment[];
  layovers?: {
    id?: string;
    duration?: number;
  }[];
  total_duration?: number;
  price?: number;
  type?: string;
  extensions?: string[];
  booking_token?: string;
  departure_token?: string;
};

type SerpApiFlightSegment = {
  departure_airport?: {
    id?: string;
    time?: string;
  };
  arrival_airport?: {
    id?: string;
    time?: string;
  };
  duration?: number;
  airline?: string;
  flight_number?: string;
  extensions?: string[];
};

type SerpApiSearchParams = {
  tripType: "ROUND_TRIP" | "ONE_WAY";
  originAirports: string[];
  destinationAirports: string[];
  departureDate: string;
  returnDate?: string;
  departureToken?: string;
  maxPrice: number;
  maxStops?: number;
};

type RoundTripBuildDiagnostics = {
  outboundOptionsFound: number;
  outboundOptionsWithReturnToken: number;
  outboundOptionsFollowed: number;
  returnTokenSearchesMade: number;
  returnOptionsFound: number;
  roundTripItinerariesBuilt: number;
};

type SplitOneWayBuildResult = {
  itineraries: UnscoredItinerary[];
  diagnostics: {
    outboundOptionsUsed: number;
    returnOptionsUsed: number;
    splitItinerariesBuilt: number;
  };
};

export const serpApiFlightProvider: FlightProvider = {
  name: "serpapi",
  async searchFlights(search) {
    const searchPlan = buildSerpApiSearchPlan(search, {
      maxDatePairs: env.MAX_SERPAPI_DATE_PAIRS,
      roundTripOutboundOptions: env.SERPAPI_ROUND_TRIP_OUTBOUND_OPTIONS,
      compareSplitOneWays: env.SERPAPI_COMPARE_SPLIT_ONE_WAYS,
      maxRequests: env.MAX_SERPAPI_REQUESTS_PER_SEARCH
    });

    if (search.tripType === "ONE_WAY") {
      const itineraries: UnscoredItinerary[] = [];
      const providerErrors: string[] = [];
      let apiRequestsMade = 0;

      for (const departureDate of searchPlan.departureDates) {
        try {
          const response = await fetchGoogleFlights({
            tripType: "ONE_WAY",
            originAirports: search.originAirports,
            destinationAirports: search.destinationAirports,
            departureDate,
            maxPrice: search.maxPrice + 50,
            maxStops: search.maxStops
          });
          apiRequestsMade += 1;
          itineraries.push(...mapResponseToItineraries(response, "ONE_WAY"));
        } catch (error) {
          apiRequestsMade += 1;
          providerErrors.push(getProviderErrorMessage(error));
        }
      }

      if (itineraries.length === 0 && providerErrors.length > 0) {
        throw new Error(providerErrors[0]);
      }

      return {
        provider: this.name,
        itineraries: dedupeItineraries(itineraries),
        diagnostics: {
          datePairsSearched: searchPlan.departureDates.map((departureDate) => ({ departureDate })),
          estimatedApiRequests: searchPlan.estimatedApiRequests,
          apiRequestsMade,
          rawItinerariesFound: itineraries.length,
          rawItinerariesByType: {
            ONE_WAY: itineraries.length
          },
          providerErrors
        }
      };
    }

    if (!search.latestReturnDate) {
      throw new Error("latestReturnDate is required before searching SerpApi round-trip flights.");
    }

    const datePairs = searchPlan.datePairs;
    const itineraries: UnscoredItinerary[] = [];
    const providerErrors: string[] = [];
    const roundTripDetails: RoundTripBuildDiagnostics = {
      outboundOptionsFound: 0,
      outboundOptionsWithReturnToken: 0,
      outboundOptionsFollowed: 0,
      returnTokenSearchesMade: 0,
      returnOptionsFound: 0,
      roundTripItinerariesBuilt: 0
    };
    const splitOneWayDetails = {
      outboundOptionsUsed: 0,
      returnOptionsUsed: 0,
      splitItinerariesBuilt: 0
    };
    let apiRequestsMade = 0;

    for (const datePair of datePairs) {
      const roundTripSearchParams = {
        tripType: "ROUND_TRIP" as const,
        originAirports: search.originAirports,
        destinationAirports: search.destinationAirports,
        departureDate: datePair.departureDate,
        returnDate: datePair.returnDate,
        maxPrice: search.maxPrice + 50,
        maxStops: search.maxStops
      };

      try {
        const roundTripOutboundResponse = await fetchGoogleFlights(roundTripSearchParams);
        apiRequestsMade += 1;

        const roundTripBuild = await buildRoundTripItineraries(
          roundTripOutboundResponse,
          roundTripSearchParams
        );
        apiRequestsMade += roundTripBuild.apiRequestsMade;
        addRoundTripDiagnostics(roundTripDetails, roundTripBuild.diagnostics);
        itineraries.push(...roundTripBuild.itineraries);
      } catch (error) {
        providerErrors.push(getProviderErrorMessage(error));
      }

      if (env.SERPAPI_COMPARE_SPLIT_ONE_WAYS) {
        const [outboundResult, returnResult] = await Promise.allSettled([
          fetchGoogleFlights({
            tripType: "ONE_WAY" as const,
            originAirports: search.originAirports,
            destinationAirports: search.destinationAirports,
            departureDate: datePair.departureDate,
            maxPrice: search.maxPrice + 50,
            maxStops: search.maxStops
          }),
          fetchGoogleFlights({
            tripType: "ONE_WAY" as const,
            originAirports: search.destinationAirports,
            destinationAirports: search.originAirports,
            departureDate: datePair.returnDate,
            maxPrice: search.maxPrice + 50,
            maxStops: search.maxStops
          })
        ]);
        apiRequestsMade += 2;

        if (outboundResult.status === "fulfilled" && returnResult.status === "fulfilled") {
          const splitBuild = buildSplitOneWayItineraries(outboundResult.value, returnResult.value);
          splitOneWayDetails.outboundOptionsUsed += splitBuild.diagnostics.outboundOptionsUsed;
          splitOneWayDetails.returnOptionsUsed += splitBuild.diagnostics.returnOptionsUsed;
          splitOneWayDetails.splitItinerariesBuilt += splitBuild.diagnostics.splitItinerariesBuilt;
          itineraries.push(...splitBuild.itineraries);
        } else {
          if (outboundResult.status === "rejected") {
            providerErrors.push(getProviderErrorMessage(outboundResult.reason));
          }

          if (returnResult.status === "rejected") {
            providerErrors.push(getProviderErrorMessage(returnResult.reason));
          }
        }
      }
    }

    if (itineraries.length === 0 && providerErrors.length > 0) {
      throw new Error(providerErrors[0]);
    }

    return {
      provider: this.name,
      itineraries: dedupeItineraries(itineraries),
      diagnostics: {
        datePairsSearched: datePairs,
        estimatedApiRequests: searchPlan.estimatedApiRequests,
        apiRequestsMade,
        rawItinerariesFound: itineraries.length,
        rawItinerariesByType: countItinerariesByType(itineraries),
        providerErrors,
        serpApiRoundTripDetails: roundTripDetails,
        serpApiSplitOneWayDetails: splitOneWayDetails
      }
    };
  }
};

async function fetchGoogleFlights(params: SerpApiSearchParams) {
  if (!env.SERPAPI_API_KEY) {
    throw new Error("SerpApi key is missing. Add SERPAPI_API_KEY to backend/.env.");
  }

  const query = new URLSearchParams({
    engine: "google_flights",
    api_key: env.SERPAPI_API_KEY,
    departure_id: params.originAirports.join(","),
    arrival_id: params.destinationAirports.join(","),
    outbound_date: params.departureDate,
    currency: "USD",
    gl: "us",
    hl: "en",
    type: params.tripType === "ROUND_TRIP" ? "1" : "2",
    sort_by: "2",
    no_cache: "false"
  });

  if (env.SERPAPI_SHOW_HIDDEN) {
    query.set("show_hidden", "true");
  }

  if (params.returnDate) {
    query.set("return_date", params.returnDate);
  }

  if (params.departureToken) {
    query.set("departure_token", params.departureToken);
  }

  const stops = mapMaxStops(params.maxStops);

  if (stops) {
    query.set("stops", stops);
  }

  const response = await fetch(`${env.SERPAPI_BASE_URL}/search.json?${query.toString()}`);

  if (!response.ok) {
    throw new Error(`SerpApi flight search failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as SerpApiFlightResponse;

  if (data.error) {
    throw new Error(`SerpApi flight search failed: ${data.error}`);
  }

  return data;
}

export async function verifySerpApiBookingPrice(
  bookingSelections: SerpApiBookingSelection[]
): Promise<VerifiedBookingPrice> {
  if (bookingSelections.length === 0 || bookingSelections.length > 2) {
    throw new Error("Price verification requires one itinerary selection, or two for split tickets.");
  }

  const verifiedParts = await Promise.all(
    bookingSelections.map(async (selection) => {
      const response = await fetchBookingOptions(selection);
      const lowestOption = getLowestBookingOption(response.booking_options ?? []);

      if (!lowestOption) {
        throw new Error("No currently bookable price was returned for this itinerary.");
      }

      return lowestOption;
    })
  );

  return {
    totalPrice: verifiedParts.reduce((total, option) => total + option.price, 0),
    currency: "USD",
    sellers: verifiedParts.map((option) => option.seller),
    requestsMade: bookingSelections.length
  };
}

async function fetchBookingOptions(selection: SerpApiBookingSelection) {
  if (!env.SERPAPI_API_KEY) {
    throw new Error("SerpApi key is missing. Add SERPAPI_API_KEY to backend/.env.");
  }

  const query = buildSerpApiBookingQuery(selection, env.SERPAPI_API_KEY);
  const response = await fetch(`${env.SERPAPI_BASE_URL}/search.json?${query.toString()}`);

  if (!response.ok) {
    const detail = await getSerpApiResponseError(response);
    throw new Error(
      `SerpApi booking verification failed (${response.status})${detail ? `: ${detail}` : "."}`
    );
  }

  const data = (await response.json()) as SerpApiFlightResponse;

  if (data.error) {
    throw new Error(`SerpApi booking verification failed: ${data.error}`);
  }

  return data;
}

export function buildSerpApiBookingQuery(
  selection: SerpApiBookingSelection,
  apiKey: string
) {
  const query = new URLSearchParams({
    engine: "google_flights",
    api_key: apiKey,
    booking_token: selection.bookingToken,
    departure_id: selection.originAirport,
    arrival_id: selection.destinationAirport,
    outbound_date: selection.departureDate,
    type: selection.tripType === "ROUND_TRIP" ? "1" : "2",
    currency: "USD",
    gl: "us",
    hl: "en",
    no_cache: "false"
  });

  if (selection.returnDate) {
    query.set("return_date", selection.returnDate);
  }

  return query;
}

async function getSerpApiResponseError(response: Response) {
  const responseText = await response.text();

  try {
    const parsed = JSON.parse(responseText) as { error?: unknown; message?: unknown };
    const detail = typeof parsed.error === "string" ? parsed.error : parsed.message;
    return typeof detail === "string" ? detail.slice(0, 300) : "";
  } catch {
    return responseText.trim().slice(0, 300);
  }
}

function getBookingOptionPrice(option: SerpApiBookingOption) {
  if (option.together?.price) {
    return {
      price: option.together.price,
      seller: option.together.book_with ?? "Booking partner"
    };
  }

  if (option.departing?.price && option.returning?.price) {
    return {
      price: option.departing.price + option.returning.price,
      seller:
        [option.departing.book_with, option.returning.book_with].filter(Boolean).join(" + ") ||
        "Booking partners"
    };
  }

  return null;
}

export function getLowestBookingOption(options: SerpApiBookingOption[]) {
  return options
    .map(getBookingOptionPrice)
    .filter((option): option is { price: number; seller: string } => Boolean(option))
    .sort((first, second) => first.price - second.price)[0] ?? null;
}

function getProviderErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "SerpApi flight search failed.";
}

function mapResponseToItineraries(
  response: SerpApiFlightResponse,
  itineraryType: ItineraryType,
  returnDate?: string
): UnscoredItinerary[] {
  return dedupeItineraries(
    getFlightResults(response).map((flightResult, index) =>
      mapFlightResultToItinerary(
        flightResult,
        itineraryType,
        response.search_metadata?.google_flights_url,
        index,
        returnDate
      )
    )
  );
}

function buildSplitOneWayItineraries(
  outboundResponse: SerpApiFlightResponse,
  returnResponse: SerpApiFlightResponse
): SplitOneWayBuildResult {
  const outboundOptions = mapResponseToItineraries(outboundResponse, "ONE_WAY").slice(
    0,
    env.SERPAPI_SPLIT_OPTIONS_PER_SIDE
  );
  const returnOptions = mapResponseToItineraries(returnResponse, "ONE_WAY").slice(
    0,
    env.SERPAPI_SPLIT_OPTIONS_PER_SIDE
  );
  const splitOptions: UnscoredItinerary[] = [];

  for (const outbound of outboundOptions) {
    for (const returnTrip of returnOptions) {
      const outboundLeg = outbound.legs[0];
      const returnLeg = returnTrip.legs[0];

      if (!outboundLeg || !returnLeg) {
        continue;
      }

      splitOptions.push({
        id: `serpapi-split-${outbound.id}-${returnTrip.id}`,
        type: "SPLIT_ONE_WAYS",
        totalPrice: outbound.totalPrice + returnTrip.totalPrice,
        currency: "USD",
        savingsComparedToRoundTrip: null,
        summary: "Separate one-way fares found through Google Flights results.",
        totalDurationMinutes: outbound.totalDurationMinutes + returnTrip.totalDurationMinutes,
        carryOnIncluded: combineCarryOnStatuses(outbound.carryOnIncluded, returnTrip.carryOnIncluded),
        bookingTokens: [
          ...(outbound.bookingTokens ?? []),
          ...(returnTrip.bookingTokens ?? [])
        ],
        legs: [
          {
            ...outboundLeg,
            direction: "OUTBOUND"
          },
          {
            ...returnLeg,
            direction: "RETURN"
          }
        ]
      });
    }
  }

  const itineraries = dedupeItineraries(splitOptions);

  return {
    itineraries,
    diagnostics: {
      outboundOptionsUsed: outboundOptions.length,
      returnOptionsUsed: returnOptions.length,
      splitItinerariesBuilt: itineraries.length
    }
  };
}

async function buildRoundTripItineraries(
  outboundResponse: SerpApiFlightResponse,
  searchParams: SerpApiSearchParams
) {
  const outboundResults = getFlightResults(outboundResponse);
  const outboundOptionsWithToken = outboundResults.filter((result) => result.departure_token);
  const outboundOptions = outboundOptionsWithToken.slice(0, env.SERPAPI_ROUND_TRIP_OUTBOUND_OPTIONS);
  const roundTrips: UnscoredItinerary[] = [];
  let apiRequestsMade = 0;
  let returnOptionsFound = 0;

  for (const [outboundIndex, outbound] of outboundOptions.entries()) {
    const returnResponse = await fetchGoogleFlights({
      ...searchParams,
      departureToken: outbound.departure_token
    });
    apiRequestsMade += 1;

    const returnOptions = getFlightResults(returnResponse).slice(0, env.SERPAPI_ROUND_TRIP_RETURN_OPTIONS);
    returnOptionsFound += returnOptions.length;

    for (const [returnIndex, returnTrip] of returnOptions.entries()) {
      const outboundLeg = mapSegmentsToLeg(
        outbound.flights ?? [],
        outbound.layovers ?? [],
        "OUTBOUND",
        Math.round((returnTrip.price ?? outbound.price ?? 0) / 2),
        outboundResponse.search_metadata?.google_flights_url
      );
      const returnLeg = mapSegmentsToLeg(
        returnTrip.flights ?? [],
        returnTrip.layovers ?? [],
        "RETURN",
        Math.round((returnTrip.price ?? outbound.price ?? 0) / 2),
        returnResponse.search_metadata?.google_flights_url
      );
      const totalPrice = returnTrip.price ?? outbound.price ?? 0;

      roundTrips.push({
        id: `serpapi-round-trip-${outboundIndex}-${returnIndex}-${returnTrip.booking_token ?? outbound.departure_token ?? "offer"}`,
        type: "ROUND_TRIP",
        totalPrice,
        currency: "USD",
        savingsComparedToRoundTrip: null,
        summary: buildRoundTripSummary(outbound, returnTrip),
        totalDurationMinutes:
          (outbound.total_duration ??
            sumJourneyDurationMinutes(outbound.flights ?? [], outbound.layovers ?? [])) +
          (returnTrip.total_duration ??
            sumJourneyDurationMinutes(returnTrip.flights ?? [], returnTrip.layovers ?? [])),
        carryOnIncluded: combineCarryOnStatuses(
          getCarryOnIncludedStatus(outbound),
          getCarryOnIncludedStatus(returnTrip)
        ),
        bookingTokens: returnTrip.booking_token ? [returnTrip.booking_token] : [],
        legs: [outboundLeg, returnLeg]
      });
    }
  }

  const itineraries = dedupeItineraries(roundTrips);

  return {
    itineraries,
    apiRequestsMade,
    diagnostics: {
      outboundOptionsFound: outboundResults.length,
      outboundOptionsWithReturnToken: outboundOptionsWithToken.length,
      outboundOptionsFollowed: outboundOptions.length,
      returnTokenSearchesMade: apiRequestsMade,
      returnOptionsFound,
      roundTripItinerariesBuilt: itineraries.length
    }
  };
}

function mapFlightResultToItinerary(
  flightResult: SerpApiFlightResult,
  itineraryType: ItineraryType,
  googleFlightsUrl: string | undefined,
  index: number,
  returnDate?: string
): UnscoredItinerary {
  const segments = flightResult.flights ?? [];
  const totalPrice = flightResult.price ?? 0;
  const legs = buildLegs(
    segments,
    flightResult.layovers ?? [],
    itineraryType,
    totalPrice,
    googleFlightsUrl,
    returnDate
  );

  return {
    id: `serpapi-${itineraryType.toLowerCase()}-${index}-${flightResult.booking_token ?? flightResult.departure_token ?? "offer"}`,
    type: itineraryType,
    totalPrice,
    currency: "USD",
    savingsComparedToRoundTrip: null,
    summary: buildSummary(flightResult, itineraryType),
    totalDurationMinutes:
      flightResult.total_duration ??
      sumJourneyDurationMinutes(segments, flightResult.layovers ?? []),
    carryOnIncluded: getCarryOnIncludedStatus(flightResult),
    bookingTokens: flightResult.booking_token ? [flightResult.booking_token] : [],
    legs
  };
}

function buildLegs(
  segments: SerpApiFlightSegment[],
  layovers: NonNullable<SerpApiFlightResult["layovers"]>,
  itineraryType: ItineraryType,
  totalPrice: number,
  googleFlightsUrl: string | undefined,
  returnDate?: string
) {
  if (itineraryType !== "ROUND_TRIP" || !returnDate) {
    return [mapSegmentsToLeg(segments, layovers, "OUTBOUND", totalPrice, googleFlightsUrl)];
  }

  const outboundSegments = segments.filter((segment) => getDate(segment.departure_airport?.time) < returnDate);
  const returnSegments = segments.filter((segment) => getDate(segment.departure_airport?.time) >= returnDate);
  const outboundLayoverCount = Math.max(outboundSegments.length - 1, 0);

  if (outboundSegments.length === 0 || returnSegments.length === 0) {
    return [mapSegmentsToLeg(segments, layovers, "OUTBOUND", totalPrice, googleFlightsUrl)];
  }

  return [
    mapSegmentsToLeg(
      outboundSegments,
      layovers.slice(0, outboundLayoverCount),
      "OUTBOUND",
      Math.round(totalPrice / 2),
      googleFlightsUrl
    ),
    mapSegmentsToLeg(
      returnSegments,
      layovers.slice(outboundLayoverCount),
      "RETURN",
      Math.round(totalPrice / 2),
      googleFlightsUrl
    )
  ];
}

function mapSegmentsToLeg(
  segments: SerpApiFlightSegment[],
  layovers: NonNullable<SerpApiFlightResult["layovers"]>,
  direction: ItineraryLeg["direction"],
  price: number,
  googleFlightsUrl: string | undefined
): ItineraryLeg {
  const firstSegment = segments[0];
  const lastSegment = segments[segments.length - 1];
  const airlines = [
    ...new Set(segments.map((segment) => segment.airline).filter((airline): airline is string => Boolean(airline)))
  ];

  return {
    direction,
    airline: airlines.length > 0 ? airlines.join(" + ") : "Unknown airline",
    originAirport: firstSegment?.departure_airport?.id ?? "",
    destinationAirport: lastSegment?.arrival_airport?.id ?? "",
    price,
    departDate: getDate(firstSegment?.departure_airport?.time),
    departTime: getTime(firstSegment?.departure_airport?.time),
    arrivalTime: getTime(lastSegment?.arrival_airport?.time),
    durationMinutes: getLegDurationMinutes(segments, layovers),
    stops: Math.max(segments.length - 1, 0),
    bookingLink: googleFlightsUrl ?? "https://www.google.com/travel/flights",
    segments: segments.map((segment, index) => ({
      segmentOrder: index + 1,
      airline: segment.airline ?? "Unknown airline",
      flightNumber: segment.flight_number,
      originAirport: segment.departure_airport?.id ?? "",
      destinationAirport: segment.arrival_airport?.id ?? "",
      departDate: getDate(segment.departure_airport?.time),
      departTime: getTime(segment.departure_airport?.time),
      arrivalDate: getDate(segment.arrival_airport?.time),
      arrivalTime: getTime(segment.arrival_airport?.time),
      durationMinutes: segment.duration,
      layoverAfterMinutes: layovers[index]?.duration
    }))
  };
}

function getFlightResults(response: SerpApiFlightResponse) {
  return [...(response.best_flights ?? []), ...(response.other_flights ?? [])].filter(
    (result) => result.price && result.flights && result.flights.length > 0
  );
}

function dedupeItineraries(itineraries: UnscoredItinerary[]) {
  const cheapestByFingerprint = new Map<string, UnscoredItinerary>();

  for (const itinerary of itineraries) {
    const fingerprint = [
      itinerary.type,
      itinerary.totalDurationMinutes,
      itinerary.legs
        .map((leg) =>
          [
            leg.direction,
            leg.airline,
            leg.originAirport,
            leg.destinationAirport,
            leg.departDate,
            leg.departTime ?? "",
            leg.arrivalTime ?? "",
            leg.stops
          ].join("|")
        )
        .join("||")
    ].join("::");

    const existingItinerary = cheapestByFingerprint.get(fingerprint);

    if (!existingItinerary || itinerary.totalPrice < existingItinerary.totalPrice) {
      cheapestByFingerprint.set(fingerprint, itinerary);
    }
  }

  return [...cheapestByFingerprint.values()];
}

function addRoundTripDiagnostics(
  totalDiagnostics: RoundTripBuildDiagnostics,
  nextDiagnostics: RoundTripBuildDiagnostics
) {
  totalDiagnostics.outboundOptionsFound += nextDiagnostics.outboundOptionsFound;
  totalDiagnostics.outboundOptionsWithReturnToken += nextDiagnostics.outboundOptionsWithReturnToken;
  totalDiagnostics.outboundOptionsFollowed += nextDiagnostics.outboundOptionsFollowed;
  totalDiagnostics.returnTokenSearchesMade += nextDiagnostics.returnTokenSearchesMade;
  totalDiagnostics.returnOptionsFound += nextDiagnostics.returnOptionsFound;
  totalDiagnostics.roundTripItinerariesBuilt += nextDiagnostics.roundTripItinerariesBuilt;
}

function countItinerariesByType(itineraries: UnscoredItinerary[]) {
  return itineraries.reduce<Partial<Record<ItineraryType, number>>>((counts, itinerary) => {
    counts[itinerary.type] = (counts[itinerary.type] ?? 0) + 1;
    return counts;
  }, {});
}

function buildSummary(flightResult: SerpApiFlightResult, itineraryType: ItineraryType) {
  const typeText =
    itineraryType === "ROUND_TRIP" ? "round-trip" : itineraryType === "SPLIT_ONE_WAYS" ? "split one-way" : "one-way";
  const airlines = [
    ...new Set(
      (flightResult.flights ?? [])
        .map((segment) => segment.airline)
        .filter((airline): airline is string => Boolean(airline))
    )
  ];
  const airlineText = airlines.length > 0 ? airlines.join(" + ") : "Google Flights";

  return `${typeText} result from ${airlineText}.`;
}

function buildRoundTripSummary(outbound: SerpApiFlightResult, returnTrip: SerpApiFlightResult) {
  const airlines = [
    ...new Set(
      [...(outbound.flights ?? []), ...(returnTrip.flights ?? [])]
        .map((segment) => segment.airline)
        .filter((airline): airline is string => Boolean(airline))
    )
  ];
  const airlineText = airlines.length > 0 ? airlines.join(" + ") : "Google Flights";

  return `round-trip result from ${airlineText}.`;
}

function getCarryOnIncludedStatus(flightResult: SerpApiFlightResult) {
  const text = [
    ...(flightResult.extensions ?? []),
    ...(flightResult.flights ?? []).flatMap((segment) => segment.extensions ?? [])
  ]
    .join(" ")
    .toLowerCase();

  if (!text) {
    return null;
  }

  const hasExplicitFee =
    text.includes("carry-on bag for a fee") ||
    text.includes("carry on bag for a fee") ||
    text.includes("carry-on for a fee") ||
    text.includes("carry on for a fee") ||
    text.includes("carry-on not included") ||
    text.includes("carry on not included") ||
    text.includes("no carry-on") ||
    text.includes("no carry on");

  if (hasExplicitFee) {
    return false;
  }

  const hasIncludedCarryOn =
    text.includes("carry-on") ||
    text.includes("carry on") ||
    text.includes("cabin bag") ||
    text.includes("cabin baggage") ||
    text.includes("hand baggage");

  return hasIncludedCarryOn ? true : null;
}

function combineCarryOnStatuses(...statuses: (boolean | null)[]) {
  if (statuses.some((status) => status === false)) {
    return false;
  }

  if (statuses.every((status) => status === true)) {
    return true;
  }

  return null;
}

function mapMaxStops(maxStops?: number) {
  if (maxStops === undefined) {
    return undefined;
  }

  if (maxStops === 0) {
    return "1";
  }

  if (maxStops === 1) {
    return "2";
  }

  if (maxStops === 2) {
    return "3";
  }

  return undefined;
}

function getLegDurationMinutes(
  segments: SerpApiFlightSegment[],
  layovers: NonNullable<SerpApiFlightResult["layovers"]>
) {
  return sumJourneyDurationMinutes(segments, layovers);
}

function getDate(dateTime?: string) {
  return dateTime?.slice(0, 10) ?? "";
}

function getTime(dateTime?: string) {
  return dateTime?.slice(11, 16) || undefined;
}
