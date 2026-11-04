/** Debounce edits and serialize writes so a slow request cannot overwrite a newer one. */
export function createAssumptionAutosave({ save, onState, delay = 700 }) {
  let timer, pending = null, running = null, revision = 0, valid = true;
  let state = { status: 'idle' };
  const notify = (status, error = null) => { state = { status, error }; onState(state); };
  const flush = () => {
    clearTimeout(timer);
    if (running) return running;
    if (!pending || !valid) return Promise.resolve();
    const request = pending;
    pending = null;
    notify('saving');
    let failed = false;
    running = Promise.resolve().then(() => save(request.value)).then(() => {
      if (request.revision === revision && valid) notify('saved');
    }, error => {
      if (request.revision === revision && valid) {
        pending = request;
        failed = true;
        notify('error', error?.message);
      }
    }).then(() => {
      running = null;
      if (pending && valid && !failed) return flush();
    });
    return running;
  };
  return {
    get state() { return state; },
    get unsaved() { return Boolean(pending || running || !valid); },
    queue(value) {
      clearTimeout(timer);
      revision++;
      valid = value !== null;
      pending = valid ? { revision, value: structuredClone(value) } : null;
      notify(valid ? 'pending' : 'invalid');
      if (valid) timer = setTimeout(flush, delay);
    },
    flush,
    dispose() { clearTimeout(timer); return flush(); },
  };
}
