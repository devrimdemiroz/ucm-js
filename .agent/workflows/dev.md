---
description: Start the development server and open the UCM Editor
---

// turbo-all

## Development Server Workflow

1. Start a local HTTP server on port 8080:
```bash
python3 -m http.server 8080
```

2. Open the editor at http://localhost:8080

3. For live development, keep the server running and refresh the browser after code changes.

## Alternative: Using npx serve
```bash
npx -y serve . -p 8080
```

## Quick Verification
- The canvas should render with demo components
- Left panel should show Hierarchy, Editor, and Settings tabs
- Toolbar should have all action buttons visible
