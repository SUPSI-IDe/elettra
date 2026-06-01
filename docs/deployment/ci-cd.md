# CI/CD

> Last updated: 2026-06-01

ELETTRA uses GitHub Actions for continuous deployment.

---

## GitHub Pages deployment

The repository includes a workflow at `.github/workflows/deploy.yml` that deploys the built frontend to GitHub Pages on every push to `main`.

### Trigger

- Push to `main` branch
- Manual dispatch (workflow_dispatch)

### Steps

1. Checkout repository
2. Set up Node.js (LTS version, npm cache enabled)
3. Install dependencies (`npm ci`)
4. Build the frontend (`npm run build`)
5. Configure GitHub Pages
6. Upload `dist/` as artifact
7. Deploy to GitHub Pages

### Permissions

The workflow requires:
- `contents: read`
- `pages: write`
- `id-token: write`

### Concurrency

Deployments are serialized under the `pages` concurrency group. In-progress deployments are cancelled when a new push arrives.

---

## Build commands reference

| Command | Purpose |
|---------|---------|
| `npm ci` | Install dependencies from lockfile |
| `npm run build` | Create production bundle in `dist/` |
| `npm run dev` | Start development server (not used in CI) |
| `npm run preview` | Preview production build locally (not used in CI) |

---

## Notes

- The CI workflow uses `actions/setup-node@v6` with `node-version: lts/*` — this automatically tracks the current LTS release.
- The built output (`dist/`) is served under the `/elettra/` base path, matching the `base` setting in `vite.config.js`.
- There are currently no automated test steps in the CI pipeline (*to verify*: whether tests are planned).
