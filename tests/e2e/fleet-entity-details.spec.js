import { expect, test } from "@playwright/test";

const busModel = {
  id: "bus-model-1",
  user_id: "user-1",
  name: "Electric 13",
  description: "Standard city service",
  specs: {
    vehicle_reference_key: "standard_electric_bus_12_13m",
    bus_length_m: 13,
    cost: 620000,
    max_passengers: 64,
    empty_weight_kg: 12800,
    bus_lifetime: 14,
    min_battery_packs: 8,
    max_battery_packs: 14,
    battery_pack_size_kwh: 42,
    battery_pack_cost_chf: 7200,
    max_charging_power_kw: 300,
    battery_pack_weight_kg: 265,
    battery_pack_lifetime: 7,
  },
};

const customStop = {
  id: "stop-1",
  user_id: "user-1",
  name: "Central depot",
  address: "Depot road 4",
  latitude: 46.195,
  longitude: 9.021,
  features: {
    type: "depot",
    city: "Bellinzona",
    notes: "Night charging",
  },
};

const fulfillJson = (route, body, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

const installSession = async (page, lang = "en") => {
  await page.addInitScript(({ lang }) => {
    localStorage.setItem("access_token", "fleet-details-token");
    localStorage.setItem("cache.currentUser.id", "user-1");
    localStorage.setItem("elettra_lang", lang);
  }, { lang });
  await page.route("**/auth/me", (route) =>
    fulfillJson(route, { id: "user-1", email: "fleet@example.test" })
  );
  await page.route("**/api/v1/**", (route) => fulfillJson(route, []));
};

test("bus model rows stay compact and expose complete details, edit and delete actions", async ({
  page,
}) => {
  await installSession(page, "it");
  let deleteRequests = 0;
  await page.route("**/api/v1/user/bus-models/**", (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "DELETE") {
      deleteRequests += 1;
      return fulfillJson(route, {});
    }
    if (url.pathname.endsWith("/bus-models/")) {
      return fulfillJson(route, {
        items: [{
          id: busModel.id,
          user_id: busModel.user_id,
          name: busModel.name,
          description: busModel.description,
        }],
        total: 1,
        skip: 0,
        limit: 20,
        count: 1,
        has_next: false,
        has_previous: false,
      });
    }
    return fulfillJson(route, busModel);
  });

  await page.goto("./#buses");
  const table = page.locator(".bus-models table");
  await expect(table.locator("thead th")).toHaveCount(5);
  await expect(table.locator("thead th").nth(1)).toHaveText("Nome");
  await expect(table.locator("thead th").nth(2)).toHaveText("Categoria veicolo");
  await expect(table.locator("thead th").nth(3)).toHaveText("Dimensione [m]");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await expect(table.locator("tbody td.model")).toHaveText(
    "Autobus elettrico standard — 13 m"
  );
  await expect(table.locator("tbody td.size")).toHaveText("13");
  await expect(table.locator("tbody [data-row-action]")).toHaveCount(3);

  await table.locator('[data-row-action="details"]').click();
  const dialog = page.locator('[data-role="bus-model-details-dialog"]');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[data-role="entity-details-title"]')).toHaveText(
    "Dettagli modello autobus — Electric 13"
  );
  await expect(dialog.locator(".entity-details__item")).toHaveCount(15);
  await expect(dialog).toContainText("Standard city service");
  await expect(dialog).toContainText("12800");
  await expect(dialog).toContainText("7200");
  await expect(dialog).toContainText("300");
  await dialog.locator('[data-action="close-details"]').click();
  await expect(dialog).not.toBeVisible();

  await table.locator('[data-row-action="edit"]').click();
  await expect(page.locator("section.add-bus-model")).toBeVisible();
  await expect(page.locator("#name")).toHaveValue("Electric 13");

  await page.goto("./#buses");
  await expect(page.locator(".bus-models tbody td.size")).toHaveText("13");
  page.once("dialog", (confirmation) => confirmation.accept());
  await page.locator('.bus-models [data-row-action="delete"]').click();
  await expect.poll(() => deleteRequests).toBe(1);
});

test("custom stop rows expose translated type and all popup fields with inline actions", async ({
  page,
}) => {
  await installSession(page, "en");
  let deleteRequests = 0;
  await page.route("**/api/v1/user/depots/**", (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "DELETE") {
      deleteRequests += 1;
      return fulfillJson(route, {});
    }
    if (url.pathname.endsWith("/depots/")) return fulfillJson(route, [customStop]);
    return fulfillJson(route, customStop);
  });

  await page.goto("./#custom-stops");
  const table = page.locator(".custom-stop-table table");
  await expect(table.locator("thead th")).toHaveCount(5);
  await expect(table.locator("tbody td.type")).toHaveText("Depot");
  await expect(table.locator("tbody [data-row-action]")).toHaveCount(3);

  await table.locator('[data-row-action="details"]').click();
  const dialog = page.locator('[data-role="custom-stop-details-dialog"]');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[data-role="entity-details-title"]')).toHaveText(
    "Custom stop details — Central depot"
  );
  await expect(dialog.locator(".entity-details__item")).toHaveCount(7);
  for (const value of [
    "Depot road 4",
    "Bellinzona",
    "Night charging",
    "46.195",
    "9.021",
  ]) {
    await expect(dialog).toContainText(value);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();

  await table.locator('[data-row-action="edit"]').click();
  await expect(page.locator("section.add-custom-stop")).toBeVisible();
  await expect(page.locator("#custom-stop-name")).toHaveValue("Central depot");

  await page.goto("./#custom-stops");
  page.once("dialog", (confirmation) => confirmation.accept());
  await page.locator('.custom-stop-table [data-row-action="delete"]').click();
  await expect.poll(() => deleteRequests).toBe(1);
});

test("detail popup content remains inert when API values contain markup", async ({ page }) => {
  await page.goto("./#landing");
  const result = await page.evaluate(async () => {
    window.__detailXss = 0;
    const moduleUrl = (path) => new URL(path, document.baseURI).href;
    const [{ initializeEntityDetailsDialog }, { buildBusModelDetailGroups }] =
      await Promise.all([
        import(moduleUrl("src/dom/entity-details.js")),
        import(moduleUrl("src/pages/Fleet/Buses/buses.js")),
      ]);
    const dialog = document.createElement("dialog");
    dialog.innerHTML = `
      <h2 data-role="entity-details-title"></h2>
      <div data-role="entity-details-content"></div>
      <button data-action="close-details">Close</button>`;
    document.body.append(dialog);
    const malicious = `<img src=x onerror="window.__detailXss += 1"><script>window.__detailXss += 10<\/script>`;
    const controller = initializeEntityDetailsDialog(dialog);
    controller.open({
      title: malicious,
      groups: buildBusModelDetailGroups({
        name: malicious,
        description: malicious,
        specs: { model_type: malicious, bus_length_m: malicious },
      }),
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    return {
      xss: window.__detailXss,
      images: dialog.querySelectorAll("img").length,
      scripts: dialog.querySelectorAll("script").length,
      title: dialog.querySelector("h2").textContent,
    };
  });
  expect(result.xss).toBe(0);
  expect(result.images).toBe(0);
  expect(result.scripts).toBe(0);
  expect(result.title).toContain("<img");
});
