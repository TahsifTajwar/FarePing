import assert from "node:assert/strict";
import test from "node:test";
import { getLowestBookingOption } from "../src/services/flightProviders/serpApiFlightProvider.js";

test("selects the lowest current seller price", () => {
  assert.deepEqual(
    getLowestBookingOption([
      { together: { book_with: "Emirates", price: 1602 } },
      { together: { book_with: "Expedia", price: 1572 } }
    ]),
    { seller: "Expedia", price: 1572 }
  );
});

test("adds departing and returning prices for a separate-ticket option", () => {
  assert.deepEqual(
    getLowestBookingOption([
      {
        departing: { book_with: "Seller A", price: 500 },
        returning: { book_with: "Seller B", price: 600 }
      }
    ]),
    { seller: "Seller A + Seller B", price: 1100 }
  );
});
