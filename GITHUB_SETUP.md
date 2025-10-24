# GitHub Repository Setup Guide

This document explains how to configure GitHub repository settings for the Dorman Lakely's Tile Utilities project to enable automated workflows and enforce code quality.

## Table of Contents

- [Branch Protection Rules](#branch-protection-rules)
- [Required Labels](#required-labels)
- [GitHub Secrets](#github-secrets)
- [Automated Workflows](#automated-workflows)

## Branch Protection Rules

Branch protection rules ensure code quality by requiring tests to pass and reviews to be completed before merging pull requests.

### Setting Up Branch Protection for `main`

1. **Navigate to Settings**

   Go to: `https://github.com/jesshmusic/em-tile-utilities/settings/branches`

   Or:
   - Click "Settings" tab in your repository
   - Click "Branches" in the left sidebar
   - Under "Branch protection rules", click "Add rule"

2. **Configure Branch Name Pattern**
   - Branch name pattern: `main`

3. **Require Pull Request Before Merging**

   Enable: ✅ **Require a pull request before merging**

   Recommended sub-options:
   - ✅ **Require approvals**: 1 (if working with a team)
   - ✅ **Dismiss stale pull request approvals when new commits are pushed**
   - ✅ **Require review from Code Owners** (if you have a CODEOWNERS file)

4. **Require Status Checks to Pass**

   Enable: ✅ **Require status checks to pass before merging**

   Click "Add status check" and search for these checks (they must have run at least once before they appear):
   - `test (18.x)` - Test suite on Node.js 18.x
   - `test (20.x)` - Test suite on Node.js 20.x
   - `lint` - ESLint and TypeScript type checking

   Enable: ✅ **Require branches to be up to date before merging**

   This ensures the PR has the latest changes from `main` before merging.

5. **Additional Recommended Protections**
   - ✅ **Require conversation resolution before merging** - All review comments must be resolved
   - ✅ **Do not allow bypassing the above settings** - Even admins must follow the rules
   - ❌ **Allow force pushes** - Keep disabled to prevent history rewriting
   - ❌ **Allow deletions** - Keep disabled to prevent accidental branch deletion

6. **Save Changes**

   Click "Create" or "Save changes" at the bottom of the page.

### What This Means

Once configured:

- **Direct commits to `main` are blocked** - All changes must go through a pull request
- **PRs cannot be merged if tests fail** - Red X = blocked merge
- **PRs cannot be merged if linting fails** - Code must pass style checks
- **PRs must be up-to-date** - Must rebase/merge latest `main` before merging
- The "Merge pull request" button will be **disabled** until all requirements are met

### Example: Blocked PR

```
❌ test (18.x) — Failed
❌ test (20.x) — Failed
✅ lint — Passed

⚠️ Merging is blocked
Some checks were not successful
1 failing and 1 successful check
```

### Example: Mergeable PR

```
✅ test (18.x) — Passed
✅ test (20.x) — Passed
✅ lint — Passed

✅ All checks have passed
This branch has no conflicts with the base branch
```

## Optional Labels for Documentation

GitHub labels can be used to document what type of version bump a PR contains. Labels are optional since the version is controlled by running `npm run release:X` before creating the PR.

### Creating Version Labels

1. **Navigate to Labels**

   Go to: `https://github.com/jesshmusic/em-tile-utilities/labels`

   Or:
   - Click "Issues" tab
   - Click "Labels" button

2. **Create These Labels**

   Click "New label" for each:

   **Label: patch**
   - Name: `patch`
   - Description: `Bug fixes and minor improvements`
   - Color: `#d4c5f9` (light purple)

   **Label: minor**
   - Name: `minor`
   - Description: `New features and enhancements`
   - Color: `#0e8a16` (green)

   **Label: major**
   - Name: `major`
   - Description: `Breaking changes`
   - Color: `#d93f0b` (red)

### Using Labels on Pull Requests (Optional)

Labels are **optional** but helpful for documentation. The version bump is controlled by running `npm run release:X` before creating the PR, not by labels.

Add a label that matches your version bump for documentation purposes:

- **patch** - Bug fixes, documentation updates, minor tweaks (you ran `npm run release:patch`)
- **minor** - New features, tile types, enhancements (you ran `npm run release:minor`)
- **major** - Breaking changes, API changes (you ran `npm run release:major`)

**Example:**

```bash
# Create a PR with a label
gh pr create --title "Add teleport tile" --label "minor"

# Or add label to existing PR
gh pr edit 42 --add-label "minor"
```

**Via GitHub UI:**

1. Open your pull request
2. On the right sidebar, click "Labels"
3. Select the label that matches the version bump in your PR

## GitHub Secrets

The automated release workflow requires certain secrets to be configured in your repository settings.

### Required Secrets

1. **Navigate to Secrets**

   Go to: `https://github.com/jesshmusic/em-tile-utilities/settings/secrets/actions`

   Or:
   - Click "Settings" tab
   - Click "Secrets and variables" → "Actions" in left sidebar

2. **GITHUB_TOKEN**
   - ✅ **Automatically provided by GitHub**
   - No action needed - this secret is available in all workflows
   - Used for: Creating releases, pushing tags, updating repository

3. **FOUNDRY_PACKAGE_TOKEN**
   - ❌ **Must be created manually**
   - Used for: Notifying FoundryVTT Package API of new releases

   **To create:**

   a. Go to [FoundryVTT Package Admin](https://foundryvtt.com/admin)
   b. Sign in with your FoundryVTT account
   c. Navigate to your package: "Dorman Lakely's Tile Utilities"
   d. Generate an API token for package releases
   e. Copy the token

   **To add to GitHub:**

   a. Go to: `https://github.com/jesshmusic/em-tile-utilities/settings/secrets/actions`
   b. Click "New repository secret"
   c. Name: `FOUNDRY_PACKAGE_TOKEN`
   d. Value: Paste the token from FoundryVTT
   e. Click "Add secret"

### Verifying Secrets

You can verify secrets are configured by:

1. Going to Settings → Secrets and variables → Actions
2. Checking that `FOUNDRY_PACKAGE_TOKEN` appears in the list
3. `GITHUB_TOKEN` will not appear (it's automatic)

**Note:** Secret values are hidden and cannot be viewed after creation. You can only update or delete them.

## Automated Workflows

The repository has three GitHub Actions workflows:

### 1. Tests Workflow (`test.yml`)

**Triggers:**

- Push to `main` or `develop` branches
- Pull requests targeting `main` or `develop`

**What it does:**

- Runs test suite on Node.js 18.x and 20.x
- Runs ESLint and type checking
- Builds the project to verify compilation
- Uploads code coverage to Codecov (Node 20.x only)

**Status checks:**

- `test (18.x)`
- `test (20.x)`
- `lint`

### 2. Auto-Release Workflow (`auto-release.yml`)

**Triggers:**

- When a pull request is **merged** into `main`

**What it does:**

1. Reads the version from `package.json` (already bumped in the PR)
2. Verifies the version is newer than the last release
3. Builds the project
4. Creates `module.zip` archive
5. Creates git tag and pushes it
6. Creates GitHub Release with changelog from `CHANGELOG.md`
7. Notifies FoundryVTT Package API

**Requires:**

- Version must be bumped in the PR using `npm run release:X`
- `FOUNDRY_PACKAGE_TOKEN` secret

**Note:** No commits are pushed to `main` - the version bump is already part of your PR, so branch protection rules don't block the workflow.

### 3. Manual Release Workflow (`release.yml`)

**Triggers:**

- Manual workflow dispatch from GitHub Actions UI

**What it does:**

- Reads the version from `package.json` on `main` branch
- Checks if the tag already exists (prevents duplicate releases)
- Builds the project and creates release artifacts
- Creates git tag and GitHub Release

**When to use:**

- When auto-release fails or is disabled
- Re-running a release after fixing issues
- Creating a release for an already-merged version bump

**Note:** The version must already be bumped and merged to `main`. This workflow doesn't bump versions.

## Troubleshooting

### Status Checks Don't Appear in Branch Protection

**Problem:** When trying to add status checks to branch protection, the checks don't appear in the search.

**Solution:**

1. The checks must run at least once before they appear
2. Create a test PR to trigger the workflows
3. Wait for workflows to complete
4. Try adding the checks again

### Auto-Release Workflow Fails

**Common causes:**

1. **Missing `FOUNDRY_PACKAGE_TOKEN`**
   - Error: API call to FoundryVTT fails
   - Fix: Add the secret in repository settings

2. **Version wasn't bumped in PR**
   - Error: "Version was not bumped!"
   - Fix: Run `npm run release:X` and commit the changes before merging

3. **Version already released**
   - Error: Tag already exists
   - Fix: Check if someone already created this version, or bump to a new version

4. **Build failures**
   - Error: `npm run build` fails
   - Fix: Ensure code builds locally before creating the PR

### Cannot Merge PR

**Possible causes:**

1. **Status checks failing**
   - Check the "Checks" tab on the PR
   - Fix failing tests or linting issues
   - Push new commits to fix

2. **Branch not up-to-date**
   - Click "Update branch" button on PR
   - Or rebase locally: `git rebase origin/main`

3. **Merge conflicts**
   - Resolve conflicts locally
   - Push resolved changes

## Best Practices

### For Contributors

1. ✅ Always create feature branches from up-to-date `main`
2. ✅ Run `npm run lint` and `npm test` before pushing
3. ✅ **Bump version with `npm run release:X`** before creating PR
4. ✅ Add optional version label to PRs for documentation
5. ✅ Keep PRs focused on single features/fixes
6. ✅ Write descriptive commit messages following conventional format

### For Maintainers

1. ✅ Review PRs promptly
2. ✅ **Verify version was bumped** in the PR before merging
3. ✅ Ensure version labels match the actual bump (if used)
4. ✅ Verify all status checks pass before merging
5. ✅ Monitor GitHub Actions for workflow failures
6. ✅ Keep branch protection rules enforced
7. ✅ Regularly update dependencies and workflows

## Additional Resources

- [GitHub Branch Protection Documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Semantic Versioning (SemVer)](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [FoundryVTT Package Development](https://foundryvtt.com/article/package-development/)
