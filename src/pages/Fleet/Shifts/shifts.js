import { t } from "../../../i18n";
import "./shifts.css";
import {
  createShift,
  deleteShift,
  fetchShiftById,
  fetchShifts,
  fetchBusById,
  fetchAllBusModels,
  fetchStopsByTripId,
} from "../../../api";
import { isAuthenticated, resolveUserId } from "../../../api/session";
import { getCurrentUserId } from "../../../store";
import { bindSelectAll } from "../../../dom/tables";
import { installPaginationControl } from "../../../dom/pagination";
import { DEFAULT_PAGE_SIZE } from "../../../api/pagination";
import { triggerPartialLoad } from "../../../events";
import { textContent, resolveBusModelDisplayName } from "../../../ui-helpers";
import {
  extractShiftDistanceKm,
  formatDistanceKm,
  invalidateShiftDistanceCache,
  resolveShiftDailyDistanceKm,
} from "../../../utils/shift-distance";
import { buildDuplicateShiftPayload } from "./shift-utils";

const text = (value) =>
  value === null || value === undefined ? "" : String(value);

const textCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

const DEFAULT_SORT = {
  key: "name",
  direction: "asc",
};

const setFlashMessage = (section, message) => {
  const flashElement = section.querySelector('[data-role="flash"]');
  if (!flashElement) {
    return;
  }

  if (message) {
    flashElement.textContent = message;
    flashElement.hidden = false;
  } else {
    flashElement.textContent = "";
    flashElement.hidden = true;
  }
};

const renderLoading = (tbody) => {
  if (!tbody) {
    return;
  }

  tbody.innerHTML = `
        <tr class="table-state-row">
            <td class="checkbox"></td>
            <td class="id table-state-cell table-empty" colspan="7">${textContent(
              t("common.loading") || "Loading…"
            )}</td>
        </tr>
    `;
};

const renderError = (tbody, message = t("shifts.unable_to_load")) => {
  if (!tbody) {
    return;
  }

  tbody.innerHTML = `
        <tr class="table-state-row">
            <td class="checkbox"></td>
            <td class="id table-state-cell table-empty" colspan="7">${textContent(message)}</td>
        </tr>
    `;
};

const renderEmpty = (tbody) => {
  if (!tbody) {
    return;
  }

  tbody.innerHTML = `
        <tr class="table-state-row">
            <td class="checkbox"></td>
            <td class="id table-state-cell table-empty" colspan="7">${textContent(
              t("shifts.no_shifts_found") || "No shifts found."
            )}</td>
        </tr>
    `;
};

const parseTime = (time) => {
  const value = text(time).trim();
  if (!value) {
    return null;
  }

  if (value.includes("T")) {
    const parsedDate = new Date(value);
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate.getHours() * 60 + parsedDate.getMinutes();
    }
  }

  const match = /^\s*(\d{1,2}):(\d{2})/.exec(value);
  if (!match) {
    return null;
  }
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }
  return hours * 60 + minutes;
};

