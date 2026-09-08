import { expect, test } from "@playwright/test";


test("methodology popover works with pointer, keyboard and a mobile viewport", async ({
  page,
}) => {
  await page.goto("./");
  await page.evaluate(async () => {
    const module = await import(
      "/elettra/src/pages/Simulation/YearlyAnalysis/yearly-analysis-results.js"
    );
    const host = document.createElement("div");
    host.id = "methodology-test-host";
    host.style.margin = "2rem";
    host.innerHTML = module.methodologyPopover(
      "Methodology details",
      "<strong>Well-to-wheel</strong><span>NOx as NO2 equivalent.</span>"
    );
    document.body.replaceChildren(host);
    module.bindMethodologyPopover(host);
  });

  const trigger = page.getByRole("button", {
    name: "Methodology details",
    exact: true,
  });
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeHidden();

  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(dialog).toBeVisible();
  await expect(dialog).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();

  const box = await trigger.boundingBox();
  expect(box).not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(
    await page.evaluate(() => window.innerWidth)
  );
});


test("controlled yearly cases keep positive, electric, zero and incomplete heater states distinct", async ({
  page,
}) => {
  await page.goto("./");
  await page.evaluate(async () => {
    const module = await import(
      "/elettra/src/pages/Simulation/YearlyAnalysis/yearly-analysis-results.js"
    );
    const buildState = (type, liters, status) => ({
      isDieselHeating: type === "diesel",
      structured: {
        assumptions: {
          auxiliary_heating_type: type,
          yearly_diesel_heating_liters: liters,
        },
        dataCompleteness: { status },
      },
    });
    const cases = {
      positive: buildState("diesel", 12.5, "complete"),
      electric: buildState("electric", 0, "complete"),
      zero: buildState("diesel", 0, "complete"),
      incomplete: buildState("diesel", null, "partial"),
    };
    const host = document.createElement("main");
    host.setAttribute("aria-label", "Controlled diesel-heating cases");
    Object.entries(cases).forEach(([name, state]) => {
      const result = module.resolveDieselHeatingPresentation(state);
      const item = document.createElement("div");
      item.dataset.case = name;
      Object.entries(result).forEach(([key, value]) => {
        item.dataset[key] = String(value);
      });
      host.append(item);
    });
    document.body.replaceChildren(host);
  });

  await expect(page.locator('[data-case="positive"]')).toHaveAttribute("data-positive", "true");
  await expect(page.locator('[data-case="electric"]')).toHaveAttribute("data-configured", "false");
  await expect(page.locator('[data-case="zero"]')).toHaveAttribute("data-zero", "true");
  await expect(page.locator('[data-case="incomplete"]')).toHaveAttribute("data-unavailable", "true");
});
