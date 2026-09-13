import { expect, test, type Locator } from "@playwright/test";

const resultsSession = {
  requestBody: {
    tripType: "ROUND_TRIP",
    originAirports: ["BOS"],
    destinationAirports: ["DAC"],
    earliestDepartDate: "2026-12-29",
    latestReturnDate: "2027-01-31",
    minTripDays: 30,
    maxPrice: 2000,
    maxStops: 1
  },
  searchedAt: "2026-09-09T18:00:00.000Z",
  results: [
    {
      id: "best-emirates",
      type: "ROUND_TRIP",
      totalPrice: 1664,
      currency: "USD",
      savingsComparedToRoundTrip: null,
      summary: "Emirates round trip",
      totalDurationMinutes: 2825,
      dealScore: 880,
      qualityLabel: "Strong value",
      warning: null,
      carryOnIncluded: true,
      legs: [
        {
          direction: "OUTBOUND",
          airline: "Emirates",
          originAirport: "BOS",
          destinationAirport: "DAC",
          price: 832,
          departDate: "2026-12-29",
          departTime: "22:10",
          arrivalTime: "08:20",
          durationMinutes: 1390,
          stops: 1,
          bookingLink: "https://example.com/emirates",
          segments: [
            {
              segmentOrder: 0,
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
              segmentOrder: 1,
              airline: "Emirates",
              flightNumber: "EK 582",
              originAirport: "DXB",
              destinationAirport: "DAC",
              departDate: "2026-12-31",
              departTime: "01:55",
              arrivalDate: "2026-12-31",
              arrivalTime: "08:20",
              durationMinutes: 265
            }
          ]
        },
        {
          direction: "RETURN",
          airline: "Emirates",
          originAirport: "DAC",
          destinationAirport: "BOS",
          price: 832,
          departDate: "2027-01-31",
          departTime: "01:00",
          arrivalTime: "13:55",
          durationMinutes: 1435,
          stops: 1,
          bookingLink: "https://example.com/emirates",
          segments: [
            {
              segmentOrder: 0,
              airline: "Emirates",
              flightNumber: "EK 585",
              originAirport: "DAC",
              destinationAirport: "DXB",
              departDate: "2027-01-31",
              departTime: "01:00",
              arrivalDate: "2027-01-31",
              arrivalTime: "04:25",
              durationMinutes: 325,
              layoverAfterMinutes: 255
            },
            {
              segmentOrder: 1,
              airline: "Emirates",
              flightNumber: "EK 237",
              originAirport: "DXB",
              destinationAirport: "BOS",
              departDate: "2027-01-31",
              departTime: "08:40",
              arrivalDate: "2027-01-31",
              arrivalTime: "13:55",
              durationMinutes: 805
            }
          ]
        }
      ]
    },
    {
      id: "split-value",
      type: "SPLIT_ONE_WAYS",
      totalPrice: 1490,
      currency: "USD",
      savingsComparedToRoundTrip: 174,
      summary: "Separate one-way tickets",
      totalDurationMinutes: 2700,
      dealScore: 810,
      qualityLabel: "Great value",
      warning: "Separate tickets may have different baggage and change rules.",
      carryOnIncluded: null,
      legs: [
        {
          direction: "OUTBOUND",
          airline: "Turkish Airlines",
          originAirport: "BOS",
          destinationAirport: "DAC",
          price: 760,
          departDate: "2026-12-30",
          departTime: "20:00",
          arrivalTime: "05:15",
          durationMinutes: 1320,
          stops: 1,
          bookingLink: "https://example.com/outbound"
        },
        {
          direction: "RETURN",
          airline: "Qatar Airways",
          originAirport: "DAC",
          destinationAirport: "BOS",
          price: 730,
          departDate: "2027-01-31",
          departTime: "10:45",
          arrivalTime: "19:20",
          durationMinutes: 1380,
          stops: 1,
          bookingLink: "https://example.com/return"
        }
      ]
    },
    {
      id: "nonstop-option",
      type: "ROUND_TRIP",
      totalPrice: 1780,
      currency: "USD",
      savingsComparedToRoundTrip: null,
      summary: "Nonstop round trip",
      totalDurationMinutes: 2440,
      dealScore: 760,
      qualityLabel: "Fastest",
      warning: null,
      carryOnIncluded: true,
      legs: [
        {
          direction: "OUTBOUND",
          airline: "Example Air",
          originAirport: "BOS",
          destinationAirport: "DAC",
          price: 890,
          departDate: "2026-12-29",
          departTime: "18:30",
          arrivalTime: "20:30",
          durationMinutes: 1220,
          stops: 0,
          bookingLink: "https://example.com/nonstop",
          segments: [
            {
              segmentOrder: 0,
              airline: "Example Air",
              flightNumber: "FP 101",
              originAirport: "BOS",
              destinationAirport: "DAC",
              departDate: "2026-12-29",
              departTime: "18:30",
              arrivalDate: "2026-12-30",
              arrivalTime: "20:30",
              durationMinutes: 1220
            }
          ]
        },
        {
          direction: "RETURN",
          airline: "Example Air",
          originAirport: "DAC",
          destinationAirport: "BOS",
          price: 890,
          departDate: "2027-01-31",
          departTime: "09:30",
          arrivalTime: "12:00",
          durationMinutes: 1220,
          stops: 0,
          bookingLink: "https://example.com/nonstop",
          segments: [
            {
              segmentOrder: 0,
              airline: "Example Air",
              flightNumber: "FP 102",
              originAirport: "DAC",
              destinationAirport: "BOS",
              departDate: "2027-01-31",
              departTime: "09:30",
              arrivalDate: "2027-01-31",
              arrivalTime: "12:00",
              durationMinutes: 1220
            }
          ]
        }
      ]
    }
  ]
};

