import { env } from "../../config/env.js";
import { getAmadeusAccessToken } from "./amadeusAuth.js";
import {
  type FlightProvider,
  type FlightSearchInput,
  type ItineraryLeg,
  type ItineraryType,
  type UnscoredItinerary
} from "./types.js";

type AmadeusFlightOffer = {
  id: string;
  itineraries: {
    duration?: string;
    segments: {
      departure: {
        iataCode: string;
        at: string;
      };
      arrival: {
        iataCode: string;
        at: string;
      };
      carrierCode: string;
      numberOfStops?: number;
      duration?: string;
    }[];
  }[];
  price: {
    currency: string;
    total: string;
  };
};

type AmadeusFlightOffersResponse = {
  data?: AmadeusFlightOffer[];
  dictionaries?: {
    carriers?: Record<string, string>;
  };
};

type AmadeusSearchParams = {
  originAirport: string;
  destinationAirport: string;
  departureDate: string;
  returnDate?: string;
  maxPrice: number;
  nonStop: boolean;
};

const MAX_AMADEUS_RESULTS = "20";

export const amadeusFlightProvider: FlightProvider = {
  name: "amadeus",
  async searchFlights(search) {
    const originAirport = search.originAirports[0];
    const destinationAirport = search.destinationAirports[0];
    const nonStop = search.maxStops === 0;
    const providerMaxPrice = Math.ceil(search.maxPrice + 50);

    if (search.tripType === "ONE_WAY") {
      const response = await fetchFlightOffers({
        originAirport,
        destinationAirport,
        departureDate: search.earliestDepartDate,
        maxPrice: providerMaxPrice,
        nonStop
      });

      return {
        provider: this.name,
        itineraries: mapOffersToItineraries(response, "ONE_WAY")
      };
    }

    const returnDate = search.latestReturnDate;

    if (!returnDate) {
      throw new Error("latestReturnDate is required before searching Amadeus round-trip flights.");
    }

    const [roundTripResponse, outboundResponse, returnResponse] = await Promise.all([
      fetchFlightOffers({
        originAirport,
        destinationAirport,
        departureDate: search.earliestDepartDate,
        returnDate,
        maxPrice: providerMaxPrice,
        nonStop
      }),
      fetchFlightOffers({
        originAirport,
        destinationAirport,
        departureDate: search.earliestDepartDate,
        maxPrice: providerMaxPrice,
        nonStop
      }),
      fetchFlightOffers({
        originAirport: destinationAirport,
        destinationAirport: originAirport,
        departureDate: returnDate,
        maxPrice: providerMaxPrice,
        nonStop
      })
    ]);

    const roundTrips = mapOffersToItineraries(roundTripResponse, "ROUND_TRIP");
    const splitOneWays = buildSplitOneWayItineraries(outboundResponse, returnResponse);

    return {
      provider: this.name,
      itineraries: [...roundTrips, ...splitOneWays]
    };
  }
};

