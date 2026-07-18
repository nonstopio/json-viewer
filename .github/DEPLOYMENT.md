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

### 🔄 **Simple CI/CD Pipeline**

1. **Deployment** (`deploy.yml`):
   - **Only runs on `main` branch**
   - Builds and deploys to Netlify automatically

2. **Pull Request Checks** (`pr-checks.yml`):
   - Runs on all PRs to `main` branch
   - Executes `npm run code-quality` (formatting, linting, build)

### 🚀 **Deployment Process**

- **Automatic Deployment**: Every push to `main` branch triggers build and deployment
- **Build Caching**: npm dependencies are cached for faster builds
- **Quality Assurance**: PRs are checked for code quality before merging

## Releases & Changelog

Versioning and the changelog are automated with [release-please](https://github.com/googleapis/release-please-action) (`release-please.yml`), driven by our Conventional Commit messages (enforced by commitlint).

### 🏷️ **Release Flow**

1. Merge feature/fix PRs into `main` as usual — each merge still deploys to Netlify immediately.
2. release-please keeps a single open **release PR** (titled `chore(main): release X.Y.Z`) that accumulates the version bump and `CHANGELOG.md` entries from the commits since the last release.
3. When you're ready to cut a release, **merge that release PR**. release-please then:
   - bumps the version in `package.json`,
   - updates `CHANGELOG.md`,
   - creates the `vX.Y.Z` git tag and a **GitHub Release** with generated notes.
4. Merging the release PR is itself a push to `main`, so Netlify redeploys the released version.

### 📈 **Version Bumps** (from commit type)

- `fix:` → patch (1.0.0 → 1.0.1)
- `feat:` → minor (1.0.0 → 1.1.0)
- `feat!:` or a `BREAKING CHANGE:` footer → major (1.0.0 → 2.0.0)

### ⚙️ **Notes**

- No extra secrets needed — the built-in `GITHUB_TOKEN` handles the tag, release, and PR (`contents: write`, `pull-requests: write` are granted in the workflow).
- **One-time baseline (recommended):** tag the current release so the first changelog only covers new work:
  ```bash
  git tag v1.0.0 origin/main
  git push origin v1.0.0
  ```
- **Squash-merging?** release-please reads commits on `main`, so the **squash commit title** must be a valid Conventional Commit — otherwise that change won't be categorized in the changelog.

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
