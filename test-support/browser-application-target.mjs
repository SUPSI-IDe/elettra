import { resolveStagingTargets } from './staging-targets.mjs';

// Source and optimized-bundle runners share port 9010 and proxy to staging
// :9005. The installed staging frontend is the only other allowed target.
export function browserApplicationOrigin(baseURL = resolveStagingTargets().frontendUrl + '/elettra/') {
  resolveStagingTargets();
  const url = new URL(baseURL);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' ||
      !['9010', '55558'].includes(url.port) || url.username || url.password ||
      url.pathname !== '/elettra/' || url.search || url.hash) {
    throw new Error('Browser regressions require the local source/bundle runner or the ELETTRA staging frontend.');
  }
  return url.origin;
}
