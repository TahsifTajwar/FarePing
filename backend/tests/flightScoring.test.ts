import assert from "node:assert/strict";
import test from "node:test";
import {
  scoreFilterAndSortResultsWithDiagnostics
} from "../src/services/flightScoring.js";
import type {
  FlightSearchInput,
  UnscoredItinerary
} from "../src/services/flightProviders/types.js";

const search: FlightSearchInput = {
  tripType: "ROUND_TRIP",
  originAirports: ["BOS"],
  destinationAirports: ["DAC"],
  earliestDepartDate: "2026-12-24",
  latestDepartDate: "2026-12-24",
  latestReturnDate: "2027-01-31",
  minTripDays: 30,
  maxPrice: 1800,
  maxStops: 1
};

function itinerary(
  id: string,
  totalPrice: number,
  totalDurationMinutes: number,
  stops: number
): UnscoredItinerary {
  return {
    id,
    type: "ROUND_TRIP",
    totalPrice,
    currency: "USD",
    totalDurationMinutes,
    carryOnIncluded: false,
    bookingUrl: null,
    summary: id,
    legs: [
      {
        direction: "OUTBOUND",
        airline: "Test Air",
        originAirport: "BOS",
        destinationAirport: "DAC",
        departDate: "2026-12-24",
        departTime: "10:00",
        arrivalTime: "12:00",
        durationMinutes: Math.floor(totalDurationMinutes / 2),
        stops,
        segments: []
      },
      {
        direction: "RETURN",
        airline: "Test Air",
        originAirport: "DAC",
        destinationAirport: "BOS",
        departDate: "2027-01-31",
        departTime: "10:00",
        arrivalTime: "12:00",
        durationMinutes: Math.ceil(totalDurationMinutes / 2),
        stops,
        segments: []
      }
    ]
  };
}

test("hides under-budget fares when their deal score is below the visibility threshold", () => {
  const results = [
    itinerary("benchmark", 900, 1200, 0),
    itinerary("valid-but-slow", 1799, 6000, 1)
  ];

  const scored = scoreFilterAndSortResultsWithDiagnostics(results, search);
  const slowFare = scored.results.find((result) => result.id === "valid-but-slow");

  assert.equal(slowFare, undefined);
  assert.equal(scored.diagnostics.visibleItineraries, 1);
});

test("still removes fares outside the allowed price tolerance", () => {
  const scored = scoreFilterAndSortResultsWithDiagnostics(
    [itinerary("under-budget", 1700, 1800, 1), itinerary("too-expensive", 1851, 1800, 1)],
    search
  );

  assert.deepEqual(scored.results.map((result) => result.id), ["under-budget"]);
});

test("scores round-trip stops per leg instead of adding both directions", () => {
  const scored = scoreFilterAndSortResultsWithDiagnostics(
    [itinerary("one-stop-each-way", 1500, 1800, 1)],
    search
  );

  assert.equal(scored.results[0]?.dealScore, 920);
});

test("removes itineraries with a layover longer than 12 hours", () => {
  const normalConnection = itinerary("normal-connection", 1500, 1800, 1);
  const longConnection = itinerary("long-connection", 1400, 1800, 1);

  normalConnection.legs[0]!.segments = [buildSegment(120)];
  longConnection.legs[0]!.segments = [buildSegment(25 * 60)];

  const scored = scoreFilterAndSortResultsWithDiagnostics(
    [normalConnection, longConnection],
    search
  );

  assert.deepEqual(scored.results.map((result) => result.id), ["normal-connection"]);
  assert.equal(scored.diagnostics.removedByLayoverRules, 1);
});

test("ranks a two-hour layover above a six-hour layover when other factors match", () => {
  const shortConnection = itinerary("short-connection", 1500, 1800, 1);
  const longerConnection = itinerary("longer-connection", 1500, 1800, 1);

  shortConnection.legs[0]!.segments = [buildSegment(120)];
  longerConnection.legs[0]!.segments = [buildSegment(360)];

  const scored = scoreFilterAndSortResultsWithDiagnostics(
    [longerConnection, shortConnection],
    search
  );

  assert.deepEqual(scored.results.map((result) => result.id), [
    "short-connection",
    "longer-connection"
  ]);
});

function buildSegment(layoverAfterMinutes: number) {
  return {
    segmentOrder: 1,
    airline: "Test Air",
    originAirport: "BOS",
    destinationAirport: "DXB",
    departDate: "2026-12-24",
    durationMinutes: 720,
    layoverAfterMinutes
  };
}
