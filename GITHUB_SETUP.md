# CI, releases and repository setup

What the GitHub Actions workflows do, what they enforce, and how the repository has to be configured for them to work.

## Workflows

Three workflows live in `.github/workflows/`. Read them for the details — they carry inline comments explaining why each gate exists.

### `test.yml` — runs on push to `main`/`develop` and on PRs targeting them

| Job                           | Status check name                      | What it does                                                                                                           |
| ----------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Run Tests**                 | `Run Tests (22.x)`, `Run Tests (24.x)` | `npm run test:ci` on both Node versions; uploads `coverage/lcov.info` to Codecov from the 22.x leg                     |
| **Lint, Format & Type Check** | `Lint, Format & Type Check`            | `npm run typecheck` → `npm run lint` → `npm run format:check` → `npm run build`                                        |
| **Version Bump Check**        | `Version Bump Check`                   | PRs only. Fails unless `package.json` is a real semver increase over the base branch, and `module.json` agrees with it |

Two things worth knowing about this job set:

- **`npm run build` is not a type check.** It is `vite build`, an esbuild transpile that ignores type errors. The `typecheck` step is the only thing running `tsc`, and until v2.2.0 nothing in CI ran it at all — which is how the v14 breakage shipped. Node 22.x and 24.x are the matrix because 18 and 20 are both past EOL and Vite 7 requires `^20.19.0 || >=22.12.0`.
- **The version gate runs pre-merge.** It used to live in `auto-release.yml`, which fires on `pull_request: closed` — so an unbumped PR merged green and only the release failed afterwards, leaving `main` with unreleased commits. It compares against `origin/<base>` rather than `git describe --tags`, because `describe` returns the nearest _reachable_ tag, not the highest version, and it uses a real semver comparison so a downgrade fails instead of sneaking past a string inequality.

### `auto-release.yml` — runs when a PR is merged into `main`

Reads the version, refuses to re-tag an existing release, type checks, builds, zips `module.json README.md LICENSE styles templates lang dist icons` (failing loudly if any path is missing — `zip` warns and exits 0 on a missing path, which is how releases shipped without a LICENSE for months), tags, creates the GitHub release with the top `CHANGELOG.md` entry as its body, and notifies the FoundryVTT package API.

**The compatibility range in the API payload is read from `module.json`.** It used to be hardcoded at 13/13 while the manifest declared 14/14, so every release from v2.1.0 to v2.1.3 was registered in the package listing with the wrong core version range.

Because the version bump is part of your PR, no commits are pushed to `main` and branch protection never blocks the workflow.

### `release.yml` — manual (`workflow_dispatch`)

Same build, archive, tag, release and API notification as the auto-release, run by hand from the Actions tab against `main`. Use it when auto-release failed, or to release a version bump that is already merged. It does not bump anything.

## Releasing

```bash
npm run release:patch   # bug fixes
npm run release:minor   # new features
npm run release:major   # breaking changes
```

This updates `package.json` and `module.json` together and touches `CHANGELOG.md`. Commit all three in the PR. Write the changelog entry by hand — `CHANGELOG.md` and `module.json` are in `.prettierignore` precisely because `scripts/release.js` rewrites them with its own formatting, so Prettier would fight it forever.

## Branch protection

At `https://github.com/jesshmusic/em-tile-utilities/settings/branches`, rule for `main`:

- Require a pull request before merging (and conversation resolution)
- Require status checks to pass, requiring branches to be up to date: `Run Tests (22.x)`, `Run Tests (24.x)`, `Lint, Format & Type Check`, `Version Bump Check`
- No force pushes, no deletions, no bypassing for admins

A status check only appears in the picker after it has run at least once, so open a throwaway PR first if the list is empty.

## Secrets

| Secret                  | Source                                                                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GITHUB_TOKEN`          | Provided automatically; nothing to configure                                                                                                       |
| `FOUNDRY_PACKAGE_TOKEN` | Generate at [foundryvtt.com/me/keys](https://foundryvtt.com/me/keys) for the package, then add it under Settings → Secrets and variables → Actions |
| `CODECOV_TOKEN`         | From Codecov. Optional — the upload step sets `fail_ci_if_error: false`                                                                            |

Secret values cannot be read back after creation, only replaced.

## Optional PR labels

`patch` / `minor` / `major` labels are documentation only. The version is set by whichever `npm run release:*` you ran, not by the label.

## Troubleshooting

**"Version … is unchanged from the base branch."** Run `npm run release:patch|minor|major` and commit `package.json` and `module.json`.

**"package.json and module.json are out of sync."** Something edited one by hand. The release scripts update both.

**"Tag vX.Y.Z already exists."** That version was already released. Bump again.

**Format check fails on a file you did not touch.** Run `npm run format`. Note it covers `**/*.md` and `**/*.json`, so documentation changes are subject to Prettier too.

**Foundry API notification fails.** Check `FOUNDRY_PACKAGE_TOKEN` is present and has package-release permission, and that `module.json` has both `compatibility.minimum` and `compatibility.verified` — the payload builder exits non-zero without them.

## Resolving Copilot review threads

Copilot reviews PRs on this repository. To find and resolve threads from the CLI:

```bash
gh api graphql -f query='
query {
  repository(owner: "jesshmusic", name: "em-tile-utilities") {
    pullRequest(number: PR_NUMBER) {
      reviewThreads(first: 20) {
        nodes { id isResolved comments(first: 1) { nodes { path body } } }
      }
    }
  }
}' --jq '.data.repository.pullRequest.reviewThreads.nodes[] | {id, isResolved, path: .comments.nodes[0].path}'

gh api graphql -f query='
mutation { resolveReviewThread(input: {threadId: "THREAD_ID"}) { thread { id isResolved } } }'
```

Review focus areas for Copilot are configured in `.github/copilot-instructions.md`.
