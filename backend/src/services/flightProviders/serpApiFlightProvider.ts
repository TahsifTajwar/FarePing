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

const MAX_SPLIT_OPTIONS_PER_SIDE = 3;
const MAX_ROUND_TRIP_OUTBOUND_OPTIONS = 2;

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
        itineraries: mapResponseToItineraries(response, "ONE_WAY")
      };
    }

    if (!search.latestReturnDate) {
      throw new Error("latestReturnDate is required before searching SerpApi round-trip flights.");
    }

    const roundTripSearchParams = {
      tripType: "ROUND_TRIP" as const,
      originAirports: search.originAirports,
      destinationAirports: search.destinationAirports,
      departureDate: search.earliestDepartDate,
      returnDate: search.latestReturnDate,
      maxPrice: search.maxPrice + 50,
      maxStops: search.maxStops
    };

    const [roundTripOutboundResponse, outboundResponse, returnResponse] = await Promise.all([
      fetchGoogleFlights(roundTripSearchParams),
      fetchGoogleFlights({
        tripType: "ONE_WAY",
        originAirports: search.originAirports,
        destinationAirports: search.destinationAirports,
        departureDate: search.earliestDepartDate,
        maxPrice: search.maxPrice + 50,
        maxStops: search.maxStops
      }),
      fetchGoogleFlights({
        tripType: "ONE_WAY",
        originAirports: search.destinationAirports,
        destinationAirports: search.originAirports,
        departureDate: search.latestReturnDate,
        maxPrice: search.maxPrice + 50,
        maxStops: search.maxStops
      })
    ]);

    const roundTrips = await buildRoundTripItineraries(roundTripOutboundResponse, roundTripSearchParams);

    return {
      provider: this.name,
      itineraries: [
        ...roundTrips,
        ...buildSplitOneWayItineraries(outboundResponse, returnResponse)
      ]
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
    max_price: String(Math.ceil(params.maxPrice)),
    no_cache: "false"
  });

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
): UnscoredItinerary[] {
  const outboundOptions = mapResponseToItineraries(outboundResponse, "ONE_WAY").slice(0, MAX_SPLIT_OPTIONS_PER_SIDE);
  const returnOptions = mapResponseToItineraries(returnResponse, "ONE_WAY").slice(0, MAX_SPLIT_OPTIONS_PER_SIDE);
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
        carryOnIncluded: outbound.carryOnIncluded && returnTrip.carryOnIncluded,
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

  return dedupeItineraries(splitOptions);
}

async function buildRoundTripItineraries(
  outboundResponse: SerpApiFlightResponse,
  searchParams: SerpApiSearchParams
) {
  const outboundOptions = getFlightResults(outboundResponse)
    .filter((result) => result.departure_token)
    .slice(0, MAX_ROUND_TRIP_OUTBOUND_OPTIONS);
  const roundTrips: UnscoredItinerary[] = [];

  for (const [outboundIndex, outbound] of outboundOptions.entries()) {
    const returnResponse = await fetchGoogleFlights({
      ...searchParams,
      departureToken: outbound.departure_token
    });

    const returnOptions = getFlightResults(returnResponse).slice(0, 2);

    for (const [returnIndex, returnTrip] of returnOptions.entries()) {
      const outboundLeg = mapSegmentsToLeg(
        outbound.flights ?? [],
        "OUTBOUND",
        Math.round((returnTrip.price ?? outbound.price ?? 0) / 2),
        outboundResponse.search_metadata?.google_flights_url
      );
      const returnLeg = mapSegmentsToLeg(
        returnTrip.flights ?? [],
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
        carryOnIncluded: hasCarryOnIncluded(outbound) && hasCarryOnIncluded(returnTrip),
        legs: [outboundLeg, returnLeg]
      });
    }
  }

  return dedupeItineraries(roundTrips);
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
  const legs = buildLegs(segments, itineraryType, totalPrice, googleFlightsUrl, returnDate);

  return {
    id: `serpapi-${itineraryType.toLowerCase()}-${index}-${flightResult.booking_token ?? flightResult.departure_token ?? "offer"}`,
    type: itineraryType,
    totalPrice,
    currency: "USD",
    savingsComparedToRoundTrip: null,
    summary: buildSummary(flightResult, itineraryType),
    totalDurationMinutes: flightResult.total_duration ?? sumSegmentDurations(segments),
    carryOnIncluded: hasCarryOnIncluded(flightResult),
    legs
  };
}

function buildLegs(
  segments: SerpApiFlightSegment[],
  itineraryType: ItineraryType,
  totalPrice: number,
  googleFlightsUrl: string | undefined,
  returnDate?: string
) {
  if (itineraryType !== "ROUND_TRIP" || !returnDate) {
    return [mapSegmentsToLeg(segments, "OUTBOUND", totalPrice, googleFlightsUrl)];
  }

  const outboundSegments = segments.filter((segment) => getDate(segment.departure_airport?.time) < returnDate);
  const returnSegments = segments.filter((segment) => getDate(segment.departure_airport?.time) >= returnDate);

  if (outboundSegments.length === 0 || returnSegments.length === 0) {
    return [mapSegmentsToLeg(segments, "OUTBOUND", totalPrice, googleFlightsUrl)];
  }

  return [
    mapSegmentsToLeg(outboundSegments, "OUTBOUND", Math.round(totalPrice / 2), googleFlightsUrl),
    mapSegmentsToLeg(returnSegments, "RETURN", Math.round(totalPrice / 2), googleFlightsUrl)
  ];
}

function mapSegmentsToLeg(
  segments: SerpApiFlightSegment[],
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
    stops: Math.max(segments.length - 1, 0),
    bookingLink: googleFlightsUrl ?? "https://www.google.com/travel/flights"
  };
}

function getFlightResults(response: SerpApiFlightResponse) {
  return [...(response.best_flights ?? []), ...(response.other_flights ?? [])].filter(
    (result) => result.price && result.flights && result.flights.length > 0
  );
}

function dedupeItineraries(itineraries: UnscoredItinerary[]) {
  const seen = new Set<string>();

  return itineraries.filter((itinerary) => {
    const fingerprint = [
      itinerary.type,
      itinerary.totalPrice,
      itinerary.totalDurationMinutes,
      itinerary.legs
        .map((leg) =>
          [
            leg.direction,
            leg.airline,
            leg.originAirport,
            leg.destinationAirport,
            leg.departDate,
            leg.stops
          ].join("|")
        )
        .join("||")
    ].join("::");

    if (seen.has(fingerprint)) {
      return false;
    }

    seen.add(fingerprint);
    return true;
  });
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

function hasCarryOnIncluded(flightResult: SerpApiFlightResult) {
  const text = [
    ...(flightResult.extensions ?? []),
    ...(flightResult.flights ?? []).flatMap((segment) => segment.extensions ?? [])
  ]
    .join(" ")
    .toLowerCase();

  return text.includes("carry-on") && !text.includes("carry-on bag for a fee");
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

function sumSegmentDurations(segments: SerpApiFlightSegment[]) {
  return segments.reduce((total, segment) => total + (segment.duration ?? 0), 0);
}

function getDate(dateTime?: string) {
  return dateTime?.slice(0, 10) ?? "";
}
