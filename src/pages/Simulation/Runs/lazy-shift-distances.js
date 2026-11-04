const normalizeConcurrency = (value) =>
  Math.max(1, Math.floor(Number(value)) || 1);

export const createLazyShiftDistanceLoader = ({
  keyFor,
  load,
  onLoaded = () => {},
  onError = () => {},
  concurrency = 4,
} = {}) => {
  if (typeof keyFor !== "function" || typeof load !== "function") {
    throw new TypeError("keyFor and load must be functions");
  }

  const limit = normalizeConcurrency(concurrency);
  const tasks = new Map();
  const queue = [];
  let active = 0;
  let disposed = false;

  const drain = () => {
    if (disposed) return;

    while (active < limit && queue.length) {
      const task = queue.shift();
      active += 1;

      Promise.resolve()
        .then(() => load(task.item))
        .then((result) => {
          if (!disposed) onLoaded(result, task.item);
          task.resolve(result);
        })
        .catch((error) => {
          if (!disposed) onError(error, task.item);
          task.resolve(null);
        })
        .finally(() => {
          active -= 1;
          drain();
        });
    }
  };

  const schedule = (item) => {
    if (disposed) return Promise.resolve(null);
    const key = String(keyFor(item) ?? "").trim();
    if (!key) return Promise.resolve(null);
    if (tasks.has(key)) return tasks.get(key).promise;

    let resolveTask;
    const promise = new Promise((resolve) => {
      resolveTask = resolve;
    });
    tasks.set(key, { promise });
    queue.push({ item, resolve: resolveTask });
    drain();
    return promise;
  };

  const scheduleAll = (items = []) =>
    Promise.all((Array.isArray(items) ? items : []).map(schedule));

  const dispose = () => {
    disposed = true;
    while (queue.length) {
      queue.shift().resolve(null);
    }
  };

  return { schedule, scheduleAll, dispose };
};
