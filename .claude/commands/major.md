---
description: Increment major version, run tests/linting, commit, push, and create PR
---

Follow this workflow to create a major release:

1. **Increment Major Version**:
   - Run `npm run release:major` to bump the version and generate changelog
   - This updates package.json, module.json, CHANGELOG.md, and build-info.json

2. **Run Quality Checks**:
   - Run `npm run lint` to check for linting issues
   - Run `npm run format` to format code with Prettier
   - Run `npm run build` to ensure the build succeeds
   - Fix any issues that arise

3. **Commit Changes**:
   - Add all changed files: `git add package.json module.json CHANGELOG.md build-info.json src/ dist/`
   - Create a commit with the version number: `git commit -m "chore: bump version to X.X.X"`
   - Make sure to use the actual version number from package.json

4. **Push to Remote**:
   - Push the current branch: `git push -u origin [current-branch-name]`

5. **Create Pull Request**:
   - Use `gh pr create` to create a pull request
   - Use the CHANGELOG entry for the PR description
   - Add the `major` label to the PR
   - Do NOT include "Generated with Claude Code" or any AI attribution in the PR

After all steps are complete, provide the PR URL to the user.