test("results are scannable, sortable, filterable, and expandable", async ({ page }, testInfo) => {
  await page.addInitScript((session) => {
    window.sessionStorage.setItem("fareping-current-results", JSON.stringify(session));
  }, resultsSession);

  await page.route("**/api/airports/resolve?**", async (route) => {
    const code = new URL(route.request().url()).searchParams.get("q") ?? "";
    const municipalities: Record<string, string> = {
      BOS: "Boston",
      DAC: "Dhaka",
      DXB: "Dubai"
    };
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        airports: [
          {
            iataCode: code,
            name: `${municipalities[code] ?? code} Airport`,
            municipality: municipalities[code] ?? code,
            country: "",
            region: "",
            type: "large_airport"
          }
        ]
      })
    });
  });

  await page.goto("/results/current");

  await expect(page.getByRole("heading", { name: "Boston to Dhaka", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Boston to Dhaka", exact: true })).toBeFocused();
  await expect(page.getByRole("heading", { name: "Watch this trip" })).toBeVisible();
  await expect(page.getByText("Sign in to save alerts", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Sign in", { exact: true })).toHaveCount(1);
  await expect(page.getByTestId("flight-result")).toHaveCount(3);
  await expect(page.getByText("6h 35m layover in DXB")).toBeHidden();

  const collapsedConnectors = page
    .getByTestId("flight-result")
    .first()
    .getByTestId("flight-route-connector");
  await expect(collapsedConnectors).toHaveCount(2);
  await expectConnectorsCentered(collapsedConnectors);

  const detailsButton = page
    .getByTestId("flight-result")
    .first()
    .locator('button[aria-controls^="flight-details-"]');
  const detailsId = await detailsButton.getAttribute("aria-controls");
  expect(detailsId).toBeTruthy();
  await expect(detailsButton).toHaveAttribute("aria-expanded", "false");
  await detailsButton.click();
  await expect(detailsButton).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(`#${detailsId}`)).toBeVisible();
  await expect(page.getByText("6h 35m layover in DXB")).toBeVisible();
  await expect(page.getByText("EK 238")).toBeVisible();
  await expectConnectorsCentered(
    page.getByTestId("flight-result").first().getByTestId("flight-route-connector")
  );

  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath(`results-expanded-${testInfo.project.name}.png`)
  });

  await page.getByRole("button", { name: "Cheapest" }).click();
  await expect(page.getByTestId("flight-result").first()).toContainText("USD 1490");

  await page.getByLabel("Filter by stops").selectOption("NONSTOP");
  await expect(page.getByTestId("flight-result")).toHaveCount(1);
  await expect(page.getByTestId("flight-result")).toContainText("Example Air");
  await expect(page.getByTestId("flight-result")).toContainText("FP 101");
  await expect(
    page.getByTestId("flight-result").locator('button[aria-controls^="flight-details-"]')
  ).toHaveCount(0);

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
  expect(hasHorizontalOverflow).toBe(false);

  const globe = page.locator('canvas[data-testid="night-globe"]');
  await expect(globe).toBeVisible();
  const pixelStats = await globe.evaluate((canvas: HTMLCanvasElement) => {
    const sample = document.createElement("canvas");
    sample.width = 60;
    sample.height = 60;
    const context = sample.getContext("2d");
    if (!context) return { lit: 0, range: 0 };
    context.drawImage(canvas, 0, 0, sample.width, sample.height);
    const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
    let lit = 0;
    let minimum = 255;
    let maximum = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const luminance = (pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3;
      if (luminance > 10) lit += 1;
      minimum = Math.min(minimum, luminance);
      maximum = Math.max(maximum, luminance);
    }
    return { lit, range: maximum - minimum };
  });
  expect(pixelStats.lit).toBeGreaterThan(40);
  expect(pixelStats.range).toBeGreaterThan(15);

  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath(`results-${testInfo.project.name}.png`)
  });
});

