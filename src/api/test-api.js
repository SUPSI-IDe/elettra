/**
 * API Test Script
 *
 * This file tests all available API endpoints and displays their status/responses.
 * Run this from the browser console or import it in a test page.
 *
 * Usage:
 *   import { runAllTests, testAuth, testBuses, ... } from './test-api.js';
 *   await runAllTests();
 */

import { API_ROOT, authHeaders, readAccessToken } from "./client";

// ==================== HELPERS ====================

const log = (category, status, message, data = null) => {
  const emoji =
    status === "success" ? "✅"
    : status === "error" ? "❌"
    : "⚠️";
  console.log(`${emoji} [${category}] ${message}`);
  if (data) {
    console.log("   Response:", data);
  }
};

const testEndpoint = async (category, name, fetchFn) => {
  try {
    const result = await fetchFn();
    log(category, "success", `${name} - OK`, result);
    return { name, status: "success", data: result };
  } catch (error) {
    log(category, "error", `${name} - FAILED: ${error.message}`);
    return { name, status: "error", error: error.message };
  }
};

// ==================== AUTH TESTS ====================

export const testAuth = async () => {
  console.log("\n🔐 === AUTH ENDPOINTS ===\n");
  const results = [];

  // Check if we have a token
  const token = readAccessToken();
  if (token) {
    log("Auth", "success", "Access token found");
  } else {
    log(
      "Auth",
      "warning",
      "No access token found - authenticated endpoints will fail",
    );
  }

  // Test /auth/me
  results.push(
    await testEndpoint("Auth", "GET /auth/me", async () => {
      const response = await fetch(`${API_ROOT}/auth/me`, {
        method: "GET",
        headers: authHeaders(),
      });
      if (!response.ok)
        throw new Error(`${response.status} ${response.statusText}`);
      return response.json();
    }),
  );

  return results;
};

// ==================== BUS MODELS TESTS ====================

export const testBusModels = async () => {
  console.log("\n🚌 === BUS MODELS ENDPOINTS ===\n");
  const results = [];

  // List bus models
  results.push(
    await testEndpoint(
      "BusModels",
      "GET /api/v1/user/bus-models/",
      async () => {
        const response = await fetch(
          `${API_ROOT}/api/v1/user/bus-models/?skip=0&limit=10`,
          {
            method: "GET",
            headers: authHeaders(),
          },
        );
        if (!response.ok)
          throw new Error(`${response.status} ${response.statusText}`);
        return response.json();
      },
    ),
  );

  return results;
};

// ==================== BUSES TESTS ====================

export const testBuses = async () => {
  console.log("\n🚍 === BUSES ENDPOINTS ===\n");
  const results = [];

  // List buses
  results.push(
    await testEndpoint("Buses", "GET /api/v1/user/buses/", async () => {
      const response = await fetch(
        `${API_ROOT}/api/v1/user/buses/?skip=0&limit=10`,
        {
          method: "GET",
          headers: authHeaders(),
        },
      );
      if (!response.ok)
        throw new Error(`${response.status} ${response.statusText}`);
      return response.json();
    }),
  );

  return results;
};

// ==================== DEPOTS TESTS ====================

export const testDepots = async () => {
  console.log("\n🏢 === DEPOTS ENDPOINTS ===\n");
  const results = [];

  // List depots
  results.push(
    await testEndpoint("Depots", "GET /api/v1/user/depots/", async () => {
      const response = await fetch(
        `${API_ROOT}/api/v1/user/depots/?skip=0&limit=10`,
        {
          method: "GET",
          headers: authHeaders(),
        },
      );
      if (!response.ok)
        throw new Error(`${response.status} ${response.statusText}`);
      return response.json();
    }),
  );

  return results;
};

// ==================== SHIFTS TESTS ====================

export const testShifts = async () => {
  console.log("\n📅 === SHIFTS ENDPOINTS ===\n");
  const results = [];

  // List shifts
  results.push(
    await testEndpoint("Shifts", "GET /api/v1/user/shifts/", async () => {
      const response = await fetch(
        `${API_ROOT}/api/v1/user/shifts/?skip=0&limit=10`,
        {
          method: "GET",
          headers: authHeaders(),
        },
      );
      if (!response.ok)
        throw new Error(`${response.status} ${response.statusText}`);
      return response.json();
    }),
  );

  return results;
};

