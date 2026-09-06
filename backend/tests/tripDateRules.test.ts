import assert from "node:assert/strict";
import test from "node:test";
import { deriveLatestDepartDate } from "../src/services/tripDateRules.js";

test("derives the latest feasible departure from return date and minimum stay", () => {
  const draft = deriveLatestDepartDate({
    tripType: "ROUND_TRIP" as const,
    earliestDepartDate: "2026-12-24",
    latestDepartDate: null,
    latestReturnDate: "2027-01-31",
    minTripDays: 30
  });

  assert.equal(draft.latestDepartDate, "2027-01-01");
});

test("preserves an explicitly earlier latest departure", () => {
  const draft = deriveLatestDepartDate({
    tripType: "ROUND_TRIP" as const,
    earliestDepartDate: "2026-12-24",
    latestDepartDate: "2026-12-28",
    latestReturnDate: "2027-01-31",
    minTripDays: 30
  });

  assert.equal(draft.latestDepartDate, "2026-12-28");
});

test("does not derive an impossible departure window", () => {
  const draft = deriveLatestDepartDate({
    tripType: "ROUND_TRIP" as const,
    earliestDepartDate: "2027-01-15",
    latestDepartDate: null,
    latestReturnDate: "2027-01-31",
    minTripDays: 30
  });

  assert.equal(draft.latestDepartDate, null);
});
