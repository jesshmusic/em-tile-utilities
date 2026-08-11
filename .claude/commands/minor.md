---
description: Increment minor version, run tests/linting, commit, push, and create PR
---

Follow this workflow to create a minor release:

1. **Increment Minor Version**:
   - Run `npm run release:minor` to bump the version and generate changelog
   - This updates package.json, module.json, and CHANGELOG.md
   - It does NOT touch build-info.json — that counter is bumped by `vite build`
     (see vite.config.ts), so it only changes once you run step 2's build

2. **Run Quality Checks** (these are exactly what CI enforces in `.github/workflows/test.yml`):
   - Run `npm run format` to format code with Prettier
   - Run `npm run lint` — this runs with `--max-warnings 0`, so any warning fails
   - Run `npm run typecheck` — `npm run build` does NOT type check, this is the only thing that does
   - Run `npm test` to make sure the suite and the coverage thresholds pass
   - Run `npm run build` to ensure the build succeeds
   - Fix any issues that arise

3. **Commit Changes**:
   - Add all changed files: `git add package.json module.json CHANGELOG.md build-info.json src/ tests/`
   - Do NOT try to `git add dist/` — it is gitignored and untracked, so git exits
     non-zero with "The following paths are ignored by one of your .gitignore files".
     The release workflow builds dist/ itself and zips it into module.zip.
   - Create a commit with the version number: `git commit -m "chore: bump version to X.X.X"`
   - Make sure to use the actual version number from package.json

4. **Push to Remote**:
   - Push the current branch: `git push -u origin [current-branch-name]`

5. **Create Pull Request**:
   - Use `gh pr create` to create a pull request
   - Use the CHANGELOG entry for the PR description
   - Add the `minor` label to the PR
   - Do NOT include "Generated with Claude Code" or any AI attribution in the PR

After all steps are complete, provide the PR URL to the user.
