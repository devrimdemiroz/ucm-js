# Implementation Plan - UCM Editor Enhancements

This plan outlines the steps for implementing the features identified in the requirements (Task 1, 2, 3).

## Task 1: DSL Editor Sidebar
**Objective**: Introduce a tabbed interface in the left panel and a live DSL editor for bi-directional synchronization.

### 1.1 UI Structure (Tabbed Sidebar)
- [x] Create a tab navigation header in the `#left-panel`.
- [x] Define content areas for "Hierarchy", "Editor", and "Settings".
- [x] Implement tab switching logic.
- [x] Style the tabs for a premium, minimal **Black & White** aesthetic.

### 1.2 DSL Editor implementation
- [x] Integrate a code editor component (currently styled `<textarea>`).
- [x] Add the "Editor" panel content with the editor instance.

### 1.3 Serialization & Parsing logic
- [x] Implement `serializer.js` to convert `UCMGraph` to UCM DSL.
- [x] Implement `parser.js` for basic DSL-to-Graph sync.
- [x] **Advanced Parsing**: Support block syntax `component "X" { responsibility "Y" }`.
- [x] **Incremental Sync**: Preserves node positions when re-parsing DSL.

### 1.4 Bi-directional Synchronization
- [x] **Graph -> DSL**: Automatic update on canvas changes.
- [x] **DSL -> Graph**: "Apply" button triggered re-render.
- [x] Handle parsing errors with better visual line indicators.

---

## Task 2: Export & Import System
**Objective**: Enable saving and loading diagrams in various formats (Priorities 1-4 from user feedback).

### 2.1 Basic Export & Save (Priority 3 & 4)
- [x] Implement "Save as File" (JSON).
- [x] **D3.js / Cytoscape Export**: Nodes/Edges formatted for data viz libraries.

### 2.2 Advanced Format Export (Priority 2)
- [x] **jUCM Export**: Export as XML compatible with jUCMNav.

### 2.3 Image & Document Export (Priority 1)
- [x] **PDF Export**: Current implementation (window.print).
- [x] **High-Res Export**: Export canvas as SVG file.

### 2.4 Import (Priority 3)
- [x] **Upload File**: "Import JSON" button to restore state.
- [x] **DSL Import**: Drag & Drop `.ucm` text files onto the editor.

---

## Task 3: Global Settings & Visual Styles
**Objective**: Toggle between different UCM representations and UI behavior.

### 3.1 Settings Panel
- [x] Create a "Settings" tab in the sidebar.
- [x] **Transit Map Mode**: B&W high-contrast visualization.
- [x] **Show Grid**: Toggle background dots.
- [x] **UI Controls**: Toggles for "Show Labels", "Snap to Grid", and "Auto-layout".
- [x] **Aesthetics**: Ensure settings use strict B&W switches/sliders.

---

## Task 1 Breakdown (Immediate Work)

1.  **Modify `index.html`**: Add tab headers and container for the editor.
2.  **Update `css/styles.css`**: Add styles for tabs and the editor area.
3.  **Create `js/ui/sidebar.js`**: Handle tab switching and sidebar state.
4.  **Create `js/core/serializer.js`**: Implement the `serialize(graph)` function.
5.  **Update `js/app.js`**: Initialize the sidebar and wire up the synchronization.
