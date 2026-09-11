import { expect, test } from "@playwright/test";

test("browser-autofilled email remains visible in the sign-in field", async ({ page }) => {
  await page.route("**/api/saved-searches", (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "Sign in required" }) })
  );
  await page.goto("/alerts");

  await page.getByText("Sign in", { exact: true }).click();
  const emailInput = page.locator('input[name="email"]');
  await emailInput.evaluate((input: HTMLInputElement) => {
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    valueSetter?.call(input, "saved@example.com");
  });

  await expect(emailInput).toHaveValue("saved@example.com");
  await page.evaluate(() => window.dispatchEvent(new Event("fareping-auth-session-changed")));
  await expect(emailInput).toHaveValue("saved@example.com");
});
