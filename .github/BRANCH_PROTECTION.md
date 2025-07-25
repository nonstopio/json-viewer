# Branch Protection Setup

To ensure deployment only happens after linting passes, configure these branch protection rules in GitHub:

## Main Branch Protection

Navigate to: **Settings** > **Branches** > **Add rule**

### Protection Rules for `main` branch:

#### ✅ **Required Status Checks**
- [x] Require status checks to pass before merging
- [x] Require branches to be up to date before merging

**Required checks:**
- `code-quality` (from PR workflow)

#### ✅ **Additional Protection**
- [x] Require pull request reviews before merging
- [x] Dismiss stale PR approvals when new commits are pushed
- [x] Require review from code owners (if CODEOWNERS file exists)
- [x] Restrict pushes that create files that match protected paths
- [x] Require signed commits (recommended)

#### ✅ **Merge Options**
- [x] Require linear history
- [x] Include administrators (applies rules to admins too)
- [x] Allow force pushes: **DISABLED**
- [x] Allow deletions: **DISABLED**

## Workflow Dependencies

The simplified pipeline:

1. **Deployment Pipeline** (`deploy.yml`):
   - Only runs on `main` branch
   - Builds and deploys automatically

2. **PR Checks** (`pr-checks.yml`):
   - Runs on all pull requests to `main`
   - Executes `npm run code-quality` for code validation

## Quick Setup Commands

Run these in your repository settings:

```bash
# Enable branch protection via GitHub CLI (if available)
gh api repos/{owner}/{repo}/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"checks":[{"context":"code-quality"}]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"dismiss_stale_reviews":true,"require_code_owner_reviews":true}' \
  --field restrictions=null
```

## Benefits

✅ **Code quality checks on all PRs**  
✅ **Automatic deployment on main branch**  
✅ **Simple and maintainable workflow**  
✅ **Fast feedback loop for developers**