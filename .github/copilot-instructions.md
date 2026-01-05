# UCM Editor - AI Agent Instructions

## Project Overview
This is a **Use Case Map (UCM)** graphical editor implementing the ITU-T Z.151 standard. UCM models system behavior as an abstract network graph where Components (containers) house Responsibilities (nodes) connected by Paths (edges). The project follows a "path-centric" philosophy with London Tube Map visual styling.

## Architecture Pattern: Dual Graph System

### Primary System (Live Editor)
- **Core**: [`js/core/graph.js`](js/core/graph.js) - Main graph store with `UCMGraph` class. Manages nodes, edges, and nested components.
- **Canvas**: [`js/editor/canvas.js`](js/editor/canvas.js) - D3-style SVG rendering with interactive tools.
- **Entry**: [`js/app.js`](js/app.js) - Module orchestration, tracing initialization, and demo data.
- **UI**: Modular UI components in [`js/ui/`](js/ui/) (Sidebar, DSL Panel, Settings, AI Chat).

### Secondary System (Mermaid Integration)  
- **Parser**: [`src/parser.js`](src/parser.js) - Text DSL parser for declarative diagram syntax.
- **Database**: [`src/db.js`](src/db.js) - `UcmDb` class for Mermaid compatibility.
- **Renderer**: [`src/renderer.js`](src/renderer.js) - Alternative D3 renderer for parsed diagrams.

## Critical Development Patterns

### Graph Data Model
All elements are nodes/edges. Components are container nodes that can nest other components.
```javascript
// Node structure (start/end/responsibility/fork/join)
{ id, type, position: {x, y}, properties: {name, ...}, parentComponent, inEdges: Set, outEdges: Set }

// Component structure (actor/team/object/process/agent)  
{ 
  id, type, bounds: {x, y, width, height}, 
  properties: {name, ...}, 
  childNodes: Set,        // Nodes bound to this component
  childComponents: Set,   // Nested sub-components
  parentComponent: String // ID of parent component
}

// Edge structure (paths between nodes)
{ id, sourceNodeId, targetNodeId, controlPoints: [], condition, properties }
```

### Event-Driven Updates
The graph emits events (`node:added`, `component:updated`, `component:nested`, etc.) that trigger canvas re-renders. **Always use graph methods** rather than direct DOM manipulation.
```javascript
// Correct: triggers events, tracing, and updates
graph.addNode('responsibility', { x: 100, y: 200, name: 'ValidateInput' });

// Incorrect: bypasses event system and tracing
this.nodes.set(id, nodeData);
```

### Observability & Tracing
The editor integrates with a local observability stack (Prometheus, Jaeger, OTel Collector).
- **Tracing Core**: [`js/core/tracing.js`](js/core/tracing.js) - Lightweight OTLP/HTTP exporter.
- **Instrumentation**: `UCMGraph` methods automatically create spans (e.g., `ucm.node.create`).
- **Stack Management**:
  ```bash
  cd observability && docker-compose up -d
  # Jaeger UI: http://localhost:16686
  # Prometheus: http://localhost:9090
  ```

### Module Import Pattern
Uses ES6 modules with singleton pattern. Import the singleton instance, not the class.
```javascript
import { graph } from './core/graph.js';         // ✓ Singleton instance
import { tracing } from './core/tracing.js';     // ✓ Singleton instance
```

## Development Workflows

### Local Development Server
Required due to ES6 module CORS restrictions:
```bash
python3 -m http.server 8080
# Navigate to http://localhost:8080/index.html
```

### Testing & Debugging
1.  **Demo Data**: Modify `createDemoData()` in [`js/app.js`](js/app.js) to test complex scenarios (e.g., Forks/Joins).
2.  **Console Access**: Use `window.ucmEditor` and `window.ucmGraph` for runtime inspection.
3.  **Tracing**: Check Jaeger UI to verify operation flows and performance.

### UCM Constraints
The `UCMGraph` enforces standard constraints:
- **Start Nodes**: Max 1 outgoing edge (use AND-Fork for parallelism).
- **End Nodes**: No outgoing edges.
- **Nesting**: Circular nesting of components is prevented.

## Visual Styling Philosophy
- **High contrast**: Black paths/nodes on white background (London Tube Map inspiration).
- **CSS Custom Properties**: All colors in `:root` variables.
- **Layer-based SVG**: Separate `g` elements for components/edges/nodes/labels/selection.
- **Octilinear Paths**: All paths use octilinear routing (horizontal, vertical, diagonal). Forks and Joins use specific symmetrical patterns (Diagonal-First for Forks, Diagonal-Last for Joins) to create clean diamond shapes.

When extending functionality, ensure you instrument new operations with `tracing.sendSpan()` and maintain the event-driven architecture.