const formatTime = (minutes) => {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) {
    return "—";
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const compareNullableNumbers = (left, right) => {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  return left - right;
};

const compareTexts = (left, right) =>
  textCollator.compare(text(left).trim(), text(right).trim());

const sortShiftsByName = (shifts = []) =>
  [...shifts].sort((left = {}, right = {}) => {
    const nameComparison = compareTexts(left?.name, right?.name);
    if (nameComparison !== 0) return nameComparison;
    return compareTexts(left?.id, right?.id);
  });

const normalizeTimeLabel = (value) => {
  const parsedMinutes = parseTime(value);
  if (parsedMinutes == null) {
    return text(value).trim() || "—";
  }
  return formatTime(parsedMinutes);
};

const readStructure = (shift = {}) =>
  Array.isArray(shift?.structure) ? shift.structure : [];

const resolveTripCount = (shift = {}) => {
  if (Number.isFinite(shift?.trip_count)) return Number(shift.trip_count);
  if (Number.isFinite(shift?.tripCount)) return Number(shift.tripCount);
  return readStructure(shift).length;
};

const formatRouteLabel = (tripCount) => {
  if (!tripCount) {
    return "—";
  }
  return (
    t("shifts.trip_count", { count: tripCount }) ||
    `${tripCount} trip${tripCount === 1 ? "" : "s"}`
  );
};

const resolveShiftTimes = (shift = {}) => {
  let startTime =
    text(shift?.start_time).trim() || text(shift?.startTime).trim();
  let endTime = text(shift?.end_time).trim() || text(shift?.endTime).trim();

  const structure = readStructure(shift);
  if ((!startTime || !endTime) && structure.length > 0) {
    const times = structure.flatMap((item) => {
      const trip = item?.trip ?? {};
      const nestedTrip = trip?.trip ?? {};
      const stopTimes = Array.isArray(trip?.stop_times)
        ? trip.stop_times
        : Array.isArray(nestedTrip?.stop_times)
          ? nestedTrip.stop_times
          : [];

      return [
        trip.departure_time,
        trip.arrival_time,
        trip.start_time,
        trip.end_time,
        nestedTrip.departure_time,
        nestedTrip.arrival_time,
        nestedTrip.start_time,
        nestedTrip.end_time,
        stopTimes[0]?.departure_time,
        stopTimes[0]?.arrival_time,
        stopTimes[stopTimes.length - 1]?.departure_time,
        stopTimes[stopTimes.length - 1]?.arrival_time,
      ];
    });

    const minutes = times.map(parseTime).filter((m) => m !== null);
    if (minutes.length > 0) {
      if (!startTime) {
        startTime = formatTime(Math.min(...minutes));
      }
      if (!endTime) {
        endTime = formatTime(Math.max(...minutes));
      }
    }
  }

  const startMinutes = parseTime(startTime);
  const endMinutes = parseTime(endTime);

  return {
    startLabel: startTime ? normalizeTimeLabel(startTime) : "—",
    endLabel: endTime ? normalizeTimeLabel(endTime) : "—",
    startMinutes,
    endMinutes,
  };
};

const sortShifts = (shifts = [], sortState = DEFAULT_SORT) => {
  const directionMultiplier = sortState.direction === "desc" ? -1 : 1;

  return [...shifts].sort((left = {}, right = {}) => {
    let comparison = 0;

    switch (sortState.key) {
      case "bus_model":
        comparison = compareTexts(
          left?.bus_model_name,
          right?.bus_model_name
        );
        break;
      case "start_time":
        comparison = compareNullableNumbers(
          left?._resolved_start_minutes,
          right?._resolved_start_minutes
        );
        break;
      case "end_time":
        comparison = compareNullableNumbers(
          left?._resolved_end_minutes,
          right?._resolved_end_minutes
        );
        break;
      case "distance":
        comparison = compareNullableNumbers(
          left?._resolved_daily_distance_km,
          right?._resolved_daily_distance_km
        );
        break;
      case "route":
        comparison = compareNullableNumbers(
          left?._resolved_trip_count,
          right?._resolved_trip_count
        );
        break;
      case "name":
      default:
        comparison = compareTexts(left?.name, right?.name);
        break;
    }

    if (comparison !== 0) {
      return comparison * directionMultiplier;
    }

    const fallbackByName = compareTexts(left?.name, right?.name);
    if (fallbackByName !== 0) {
      return fallbackByName;
    }

    return compareTexts(left?.id, right?.id);
  });
};

const updateSortHeaders = (table, sortState) => {
  table?.querySelectorAll("thead th[data-sort-key]").forEach((header) => {
    const key = text(header.dataset.sortKey).trim();
    const isActive = key === sortState.key;
    const arrow = header.querySelector(".sort-arrow");

    header.setAttribute(
      "aria-sort",
      isActive
        ? sortState.direction === "asc"
          ? "ascending"
          : "descending"
        : "none"
    );

    if (arrow) {
      arrow.textContent =
        !isActive ? "↕" : sortState.direction === "asc" ? "↑" : "↓";
    }
  });
};

const renderRows = (tbody, shifts = [], { selectedIds = new Set() } = {}) => {
  if (!tbody) {
    return;
  }

  if (!Array.isArray(shifts) || shifts.length === 0) {
    renderEmpty(tbody);
    return;
  }

  const rows = shifts
    .map((shift = {}) => {
      const rowId = text(shift?.id);
      const rowName = text(shift?.name);
      const rowBus = text(shift?.bus_id ?? shift?.busId ?? shift?.bus?.id ?? "");
      const isSelected = selectedIds.has(rowId);

      return `
                <tr data-id="${rowId}" data-name="${rowName}" data-bus="${rowBus}">
                    <td class="checkbox"><input type="checkbox" aria-label="${textContent(t("shifts.select_shift"))}" ${
                      isSelected ? "checked" : ""
                    }></td>

                    <td class="name">${textContent(shift?.name ?? "")}</td>
                    <td class="bus">${textContent(
                      shift?.bus_model_name ?? "—"
                    )}</td>
                    <td class="start" data-role="shift-start">${textContent(
                      shift?._resolved_start_label ?? "—"
                    )}</td>
                    <td class="end" data-role="shift-end">${textContent(
                      shift?._resolved_end_label ?? "—"
                    )}</td>
                    <td class="distance" data-role="shift-distance">${textContent(
                      shift?._resolved_daily_distance_label ?? formatDistanceKm(null)
                    )}</td>
                    <td class="route">${textContent(
                      shift?._resolved_route_label ?? "—"
                    )}</td>
                    <td class="actions">
                        <button type="button" data-action="visualize-shift">${textContent(t("shifts.visualize"))}</button>
                    </td>
                </tr>
            `;
    })
    .join("");

  tbody.innerHTML = rows;
};

const getSelectedIdsFrom = (table) =>
  Array.from(
    table?.querySelectorAll('tbody input[type="checkbox"]:checked') ?? []
  )
    .map((input) => input.closest("tr")?.dataset?.id)
    .filter(Boolean);

export const initializeShifts = async (root = document, options = {}) => {
  const section = root.querySelector("section.shifts");
  if (!section) {
    return null;
  }

  const cleanupHandlers = [];

  const table = section.querySelector("table");
  const tbody = table?.querySelector('tbody[data-role="shifts-body"]');
  const headerCheckbox = table?.querySelector(
    'thead .checkbox input[type="checkbox"]'
  );
  const searchInput = section.querySelector("#shifts-filter");
  const deleteButton = section.querySelector(
    '[data-action="delete-selected-shifts"]'
  );
  const duplicateButton = section.querySelector(
    '[data-action="duplicate-selected-shifts"]'
  );
  const editButton = section.querySelector(
    '[data-action="edit-selected-shifts"]'
  );
  const addButton = section.querySelector('[data-action="add-shift"]');

  setFlashMessage(section, options.flashMessage ?? "");

  if (!table || !tbody) {
    return null;
  }

  let allShifts = [];
  let sortState = { ...DEFAULT_SORT };
  const tripStopsCache = new Map();
  const shiftDetailCache = new Map();
  const pendingTimeResolutions = new Set();
  const pendingDistanceResolutions = new Set();
  const busesCache = new Map();
  let modelsByIdCache = null;
  let cachedUserId = "";

  // ── Pagination state ──────────────────────────────────────────────
  let skip = 0;
  let limit = DEFAULT_PAGE_SIZE;
  const paginationContainer = section.querySelector(
    '[data-role="shifts-pagination"]'
  );
  const pagination = installPaginationControl(paginationContainer, {
    onPageChange: (nextSkip) => {
      skip = Math.max(0, nextSkip);
      void loadShifts();
    },
    onPageSizeChange: (nextLimit) => {
      limit = nextLimit;
      skip = 0;
      void loadShifts();
    },
  });
  if (pagination) {
    cleanupHandlers.push(() => pagination.destroy());
  }

  const fetchTripStopsCached = async (tripId) => {
    const cacheKey = text(tripId).trim();
    if (!cacheKey) {
      return [];
    }

    if (!tripStopsCache.has(cacheKey)) {
      const pendingStops = fetchStopsByTripId(cacheKey)
        .then((rawStops) => {
          const stops = Array.isArray(rawStops) ? [...rawStops] : [];
          return stops.sort(
            (left, right) =>
              (left?.stop_sequence ?? 0) - (right?.stop_sequence ?? 0)
          );
        })
        .catch((error) => {
          tripStopsCache.delete(cacheKey);
          throw error;
        });

      tripStopsCache.set(cacheKey, pendingStops);
    }

    return tripStopsCache.get(cacheKey);
  };

  // Load full shift detail (including `structure`) on demand.  The list
  // endpoint now returns lightweight items without `structure`, so any
  // computation that needs trip details must hydrate via this helper.
  const fetchShiftDetailCached = async (shiftId) => {
    const cacheKey = text(shiftId).trim();
    if (!cacheKey) return null;
    if (!shiftDetailCache.has(cacheKey)) {
      const pending = fetchShiftById(cacheKey).catch((error) => {
        shiftDetailCache.delete(cacheKey);
        throw error;
      });
      shiftDetailCache.set(cacheKey, pending);
    }
    return shiftDetailCache.get(cacheKey);
  };

  const ensureShiftStructure = async (shift = {}) => {
    if (Array.isArray(shift?.structure) && shift.structure.length) {
      return shift;
    }
    const detail = await fetchShiftDetailCached(shift?.id);
    if (detail && Array.isArray(detail.structure)) {
      shift.structure = detail.structure;
    }
    return shift;
  };

  const resolveShiftTimesFromStops = async (shift = {}) => {
    await ensureShiftStructure(shift);
    const structure = readStructure(shift);
    if (!structure.length) {
      return null;
    }

    const sortedStructure = [...structure].sort(
      (left, right) => (left?.sequence_number ?? 0) - (right?.sequence_number ?? 0)
    );
    const firstItem = sortedStructure[0] ?? {};
    const lastItem = sortedStructure[sortedStructure.length - 1] ?? {};
    const firstTripId = text(
      firstItem?.trip_id ?? firstItem?.trip?.trip_id ?? ""
    ).trim();
    const lastTripId = text(
      lastItem?.trip_id ?? lastItem?.trip?.trip_id ?? ""
    ).trim();

    let startTime = "";
    let endTime = "";

    if (firstTripId) {
      const stops = await fetchTripStopsCached(firstTripId);
      if (stops.length) {
        startTime = text(
          stops[0]?.departure_time ?? stops[0]?.arrival_time ?? ""
        ).trim();
        if (firstTripId === lastTripId) {
          const lastStop = stops[stops.length - 1] ?? {};
          endTime = text(
            lastStop?.arrival_time ?? lastStop?.departure_time ?? ""
          ).trim();
        }
      }
    }

    if (lastTripId && lastTripId !== firstTripId) {
      const stops = await fetchTripStopsCached(lastTripId);
      if (stops.length) {
        const lastStop = stops[stops.length - 1] ?? {};
        endTime = text(
          lastStop?.arrival_time ?? lastStop?.departure_time ?? ""
        ).trim();
      }
    }

    if (!startTime && !endTime) {
      return null;
    }

    return {
      startLabel: startTime ? normalizeTimeLabel(startTime) : null,
      endLabel: endTime ? normalizeTimeLabel(endTime) : null,
      startMinutes: parseTime(startTime),
      endMinutes: parseTime(endTime),
    };
  };

  const getFilteredShifts = () => {
    const query = (searchInput?.value ?? "").toLowerCase().trim();
    return query
      ? allShifts.filter(
          (shift = {}) =>
            text(shift?.name).toLowerCase().includes(query) ||
            text(shift?.bus_model_name).toLowerCase().includes(query)
        )
      : allShifts;
  };

  const renderCurrentView = () => {
    const selectedIds = new Set(getSelectedIdsFrom(table));
    const visibleShifts = sortShifts(getFilteredShifts(), sortState);
    renderRows(tbody, visibleShifts, { selectedIds });
    updateSortHeaders(table, sortState);
    bindSelectAll(headerCheckbox, table);
  };

  const updateShiftRow = (shift) => {
    const rowId = text(shift?.id).trim();
    if (!rowId) {
      return;
    }

    const row = tbody.querySelector(`tr[data-id="${rowId}"]`);
    if (!row) {
      return;
    }

    const startCell = row.querySelector('[data-role="shift-start"]');
    const endCell = row.querySelector('[data-role="shift-end"]');
    const distanceCell = row.querySelector('[data-role="shift-distance"]');

    if (startCell) {
      startCell.textContent = shift?._resolved_start_label ?? "—";
    }
    if (endCell) {
      endCell.textContent = shift?._resolved_end_label ?? "—";
    }
    if (distanceCell) {
      distanceCell.textContent =
        shift?._resolved_daily_distance_label ?? formatDistanceKm(null);
    }
  };

  const hydrateShiftTimes = (shifts = []) => {
    shifts.forEach((shift) => {
      const shiftId = text(shift?.id).trim();
      if (
        !shiftId ||
        pendingTimeResolutions.has(shiftId) ||
        (shift?._resolved_start_minutes != null &&
          shift?._resolved_end_minutes != null)
      ) {
        return;
      }

      pendingTimeResolutions.add(shiftId);
      resolveShiftTimesFromStops(shift)
        .then((resolvedTimes) => {
          if (!resolvedTimes) {
            return;
          }

          if (shift?._resolved_start_minutes == null && resolvedTimes.startMinutes != null) {
            shift._resolved_start_minutes = resolvedTimes.startMinutes;
          }
          if (shift?._resolved_end_minutes == null && resolvedTimes.endMinutes != null) {
            shift._resolved_end_minutes = resolvedTimes.endMinutes;
          }
          if (
            shift?._resolved_start_label === "—" &&
            resolvedTimes.startLabel
          ) {
            shift._resolved_start_label = resolvedTimes.startLabel;
          }
          if (shift?._resolved_end_label === "—" && resolvedTimes.endLabel) {
            shift._resolved_end_label = resolvedTimes.endLabel;
          }

          updateShiftRow(shift);
          if (
            sortState.key === "start_time" ||
            sortState.key === "end_time"
          ) {
            renderCurrentView();
          }
        })
        .catch((error) => {
          console.warn("Failed to resolve shift times", error);
        })
        .finally(() => {
          pendingTimeResolutions.delete(shiftId);
        });
    });
  };

  const hydrateShiftDistances = (shifts = []) => {
    shifts.forEach((shift) => {
      const shiftId = text(shift?.id).trim();
      if (
        !shiftId ||
        pendingDistanceResolutions.has(shiftId) ||
        shift?._resolved_daily_distance_km != null
      ) {
        return;
      }

      pendingDistanceResolutions.add(shiftId);
      resolveShiftDailyDistanceKm(shift)
        .then((distanceKm) => {
          shift._resolved_daily_distance_km = distanceKm;
          shift._resolved_daily_distance_label = formatDistanceKm(distanceKm);
          updateShiftRow(shift);
          if (sortState.key === "distance") {
            renderCurrentView();
          }
        })
        .catch((error) => {
          console.warn(
            `[elettra] Unable to resolve distance for shift ${shiftId}`,
            error
          );
        })
        .finally(() => {
          pendingDistanceResolutions.delete(shiftId);
        });
    });
  };

  const ensureLookupCaches = async (userId) => {
    // Bus models are paginated — page through with the dedicated helper
    // (max page size 100) so we get every model the user owns without
    // breaking the new pagination contract.
    if (!modelsByIdCache) {
      try {
        const allModels = await fetchAllBusModels({ userId });
        const userModels = userId
          ? allModels.filter((model) => text(model?.user_id) === userId)
          : allModels;
        modelsByIdCache = userModels.reduce((acc, model) => {
          if (model?.id) acc[text(model.id)] = model;
          return acc;
        }, {});
      } catch (error) {
        console.warn("Failed to load bus models for shifts lookup", error);
        modelsByIdCache = {};
      }
    }
    return modelsByIdCache;
  };

  const ensureBusInfoForIds = async (busIds = []) => {
    const missing = busIds
      .map((id) => text(id).trim())
      .filter((id) => id && !busesCache.has(id));
    if (!missing.length) return;
    // Fetch each bus only once; reuse the cache across pages.
    await Promise.allSettled(
      missing.map(async (id) => {
        try {
          const bus = await fetchBusById(id);
          busesCache.set(id, bus);
        } catch (error) {
          console.warn(`Failed to load bus ${id}`, error);
          busesCache.set(id, null);
        }
      })
    );
  };

  const loadShifts = async () => {
    renderLoading(tbody);
    pagination?.setBusy(true);

    if (!isAuthenticated()) {
      const authMessage = t("shifts.login_required") || "Please login to view your shifts.";
      renderError(tbody, authMessage);
      pagination?.setBusy(false);
      return;
    }

    try {
      if (!cachedUserId) {
        cachedUserId = text(
          (await resolveUserId().catch(() => null)) ??
            getCurrentUserId() ??
            ""
        ).trim();
      }
      const currentUserId = cachedUserId;
      if (!currentUserId) {
        throw new Error("Unable to resolve current user.");
      }

      const envelope = await fetchShifts({ skip, limit });
      const items = Array.isArray(envelope?.items) ? envelope.items : [];

      const modelsById = await ensureLookupCaches(currentUserId);

      const busIds = [
        ...new Set(
          items
            .map((shift) =>
              text(
                shift?.bus?.id ?? shift?.bus_id ?? shift?.busId ?? ""
              ).trim()
            )
            .filter(Boolean)
        ),
      ];
      await ensureBusInfoForIds(busIds);

      // The /api/v1/user/shifts/ endpoint is user-scoped server-side, so
      // additional client-side filtering is not required.
      allShifts = sortShiftsByName(
        items.map((shift) => {
          const busId = text(
            shift?.bus?.id ?? shift?.bus_id ?? shift?.busId ?? ""
          );
          const directModelId = text(
            shift?.bus?.bus_model_id ?? shift?.bus_model_id ?? shift?.busModelId ?? ""
          );
          const bus = busId ? busesCache.get(busId) : null;
          const resolvedModelId =
            directModelId || text(bus?.bus_model_id ?? "");
          const modelFromBus = resolveBusModelDisplayName(
            modelsById[resolvedModelId]
          );
          const modelLabel = modelFromBus || shift?.bus_model_name || "";
          const tripCount = resolveTripCount(shift);
          const resolvedTimes = resolveShiftTimes(shift);
          const dailyDistanceKm = extractShiftDistanceKm(shift);

          return {
            ...shift,
            bus_model_name: modelLabel || shift?.bus_model_name,
            _resolved_trip_count: tripCount,
            _resolved_route_label: formatRouteLabel(tripCount),
            _resolved_start_label: resolvedTimes.startLabel,
            _resolved_end_label: resolvedTimes.endLabel,
            _resolved_start_minutes: resolvedTimes.startMinutes,
            _resolved_end_minutes: resolvedTimes.endMinutes,
            _resolved_daily_distance_km: dailyDistanceKm,
            _resolved_daily_distance_label: formatDistanceKm(dailyDistanceKm),
          };
        })
      );
      renderCurrentView();
      pagination?.update(envelope);
      hydrateShiftTimes(allShifts);
      hydrateShiftDistances(allShifts);
    } catch (error) {
      console.error("Failed to load shifts", error);
      renderError(tbody, error?.message ?? t("shifts.unable_to_load"));
    } finally {
      pagination?.setBusy(false);
    }
  };

  if (searchInput) {
    searchInput.addEventListener("input", renderCurrentView);
    cleanupHandlers.push(() => {
      searchInput.removeEventListener("input", renderCurrentView);
    });
  }

  const handleSortClick = (event) => {
    const button = event.target.closest("button[data-sort-key]");
    if (!button) {
      return;
    }

    const nextKey = text(button.dataset.sortKey).trim();
    if (!nextKey) {
      return;
    }

    sortState =
      sortState.key === nextKey
        ? {
            key: nextKey,
            direction: sortState.direction === "asc" ? "desc" : "asc",
          }
        : {
            key: nextKey,
            direction: nextKey === DEFAULT_SORT.key ? DEFAULT_SORT.direction : "asc",
          };

    renderCurrentView();
  };

  table.querySelector("thead")?.addEventListener("click", handleSortClick);
  cleanupHandlers.push(() => {
    table
      .querySelector("thead")
      ?.removeEventListener("click", handleSortClick);
  });

  const handleAddClick = () => {
    triggerPartialLoad("shift-form");
  };
  if (addButton) {
    addButton.addEventListener("click", handleAddClick);
    cleanupHandlers.push(() => {
      addButton.removeEventListener("click", handleAddClick);
    });
  }

  const handleDeleteClick = async () => {
    const ids = getSelectedIdsFrom(table);
    if (!ids.length) {
      console.error(t("shifts.select_min"));
      return;
    }

    const confirmDelete = confirm(
      t("shifts.delete_confirm", { count: ids.length })
    );
    if (!confirmDelete) {
      return;
    }

    deleteButton.disabled = true;

    try {
      await Promise.all(ids.map((id) => deleteShift(id)));
      ids.forEach((id) => invalidateShiftDistanceCache(id));
      console.log(t("shifts.deleted"));
      await loadShifts();
    } catch (error) {
      console.error("Failed to delete shifts", error);
    } finally {
      deleteButton.disabled = false;
    }
  };
  if (deleteButton) {
    deleteButton.addEventListener("click", handleDeleteClick);
    cleanupHandlers.push(() => {
      deleteButton.removeEventListener("click", handleDeleteClick);
    });
  }

  const handleDuplicateClick = async () => {
    const ids = getSelectedIdsFrom(table);
    if (!ids.length) {
      setFlashMessage(section, t("shifts.select_min_duplicate"));
      return;
    }

    setFlashMessage(section, "");
    duplicateButton.disabled = true;

    try {
      for (const id of ids) {
        const shift = await fetchShiftById(id);
        const { name, busId, tripIds } = buildDuplicateShiftPayload(shift, {
          copySuffix: t("shifts.copy_suffix"),
          untitledLabel: t("shifts.untitled_shift"),
        });

        await createShift({
          name,
          busId,
          tripIds,
        });
      }
      await loadShifts();
      setFlashMessage(section, t("shifts.duplicated"));
    } catch (error) {
      console.error("Failed to duplicate shift(s)", error);
      setFlashMessage(
        section,
        error?.message ?? t("shifts.unable_to_duplicate")
      );
    } finally {
      duplicateButton.disabled = false;
    }
  };
  if (duplicateButton) {
    duplicateButton.addEventListener("click", handleDuplicateClick);
    cleanupHandlers.push(() => {
      duplicateButton.removeEventListener("click", handleDuplicateClick);
    });
  }

  const handleEditClick = () => {
    const ids = getSelectedIdsFrom(table);
    if (ids.length !== 1) {
      console.error(t("shifts.select_single"));
      return;
    }

    const id = ids[0];

    triggerPartialLoad("shift-form", { mode: "edit", shiftId: id });
  };
  if (editButton) {
    editButton.addEventListener("click", handleEditClick);
    cleanupHandlers.push(() => {
      editButton.removeEventListener("click", handleEditClick);
    });
  }

  const handleTableClick = (event) => {
    const button = event.target?.closest?.(
      'button[data-action="visualize-shift"]'
    );
    if (!button) {
      return;
    }

    const row = button.closest("tr");
    const id = row?.dataset?.id;
    if (!id) {
      return;
    }

    triggerPartialLoad("visualize-shift", { shiftId: id });
  };
  if (table) {
    table.addEventListener("click", handleTableClick);
    cleanupHandlers.push(() => {
      table.removeEventListener("click", handleTableClick);
    });
  }

  bindSelectAll(headerCheckbox, table);
  await loadShifts();

  return () => {
    cleanupHandlers.forEach((handler) => handler());
  };
};