async function fetchFlightOffers(params: AmadeusSearchParams) {
  const accessToken = await getAmadeusAccessToken();
  const query = new URLSearchParams({
    originLocationCode: params.originAirport,
    destinationLocationCode: params.destinationAirport,
    departureDate: params.departureDate,
    adults: "1",
    currencyCode: "USD",
    maxPrice: String(params.maxPrice),
    nonStop: String(params.nonStop),
    max: MAX_AMADEUS_RESULTS
  });

  if (params.returnDate) {
    query.set("returnDate", params.returnDate);
  }

  const response = await fetch(`${env.AMADEUS_BASE_URL}/v2/shopping/flight-offers?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`Amadeus flight search failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as AmadeusFlightOffersResponse;
}

function mapOffersToItineraries(
  response: AmadeusFlightOffersResponse,
  itineraryType: ItineraryType
): UnscoredItinerary[] {
  const carrierNames = response.dictionaries?.carriers ?? {};

  return (response.data ?? []).map((offer) => {
    const totalPrice = parsePrice(offer.price.total);
    const legPrice = Math.round(totalPrice / Math.max(offer.itineraries.length, 1));

    return {
      id: `amadeus-${itineraryType.toLowerCase()}-${offer.id}`,
      type: itineraryType,
      totalPrice,
      currency: "USD",
      savingsComparedToRoundTrip: null,
      summary: buildSummary(offer, carrierNames),
      totalDurationMinutes: offer.itineraries.reduce(
        (total, itinerary) => total + parseDurationMinutes(itinerary.duration),
        0
      ),
      carryOnIncluded: true,
      legs: offer.itineraries.map((itinerary, index) =>
        mapItineraryToLeg(itinerary, index === 0 ? "OUTBOUND" : "RETURN", legPrice, carrierNames)
      )
    };
  });
}

function buildSplitOneWayItineraries(
  outboundResponse: AmadeusFlightOffersResponse,
  returnResponse: AmadeusFlightOffersResponse
): UnscoredItinerary[] {
  const outboundOptions = mapOffersToItineraries(outboundResponse, "ONE_WAY").slice(0, 3);
  const returnOptions = mapOffersToItineraries(returnResponse, "ONE_WAY").slice(0, 3);
  const splitOptions: UnscoredItinerary[] = [];

  for (const outbound of outboundOptions) {
    for (const returnTrip of returnOptions) {
      const outboundLeg = outbound.legs[0];
      const returnLeg = returnTrip.legs[0];

      if (!outboundLeg || !returnLeg) {
        continue;
      }

      const totalPrice = outbound.totalPrice + returnTrip.totalPrice;

      splitOptions.push({
        id: `amadeus-split-${outbound.id}-${returnTrip.id}`,
        type: "SPLIT_ONE_WAYS",
        totalPrice,
        currency: "USD",
        savingsComparedToRoundTrip: null,
        summary: "Separate one-way fares found through Amadeus.",
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

  return splitOptions;
}

function mapItineraryToLeg(
  itinerary: AmadeusFlightOffer["itineraries"][number],
  direction: ItineraryLeg["direction"],
  price: number,
  carrierNames: Record<string, string>
): ItineraryLeg {
  const firstSegment = itinerary.segments[0];
  const lastSegment = itinerary.segments[itinerary.segments.length - 1];
  const carriers = [...new Set(itinerary.segments.map((segment) => segment.carrierCode))];

  return {
    direction,
    airline: carriers.map((carrier) => carrierNames[carrier] ?? carrier).join(" + "),
    originAirport: firstSegment?.departure.iataCode ?? "",
    destinationAirport: lastSegment?.arrival.iataCode ?? "",
    price,
    departDate: firstSegment?.departure.at.slice(0, 10) ?? "",
    stops: countStops(itinerary.segments),
    bookingLink: "https://www.google.com/travel/flights"
  };
}

function buildSummary(offer: AmadeusFlightOffer, carrierNames: Record<string, string>) {
  const carriers = [
    ...new Set(
      offer.itineraries.flatMap((itinerary) => itinerary.segments.map((segment) => segment.carrierCode))
    )
  ];
  const airlineText = carriers.map((carrier) => carrierNames[carrier] ?? carrier).join(" + ");

  return `Amadeus ${offer.itineraries.length > 1 ? "round-trip" : "one-way"} offer with ${airlineText}.`;
}

function countStops(segments: AmadeusFlightOffer["itineraries"][number]["segments"]) {
  const connectionStops = Math.max(segments.length - 1, 0);
  const technicalStops = segments.reduce((totalStops, segment) => totalStops + (segment.numberOfStops ?? 0), 0);

  return connectionStops + technicalStops;
}

function parsePrice(price: string) {
  return Math.round(Number(price));
}

function parseDurationMinutes(duration?: string) {
  if (!duration) {
    return 0;
  }

  const match = duration.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?$/);

  if (!match) {
    return 0;
  }

  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);

  return days * 24 * 60 + hours * 60 + minutes;
}