// ==================== GTFS TESTS ====================

export const testGtfs = async () => {
  console.log("\n🗺️ === GTFS ENDPOINTS ===\n");
  const results = [];

  // List routes
  results.push(
    await testEndpoint("GTFS", "GET /api/v1/gtfs/gtfs-routes/", async () => {
      const response = await fetch(
        `${API_ROOT}/api/v1/gtfs/gtfs-routes/?skip=0&limit=10`,
        {
          method: "GET",
          headers: authHeaders(),
        },
      );
      if (!response.ok)
        throw new Error(`${response.status} ${response.statusText}`);
      return response.json();
    }),
  );

  return results;
};

// ==================== SIMULATION TESTS ====================

export const testSimulation = async () => {
  console.log("\n🎮 === SIMULATION ENDPOINTS ===\n");
  const results = [];

  // List prediction runs
  results.push(
    await testEndpoint(
      "Simulation",
      "GET /api/v1/simulation/prediction-runs/",
      async () => {
        const response = await fetch(
          `${API_ROOT}/api/v1/simulation/prediction-runs/`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              ...authHeaders(),
            },
          },
        );
        if (!response.ok)
          throw new Error(`${response.status} ${response.statusText}`);
        return response.json();
      },
    ),
  );

  return results;
};

// ==================== RUN ALL TESTS ====================

export const runAllTests = async () => {
  console.log("╔════════════════════════════════════════════╗");
  console.log("║     ELETTRA API ENDPOINT TESTER           ║");
  console.log("╠════════════════════════════════════════════╣");
  console.log(`║ API Root: ${API_ROOT.padEnd(32)} ║`);
  console.log("╚════════════════════════════════════════════╝");

  const allResults = {
    auth: await testAuth(),
    busModels: await testBusModels(),
    buses: await testBuses(),
    depots: await testDepots(),
    shifts: await testShifts(),
    gtfs: await testGtfs(),
    simulation: await testSimulation(),
  };

  // Summary
  console.log("\n╔════════════════════════════════════════════╗");
  console.log("║              TEST SUMMARY                  ║");
  console.log("╚════════════════════════════════════════════╝\n");

  let totalPassed = 0;
  let totalFailed = 0;

  for (const [category, results] of Object.entries(allResults)) {
    const passed = results.filter((r) => r.status === "success").length;
    const failed = results.filter((r) => r.status === "error").length;
    totalPassed += passed;
    totalFailed += failed;
    console.log(`${category}: ${passed}/${results.length} passed`);
  }

  console.log(
    `\n📊 TOTAL: ${totalPassed}/${totalPassed + totalFailed} endpoints working`,
  );

  return allResults;
};

// ==================== DETAILED TESTS (with IDs) ====================

/**
 * Test fetching a specific bus model by ID
 */
export const testBusModelById = async (modelId) => {
  return testEndpoint(
    "BusModels",
    `GET /api/v1/user/bus-models/${modelId}`,
    async () => {
      const response = await fetch(
        `${API_ROOT}/api/v1/user/bus-models/${encodeURIComponent(modelId)}`,
        {
          method: "GET",
          headers: authHeaders(),
        },
      );
      if (!response.ok)
        throw new Error(`${response.status} ${response.statusText}`);
      return response.json();
    },
  );
};

/**
 * Test fetching a specific bus by ID
 */
export const testBusById = async (busId) => {
  return testEndpoint("Buses", `GET /api/v1/user/buses/${busId}`, async () => {
    const response = await fetch(
      `${API_ROOT}/api/v1/user/buses/${encodeURIComponent(busId)}`,
      {
        method: "GET",
        headers: authHeaders(),
      },
    );
    if (!response.ok)
      throw new Error(`${response.status} ${response.statusText}`);
    return response.json();
  });
};

/**
 * Test fetching a specific depot by ID
 */
export const testDepotById = async (depotId) => {
  return testEndpoint(
    "Depots",
    `GET /api/v1/user/depots/${depotId}`,
    async () => {
      const response = await fetch(
        `${API_ROOT}/api/v1/user/depots/${encodeURIComponent(depotId)}`,
        {
          method: "GET",
          headers: authHeaders(),
        },
      );
      if (!response.ok)
        throw new Error(`${response.status} ${response.statusText}`);
      return response.json();
    },
  );
};

