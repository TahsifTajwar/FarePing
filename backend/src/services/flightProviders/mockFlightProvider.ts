import {
  type FlightProvider,
  type FlightSearchInput,
  type ItineraryLeg,
  type ItinerarySegment,
  type UnscoredItinerary
} from "./types.js";

export const mockFlightProvider: FlightProvider = {
  name: "mock",
  async searchFlights(search) {
    const originAirport = search.originAirports[0];
    const destinationAirport = search.destinationAirports[0];

    const itineraries =
      search.tripType === "ONE_WAY"
        ? buildOneWayResults(search, originAirport, destinationAirport)
        : buildRoundTripResults(search, originAirport, destinationAirport);

    return {
      provider: this.name,
      itineraries,
      diagnostics: {
        datePairsSearched: [
          {
            departureDate: search.earliestDepartDate,
            returnDate: search.latestReturnDate
          }
        ],
        apiRequestsMade: 0,
        rawItinerariesFound: itineraries.length,
        rawItinerariesByType: itineraries.reduce<Record<string, number>>((counts, itinerary) => {
          counts[itinerary.type] = (counts[itinerary.type] ?? 0) + 1;
          return counts;
        }, {}),
        providerErrors: []
      }
    };
  }
};

function buildOneWayResults(
  search: FlightSearchInput,
  originAirport: string,
  destinationAirport: string
): UnscoredItinerary[] {
  const maxStops = search.maxStops ?? 1;

  return [
    {
      id: "one-way-jetblue",
      type: "ONE_WAY",
      totalPrice: 164,
      currency: "USD",
      savingsComparedToRoundTrip: null,
      summary: "Fast nonstop one-way mock fare.",
      totalDurationMinutes: 190,
      carryOnIncluded: true,
      legs: [
        buildLeg(
          "OUTBOUND",
          "JetBlue",
          originAirport,
          destinationAirport,
          164,
          search.earliestDepartDate,
          190,
          0
        )
      ]
    },
    {
      id: "one-way-delta",
      type: "ONE_WAY",
      totalPrice: 188,
      currency: "USD",
      savingsComparedToRoundTrip: null,
      summary: "One-way mock fare with a longer connection.",
      totalDurationMinutes: 300,
      carryOnIncluded: true,
      legs: [
        buildLeg(
          "OUTBOUND",
          "Delta",
          originAirport,
          destinationAirport,
          188,
          search.latestDepartDate ?? search.earliestDepartDate,
          300,
          maxStops
        )
      ]
    },
    {
      id: "one-way-united-long",
      type: "ONE_WAY",
      totalPrice: 213,
      currency: "USD",
      savingsComparedToRoundTrip: null,
      summary: "Cheap but slow one-way mock fare.",
      totalDurationMinutes: 720,
      carryOnIncluded: false,
      legs: [
        buildLeg("OUTBOUND", "United", originAirport, destinationAirport, 213, search.earliestDepartDate, 720, maxStops)
      ]
    }
  ];
}

function buildRoundTripResults(
  search: FlightSearchInput,
  originAirport: string,
  destinationAirport: string
): UnscoredItinerary[] {
  const maxStops = search.maxStops ?? 1;
  const returnDate = getMockReturnDate(search);
  const roundTripPrice = 680;
  const fastRoundTripPrice = 580;
  const splitOutboundPrice = 280;
  const splitReturnPrice = 240;
  const splitTotalPrice = splitOutboundPrice + splitReturnPrice;

  const roundTrip: UnscoredItinerary = {
    id: "round-trip-delta",
    type: "ROUND_TRIP",
    totalPrice: roundTripPrice,
    currency: "USD",
    savingsComparedToRoundTrip: null,
    summary: "Normal round-trip mock fare.",
    totalDurationMinutes: 760,
    carryOnIncluded: true,
    legs: [
      buildLeg("OUTBOUND", "Delta", originAirport, destinationAirport, 340, search.earliestDepartDate, 380, maxStops),
      buildLeg("RETURN", "Delta", destinationAirport, originAirport, 340, returnDate, 380, maxStops)
    ]
  };

  const fastRoundTrip: UnscoredItinerary = {
    id: "round-trip-united-fast",
    type: "ROUND_TRIP",
    totalPrice: fastRoundTripPrice,
    currency: "USD",
    savingsComparedToRoundTrip: null,
    summary: "Fast round-trip mock fare that is slightly over budget.",
    totalDurationMinutes: 660,
    carryOnIncluded: true,
    legs: [
      buildLeg("OUTBOUND", "United", originAirport, destinationAirport, 320, search.earliestDepartDate, 330, 0),
      buildLeg("RETURN", "United", destinationAirport, originAirport, 320, returnDate, 330, 0)
    ]
  };

  const splitOneWays: UnscoredItinerary = {
    id: "split-one-ways-jetblue-norse",
    type: "SPLIT_ONE_WAYS",
    totalPrice: splitTotalPrice,
    currency: "USD",
    savingsComparedToRoundTrip: roundTripPrice - splitTotalPrice,
    summary: "Split one-way mock fare using different airlines.",
    totalDurationMinutes: 900,
    carryOnIncluded: false,
    legs: [
      buildLeg(
        "OUTBOUND",
        "JetBlue",
        originAirport,
        destinationAirport,
        splitOutboundPrice,
        search.earliestDepartDate,
        420,
        0
      ),
      buildLeg("RETURN", "Norse", destinationAirport, originAirport, splitReturnPrice, returnDate, 480, maxStops)
    ]
  };

  return [roundTrip, fastRoundTrip, splitOneWays];
}

