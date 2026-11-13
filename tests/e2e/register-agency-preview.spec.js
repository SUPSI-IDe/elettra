import { expect, test } from "@playwright/test";

const agency = {
  id: "11111111-1111-4111-8111-111111111111",
  agency_name: "Trasporti Demo",
  gtfs_agency_id: "DEMO",
};

const fulfillJson = (route, body, status = 200) =>
  route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });

test("company selection shows a compact, responsive network confirmation", async ({
  page,
}) => {
  const tileRequests = [];
  await page.route("**/runtime-config.json", (route) =>
    route.fulfill({ json: { CARTO_API_KEY: "test-key" } })
  );
  await page.route("https://basemaps.cartocdn.com/**", (route) => {
    tileRequests.push(route.request().url());
    return route.fulfill({ status: 204 });
  });
  page.on("request", (request) => {
    if (/openstreetmap/i.test(request.url())) tileRequests.push(request.url());
  });
  await page.route("**/api/v1/agency/agencies/**", (route) =>
    fulfillJson(route, [agency])
  );
  await page.route(
    /\/api\/v1\/agency\/agencies\/[^/?]+\/network-preview$/,
    (route) =>
      fulfillJson(route, {
        agency_id: agency.id,
        agency_name: agency.agency_name,
        route_count: 2,
        lines: [
          {
            label: "1",
            color: "007f86",
            points: [
              { lat: 46.17, lon: 9.01 },
              { lat: 46.2, lon: 9.04 },
              { lat: 46.23, lon: 9.08 },
            ],
          },
          {
            label: "5",
            color: "c35a21",
            points: [
              { lat: 46.19, lon: 8.98 },
              { lat: 46.21, lon: 9.04 },
              { lat: 46.18, lon: 9.1 },
            ],
          },
        ],
      })
  );

  await page.goto("./#register");
  const preview = page.locator('[data-role="agency-network-preview"]');
  await expect(preview).toHaveAttribute("data-state", "idle");
  await expect(preview.locator('[data-preview-state="idle"]')).toBeEmpty();
  const agencyInput = page.locator("#register-agency");
  await expect(agencyInput).toBeEnabled();
  await agencyInput.fill("Trasporti");
  const agencyOption = page
    .locator('[data-role="agency-list"] .autocomplete-item')
    .filter({ hasText: agency.agency_name });
  await expect(agencyOption).toBeVisible();
  await agencyOption.click();

  await expect(preview).toHaveAttribute("data-state", "ready");
  await expect(preview.locator("path.leaflet-interactive")).toHaveCount(2);
  await expect(
    preview.locator('[data-role="agency-network-preview-summary"]')
  ).toHaveText("Trasporti Demo");
  await expect(preview.locator(".agency-network-preview__disclaimer")).toHaveText(
    "This map is indicative: routes are simplified and may not match every detail."
  );
  await expect(
    preview.locator('[data-role="agency-network-preview-routes"] > span')
  ).toHaveCount(2);
  await expect.poll(() => tileRequests.length).toBeGreaterThan(0);
  expect(tileRequests.some((url) => /openstreetmap/i.test(url))).toBe(false);

  const layout = await page.locator(".register-body").evaluate((element) => {
    const form = element.querySelector(".register-form-column").getBoundingClientRect();
    const map = element.querySelector(".agency-network-preview").getBoundingClientRect();
    return {
      viewportWidth: window.innerWidth,
      mapRightOfForm: map.left >= form.right,
      mapBelowForm: map.top >= form.bottom,
    };
  });
  if (layout.viewportWidth > 820) expect(layout.mapRightOfForm).toBe(true);
  else expect(layout.mapBelowForm).toBe(true);
});
