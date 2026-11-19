const RELOAD_KEY = 'elettra.chunk-recovery.at';
const RELOAD_COOLDOWN_MS = 30_000;

// A tab opened before deployment can still reference a removed, hashed asset.
// Persist the attempt across reloads so a genuinely broken deployment cannot loop.
export const installChunkRecovery = (target = window, { now = Date.now } = {}) => {
  const recover = event => {
    try {
      const timestamp = now();
      const previous = Number(target.sessionStorage.getItem(RELOAD_KEY));
      if (previous > 0 && timestamp - previous < RELOAD_COOLDOWN_MS) return;
      target.sessionStorage.setItem(RELOAD_KEY, String(timestamp));
    } catch {
      // Without a persisted guard, let navigation display its retry action.
      return;
    }
    event.preventDefault();
    target.location.reload();
  };
  target.addEventListener('vite:preloadError', recover);
  return () => target.removeEventListener('vite:preloadError', recover);
};