/**
 * Test fetching a specific shift by ID
 */
export const testShiftById = async (shiftId) => {
  return testEndpoint(
    "Shifts",
    `GET /api/v1/user/shifts/${shiftId}`,
    async () => {
      const response = await fetch(
        `${API_ROOT}/api/v1/user/shifts/${encodeURIComponent(shiftId)}`,
        {
          method: "GET",
          headers: authHeaders(),
        },
      );
      if (!response.ok)
        throw new Error(`${response.status} ${response.statusText}`);
      return response.json();
    },
  );
};

/**
 * Test fetching trips by route ID
 */
export const testTripsByRoute = async (routeId, dayOfWeek = "monday") => {
  return testEndpoint(
    "GTFS",
    `GET /api/v1/gtfs/gtfs-trips/by-route/${routeId}`,
    async () => {
      const response = await fetch(
        `${API_ROOT}/api/v1/gtfs/gtfs-trips/by-route/${encodeURIComponent(routeId)}?day_of_week=${dayOfWeek}`,
        {
          method: "GET",
          headers: authHeaders(),
        },
      );
      if (!response.ok)
        throw new Error(`${response.status} ${response.statusText}`);
      return response.json();
    },
  );
};

/**
 * Test fetching stops by trip ID
 */
export const testStopsByTrip = async (tripId) => {
  return testEndpoint(
    "GTFS",
    `GET /api/v1/gtfs/gtfs-stops/by-trip/${tripId}`,
    async () => {
      const response = await fetch(
        `${API_ROOT}/api/v1/gtfs/gtfs-stops/by-trip/${encodeURIComponent(tripId)}`,
        {
          method: "GET",
          headers: authHeaders(),
        },
      );
      if (!response.ok)
        throw new Error(`${response.status} ${response.statusText}`);
      return response.json();
    },
  );
};

/**
 * Test fetching variants by route ID
 */
export const testVariantsByRoute = async (routeId) => {
  return testEndpoint(
    "GTFS",
    `GET /api/v1/gtfs/variants/by-route/${routeId}`,
    async () => {
      const response = await fetch(
        `${API_ROOT}/api/v1/gtfs/variants/by-route/${encodeURIComponent(routeId)}`,
        {
          method: "GET",
          headers: authHeaders(),
        },
      );
      if (!response.ok)
        throw new Error(`${response.status} ${response.statusText}`);
      return response.json();
    },
  );
};

/**
 * Test fetching a specific prediction run by ID
 */
export const testPredictionRunById = async (runId) => {
  return testEndpoint(
    "Simulation",
    `GET /api/v1/simulation/prediction-runs/${runId}`,
    async () => {
      const response = await fetch(
        `${API_ROOT}/api/v1/simulation/prediction-runs/${runId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(),
          },
        },
      );
      if (!response.ok)
        throw new Error(`${response.status} ${response.statusText}`);
      return response.json();
    },
  );
};

/**
 * Test fetching a specific optimization run by ID
 */
export const testOptimizationRunById = async (runId) => {
  return testEndpoint(
    "Simulation",
    `GET /api/v1/simulation/optimization-runs/${runId}`,
    async () => {
      const response = await fetch(
        `${API_ROOT}/api/v1/simulation/optimization-runs/${runId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(),
          },
        },
      );
      if (!response.ok)
        throw new Error(`${response.status} ${response.statusText}`);
      return response.json();
    },
  );
};

// Export for easy console access
if (typeof window !== "undefined") {
  window.apiTester = {
    runAllTests,
    testAuth,
    testBusModels,
    testBuses,
    testDepots,
    testShifts,
    testGtfs,
    testSimulation,
    testBusModelById,
    testBusById,
    testDepotById,
    testShiftById,
    testTripsByRoute,
    testStopsByTrip,
    testVariantsByRoute,
    testPredictionRunById,
    testOptimizationRunById,
  };
  console.log(
    "🧪 API Tester loaded! Use window.apiTester.runAllTests() to test all endpoints.",
  );
}
