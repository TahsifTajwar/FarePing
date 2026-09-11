import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOneWayDepartureDates,
  buildRoundTripDatePairs,
  buildSerpApiSearchPlan
} from "../src/services/flightProviders/serpApiSearchPlan.js";
import type { FlightSearchInput } from "../src/services/flightProviders/types.js";

const baseSearch: FlightSearchInput = {
  tripType: "ROUND_TRIP",
  originAirports: ["BOS", "JFK", "EWR", "LGA"],
  destinationAirports: ["DAC"],
  earliestDepartDate: "2027-01-01",
  latestDepartDate: "2027-01-02",
  latestReturnDate: "2027-02-01",
  minTripDays: 30,
  maxTripDays: 31,
  maxPrice: 2000,
  maxStops: 1
};

test("round-trip planning honors latest departure and stay boundaries", () => {
  assert.deepEqual(buildRoundTripDatePairs(baseSearch, 10), [
    { departureDate: "2027-01-01", returnDate: "2027-01-31" },
    { departureDate: "2027-01-01", returnDate: "2027-02-01" },
    { departureDate: "2027-01-02", returnDate: "2027-02-01" }
  ]);
});

test("round-trip sampling never includes departures after latest departure", () => {
  const pairs = buildRoundTripDatePairs(
    {
      ...baseSearch,
      latestDepartDate: "2027-01-03",
      latestReturnDate: "2027-01-20",
      minTripDays: 4,
      maxTripDays: 8
    },
    3
  );

  assert.equal(pairs.length, 3);
  assert.ok(pairs.every((pair) => pair.departureDate <= "2027-01-03"));
  assert.equal(pairs[0]?.departureDate, "2027-01-01");
  assert.equal(pairs.at(-1)?.departureDate, "2027-01-03");
});

test("round-trip planning derives the departure ceiling when latest departure is omitted", () => {
  const pairs = buildRoundTripDatePairs(
    {
      ...baseSearch,
      earliestDepartDate: "2027-01-01",
      latestDepartDate: undefined,
      latestReturnDate: "2027-01-10",
      minTripDays: 4,
      maxTripDays: 4
    },
    10
  );

  assert.equal(pairs.at(-1)?.departureDate, "2027-01-06");
  assert.equal(pairs.at(-1)?.returnDate, "2027-01-10");
  assert.ok(pairs.every((pair) => pair.departureDate <= "2027-01-06"));
});

test("round-trip sampling covers early, middle, and late departure dates", () => {
  const pairs = buildRoundTripDatePairs(
    {
      ...baseSearch,
      earliestDepartDate: "2026-12-24",
      latestDepartDate: "2027-01-01",
      latestReturnDate: "2027-01-31",
      minTripDays: 30,
      maxTripDays: undefined
    },
    3
  );

  assert.deepEqual(pairs, [
    { departureDate: "2026-12-24", returnDate: "2027-01-23" },
    { departureDate: "2026-12-28", returnDate: "2027-01-31" },
    { departureDate: "2027-01-01", returnDate: "2027-01-31" }
  ]);
});

test("round-trip planning excludes returns before the optional earliest return", () => {
  const pairs = buildRoundTripDatePairs(
    {
      ...baseSearch,
      earliestDepartDate: "2026-12-24",
      latestDepartDate: "2027-01-01",
      earliestReturnDate: "2027-01-30",
      latestReturnDate: "2027-01-31",
      minTripDays: 30,
      maxTripDays: undefined
    },
    3
  );

  assert.deepEqual(pairs, [
    { departureDate: "2026-12-24", returnDate: "2027-01-30" },
    { departureDate: "2026-12-28", returnDate: "2027-01-31" },
    { departureDate: "2027-01-01", returnDate: "2027-01-31" }
  ]);
  assert.ok(pairs.every((pair) => pair.returnDate >= "2027-01-30"));
});

test("one-way planning samples the optional departure window", () => {
  assert.deepEqual(
    buildOneWayDepartureDates(
      {
        ...baseSearch,
        tripType: "ONE_WAY",
        earliestDepartDate: "2027-01-01",
        latestDepartDate: "2027-01-05",
        latestReturnDate: undefined,
        minTripDays: undefined,
        maxTripDays: undefined
      },
      3
    ),
    ["2027-01-01", "2027-01-03", "2027-01-05"]
  );
});

test("search planning calculates the split-ticket request budget", () => {
  const plan = buildSerpApiSearchPlan(baseSearch, {
    maxDatePairs: 3,
    roundTripOutboundOptions: 4,
    compareSplitOneWays: true,
    maxRequests: 25
  });

  assert.equal(plan.datePairs.length, 3);
  assert.equal(plan.estimatedApiRequests, 21);
});

test("search planning rejects an over-budget search before requests begin", () => {
  assert.throws(
    () =>
      buildSerpApiSearchPlan(baseSearch, {
        maxDatePairs: 3,
        roundTripOutboundOptions: 4,
        compareSplitOneWays: true,
        maxRequests: 20
      }),
    /would use up to 21 requests/
  );
});
