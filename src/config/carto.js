const CARTO_VOYAGER_TILE_URL =
  "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png";

let runtimeConfigPromise;

async function loadRuntimeConfig() {
  if (!runtimeConfigPromise) {
    const baseUrl = import.meta.env?.BASE_URL ?? "/elettra/";
    runtimeConfigPromise = fetch(`${baseUrl}runtime-config.json`, {
      cache: "no-store",
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Runtime configuration returned ${response.status}`);
        }
        return response.json();
      })
      .catch(() => ({}));
  }

  return runtimeConfigPromise;
}

export async function getCartoApiKey() {
  const runtimeConfig = await loadRuntimeConfig();
  const runtimeKey = runtimeConfig.CARTO_API_KEY;
  const buildTimeKey = import.meta.env?.VITE_CARTO_API_KEY;
  const key = runtimeKey ?? buildTimeKey ?? "";

  return typeof key === "string" ? key.trim() : "";
}

export function buildCartoVoyagerTileUrl(apiKey) {
  if (!apiKey) {
    throw new Error("CARTO_API_KEY is required to render the CARTO basemap");
  }

  return `${CARTO_VOYAGER_TILE_URL}?key=${encodeURIComponent(apiKey)}`;
}
