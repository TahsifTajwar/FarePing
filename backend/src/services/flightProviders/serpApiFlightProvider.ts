import { env } from "../../config/env.js";
import {
  type FlightProvider,
  type FlightSearchInput,
  type ItineraryLeg,
  type ItineraryType,
  type UnscoredItinerary
} from "./types.js";

type SerpApiFlightResponse = {
  search_metadata?: {
    google_flights_url?: string;
  };
  best_flights?: SerpApiFlightResult[];
  other_flights?: SerpApiFlightResult[];
  error?: string;
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

type DatePair = {
  departureDate: string;
  returnDate: string;
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
    if (search.tripType === "ONE_WAY") {
      const response = await fetchGoogleFlights({
        tripType: "ONE_WAY",
        originAirports: search.originAirports,
        destinationAirports: search.destinationAirports,
        departureDate: search.earliestDepartDate,
        maxPrice: search.maxPrice + 50,
        maxStops: search.maxStops
      });

      return {
        provider: this.name,
        itineraries: mapResponseToItineraries(response, "ONE_WAY"),
        diagnostics: {
          datePairsSearched: [
            {
              departureDate: search.earliestDepartDate
            }
          ],
          apiRequestsMade: 1,
          rawItinerariesFound: getFlightResults(response).length,
          rawItinerariesByType: {
            ONE_WAY: getFlightResults(response).length
          },
          providerErrors: []
        }
      };
    }

    if (!search.latestReturnDate) {
      throw new Error("latestReturnDate is required before searching SerpApi round-trip flights.");
    }

    const datePairs = buildDatePairs(search, env.MAX_SERPAPI_DATE_PAIRS);
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
          (outbound.total_duration ?? sumSegmentDurations(outbound.flights ?? [])) +
          (returnTrip.total_duration ?? sumSegmentDurations(returnTrip.flights ?? [])),
        carryOnIncluded: combineCarryOnStatuses(
          getCarryOnIncludedStatus(outbound),
          getCarryOnIncludedStatus(returnTrip)
        ),
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
    totalDurationMinutes: flightResult.total_duration ?? sumSegmentDurations(segments),
    carryOnIncluded: getCarryOnIncludedStatus(flightResult),
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
    durationMinutes: getLegDurationMinutes(segments),
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

function buildDatePairs(search: FlightSearchInput, maxDatePairs: number): DatePair[] {
  if (!search.latestReturnDate || !search.minTripDays) {
    return [
      {
        departureDate: search.earliestDepartDate,
        returnDate: search.latestReturnDate ?? search.earliestDepartDate
      }
    ];
  }

  const earliestDepartDate = parseDate(search.earliestDepartDate);
  const latestReturnDate = parseDate(search.latestReturnDate);
  const windowDays = differenceInDays(earliestDepartDate, latestReturnDate);
  const maxTripDays = Math.min(search.maxTripDays ?? windowDays, windowDays);

  if (windowDays < search.minTripDays) {
    return [];
  }

  const allValidPairs: DatePair[] = [];

  for (let departOffset = 0; departOffset <= windowDays - search.minTripDays; departOffset++) {
    const departureDate = addDays(earliestDepartDate, departOffset);
    const remainingWindowDays = differenceInDays(departureDate, latestReturnDate);
    const longestStayFromDeparture = Math.min(maxTripDays, remainingWindowDays);

    for (let stayDays = search.minTripDays; stayDays <= longestStayFromDeparture; stayDays++) {
      allValidPairs.push({
        departureDate: formatDate(departureDate),
        returnDate: formatDate(addDays(departureDate, stayDays))
      });
    }
  }

  return sampleDatePairs(dedupeDatePairs(allValidPairs), maxDatePairs);
}

function dedupeDatePairs(datePairs: DatePair[]) {
  const seen = new Set<string>();

  return datePairs.filter((datePair) => {
    const key = `${datePair.departureDate}-${datePair.returnDate}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function sampleDatePairs(datePairs: DatePair[], maxDatePairs: number) {
  if (datePairs.length <= maxDatePairs) {
    return datePairs;
  }

  const selectedPairs: DatePair[] = [];
  const firstDepartureDate = datePairs[0]?.departureDate;
  const latestReturnDate = datePairs.reduce(
    (latestDate, datePair) => (datePair.returnDate > latestDate ? datePair.returnDate : latestDate),
    datePairs[0]?.returnDate ?? ""
  );

  addPriorityDatePairs(
    selectedPairs,
    datePairs.filter((datePair) => datePair.departureDate === firstDepartureDate),
    maxDatePairs
  );

  addPriorityDatePairs(
    selectedPairs,
    datePairs.filter((datePair) => datePair.returnDate === latestReturnDate),
    maxDatePairs
  );

  const selectedIndexes = new Set<number>();

  for (let index = 0; index < maxDatePairs; index++) {
    selectedIndexes.add(Math.round((index * (datePairs.length - 1)) / Math.max(maxDatePairs - 1, 1)));
  }

  addPriorityDatePairs(
    selectedPairs,
    [...selectedIndexes].sort((first, second) => first - second).map((index) => datePairs[index]),
    maxDatePairs
  );

  return selectedPairs;
}

function addPriorityDatePairs(selectedPairs: DatePair[], candidatePairs: DatePair[], maxDatePairs: number) {
  for (const candidatePair of candidatePairs) {
    if (selectedPairs.length >= maxDatePairs) {
      return;
    }

    const alreadySelected = selectedPairs.some(
      (selectedPair) =>
        selectedPair.departureDate === candidatePair.departureDate &&
        selectedPair.returnDate === candidatePair.returnDate
    );

    if (!alreadySelected) {
      selectedPairs.push(candidatePair);
    }
  }
}

function sumSegmentDurations(segments: SerpApiFlightSegment[]) {
  return segments.reduce((total, segment) => total + (segment.duration ?? 0), 0);
}

function getLegDurationMinutes(segments: SerpApiFlightSegment[]) {
  const firstSegment = segments[0];
  const lastSegment = segments[segments.length - 1];
  const departureTime = firstSegment?.departure_airport?.time;
  const arrivalTime = lastSegment?.arrival_airport?.time;

  if (departureTime && arrivalTime) {
    const departure = new Date(departureTime);
    const arrival = new Date(arrivalTime);

    if (!Number.isNaN(departure.getTime()) && !Number.isNaN(arrival.getTime())) {
      return Math.max(0, Math.round((arrival.getTime() - departure.getTime()) / (60 * 1000)));
    }
  }

  return sumSegmentDurations(segments);
}

function getDate(dateTime?: string) {
  return dateTime?.slice(0, 10) ?? "";
}

function getTime(dateTime?: string) {
  return dateTime?.slice(11, 16) || undefined;
}

function parseDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);

  return nextDate;
}

function differenceInDays(startDate: Date, endDate: Date) {
  const millisecondsInDay = 24 * 60 * 60 * 1000;

  return Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / millisecondsInDay));
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
