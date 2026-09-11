import { expect, test } from "@playwright/test";

test("search workspace is usable without horizontal overflow", async ({ page }, testInfo) => {
  await page.goto("/search");

  await expect(page.getByRole("heading", { name: "Plan a flight." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ask Luna" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Manual" })).toBeVisible();

  const globe = page.locator('canvas[data-testid="night-globe"]');
  await expect(globe).toBeVisible();
  const globeBox = await globe.boundingBox();
  expect(globeBox?.width).toBeGreaterThanOrEqual(page.viewportSize()?.width ?? 0);
  expect(globeBox?.height).toBeGreaterThan(500);

  const firstFrame = Number(await globe.getAttribute("data-frame"));
  await page.waitForTimeout(300);
  const nextFrame = Number(await globe.getAttribute("data-frame"));
  expect(nextFrame).toBeGreaterThan(firstFrame);

  await globe.dispatchEvent("pointermove", { clientX: 120, clientY: 180 });
  await expect(globe).toHaveAttribute("data-interactive", "true");

  const rotationBeforeDrag = Number(await globe.getAttribute("data-rotation-y"));
  await globe.dispatchEvent("pointerdown", { pointerId: 7, clientX: 120, clientY: 180 });
  await expect(page.locator("body")).toHaveClass(/fareping-globe-dragging/);
  await globe.dispatchEvent("pointermove", { pointerId: 7, clientX: 220, clientY: 180 });
  await globe.dispatchEvent("pointerup", { pointerId: 7, clientX: 220, clientY: 180 });
  await expect(page.locator("body")).not.toHaveClass(/fareping-globe-dragging/);
  await page.waitForTimeout(250);
  const rotationAfterDrag = Number(await globe.getAttribute("data-rotation-y"));
  expect(Math.abs(rotationAfterDrag - rotationBeforeDrag)).toBeGreaterThan(0.04);

  const pixelStats = await globe.evaluate((canvas: HTMLCanvasElement) => {
    const sample = document.createElement("canvas");
    sample.width = 80;
    sample.height = 80;
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
  expect(pixelStats.lit).toBeGreaterThan(80);
  expect(pixelStats.range).toBeGreaterThan(20);

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
  expect(hasHorizontalOverflow).toBe(false);

  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath(`search-luna-${testInfo.project.name}.png`)
  });

  await page.getByRole("button", { name: "Manual" }).click();
  await expect(page.getByLabel("From")).toBeVisible();
  await expect(page.getByLabel("Latest return")).toBeVisible();

  const roundTripLabel = page.getByLabel("Round trip").locator("..");
  const oneWayLabel = page.getByLabel("One way").locator("..");
  const [activeTripTypeColor, inactiveTripTypeColor] = await Promise.all([
    roundTripLabel.evaluate((element) => getComputedStyle(element).color),
    oneWayLabel.evaluate((element) => getComputedStyle(element).color)
  ]);
  expect(activeTripTypeColor).toBe("rgb(7, 17, 15)");
  expect(inactiveTripTypeColor).not.toBe(activeTripTypeColor);

  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath(`search-manual-${testInfo.project.name}.png`)
  });
});

test("failed searches preserve the request and can be retried", async ({ page }, testInfo) => {
  const requestBodies: Record<string, unknown>[] = [];
  let releaseFirstRequest: (() => void) | undefined;

  await page.route("**/api/flights/search", async (route) => {
    requestBodies.push(route.request().postDataJSON() as Record<string, unknown>);

    if (requestBodies.length === 1) {
      await new Promise<void>((resolve) => {
        releaseFirstRequest = resolve;
      });
      await route.abort("failed");
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ results: [] })
    });
  });

  await page.goto("/search");
  await page.getByRole("button", { name: "Manual" }).click();
  await page.getByLabel("From").fill("BOS");
  await page.getByRole("textbox", { name: "To", exact: true }).fill("DAC");
  await page.getByLabel("Earliest departure").fill("2027-01-01");
  await page.getByLabel("Latest return").fill("2027-01-10");
  await page.getByLabel("Minimum stay days").fill("4");
  await page.getByLabel("Max price").fill("2000");

  const searchButton = page.getByRole("button", { name: "Search flights" });
  await searchButton.click();

  await expect(page.getByTestId("flight-search-progress")).toBeVisible();
  await expect(page.getByText("Preparing combinations", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Searching..." })).toBeDisabled();
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath(`search-progress-${testInfo.project.name}.png`)
  });
  await expect.poll(() => Boolean(releaseFirstRequest)).toBe(true);
  expect(requestBodies).toHaveLength(1);
  releaseFirstRequest?.();

  await expect(
    page.getByRole("heading", { name: "FarePing could not reach the search service" })
  ).toBeVisible();
  await expect(page.getByTestId("flight-search-error")).toBeFocused();
  await expect(page.getByText("fetch failed", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Review trip" })).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath(`search-error-${testInfo.project.name}.png`)
  });

  await page.getByRole("button", { name: "Retry search" }).click();
  await expect(page).toHaveURL(/\/results\/current$/);
  expect(requestBodies).toHaveLength(2);
  expect(requestBodies[1]).toEqual(requestBodies[0]);
});

