# UCM Editor - Deployment Guide

**Last Updated**: 2026-01-05
**Deployment Target**: GitHub Pages
**Status**: ✅ Automated

---

## 📋 Overview

The UCM Editor is automatically deployed to GitHub Pages using GitHub Actions. Every push to the `main` branch triggers a new deployment.

**Live URL**: https://devrimdemiroz.github.io/ucm-js/

---

## 🚀 Automatic Deployment

### How It Works

1. **Push to Main**: Any commit pushed to the `main` branch triggers deployment
2. **GitHub Actions**: The workflow defined in `.github/workflows/deploy.yml` runs
3. **Build & Deploy**: The entire repository is uploaded to GitHub Pages
4. **Live**: Changes are live within 1-2 minutes

### Workflow Configuration

**File**: `.github/workflows/deploy.yml`

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches:
      - main
  workflow_dispatch:  # Allows manual triggering

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - Checkout repository
      - Setup GitHub Pages
      - Upload artifact
      - Deploy to GitHub Pages
```

---

## ⚙️ GitHub Pages Setup

### Initial Configuration (One-Time Setup)

1. **Go to Repository Settings**:
   - Navigate to https://github.com/devrimdemiroz/ucm-js/settings/pages

2. **Configure Source**:
   - Source: `GitHub Actions`
   - (No branch selection needed with Actions)

3. **Save Settings**:
   - GitHub will automatically enable Pages

### Verify Configuration

Check deployment status at:
- **Actions Tab**: https://github.com/devrimdemiroz/ucm-js/actions
- **Environments**: https://github.com/devrimdemiroz/ucm-js/deployments

---

## 📦 What Gets Deployed

### Included Files
- ✅ `index.html` - Main entry point
- ✅ `css/` - All stylesheets
- ✅ `js/` - All JavaScript modules
- ✅ `examples/` - Example UCM diagrams
- ✅ `docs/images/` - Documentation images
- ✅ `.nojekyll` - Disables Jekyll processing

### Excluded Files (via .gitignore)
- ❌ `node_modules/` - Dependencies (not needed in browser)
- ❌ `*.log` - Log files
- ❌ `*.mov` - Video files
- ❌ `.env` - Environment variables
- ❌ `.DS_Store` - macOS system files

---

## 🔧 Manual Deployment

### Option 1: GitHub Web Interface

1. Go to **Actions** tab
2. Select **Deploy to GitHub Pages** workflow
3. Click **Run workflow** → **Run workflow**
4. Wait for completion (~1-2 minutes)

### Option 2: Git Push

```bash
# Make changes
git add .
git commit -m "Update: description of changes"
git push origin main

# Deployment triggers automatically
```

### Option 3: Force Deployment

```bash
# Trigger deployment without changes
git commit --allow-empty -m "deploy: Trigger deployment"
git push origin main
```

---

## 🧪 Testing Before Deployment

### Local Testing

Always test locally before pushing:

```bash
# Start local server
python3 -m http.server 8088

# Open in browser
open http://localhost:8088

# Or use Node.js
npx http-server . -p 8088
```

### Pre-Deployment Checklist

- [ ] All tests passing (`node tests/integration/phase1-validation.test.js`)
- [ ] No console errors in browser
- [ ] All features working locally
- [ ] README updated if needed
- [ ] Commit messages are clear

---

## 📊 Monitoring Deployment

### Check Deployment Status

**GitHub Actions**:
```
https://github.com/devrimdemiroz/ucm-js/actions
```

**Deployment History**:
```
https://github.com/devrimdemiroz/ucm-js/deployments
```

### Deployment Stages

1. **Queued**: Workflow waiting to run
2. **Running**: Deployment in progress
3. **Success**: ✅ Deployed successfully
4. **Failure**: ❌ Deployment failed (check logs)

### Troubleshooting Failed Deployments

If deployment fails:

1. **Check Action Logs**:
   - Go to Actions tab → Failed workflow
   - Review error messages

2. **Common Issues**:
   - Missing permissions (Pages settings)
   - Invalid workflow syntax
   - Git conflicts

3. **Fix & Retry**:
   ```bash
   # Fix the issue
   git add .
   git commit -m "fix: Resolve deployment issue"
   git push origin main
   ```

---

## 🌐 Custom Domain (Optional)

To use a custom domain:

### Setup Steps

1. **Add CNAME Record** (at your domain registrar):
   ```
   Type: CNAME
   Name: ucm (or www)
   Value: devrimdemiroz.github.io
   ```

2. **Configure in GitHub**:
   - Settings → Pages → Custom domain
   - Enter: `ucm.yourdomain.com`
   - Save

3. **Enable HTTPS** (recommended):
   - Check "Enforce HTTPS"

4. **Create CNAME File**:
   ```bash
   echo "ucm.yourdomain.com" > CNAME
   git add CNAME
   git commit -m "Add custom domain"
   git push
   ```

---

## 🔒 Security Considerations

### HTTPS
- ✅ Enabled by default on GitHub Pages
- ✅ Enforced for all connections

### Secrets
- ❌ **NEVER** commit `.env` files
- ❌ **NEVER** commit API keys
- ❌ **NEVER** commit credentials

### Client-Side Only
- ✅ All code runs in the browser
- ✅ No server-side processing
- ✅ No database connections
- ✅ No sensitive data storage

---

## 📈 Performance Optimization

### Automatic Optimizations

GitHub Pages provides:
- ✅ Global CDN
- ✅ HTTPS/2
- ✅ Gzip compression
- ✅ Browser caching

### Manual Optimizations

**Already Implemented**:
- ✅ Minified CSS (production build)
- ✅ ES6 modules (tree-shakeable)
- ✅ Lazy-loaded images
- ✅ Minimal dependencies

**Future Enhancements** (optional):
- [ ] Bundle with Rollup/Webpack
- [ ] Minify JavaScript
- [ ] Optimize images
- [ ] Add service worker for offline support

---

## 🔄 Rollback Procedure

### Revert to Previous Version

If a deployment breaks production:

```bash
# Option 1: Revert last commit
git revert HEAD
git push origin main

