import { expect, test } from "@playwright/test";

const updateGuideScreenshots = process.env.UPDATE_GUIDE_SCREENSHOTS === "1";

const legacyStop = {
  id: "ec4f5f7f-1772-4312-bbcf-11c355c6e71c",
  user_id: "user-1",
  name: "TPL Rimessa 3",
  address: "Corso Enrico Pestalozzi 8 6900 Lugano",
  features: null,
  latitude: 46.00586757702194,
  longitude: 8.952323198318483,
};

const fulfillJson = (route, body, status = 200) =>
  route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });

const installSession = async (page) => {
  await page.addInitScript(() => {
    localStorage.setItem("access_token", "custom-stop-edit-token");
    localStorage.setItem("cache.currentUser.id", "user-1");
    localStorage.setItem("elettra_lang", "it");
  });
  await page.route("**/auth/me", (route) =>
    fulfillJson(route, { id: "user-1", email: "custom-stop@example.test" })
  );
  await page.route("**/api/v1/**", (route) => fulfillJson(route, []));
};

const installDepotApi = async (page, depot) => {
  let updateBody = null;
  await page.route("**/api/v1/user/depots/**", (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "PUT") {
      updateBody = request.postDataJSON();
      return fulfillJson(route, { ...depot, ...updateBody });
    }
    return fulfillJson(route, url.pathname.endsWith("/depots/") ? [depot] : depot);
  });
  return () => updateBody;
};

const openEditForm = async (page) => {
  await page.goto("./#custom-stops");
  await page.locator('.custom-stop-table [data-row-action="edit"]').click();
  await expect(page.locator("section.add-custom-stop")).toBeVisible();
};

test("an address search positions a custom stop while keeping the map picker available", async ({
  page,
}) => {
  await installSession(page);
  let reverseRequests = 0;
  const searchQueries = [];

  await page.route("**/reverse?**", (route) => {
    reverseRequests += 1;
    return fulfillJson(route, {
      display_name: "Via iniziale 1, Bellinzona",
      address: {
        road: "Via iniziale",
        house_number: "1",
        city: "Bellinzona",
      },
    });
  });
  await page.route("**/search?**", (route) => {
    const query = new URL(route.request().url()).searchParams.get("q");
    searchQueries.push(query);
    if (query?.startsWith("Indirizzo inesistente")) {
      return fulfillJson(route, []);
    }
    return fulfillJson(route, [
      {
        lat: "46.003677",
        lon: "8.951052",
        display_name: "Via Cantonale 10, Lugano",
        address: {
          road: "Via Cantonale",
          house_number: "10",
          city: "Lugano",
        },
      },
    ]);
  });

  await page.goto("./#custom-stops");
  await page.locator('[data-action="add-custom-stop"]').click();
  const address = page.locator("#custom-stop-address");
  const city = page.locator("#custom-stop-city");
  const searchButton = page.locator('[data-action="search-address"]');
  const searchFeedback = page.locator('[data-role="address-search-feedback"]');

  await expect(page.locator("section.add-custom-stop")).toBeVisible();
  await expect(address).toBeEditable();
  await expect(searchButton).toHaveText("Cerca sulla mappa");
  await expect(page.locator("#custom-stop-latitude")).not.toHaveValue("");

  await address.fill("Via Cantonale 10");
  await city.fill("Lugano");
  await page.waitForTimeout(100);
  expect(searchQueries).toEqual([]);

  await searchButton.click();
  await expect.poll(() => searchQueries).toEqual([
    "Via Cantonale 10, Lugano",
  ]);
  await expect(address).toHaveValue("Via Cantonale 10");
  await expect(city).toHaveValue("Lugano");
  await expect(page.locator("#custom-stop-latitude")).toHaveValue("46.003677");
  await expect(page.locator("#custom-stop-longitude")).toHaveValue("8.951052");
  await expect(searchFeedback).toHaveText("Posizione aggiornata sulla mappa.");
  await expect(searchFeedback).toHaveAttribute("data-tone", "success");
  await page.waitForTimeout(600);
  expect(reverseRequests).toBe(1);

  await address.fill("Indirizzo inesistente");
  await address.press("Enter");
  await expect.poll(() => searchQueries.length).toBe(2);
  await expect(searchFeedback).toHaveText(
    "Nessun indirizzo corrispondente trovato. Aggiungi la città o controlla l'indirizzo."
  );
  await expect(searchFeedback).toHaveAttribute("data-tone", "error");
  await expect(page.locator("#custom-stop-latitude")).toHaveValue("46.003677");
  await expect(page.locator("#custom-stop-longitude")).toHaveValue("8.951052");
});

