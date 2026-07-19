# Deployment Setup Guide

This repository is configured for automatic deployment to Netlify using GitHub Actions.

## Required GitHub Secrets

To enable automatic deployment, you need to add these secrets in your GitHub repository:

### 1. NETLIFY_AUTH_TOKEN

1. Go to [Netlify](https://app.netlify.com)
2. Navigate to **User Settings** → **Applications** → **Personal access tokens**
3. Click **"New access token"**
4. Give it a name (e.g., "JSON Viewer GitHub Actions")
5. Copy the generated token
6. In GitHub: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
7. Name: `NETLIFY_AUTH_TOKEN`
8. Value: Paste the token

### 2. NETLIFY_SITE_ID

1. In Netlify, go to your site dashboard
2. Navigate to **Site settings** → **General** → **Site details**
3. Copy the **Site ID** (format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
4. In GitHub: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
5. Name: `NETLIFY_SITE_ID`
6. Value: Paste the Site ID

## How It Works

Two workflows, by trigger:

1. **Release and Deploy** (`release.yml`) — runs on every push to `main`. A single job that releases _then_ deploys, in order (see below).
2. **Pull Request Checks** (`pr-checks.yml`) — runs on PRs to `main` and executes `npm run code-quality` (formatting, linting, build).

## Releases & Deployment

On every push to `main`, `release.yml` runs one job that does everything in sequence:

1. **Release** — [semantic-release](https://github.com/semantic-release/semantic-release) reads the Conventional Commits since the last release (enforced by commitlint) and, when there are releasable commits:
   - bumps the version in `package.json`,
   - updates `CHANGELOG.md`,
   - commits those back to `main` (`chore(release): X.Y.Z [skip ci]`),
   - creates the `vX.Y.Z` git tag and a **GitHub Release** with generated notes.
2. **Build** — `npm run build`. Runs _after_ the version bump, so the version baked into the bundle (shown in the footer) matches the release just cut.
3. **Deploy** — publishes `dist/` to Netlify (production).

If a push has no releasable commits (e.g. only `chore:`/`docs:`), step 1 no-ops — no new version — and the build+deploy still run with the current version.

### 📈 **Version Bumps** (from commit type)

- `fix:` → patch (1.0.0 → 1.0.1)
- `feat:` → minor (1.0.0 → 1.1.0)
- `feat!:` or a `BREAKING CHANGE:` footer → major (1.0.0 → 2.0.0)

### ⚙️ **Notes**

- **Secrets:** `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID` (above) for the deploy; the built-in `GITHUB_TOKEN` handles the tag, release, and version commit (`contents`/`issues`/`pull-requests: write` are granted in the workflow).
- **No release loop:** the version commit is tagged `[skip ci]` and made with `GITHUB_TOKEN`, so it does not re-trigger the workflow.
- **First run:** with no prior git tag, semantic-release publishes the initial `v1.0.0`; subsequent `feat:`/`fix:` commits bump from there.
- **Squash-merging?** semantic-release reads commits on `main`, so the **squash commit title** must be a valid Conventional Commit — otherwise that change won't count toward the version or changelog.

## Manual Deployment

If you need to deploy manually:

```bash
npm run build
netlify deploy --prod --dir=dist
```

## Troubleshooting

### Build Fails

- Check the GitHub Actions log for detailed error messages
- Ensure all dependencies are listed in package.json
- Verify Node.js version compatibility (using Node 20)

### Deployment Fails

- Verify both secrets are correctly set in GitHub
- Check that NETLIFY_SITE_ID matches your Netlify site
- Ensure NETLIFY_AUTH_TOKEN has proper permissions

### Custom Domain

- Configure custom domain in Netlify dashboard
- Update DNS records to point to Netlify
- SSL certificates are automatically generated

## Support

For issues with deployment, check:

1. GitHub Actions workflow logs
2. Netlify deployment logs
3. Ensure secrets are properly configured
