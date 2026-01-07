# UCM Editor - Developer Quick Reference

> **Last Updated**: 2026-01-07
> **Version**: 1.0

## Architecture Overview

```
ucm-js/
├── js/
│   ├── app.js              # Entry point, initializes all modules
│   ├── core/               # State management & business logic
│   │   ├── graph.js        # Central graph state (nodes, edges, components)
│   │   ├── history.js      # Undo/redo system (50ms debounce)
│   │   ├── parser.js       # DSL text → Graph (regex-based)
│   │   ├── serializer.js   # Graph → DSL text
│   │   ├── validator.js    # UCM structural validation
│   │   ├── exporter.js     # Multi-format export (JSON, SVG, jUCM, etc.)
│   │   ├── file-loader.js  # Import/export file handling
│   │   ├── node-types.js   # Node & component type definitions
│   │   ├── fork-join.js    # Fork/join pairing logic
│   │   └── tracing.js      # OpenTelemetry integration (optional)
│   │
│   ├── editor/             # Canvas & interaction handling
│   │   ├── canvas.js       # SVG rendering, zoom/pan, transforms
│   │   ├── selection.js    # Multi-select, selection state
│   │   ├── context-menu.js # Right-click menu
│   │   └── component-tool.js # Component creation tool
│   │
│   └── ui/                 # UI panels & controls
│       ├── hierarchy-panel.js  # Tree view of graph structure
│       ├── properties-panel.js # Selected item properties editor
│       ├── actions-panel.js    # Node/edge action buttons
│       ├── dsl-panel.js        # DSL code editor tab
│       ├── settings-panel.js   # Global settings tab
│       ├── keyboard.js         # Keyboard shortcut handling
│       ├── toolbar.js          # Top toolbar
│       ├── notifications.js    # Toast notifications
│       ├── sidebar.js          # Tab switching logic
│       ├── tooltip.js          # Hover tooltips
│       └── ai-chat.js          # AI assistant integration
│
├── css/
│   └── styles.css          # All styles (B&W aesthetic)
│
├── index.html              # Main application page
├── test-ui.html            # Automated UI tests
└── tests/                  # Test files
```

---

## Core Concepts

### 1. Event System (EventEmitter Pattern)

All modules use a shared event system for decoupled communication:

```javascript
// Subscribing to events
graph.on('node:added', (node) => {
    console.log('New node:', node.id);
});

// Emitting events
graph.emit('node:updated', node);
```

**Key Events:**
| Event | Payload | Triggered When |
|-------|---------|----------------|
| `node:added` | `node` | Node created |
| `node:updated` | `node` | Node properties changed |
| `node:removed` | `{ id }` | Node deleted |
| `edge:added` | `edge` | Edge created |
| `edge:removed` | `{ id }` | Edge deleted |
| `component:added` | `component` | Component created |
| `component:updated` | `component` | Component properties changed |
| `graph:loaded` | - | Graph loaded from file |
| `graph:cleared` | - | Graph reset |
| `selection:changed` | - | Selection modified |

### 2. Graph State (graph.js)

The `graph` singleton holds all diagram state:

```javascript
import { graph } from './core/graph.js';

// Get data
const nodes = graph.getAllNodes();
const edges = graph.getAllEdges();
const components = graph.getAllComponents();

// Modify data
const node = graph.addNode('responsibility', 100, 200, { name: 'Process Order' });
const edge = graph.addEdge(sourceId, targetId);
graph.removeNode(nodeId);

// Query
const node = graph.getNode(nodeId);
const component = graph.getComponent(compId);
```

### 3. Selection System (selection.js)

```javascript
import { selection } from './editor/selection.js';

// Select items
selection.selectNode(nodeId);
selection.selectComponent(compId);
selection.addToSelection(nodeId);  // Multi-select
selection.clear();

// Query selection
selection.selectedNodes;      // Set<nodeId>
selection.selectedComponents; // Set<compId>
selection.hasSelection;       // boolean
```

### 4. History/Undo (history.js)

```javascript
import { history } from './core/history.js';

history.undo();
history.redo();
history.canUndo();  // boolean
history.canRedo();  // boolean
history.reset();    // Clear history
```

**Note:** History snapshots are debounced at 50ms to avoid flooding during drag operations.

### 5. Canvas Rendering (canvas.js)

