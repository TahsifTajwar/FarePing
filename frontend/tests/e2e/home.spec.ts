import { expect, test } from "@playwright/test";

test("home page presents the product and a clear search action", async ({ page }, testInfo) => {
  await page.goto("/");

  await expect(page.locator("h1", { hasText: "Chord" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Plan a trip" })).toHaveAttribute("href", "/search");
  await expect(page.getByRole("link", { name: "Saved alerts" })).toHaveAttribute("href", "/alerts");
  await expect(page.getByRole("heading", { name: "Flexible windows" })).toBeInViewport();

  const globe = page.locator('canvas[data-testid="night-globe"]');
  await expect(globe).toBeVisible();
  await expect(globe).toHaveAttribute("data-route-vehicle", "plane");
  expect(Number(await globe.getAttribute("data-route-count"))).toBe(8);
  expect(Number(await globe.getAttribute("data-route-min-radius"))).toBeGreaterThanOrEqual(2.489);
  await expect.poll(async () => Number(await globe.getAttribute("data-frame"))).toBeGreaterThan(2);

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

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
  expect(hasHorizontalOverflow).toBe(false);

  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath(`home-${testInfo.project.name}.png`)
  });
});
