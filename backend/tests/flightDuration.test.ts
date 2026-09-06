import assert from "node:assert/strict";
import test from "node:test";
import { sumJourneyDurationMinutes } from "../src/services/flightDuration.js";

test("calculates journey duration from flights and layovers without local-time subtraction", () => {
  const duration = sumJourneyDurationMinutes(
    [{ duration: 12 * 60 + 10 }, { duration: 4 * 60 + 25 }],
    [{ duration: 6 * 60 + 35 }]
  );

  assert.equal(duration, 23 * 60 + 10);
});