test("results survive when an email sign-in link opens in a new tab", async ({ page }) => {
  await page.addInitScript((session) => {
    const freshSession = { ...session, searchedAt: new Date().toISOString() };
    window.localStorage.setItem(
      "fareping-current-results-auth-backup",
      JSON.stringify(freshSession)
    );
  }, resultsSession);

  await page.route("**/api/airports/resolve?**", async (route) => {
    const code = new URL(route.request().url()).searchParams.get("q") ?? "";
    const municipalities: Record<string, string> = { BOS: "Boston", DAC: "Dhaka" };
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        airports: [{
          iataCode: code,
          name: `${municipalities[code] ?? code} Airport`,
          municipality: municipalities[code] ?? code,
          country: "",
          region: "",
          type: "large_airport"
        }]
      })
    });
  });

  await page.goto("/results/current");

  await expect(page.getByRole("heading", { name: "Boston to Dhaka", exact: true })).toBeVisible();
  await expect(page.getByTestId("flight-result")).toHaveCount(3);
  await expect.poll(() => page.evaluate(() =>
    Boolean(window.sessionStorage.getItem("fareping-current-results"))
  )).toBe(true);
});

test("existing session-only results are backfilled before sign-in", async ({ page }) => {
  await page.addInitScript((session) => {
    if (!window.localStorage.getItem("fareping-current-results-auth-backup")) {
      window.sessionStorage.setItem("fareping-current-results", JSON.stringify(session));
    }
  }, resultsSession);

  await page.route("**/api/airports/resolve?**", async (route) => {
    const code = new URL(route.request().url()).searchParams.get("q") ?? "";
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        airports: [{
          iataCode: code,
          name: `${code} Airport`,
          municipality: code === "BOS" ? "Boston" : code === "DAC" ? "Dhaka" : code,
          country: "",
          region: "",
          type: "large_airport"
        }]
      })
    });
  });

  await page.goto("/results/current");
  await expect(page.getByRole("heading", { name: "Boston to Dhaka", exact: true })).toBeVisible();

  const backupWasCreated = await page.evaluate(() => {
    const storedBackup = window.localStorage.getItem("fareping-current-results-auth-backup");
    if (!storedBackup) return false;
    const backup = JSON.parse(storedBackup) as { backedUpAt?: string; currentResults?: unknown };
    return Boolean(backup.backedUpAt && backup.currentResults);
  });
  expect(backupWasCreated).toBe(true);

  await page.evaluate(() => window.sessionStorage.removeItem("fareping-current-results"));
  await page.reload();
  await expect(page.getByRole("heading", { name: "Boston to Dhaka", exact: true })).toBeVisible();
});

test("empty results explain which constraint removed the options", async ({ page }, testInfo) => {
  await page.addInitScript((session) => {
    window.sessionStorage.setItem("fareping-current-results", JSON.stringify(session));
  }, {
    ...resultsSession,
    results: [],
    diagnostics: {
      provider: "mock",
      requestedProvider: "mock",
      providerDiagnostics: {
        rawItinerariesFound: 6,
        providerErrors: []
      },
      scoringDiagnostics: {
        rawItinerariesReceived: 6,
        rawItinerariesByType: { ROUND_TRIP: 6 },
        removedByRouteRules: 0,
        removedByStayRules: 6,
        removedByStopsRules: 0,
        removedByLayoverRules: 0,
        scoredItineraries: 0,
        hiddenByScoreOrPriceRules: 0,
        visibleItineraries: 0,
        visibleItinerariesByType: {},
        cheapestRawPrice: 1320,
        shortestRawDurationMinutes: 1200,
        minVisibleDealScore: null,
        maxPriceOverBudgetShown: 0,
        topScores: []
      }
    }
  });

  await page.goto("/results/current");

  await expect(
    page.getByRole("heading", { name: "The available trips did not fit your stay length" })
  ).toBeVisible();
  await expect(page.getByText("6 removed by stay rules", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Adjust search" })).toHaveAttribute(
    "href",
    "/search#search-setup"
  );
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath(`results-empty-${testInfo.project.name}.png`)
  });
});

async function expectConnectorsCentered(connectors: Locator) {
  const offsets = await connectors.evaluateAll((elements) =>
    elements.map((element) => {
      const connectorBounds = element.getBoundingClientRect();
      const marker = element.querySelector('[data-testid="flight-route-marker"]');
      if (!marker) return Number.POSITIVE_INFINITY;
      const markerBounds = marker.getBoundingClientRect();
      return Math.abs(
        markerBounds.left + markerBounds.width / 2 -
          (connectorBounds.left + connectorBounds.width / 2)
      );
    })
  );

  for (const offset of offsets) {
    expect(offset).toBeLessThanOrEqual(1);
  }
}
