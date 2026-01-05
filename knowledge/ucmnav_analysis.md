# UCMNav (C++) Editor Functionalities Analysis

## Overview

**UCMNav (Use Case Map Navigator)** was a pioneering graphical modeling tool developed at Carleton University, primarily by researchers in the SQUALL (Software Quality Lab) group. It was written in **C++** with an **X-Windows/Motif** GUI toolkit, running primarily on Unix/Linux and Solaris systems (with Windows support via Cygwin/X-server emulators).

**Development Era:** Mid-to-late 1990s to approximately 2005

---

## Core Editor Functionalities

### 1. Graphical UCM Element Editing

UCMNav provided a graphical interface for creating and manipulating core Use Case Map elements:

| Element | Visual Representation | Functionality |
|---------|----------------------|---------------|
| **Start Points** | Filled circles (●) | Define preconditions and triggering causes for scenarios |
| **End Points** | Bars (▮) | Indicate post-conditions and resulting effects |
| **Responsibilities** | Crosses (✕) | Represent actions, tasks, or functions performed along a path |
| **Components** | Rectangular boxes (□) | Abstract entities (objects, processes, agents, databases, actors) |
| **Paths** | Wiggly/curved lines | Causal chains connecting elements as scenarios |
| **Stubs** | Containers for sub-maps | Hierarchical decomposition enabling plug-in behavior |

### 2. Path Editing Operations

- **Path creation**: Draw causal paths from start points to end points
- **Path extension**: Add segments to existing paths
- **Path deletion**: Remove portions of paths
- **Path connection**: Connect path elements
- **B-spline rendering** (evident from `bspline.cc` in source): Smooth curve rendering for paths

### 3. Component Management

Based on the source files (`component.cc`, `component_mgr.cc`, `component_ref.cc`):
- Component creation and positioning
- Component binding (allocating responsibilities to components)
- Component reference management
- Component hierarchy organization

### 4. Syntactical Correctness Enforcement

UCMNav ensured that UCM models being manipulated were **syntactically correct**, preventing the construction of invalid models. This was a significant feature for maintaining model integrity.

### 5. Advanced Flow Control Elements

- **OR-forks**: Alternative path branching
- **AND-forks**: Parallel path execution
- **Loops** (evident from `loop.cc`, `loop_figure.cc` in source)
- **Wait/Synchronization points**
- **Timers** for temporal modeling
- **Conditions** (evident from `condition.cc`, `conditions.cc`)

### 6. Hierarchical Map Organization

- **Static and Dynamic Stubs**: Allow sub-maps to be referenced from parent maps
- **Input/Output point binding**: Connect stub points to sub-map path segments
- **Plug-in architecture**: Refine behavior through nested maps

---

## Analysis & Transformation Features

### 7. Scenario Traversal

UCMNav implemented **scenario traversal** mechanisms that:
- Simulate UCM execution based on initial context
- Determine specific paths taken through the model
- Enable scenario-based testing and validation
- Detect undesired scenario interactions

### 8. Performance Modeling (LQN Generation)

A significant feature was automatic generation of **Layered Queueing Network (LQN)** models:
- **Performance → Generate LQN** menu option
- Scenario-to-performance transformation (SPT)
- Point-to-point path traversal to infer component calling structures
- Support for performance bottleneck prediction

### 9. Evaluation Engine

The source code includes `evaluate.l` and `evaluate.y` (lex/yacc files), indicating:
- Expression evaluation capabilities
- Condition evaluation for path selection
- Pre/post-condition validation

---

## Export & Output Formats

### 10. Multiple Export Formats

UCMNav supported exporting UCM models in various formats:

| Format | Description |
|--------|-------------|
| **XML** | Structured data exchange with external tools |
| **EPS** | Encapsulated PostScript for vector graphics |
| **MIF** | Maker Interchange Format (for FrameMaker) |
| **PostScript/PDF** | Report generation |
| **CGM** | Computer Graphics Metafile (evident from `cgmpresentation.cc`) |

### 11. Report Generation

- PostScript output for documentation
- PDF generation for comprehensive reports

---

## User Interface Features (Motif-based)

### 12. Standard Motif GUI Widgets

Being built on X-Windows/Motif, UCMNav featured:
- **Menu system**: Standard menu bars and dropdown menus
- **Toolbars**: Button-based tool selection
- **Dialog boxes**: Property editing, file operations
- **Scroll bars**: Canvas navigation
- **Text fields**: Label and property editing (evident from `label.cc`)
- **Canvas/drawing area**: Main editing workspace

### 13. Actions & Callbacks

The source includes `action.cc` and `callbacks.cc`, indicating:
- User interaction handling
- Undo/redo operations
- State machine for editing modes

### 14. Display Management

From `display.cc`:
- Zoom capabilities
- Panning/scrolling
- Figure rendering and refresh
- Multi-window support

### 15. Handle Manipulation

From `handle.cc`:
- Interactive element handles
- Resize/move operations
- Selection handling

---

## Data Management Features

### 16. File Operations

- Save/Load UCM models
- File format conversion
- Design import/export

### 17. Internal Data Structures

From source files:
- **Hypergraph representation** (`hypergraph.cc`): Graph-based model storage
- **Collections** (`collection.cc`): Element container management
- **Data management** (`data.cc`): Model data handling

---

## Summary of Key Editor Functionalities

| Category | Features |
|----------|----------|
| **Element Creation** | Start points, end points, responsibilities, components, stubs, paths |
| **Path Editing** | Create, extend, connect, delete paths; smooth B-spline curves |
| **Component Editing** | Create, position, bind responsibilities, manage hierarchy |
| **Flow Control** | OR-forks, AND-forks, loops, waits, synchronization, timers |
| **Validation** | Syntactical correctness enforcement, condition checking |
| **Hierarchy** | Static/dynamic stubs, sub-maps, plug-in architecture |
| **Analysis** | Scenario traversal, performance modeling, LQN generation |
| **Export** | XML, EPS, MIF, CGM, PostScript, PDF |
| **GUI** | Motif widgets, canvas editing, zoom, pan, undo/redo |

---

## Source Code Structure (GitHub: JUCMNAV/UCMNav)

Key source files identified:
- `component.cc/.h` - Component management
- `bspline.cc/.h` - Path curve rendering
- `loop.cc/.h` - Loop element handling
- `condition.cc/.h` - Condition evaluation
- `hypergraph.cc/.h` - Model data structure
- `display.cc/.h` - Rendering engine
- `callbacks.cc/.h` - User interaction
- `cgmpresentation.cc/.h` - CGM export
- `lqn.cc/.h` - LQN generation

---

*This analysis is based on the UCMNav source code structure and research documentation from Carleton University.*
