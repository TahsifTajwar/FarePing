import {
  type FlightProvider,
  type FlightSearchInput,
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
      itineraries
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
        buildLeg("OUTBOUND", "United", originAirport, destinationAirport, 213, search.earliestDepartDate, maxStops)
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
  const returnDate = search.latestReturnDate ?? search.earliestDepartDate;
  const roundTripPrice = 680;
  const fastRoundTripPrice = 640;
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
      buildLeg("OUTBOUND", "Delta", originAirport, destinationAirport, 340, search.earliestDepartDate, maxStops),
      buildLeg("RETURN", "Delta", destinationAirport, originAirport, 340, returnDate, maxStops)
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
      buildLeg("OUTBOUND", "United", originAirport, destinationAirport, 320, search.earliestDepartDate, 0),
      buildLeg("RETURN", "United", destinationAirport, originAirport, 320, returnDate, 0)
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
        0
      ),
      buildLeg("RETURN", "Norse", destinationAirport, originAirport, splitReturnPrice, returnDate, maxStops)
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
  stops: number
) {
  return {
    direction,
    airline,
    originAirport,
    destinationAirport,
    price,
    departDate,
    stops,
    bookingLink: `https://example.com/book/${airline.toLowerCase()}`
  };
}
