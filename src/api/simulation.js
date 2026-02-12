import { authHeaders, API_ROOT } from "./client";

export const fetchSimulationRuns = async (options = {}) => {
  const url = new URL(
    `${API_ROOT}/api/v1/simulation/simulation-runs/`,
    window.location.origin,
  );

  // Append query params if needed (e.g. for searching/pagination)
  Object.keys(options).forEach((key) =>
    url.searchParams.append(key, options[key]),
  );

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
    });

    if (!response.ok) {
      throw new Error(`Error fetching simulation runs: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Failed to fetch simulation runs:", error);
    throw error;
  }
};

export const createSimulationRun = async (data) => {
  const url = `${API_ROOT}/api/v1/simulation/simulation-runs/`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Error creating simulation run: ${response.statusText} - ${errorBody}`,
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to create simulation run:", error);
    throw error;
  }
};

export const getSimulationRun = async (runId) => {
  const url = `${API_ROOT}/api/v1/simulation/simulation-runs/${runId}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
    });

    if (!response.ok) {
      throw new Error(`Error fetching simulation run: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to get simulation run:", error);
    throw error;
  }
};

export const updateSimulationRun = async (runId, data) => {
  const url = `${API_ROOT}/api/v1/simulation/simulation-runs/${runId}`;

  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Error updating simulation run: ${response.statusText} - ${errorBody}`,
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to update simulation run:", error);
    throw error;
  }
};

export const deleteSimulationRun = async (runId) => {
  const url = `${API_ROOT}/api/v1/simulation/simulation-runs/${runId}`;
  console.log("deleteSimulationRun URL:", url);

  try {
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        ...authHeaders(),
      },
    });

    if (!response.ok) {
      throw new Error(`Error deleting simulation run: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error("Failed to delete simulation run:", error);
    throw error;
  }
};

export const getSimulationRunResults = async (runId, keys = null) => {
  const url = new URL(
    `${API_ROOT}/api/v1/simulation/simulation-runs/${runId}/results`,
    window.location.origin,
  );

  if (keys) {
    url.searchParams.append("keys", keys);
  }

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
    });

    if (!response.ok) {
      throw new Error(
        `Error fetching simulation run results: ${response.statusText}`,
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to get simulation run results:", error);
    throw error;
  }
};

export const generatePvgisTmy = async (latitude, longitude) => {
  const url = new URL(
    `${API_ROOT}/api/v1/simulation/pvgis-tmy/`,
    window.location.origin,
  );

  url.searchParams.append("latitude", latitude);
  url.searchParams.append("longitude", longitude);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
    });

    if (!response.ok) {
      throw new Error(
        `Error generating PVGIS TMY data: ${response.statusText}`,
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to generate PVGIS TMY data:", error);
    throw error;
  }
};

export const computeTripStatistics = async (tripIds) => {
  const url = `${API_ROOT}/api/v1/simulation/trip-statistics/`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({ trip_ids: tripIds }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Error computing trip statistics: ${response.statusText} - ${errorBody}`,
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to compute trip statistics:", error);
    throw error;
  }
};
