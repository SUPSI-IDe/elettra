/**
 * Run every requested deletion and retain both successful and failed items.
 *
 * Promise.all() rejects on the first failure, which makes multi-row delete
 * handlers lose track of deletions that already completed.  This helper keeps
 * that state explicit so callers can refresh their table and report partial
 * success accurately.
 *
 * @template T, R
 * @param {T[]} items
 * @param {(item: T, index: number) => Promise<R>|R} deleteItem
 * @returns {Promise<{
 *   total: number,
 *   succeeded: Array<{item: T, value: R}>,
 *   failed: Array<{item: T, reason: unknown}>,
 *   succeededCount: number,
 *   failedCount: number
 * }>}
 */
export const settleBatchDeletion = async (items, deleteItem) => {
  if (!Array.isArray(items)) {
    throw new TypeError("items must be an array");
  }
  if (typeof deleteItem !== "function") {
    throw new TypeError("deleteItem must be a function");
  }

  const settled = await Promise.allSettled(
    items.map((item, index) =>
      Promise.resolve().then(() => deleteItem(item, index))
    )
  );
  const succeeded = [];
  const failed = [];

  settled.forEach((result, index) => {
    if (result.status === "fulfilled") {
      succeeded.push({ item: items[index], value: result.value });
    } else {
      failed.push({ item: items[index], reason: result.reason });
    }
  });

  return {
    total: items.length,
    succeeded,
    failed,
    succeededCount: succeeded.length,
    failedCount: failed.length,
  };
};

export const formatBatchDeletionSummary = (result, translate) => {
  if (!result?.failedCount) {
    return "";
  }

  const key = result.succeededCount
    ? "common.delete_partial"
    : "common.delete_none";
  return translate(key, {
    deleted: result.succeededCount,
    failed: result.failedCount,
    total: result.total,
  });
};

export const formatBatchDeletionFeedback = (
  result,
  translate,
  resolveFailure
) => {
  const summary = formatBatchDeletionSummary(result, translate);
  const firstReason = result?.failed?.[0]?.reason;
  if (!firstReason || typeof resolveFailure !== "function") {
    return summary;
  }

  const resolved = resolveFailure(firstReason);
  const detail =
    typeof resolved === "string" ? resolved : resolved?.message;
  return detail && detail !== summary ? `${summary}\n${detail}` : summary;
};
