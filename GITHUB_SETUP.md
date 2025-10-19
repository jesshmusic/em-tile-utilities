# GitHub Repository Setup Guide

This document explains how to configure GitHub repository settings for the EM Tile Utilities project to enable automated workflows and enforce code quality.

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

## Required Labels

The automated release workflow uses GitHub labels to determine version bump types. These labels must be created in your repository.

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

### Using Labels on Pull Requests

When creating a PR, add ONE of the version labels to indicate the type of release:

- **patch** - For bug fixes, documentation updates, minor tweaks
- **minor** - For new features, new tile types, enhancements
- **major** - For breaking changes, API changes, major refactoring

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
3. Select the appropriate version label
4. The label should be visible before merging

**If no label is added**, the auto-release workflow will default to a `patch` version bump.

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
   c. Navigate to your package: "EM Tile Utilities"
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

1. Reads the PR label (`patch`, `minor`, or `major`)
2. Bumps version in `package.json` and `module.json`
3. Updates `CHANGELOG.md` from git commit messages
4. Builds the project
5. Creates `module.zip` archive
6. Commits version changes and creates git tag
7. Pushes to GitHub
8. Creates GitHub Release with changelog
9. Notifies FoundryVTT Package API

**Requires:**

- Version label on PR (`patch`, `minor`, or `major`)
- `FOUNDRY_PACKAGE_TOKEN` secret

### 3. Manual Release Workflow (`release.yml`)

**Triggers:**

- Manual workflow dispatch from GitHub Actions UI

**What it does:**

- Same as auto-release, but initiated manually
- Allows choosing version bump type in the UI

**When to use:**

- Emergency releases
- Hotfixes that bypass normal PR process
- Testing the release process
- When auto-release fails

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

2. **No version label on PR**
   - Default behavior: Uses `patch` bump
   - Not an error, but might not be intended

3. **Merge conflicts**
   - Error: Cannot commit version changes
   - Fix: Ensure PR is up-to-date before merging

4. **Build failures**
   - Error: `npm run build` fails
   - Fix: Ensure code builds locally before merging

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
3. ✅ Add appropriate version label to PRs
4. ✅ Keep PRs focused on single features/fixes
5. ✅ Write descriptive commit messages following conventional format

### For Maintainers

1. ✅ Review PRs promptly
2. ✅ Ensure version labels are correct before merging
3. ✅ Verify all status checks pass before merging
4. ✅ Monitor GitHub Actions for workflow failures
5. ✅ Keep branch protection rules enforced
6. ✅ Regularly update dependencies and workflows

## Additional Resources

- [GitHub Branch Protection Documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Semantic Versioning (SemVer)](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [FoundryVTT Package Development](https://foundryvtt.com/article/package-development/)