test("legacy stop recovers its missing city and can be assigned a type", async ({
  page,
}) => {
  await installSession(page);
  const getUpdateBody = await installDepotApi(page, legacyStop);
  await page.route("**/reverse?**", (route) =>
    fulfillJson(route, {
      display_name: "Corso Enrico Pestalozzi 8, Lugano",
      address: { road: "Corso Enrico Pestalozzi", house_number: "8", city: "Lugano" },
    })
  );

  await openEditForm(page);
  await expect(page.locator("#custom-stop-name")).toHaveValue("TPL Rimessa 3");
  await expect(page.locator("#custom-stop-type")).toHaveValue("");
  await expect(page.locator("#custom-stop-city")).toHaveValue("Lugano");
  await expect(page.locator("#custom-stop-city")).toBeEditable();

  await page.selectOption("#custom-stop-type", "depot");
  if (updateGuideScreenshots) {
    await page.setViewportSize({ width: 1760, height: 1080 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: "guide/images/custom-stop.png" });
  }
  await page.locator('button[type="submit"]').click();

  await expect.poll(getUpdateBody).not.toBeNull();
  expect(getUpdateBody().features).toEqual({ type: "depot", city: "Lugano" });
});

test("legacy stop remains editable when reverse geocoding is unavailable", async ({
  page,
}) => {
  await installSession(page);
  const depot = {
    ...legacyStop,
    features: { legacy_code: "TPL-3", notes: "Existing note" },
  };
  const getUpdateBody = await installDepotApi(page, depot);
  await page.route("**/reverse?**", (route) => fulfillJson(route, {}, 503));

  await openEditForm(page);
  await page.locator('button[type="submit"]').click();
  await expect(page.locator('[data-role="feedback"]')).toHaveText(
    "Il campo Tipo è obbligatorio."
  );
  await expect(page.locator("#custom-stop-type")).toHaveAttribute(
    "aria-invalid",
    "true"
  );

  await page.selectOption("#custom-stop-type", "depot");
  await page.locator('button[type="submit"]').click();
  await expect(page.locator('[data-role="feedback"]')).toHaveText(
    "Il campo Città è obbligatorio."
  );
  await expect(page.locator("#custom-stop-city")).toHaveAttribute(
    "aria-invalid",
    "true"
  );

  await page.locator("#custom-stop-city").fill("Lugano");
  await page.locator('button[type="submit"]').click();

  await expect.poll(getUpdateBody).not.toBeNull();
  expect(getUpdateBody().features).toEqual({
    legacy_code: "TPL-3",
    notes: "Existing note",
    type: "depot",
    city: "Lugano",
  });
});

test("editing a current stop preserves its complete feature payload", async ({
  page,
}) => {
  await installSession(page);
  const depot = {
    ...legacyStop,
    features: {
      type: "charging",
      city: "Lugano",
      notes: "Fast charging",
      charging_profile: "legacy-compatible",
    },
  };
  const getUpdateBody = await installDepotApi(page, depot);

  await openEditForm(page);
  await expect(page.locator("#custom-stop-type")).toHaveValue("charging");
  await expect(page.locator("#custom-stop-city")).toHaveValue("Lugano");
  await page.locator('button[type="submit"]').click();

  await expect.poll(getUpdateBody).not.toBeNull();
  expect(getUpdateBody().features).toEqual(depot.features);
});
