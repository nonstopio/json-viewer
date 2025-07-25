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

### 🔄 **CI/CD Pipeline**
1. **Continuous Integration** (`ci.yml`):
   - Runs on all branches and PRs
   - Executes code quality checks: `npm run code-quality`
   - Runs security audits and vulnerability scans
   - Tests on multiple Node.js versions (18, 20)
   - **Must pass before deployment**

2. **Deployment** (`deploy.yml`):
   - **Only runs on `main` branch**
   - **Requires CI pipeline to pass first**
   - Additional pre-deployment quality checks
   - Deploys to Netlify if all checks pass

3. **Pull Request Checks** (`pr-checks.yml`):
   - Runs on all PRs to `main`/`develop`
   - Provides immediate code quality feedback
   - Bundle size analysis
   - Auto-comments on failed checks

### 🛡️ **Quality Gates**
- **Linting**: ESLint must pass with no errors
- **Formatting**: Prettier formatting must be correct
- **TypeScript**: Must compile without errors
- **Security**: No high-severity vulnerabilities
- **Build**: Production build must succeed

### 🚀 **Deployment Process**
- **Automatic Deployment**: Every push to `main` branch triggers deployment (if CI passes)
- **Quality Assurance**: Deployment only happens after all quality checks pass
- **Build Caching**: npm dependencies are cached for faster builds
- **Security Headers**: Netlify.toml includes security and performance headers

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