function buildLeg(
  direction: "OUTBOUND" | "RETURN",
  airline: string,
  originAirport: string,
  destinationAirport: string,
  price: number,
  departDate: string,
  durationMinutes: number,
  stops: number
): ItineraryLeg {
  const departTime = direction === "OUTBOUND" ? "08:00" : "17:00";
  const arrivalTime = direction === "OUTBOUND" ? "12:30" : "21:30";

  return {
    direction,
    airline,
    originAirport,
    destinationAirport,
    price,
    departDate,
    departTime,
    arrivalTime,
    durationMinutes,
    stops,
    bookingLink: `https://example.com/book/${airline.toLowerCase()}`,
    segments: buildMockSegments({
      direction,
      airline,
      originAirport,
      destinationAirport,
      departDate,
      departTime,
      arrivalTime,
      durationMinutes,
      stops
    })
  };
}

function buildMockSegments({
  direction,
  airline,
  originAirport,
  destinationAirport,
  departDate,
  departTime,
  arrivalTime,
  durationMinutes,
  stops
}: {
  direction: ItineraryLeg["direction"];
  airline: string;
  originAirport: string;
  destinationAirport: string;
  departDate: string;
  departTime: string;
  arrivalTime: string;
  durationMinutes: number;
  stops: number;
}): ItinerarySegment[] {
  if (stops === 0) {
    return [
      {
        segmentOrder: 1,
        airline,
        flightNumber: getMockFlightNumber(airline, direction, 1),
        originAirport,
        destinationAirport,
        departDate,
        departTime,
        arrivalDate: departDate,
        arrivalTime,
        durationMinutes
      }
    ];
  }

  const layoverAirport = direction === "OUTBOUND" ? "ATL" : "KEF";
  const layoverMinutes = 90;
  const firstFlightMinutes = Math.max(90, Math.floor((durationMinutes - layoverMinutes) / 2));
  const secondFlightMinutes = Math.max(90, durationMinutes - layoverMinutes - firstFlightMinutes);

  return [
    {
      segmentOrder: 1,
      airline,
      flightNumber: getMockFlightNumber(airline, direction, 1),
      originAirport,
      destinationAirport: layoverAirport,
      departDate,
      departTime,
      arrivalDate: departDate,
      arrivalTime: "10:15",
      durationMinutes: firstFlightMinutes,
      layoverAfterMinutes: layoverMinutes
    },
    {
      segmentOrder: 2,
      airline,
      flightNumber: getMockFlightNumber(airline, direction, 2),
      originAirport: layoverAirport,
      destinationAirport,
      departDate,
      departTime: "11:45",
      arrivalDate: departDate,
      arrivalTime,
      durationMinutes: secondFlightMinutes
    }
  ];
}

function getMockFlightNumber(airline: string, direction: ItineraryLeg["direction"], segmentOrder: number) {
  const airlineCode = airline.slice(0, 2).toUpperCase();
  const directionNumber = direction === "OUTBOUND" ? 10 : 20;

  return `${airlineCode} ${directionNumber + segmentOrder}`;
}

function getMockReturnDate(search: FlightSearchInput) {
  if (!search.latestReturnDate) {
    return search.earliestDepartDate;
  }

  const stayDays = search.maxTripDays ?? search.minTripDays ?? 3;
  const mockReturnDate = addDays(search.earliestDepartDate, stayDays);

  return mockReturnDate <= search.latestReturnDate ? mockReturnDate : search.latestReturnDate;
}

function addDays(date: string, days: number) {
  const nextDate = new Date(`${date}T00:00:00.000Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);

  return nextDate.toISOString().slice(0, 10);
}
