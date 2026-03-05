import { authHeaders, API_ROOT } from "./client";

// ==================== PREDICTION RUNS ====================

export const createPredictionRun = async (data) => {
  const url = `${API_ROOT}/api/v1/simulation/prediction-runs/`;

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
        `Error creating prediction run: ${response.statusText} - ${errorBody}`,
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to create prediction run:", error);
    throw error;
  }
};

export const listPredictionRuns = async (options = {}) => {
  const url = new URL(
    `${API_ROOT}/api/v1/simulation/prediction-runs/`,
    window.location.origin,
  );

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
      throw new Error(`Error fetching prediction runs: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to fetch prediction runs:", error);
    throw error;
  }
};

export const getPredictionRun = async (runId) => {
  const url = `${API_ROOT}/api/v1/simulation/prediction-runs/${runId}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
    });

    if (!response.ok) {
      throw new Error(`Error fetching prediction run: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to get prediction run:", error);
    throw error;
  }
};

export const getPredictionRunPredictions = async (runId) => {
  const url = `${API_ROOT}/api/v1/simulation/prediction-runs/${runId}/predictions`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
    });

    if (!response.ok) {
      throw new Error(
        `Error fetching prediction run predictions: ${response.statusText}`,
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to get prediction run predictions:", error);
    throw error;
  }
};

// ==================== OPTIMIZATION RUNS ====================

export const createOptimizationRun = async (data) => {
  const url = `${API_ROOT}/api/v1/simulation/optimization-runs/`;

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
        `Error creating optimization run: ${response.statusText} - ${errorBody}`,
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to create optimization run:", error);
    throw error;
  }
};

export const getOptimizationRun = async (runId) => {
  const url = `${API_ROOT}/api/v1/simulation/optimization-runs/${runId}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
    });

    if (!response.ok) {
      throw new Error(
        `Error fetching optimization run: ${response.statusText}`,
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to get optimization run:", error);
    throw error;
  }
};

// ==================== PVGIS & TRIP STATISTICS ====================

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
