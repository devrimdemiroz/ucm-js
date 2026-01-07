---
description: Run tests for the UCM Editor
---

// turbo-all

## Test Workflow

### Unit Tests
1. Run the full test suite:
```bash
npm test
```

### UI Smoke Tests
1. Start the dev server (if not running):
```bash
python3 -m http.server 8080 &
```

2. Open the test UI page at http://localhost:8080/test-ui.html

3. Verify all automated tests pass in the browser console.

### Manual Verification Checklist
- [ ] Canvas renders without errors
- [ ] Node selection works (click on nodes)
- [ ] Component selection works (click on component boxes)
- [ ] Hierarchy panel updates when selecting items
- [ ] Properties panel shows selected item's properties
- [ ] Undo/Redo works (Ctrl+Z / Ctrl+Shift+Z)
- [ ] DSL Editor syncs with canvas changes
- [ ] Export functions produce valid output

### Performance Smoke Test
1. Load a large example (examples/complex.ucm or similar)
2. Verify render time < 1 second
3. Verify smooth panning and zooming