# Option 2: Reset to specific commit
git reset --hard <commit-hash>
git push origin main --force

# Option 3: Deploy from tag
git checkout v1.0.0
git push origin main --force
```

### Create Deployment Tags

Tag stable releases for easy rollback:

```bash
# Tag current version
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# Deploy from tag later
git checkout v1.0.0
git push origin main --force
```

---

## 📝 Deployment Checklist

### Before Deploying

- [ ] Code is tested locally
- [ ] All tests passing
- [ ] No console errors
- [ ] README updated
- [ ] Changelog updated (if applicable)
- [ ] Version bumped (if applicable)

### During Deployment

- [ ] Commit with clear message
- [ ] Push to main
- [ ] Monitor Actions tab
- [ ] Verify deployment success

### After Deployment

- [ ] Test live site
- [ ] Check all features work
- [ ] Verify examples load
- [ ] Monitor for errors (browser console)
- [ ] Share with stakeholders

---

## 📞 Support & Troubleshooting

### Common Issues

**Issue**: Pages not updating
- **Solution**: Hard refresh browser (Ctrl+Shift+R)
- **Solution**: Clear browser cache
- **Solution**: Wait 2-3 minutes for CDN propagation

**Issue**: 404 errors
- **Solution**: Check file paths (case-sensitive!)
- **Solution**: Verify .nojekyll exists
- **Solution**: Check Pages settings enabled

**Issue**: CSS/JS not loading
- **Solution**: Check relative paths
- **Solution**: Verify files are committed
- **Solution**: Check browser console for errors

### Getting Help

- **GitHub Docs**: https://docs.github.com/en/pages
- **Actions Docs**: https://docs.github.com/en/actions
- **Repository Issues**: https://github.com/devrimdemiroz/ucm-js/issues

---

## 📊 Deployment Metrics

### Performance Goals
- **Deploy Time**: < 2 minutes
- **Uptime**: 99.9% (GitHub SLA)
- **Load Time**: < 2 seconds (first load)
- **CDN Coverage**: Global

### Monitoring

Check site performance:
- **PageSpeed Insights**: https://pagespeed.web.dev/
- **WebPageTest**: https://www.webpagetest.org/
- **GitHub Status**: https://www.githubstatus.com/

---

## 🎯 Best Practices

### Commit Messages
```bash
# Good commit messages
git commit -m "feat: Add keyboard shortcuts"
git commit -m "fix: Resolve parser validation bug"
git commit -m "docs: Update deployment guide"

# Bad commit messages
git commit -m "update"
git commit -m "fix stuff"
git commit -m "wip"
```

### Branch Strategy

**Main Branch**:
- Always deployable
- Protected (optional)
- Direct commits okay for now
- Tag stable releases

**Feature Branches** (optional):
```bash
# Create feature branch
git checkout -b feature/validator
git push origin feature/validator

# Merge via PR (optional)
# Or merge directly
git checkout main
git merge feature/validator
git push
```

---

## 🚀 Continuous Improvement

### Future Enhancements

1. **Staging Environment**:
   - Deploy `develop` branch to staging URL
   - Test before production

2. **Preview Deployments**:
   - Deploy PRs to temporary URLs
   - Review before merging

3. **Automated Testing in CI**:
   - Run tests before deployment
   - Block deployment if tests fail

4. **Performance Monitoring**:
   - Track Core Web Vitals
   - Alert on regressions

---

**Last Updated**: 2026-01-05
**Maintained By**: UCM Editor Team
**Deployment Status**: ✅ Automated & Active
**Live URL**: https://devrimdemiroz.github.io/ucm-js/
