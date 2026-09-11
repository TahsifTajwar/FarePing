import { expect, test, type Page } from "@playwright/test";

const latestItinerary = {
  id: "saved-emirates",
  type: "ROUND_TRIP",
  totalPrice: 1540,
  currency: "USD",
  savingsComparedToRoundTrip: null,
  summary: "Emirates round trip",
  totalDurationMinutes: 2825,
  dealScore: 870,
  qualityLabel: "Strong value",
  warning: null,
  bookingTokens: [],
  totalStops: 1,
  legs: [
    {
      id: "outbound-leg",
      direction: "OUTBOUND",
      airline: "Emirates",
      originAirport: "BOS",
      destinationAirport: "DAC",
      price: 770,
      departDate: "2026-12-29",
      departTime: "22:10",
      arrivalTime: "08:20",
      durationMinutes: 1390,
      stops: 1,
      bookingLink: "https://example.com/emirates",
      segments: [
        {
          id: "segment-one",
          itineraryLegId: "outbound-leg",
          segmentOrder: 1,
          airline: "Emirates",
          flightNumber: "EK 238",
          originAirport: "BOS",
          destinationAirport: "DXB",
          departDate: "2026-12-29",
          departTime: "22:10",
          arrivalDate: "2026-12-30",
          arrivalTime: "19:20",
          durationMinutes: 730,
          layoverAfterMinutes: 395
        },
        {
          id: "segment-two",
          itineraryLegId: "outbound-leg",
          segmentOrder: 2,
          airline: "Emirates",
          flightNumber: "EK 582",
          originAirport: "DXB",
          destinationAirport: "DAC",
          departDate: "2026-12-31",
          departTime: "01:55",
          arrivalDate: "2026-12-31",
          arrivalTime: "08:20",
          durationMinutes: 265,
          layoverAfterMinutes: null
        }
      ]
    },
    {
      id: "return-leg",
      direction: "RETURN",
      airline: "Emirates",
      originAirport: "DAC",
      destinationAirport: "BOS",
      price: 770,
      departDate: "2027-01-31",
      departTime: "01:00",
      arrivalTime: "13:55",
      durationMinutes: 1435,
      stops: 1,
      bookingLink: "https://example.com/emirates",
      segments: []
    }
  ]
};

const savedSearch = {
  id: "trip-one",
  contactPhone: "+12145551234",
  tripType: "ROUND_TRIP",
  originAirports: ["BOS"],
  destinationAirports: ["DAC"],
  earliestDepartDate: "2026-12-29T00:00:00.000Z",
  latestDepartDate: null,
  earliestReturnDate: "2027-01-30T00:00:00.000Z",
  latestReturnDate: "2027-01-31T00:00:00.000Z",
  minTripDays: 30,
  maxTripDays: null,
  maxPrice: 1800,
  maxStops: 1,
  active: true,
  createdAt: "2026-09-09T18:00:00.000Z",
  resultBatches: [
    {
      id: "batch-latest",
      savedSearchId: "trip-one",
      checkedAt: "2026-09-10T16:00:00.000Z",
      bestPrice: 1540,
      itineraries: [latestItinerary]
    },
    {
      id: "batch-two",
      savedSearchId: "trip-one",
      checkedAt: "2026-09-09T16:00:00.000Z",
      bestPrice: 1602,
      itineraries: []
    },
    {
      id: "batch-one",
      savedSearchId: "trip-one",
      checkedAt: "2026-09-08T16:00:00.000Z",
      bestPrice: 1664,
      itineraries: []
    }
  ]
};

test.beforeEach(async ({ page }) => {
  await installMockSession(page);
  await page.route("**/api/health", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ flightProvider: "mock", scheduledFlightProvider: "mock" })
    })
  );
  await page.route("**/api/airports/resolve?**", async (route) => {
    const code = new URL(route.request().url()).searchParams.get("q") ?? "";
    const cities: Record<string, string> = { BOS: "Boston", DAC: "Dhaka", DXB: "Dubai" };
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        airports: [{ iataCode: code, name: `${cities[code] ?? code} Airport`, municipality: cities[code] ?? code, country: "", region: "", type: "large_airport" }]
      })
    });
  });
});

test("tracked trips are compact and actionable", async ({ page }, testInfo) => {
  await page.route("**/api/saved-searches", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        savedSearches: [
          { ...savedSearch, resultBatches: [savedSearch.resultBatches[0]] },
          {
            ...savedSearch,
            id: "trip-two",
            active: false,
            destinationAirports: ["LAX"],
            resultBatches: []
          }
        ]
      })
    })
  );

  await page.goto("/alerts");

  await expect(page.getByRole("heading", { name: "Your flight watchlist" })).toBeVisible();
  await expect(page.getByTestId("tracked-trip")).toHaveCount(2);
  await expect(page.getByText("$1540", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "View trip" }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ fullPage: true, path: testInfo.outputPath(`alerts-${testInfo.project.name}.png`) });

  await page.getByRole("button", { name: "Edit trip" }).first().click();
  await expect(page.getByText("Edit alert details")).toBeVisible();
  await expect(page.getByLabel("Latest departure (optional)")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("alert detail shows price history and reusable flight cards", async ({ page }, testInfo) => {
  await page.route("**/api/saved-searches/trip-one", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ savedSearch }) })
  );

  await page.goto("/alerts/trip-one");

  await expect(page.getByRole("heading", { name: "Boston to Dhaka", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Boston to Dhaka", exact: true })).toBeFocused();
  await expect(page.getByTestId("price-history")).toBeVisible();
  await expect(page.getByTestId("flight-result")).toHaveCount(1);
  await expect(page.getByText("6h 35m layover in DXB")).toBeHidden();
  await page.getByRole("button", { name: "Flight details" }).click();
  await expect(page.getByText("6h 35m layover in DXB")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ fullPage: true, path: testInfo.outputPath(`alert-detail-${testInfo.project.name}.png`) });
});

async function installMockSession(page: Page) {
  await page.addInitScript(() => {
    const futureExpiration = Math.floor(Date.now() / 1000) + 60 * 60;
    window.localStorage.setItem(
      "sb-ivxmxckzxzxchevxfhjz-auth-token",
      JSON.stringify({
        access_token: "playwright-access-token",
        refresh_token: "playwright-refresh-token",
        expires_in: 3600,
        expires_at: futureExpiration,
        token_type: "bearer",
        user: {
          id: "playwright-user",
          email: "traveler@example.com",
          aud: "authenticated",
          role: "authenticated"
        }
      })
    );
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
  expect(hasHorizontalOverflow).toBe(false);
}