test("additional airport suggestions open a selector and preserve existing airports", async ({
  page
}) => {
  await page.route("**/api/trip-assistant/message", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        reply: "I found additional departure airports for you to confirm.",
        tripDraft: {
          tripType: "ROUND_TRIP",
          originAirports: ["BOS"],
          destinationAirports: ["DAC"],
          earliestDepartDate: "2026-09-28",
          latestDepartDate: "2026-09-29",
          earliestReturnDate: null,
          latestReturnDate: "2027-01-31",
          minTripDays: 30,
          maxTripDays: null,
          maxPrice: 2000,
          phone: null,
          minTripDaysProvided: true,
          earliestReturnDateSkipped: true,
          maxTripDaysProvided: false,
          maxTripDaysFlexible: true
        },
        missingFields: ["phone"],
        readyToSearch: true,
        readyToSaveAlert: false,
        airportOptions: {
          origins: [
            {
              iataCode: "JFK",
              name: "John F Kennedy International Airport",
              municipality: "New York",
              country: "United States",
              region: "New York",
              type: "large_airport"
            },
            {
              iataCode: "EWR",
              name: "Newark Liberty International Airport",
              municipality: "Newark",
              country: "United States",
              region: "New Jersey",
              type: "large_airport"
            },
            {
              iataCode: "BDL",
              name: "Bradley International Airport",
              municipality: "Hartford",
              country: "United States",
              region: "Connecticut",
              type: "large_airport"
            }
          ],
          destinations: []
        }
      })
    });
  });

  await page.goto("/search");
  await page.getByRole("button", { name: "Manual" }).click();
  await page.getByLabel("From").fill("BOS");
  await page.getByRole("button", { name: "Ask Luna" }).click();
  await page.getByPlaceholder("Route, dates, budget, or reply...").fill(
    "Add NYC and Hartford departure airports"
  );
  await page.getByRole("button", { name: "Send" }).click();

  const airportSelector = page.getByRole("dialog", { name: "Departure airports" });
  await expect(airportSelector).toBeVisible();
  await expect(airportSelector).toBeFocused();
  await expect(page.getByText("Already included: BOS", { exact: true })).toBeVisible();
  await airportSelector.press("Escape");
  await expect(airportSelector).toBeHidden();
  await expect(page.getByPlaceholder("Route, dates, budget, or reply...")).toBeFocused();

  await page.getByPlaceholder("Route, dates, budget, or reply...").fill(
    "Add NYC and Hartford departure airports"
  );
  await page.getByRole("button", { name: "Send" }).click();
  await expect(airportSelector).toBeFocused();
  await page.getByRole("button", { name: "Add selected airports" }).click();

  await expect(page.locator(".fareping-trip-readout")).toContainText(
    "BOS / JFK / EWR / BDL"
  );
  await expect(page.getByPlaceholder("Route, dates, budget, or reply...")).toBeFocused();
});

test("round-trip search can omit the latest departure date", async ({ page }) => {
  let requestBody: Record<string, unknown> | null = null;

  await page.route("**/api/flights/search", async (route) => {
    requestBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ results: [] })
    });
  });

  await page.goto("/search");
  await page.getByRole("button", { name: "Manual" }).click();
  await page.getByLabel("From").fill("BOS");
  await page.getByRole("textbox", { name: "To", exact: true }).fill("DAC");
  await page.getByLabel("Earliest departure").fill("2027-01-01");
  await page.getByLabel("Latest return").fill("2027-01-10");
  await page.getByLabel("Minimum stay days").fill("4");
  await page.getByLabel("Max price").fill("2000");
  await page.getByRole("button", { name: "Search flights" }).click();

  await expect(page).toHaveURL(/\/results\/current$/);
  await expect(page.getByRole("heading", { name: "Try a little more flexibility" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "BOS to DAC" })).toBeFocused();
  expect(requestBody).not.toBeNull();
  expect(requestBody).not.toHaveProperty("latestDepartDate");
});
