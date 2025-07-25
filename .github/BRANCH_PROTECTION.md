# Branch Protection Setup

To ensure deployment only happens after linting passes, configure these branch protection rules in GitHub:

## Main Branch Protection

Navigate to: **Settings** > **Branches** > **Add rule**

### Protection Rules for `main` branch:

#### ✅ **Required Status Checks**
- [x] Require status checks to pass before merging
- [x] Require branches to be up to date before merging

**Required checks:**
- `code-quality` (from CI workflow)
- `security-scan` (from CI workflow) 
- `lint-and-test` (from CI workflow)

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

The deployment pipeline is configured to:

1. **CI Pipeline** (`ci.yml`):
   - Runs on all branches
   - Executes `npm run code-quality` (includes lint, format, build)
   - Must pass before deployment can proceed

2. **Deployment Pipeline** (`deploy.yml`):
   - Only runs on `main` branch
   - Depends on CI pipeline success
   - Includes additional pre-deployment quality checks
   - Cancels deployment if CI fails

3. **PR Checks** (`pr-checks.yml`):
   - Runs on all pull requests to `main`/`develop`
   - Provides immediate feedback on code quality
   - Comments on PR if checks fail

## Quick Setup Commands

Run these in your repository settings:

```bash
# Enable branch protection via GitHub CLI (if available)
gh api repos/{owner}/{repo}/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"checks":[{"context":"code-quality"},{"context":"security-scan"}]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"dismiss_stale_reviews":true,"require_code_owner_reviews":true}' \
  --field restrictions=null
```

## Benefits

✅ **No deployment without clean code**  
✅ **Consistent code quality across all branches**  
✅ **Automatic security scanning**  
✅ **PR feedback loop for early issue detection**  
✅ **Multi-node testing (Node.js 18 & 20)**  
✅ **Bundle size monitoring**