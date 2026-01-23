/**
 * Default map locations for transport companies
 * Coordinates: [latitude, longitude]
 */
export const COMPANY_LOCATIONS = {
  // Ticino
  "TPL": { lat: 46.0037, lon: 8.9511, name: "Lugano" },
  "Trasporti Pubblici Luganesi": { lat: 46.0037, lon: 8.9511, name: "Lugano" },
  "AutoPostale Ticino": { lat: 46.1983, lon: 9.0228, name: "Bellinzona" },
  "FART": { lat: 46.1708, lon: 8.7991, name: "Locarno" },
  
  // German-speaking Switzerland
  "Bernmobil": { lat: 46.9480, lon: 7.4474, name: "Bern" },
  "VBZ": { lat: 47.3769, lon: 8.5417, name: "Zurich" },
  "Verkehrsbetriebe Zürich": { lat: 47.3769, lon: 8.5417, name: "Zurich" },
  "BVB": { lat: 47.5596, lon: 7.5886, name: "Basel" },
  "Basler Verkehrs-Betriebe": { lat: 47.5596, lon: 7.5886, name: "Basel" },
  "VBSG": { lat: 47.4245, lon: 9.3767, name: "St. Gallen" },
  "VBL": { lat: 47.0502, lon: 8.3093, name: "Lucerne" },
  
  // French-speaking Switzerland
  "TPG": { lat: 46.2044, lon: 6.1432, name: "Geneva" },
  "Transports Publics Genevois": { lat: 46.2044, lon: 6.1432, name: "Geneva" },
  "TL": { lat: 46.5197, lon: 6.6323, name: "Lausanne" },
  "Transports Lausannois": { lat: 46.5197, lon: 6.6323, name: "Lausanne" },
  "Transports publics fribourgeois": { lat: 46.8065, lon: 7.1620, name: "Fribourg" },
  "TPF": { lat: 46.8065, lon: 7.1620, name: "Fribourg" },
  
  // Italian companies
  "ATM Milano": { lat: 45.4642, lon: 9.1900, name: "Milan" },
  "GTT Torino": { lat: 45.0703, lon: 7.6869, name: "Turin" },
  "ATAC Roma": { lat: 41.9028, lon: 12.4964, name: "Rome" },
};

// Default fallback location (Bern - center of Switzerland)
export const DEFAULT_LOCATION = { lat: 46.9480, lon: 7.4474, name: "Bern" };

/**
 * Get the default map location for a company
 * @param {string} companyName - The company name
 * @returns {{ lat: number, lon: number, name: string }} Location object
 */
export const getCompanyLocation = (companyName) => {
  if (!companyName) {
    return DEFAULT_LOCATION;
  }
  
  // Try exact match first
  if (COMPANY_LOCATIONS[companyName]) {
    return COMPANY_LOCATIONS[companyName];
  }
  
  // Try partial match (case-insensitive)
  const normalizedName = companyName.toLowerCase();
  for (const [key, location] of Object.entries(COMPANY_LOCATIONS)) {
    if (
      key.toLowerCase().includes(normalizedName) ||
      normalizedName.includes(key.toLowerCase())
    ) {
      return location;
    }
  }
  
  return DEFAULT_LOCATION;
};

/**
 * Get the user's company location from localStorage
 * @returns {{ lat: number, lon: number, name: string }} Location object
 */
export const getUserCompanyLocation = () => {
  const companyName = localStorage.getItem("user_company") || "";
  return getCompanyLocation(companyName);
};