```javascript
import { canvas } from './editor/canvas.js';

canvas.render();              // Full re-render
canvas.centerOnNode(nodeId);  // Pan to node
canvas.centerOnComponent(compId);
canvas.fitToWindow();         // Auto-zoom to fit content
canvas.zoomIn();
canvas.zoomOut();
```

---

## Node Types

Defined in `js/core/node-types.js`:

| Type | Icon | Description |
|------|------|-------------|
| `start` | ● (filled) | Path entry point |
| `end` | ◯ (hollow) | Path termination |
| `responsibility` | ✕ | Action/behavior |
| `or-fork` | ◇ | Decision point (1 input, N outputs) |
| `or-join` | ◇ | Merge point (N inputs, 1 output) |
| `and-fork` | ═╦═ | Parallel split |
| `and-join` | ═╩═ | Parallel sync |
| `stub` | ◊ | Plugin point for sub-diagrams |
| `waiting` | ⏸ | Wait state |
| `timer` | ⏱ | Timed trigger |

## Component Types

| Type | Description |
|------|-------------|
| `component` | Generic container |
| `actor` | External entity (stick figure) |
| `agent` | Software agent |
| `team` | Team/group container |
| `system` | System boundary |
| `process` | Business process |

---

## Common Tasks

### Adding a New Node Type

1. Define in `js/core/node-types.js`:
```javascript
export const NODE_TYPES = {
    // ... existing types
    'my-type': {
        icon: '★',
        label: 'My Type',
        defaultWidth: 20,
        defaultHeight: 20
    }
};
```

2. Add rendering logic in `js/editor/canvas.js` → `renderNode()` method

3. Add to actions panel in `js/ui/actions-panel.js`

### Adding a New Export Format

1. Add method in `js/core/exporter.js`:
```javascript
exportMyFormat(graph) {
    // Convert graph to desired format
    return formattedString;
}
```

2. Add UI button in `index.html` (toolbar dropdown)

3. Wire up in `js/ui/toolbar.js`

### Adding a Keyboard Shortcut

Edit `js/ui/keyboard.js`:
```javascript
// In handleShortcut method
if (e.key === 'x' && !e.ctrlKey && !e.metaKey) {
    // Your action
    e.preventDefault();
}
```

---

## Testing

### Run Unit Tests
```bash
npm test
```

### Run UI Smoke Tests
```bash
python3 -m http.server 8080
# Open http://localhost:8080/test-ui.html
```

### Quick Manual Test
1. Start server: `python3 -m http.server 8080`
2. Open http://localhost:8080
3. Verify: Canvas renders, selection works, panels sync

---

## Common Gotchas

1. **Canvas uses SVG transforms, not CSS transforms**
   - Pan/zoom via `transform` attribute on a `<g>` wrapper
   - Use `canvas.screenToCanvas(x, y)` for coordinate conversion

2. **Parser is regex-based**
   - See `js/core/parser.js:35-149`
   - Complex DSL features require careful regex updates

3. **History debounces at 50ms**
   - Rapid changes (dragging) are coalesced
   - See `js/core/history.js:44`

4. **Module imports are relative**
   - Always use `./` or `../` prefixes
   - Browser ES modules don't support bare imports

5. **Event listeners on dynamic content**
   - Re-attach listeners after re-render
   - Or use event delegation on container elements

---

## File Size Reference (for refactoring decisions)

| File | Lines | Status |
|------|-------|--------|
| `canvas.js` | 1,223 | ⚠️ Consider splitting |
| `hierarchy-panel.js` | 758 | ⚠️ Consider splitting |
| `actions-panel.js` | 734 | ⚠️ Consider splitting |
| `ai-chat.js` | 600 | OK |
| `properties-panel.js` | 500 | OK |
| `graph.js` | ~500 | OK |
| Other files | <500 | ✅ Good |

---

## Useful Commands

```bash
# Start dev server
python3 -m http.server 8080

# Count lines in JS files
wc -l js/**/*.js js/*.js | tail -5

# Find TODO comments
grep -r "TODO" js/ --include="*.js"

# Check for console.log (should be removed before deploy)
grep -r "console.log" js/ --include="*.js"
```

---

## Contact & Resources

- **GitHub**: https://github.com/devrimdemiroz/ucm-js
- **UCM Spec**: See `knowledge/ucmnav_analysis.md`
- **Visual Syntax**: See `knowledge/visual_syntax_rules.md`
