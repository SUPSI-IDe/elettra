## Release and deployment safety

Treat the remote repository and the running deployment as the sources of truth.
Local branches, remote-tracking refs, tags, and remembered state may be stale,
especially when work continues across chats or worktrees.

Before recommending a release version or performing any commit, push, tag,
release, or deployment requested by the user:

1. Fetch current state with `git fetch --prune --tags origin` and inspect the
   working tree, current branch, `HEAD`, and `origin/main`.
2. Verify the latest remote tags with `git ls-remote --tags --refs origin` and,
   when release metadata matters, verify the latest GitHub release directly.
   Never infer the next version from unfetched local tags or conversation
   memory.
3. Preserve uncommitted work. If the checkout is behind or diverged from
   `origin/main`, reconcile the change onto current `origin/main` before any
   release action. Do not overwrite or discard local work to synchronize.
4. After reconciliation, rerun the dedicated regression tests for the change,
   the complete unit suite, the complete browser suite, and the production
   build. Results obtained before synchronization are not a release gate.
5. Immediately before pushing a release tag, confirm that the tag does not
   already exist remotely and that the exact tagged commit is present on
   `origin/main`.
6. A semantic-version tag triggers `.github/workflows/container-release.yml`,
   which builds the container and creates the GitHub release. Do not create a
   duplicate release manually. Wait for the workflow to succeed and obtain its
   immutable image digest before deploying.
7. Before deployment, inspect the running container and its Compose labels to
   identify the project that owns the target service and port. Deploy through
   that owning Compose project; do not assume this repository owns the running
   service. Record the currently deployed digest for rollback, preserve
   secrets, recreate only the intended frontend service, and verify its health
   endpoint plus a browser smoke test.
8. Recheck remote tags, `origin/main`, workflow status, and the running
   deployment immediately before consequential external mutations. Another
   chat or operator may have changed them since the initial preflight.

When the user asks for "proper tests", "dedicated tests", or equivalent
wording, add permanent regression tests for the requested behavior, including
relevant states, variants, and edge cases. Run those targeted tests as well as
the appropriate complete suites.

## Agent skills

### Issue tracker

Issues and specs live as local markdown files under `.scratch/<feature-slug>/` in this repo. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary — `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
