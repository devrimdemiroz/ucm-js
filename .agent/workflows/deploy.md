---
description: Deploy the UCM Editor to GitHub Pages
---

## Deployment Workflow

### Pre-deployment Checks
1. Run all tests:
```bash
npm test
```

2. Verify no console errors in browser:
```bash
python3 -m http.server 8080
# Open http://localhost:8080 and check DevTools console
```

### Deploy to GitHub Pages

// turbo
1. Ensure all changes are committed:
```bash
git status
```

2. Add any remaining changes:
```bash
git add -A
```

3. Commit with a descriptive message:
```bash
git commit -m "Deploy: [description of changes]"
```

4. Push to main branch (triggers GitHub Actions):
```bash
git push origin main
```

### Post-deployment Verification
1. Wait 2-3 minutes for GitHub Actions to complete
2. Check deployment status at: https://github.com/devrimdemiroz/ucm-js/actions
3. Verify live site at: https://devrimdemiroz.github.io/ucm-js/

### Troubleshooting
- If 404 error: Check GitHub Settings > Pages > Source is set to "GitHub Actions"
- If build fails: Check Actions tab for error logs
- Clear browser cache if seeing old version
