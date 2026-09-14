import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSerpApiBookingQuery,
  getLowestBookingOption
} from "../src/services/flightProviders/serpApiFlightProvider.js";

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

test("includes the original round-trip context when verifying a booking token", () => {
  const query = buildSerpApiBookingQuery(
    {
      bookingToken: "booking-token-value",
      tripType: "ROUND_TRIP",
      originAirport: "AUS",
      destinationAirport: "MEL",
      departureDate: "2027-09-25",
      returnDate: "2027-10-07"
    },
    "test-key"
  );

  assert.equal(query.get("booking_token"), "booking-token-value");
  assert.equal(query.get("departure_id"), "AUS");
  assert.equal(query.get("arrival_id"), "MEL");
  assert.equal(query.get("outbound_date"), "2027-09-25");
  assert.equal(query.get("return_date"), "2027-10-07");
  assert.equal(query.get("type"), "1");
});
