# jUCMNav (Java/Eclipse) UCM Editor Functionalities Analysis

## Overview

**jUCMNav (Java UCM Navigator)** is the successor to UCMNav, reimplemented as an **Eclipse plugin** written in **Java**. It serves as a graphical editor for the ITU-T User Requirements Notation (URN) standard (Z.151), with Use Case Maps (UCM) as its core scenario modeling notation.

**Platform:** Eclipse IDE (cross-platform: Windows, Linux, macOS)
**Language:** Java
**Development:** Active development since ~2005, maintained by Carleton University and the open-source community
**Repository:** [github.com/JUCMNAV](https://github.com/JUCMNAV)

---

## Core UCM Editor Functionalities

### 1. Graphical UCM Element Palette

jUCMNav provides a comprehensive palette for creating UCM elements:

| Element | Icon/Tool | Functionality |
|---------|-----------|---------------|
| **Start Point** | Filled circle | Define scenario trigger/precondition |
| **End Point** | Bar | Define scenario result/postcondition |
| **Responsibility** | Cross (✕) | Action/task performed along a path |
| **Empty Point** | Small circle | Path waypoint for curves/routing |
| **Waiting Place** | Hourglass | Introduce delays/conditions |
| **Timer** | Clock icon | Temporal conditions |
| **Stub** | Diamond | Container for sub-maps |
| **Component** | Rectangle | Structural entity |

### 2. Path Editing Tools

**Path Creation:**
- Select "Path Tool" from palette
- Click multiple times in editor to create path segments
- Path extends with subsequent clicks until tool is deselected
- Automatic start and end point creation

**Path Manipulation:**
- Extend existing paths by clicking on end points
- Delete path segments
- Merge/split paths
- Insert elements onto paths via palette or drag-drop
- Empty points for curve control (can be hidden)

**B-spline Path Rendering:**
- Smooth curved paths (wiggly lines)
- Automatic path routing around components

### 3. Fork and Join Operations

**OR-Forks (Alternative Paths):**
- Created by dragging start point onto node connection
- Multiple alternative branches with conditions
- Add branches via contextual menu or drag-drop

**OR-Joins:**
- Created by dragging end point onto node connection
- Merge multiple alternative paths

**AND-Forks (Parallel Paths):**
- Convert from OR-fork via contextual menu
- Concurrent execution branches

**AND-Joins (Synchronization):**
- Convert from OR-join via contextual menu
- Wait for all parallel branches to complete

### 4. Component Management

**Component Types (COMPONENTKIND):**
| Type | Description |
|------|-------------|
| **Team** | Group of collaborating entities |
| **Object** | Data/behavior encapsulation |
| **Process** | Executing unit |
| **Agent** | Autonomous entity |
| **Actor** | External entity interacting with system |
| **Parent** | Container for nested components |

**Component Operations:**
- Create components from palette
- Resize and reposition
- Bind responsibilities to components (visual containment)
- Nest components (hierarchical structure)
- Change component type via properties

### 5. Stub System (Hierarchical Decomposition)

**Static Stubs:**
- Single plugin map binding
- Fixed sub-map reference

**Dynamic Stubs:**
- Multiple plugin maps
- Runtime selection based on preconditions
- Conditional sub-map execution

**Plugin Binding:**
- Connect stub in-paths to plugin start points
- Connect stub out-paths to plugin end points
- Responsibility bindings
- Component bindings
- Condition-based path selection

### 6. Path Element Properties

**Responsibilities:**
- Name/label editing
- Description metadata
- Execution time (for performance analysis)
- Service demand specifications

**Start/End Points:**
- Preconditions (start points)
- Postconditions (end points)
- Condition expressions
- Failure handling modes

**Waiting Places & Timers:**
- Timeout conditions
- Node connection conditions
- Visual condition illustration

---

## Scenario Definition & Traversal

### 7. Scenario Specification

**Scenario Definition Elements:**
- Start point selection
- Precondition values
- Expected end points
- Postcondition values
- Variable initializations

**Scenario Groups:**
- Organize related scenarios
- Batch execution support

### 8. Scenario Traversal Mechanism

**Traversal Features:**
- Input: UCM model + scenario definition
- Output: Sequence of traversed UCM elements
- Path highlighting (traversed paths in red)
- Animation support for visual execution
- Visiting sequence identification

**Analysis Capabilities:**
- Detect undesired scenario interactions
- Validate scenario correctness
- Identify unreachable paths
- Coverage analysis

---

## Export & Import Capabilities

### 9. Standard File Formats

| Format | Description | Use Case |
|--------|-------------|----------|
| **Z.151 XML** | ITU-T standard URN format | Interoperability, archival |
| **XMI (Eclipse)** | Eclipse model format | Eclipse ecosystem |
| **.jucm** | Native jUCMNav format | Internal storage |

### 10. Image Export Formats

| Format | Type |
|--------|------|
| **PNG** | Raster image |
| **BMP** | Bitmap |
| **GIF** | Graphics Interchange |
| **JPG** | JPEG compressed |

### 11. Report Generation

| Format | Description |
|--------|-------------|
| **PDF** | Portable Document Format reports |
| **RTF** | Rich Text Format |
| **HTML** | Web-based documentation |

### 12. Transformation Exports

| Export Target | Description |
|---------------|-------------|
| **MSC (Message Sequence Chart)** | Generate from UCM scenarios |
| **MSC XML** | XML format for MSC tools |
| **CSM (Core Scenario Model)** | Performance analysis input |

---

## Eclipse IDE Integration

### 13. Eclipse Views

**Standard Eclipse Views:**
- **Hierarchical Outline**: Tree view of model structure
- **Graphical Outline**: Minimap of diagram
- **Properties View**: Element property editing
- **Problems View**: Model validation issues

### 14. Editor Features

**General Editing:**
- Drag-and-drop editing
- Group selection and manipulation
- Zoom in/out
- Pan/scroll
- Unlimited undo/redo
- Auto-layout mechanism
- Multiple diagram tabs

**Selection Features:**
- Multi-select with shift-click
- Rectangle selection
- Select all connected elements

### 15. Model Validation

**Syntactical Correctness:**
- Prevents invalid model construction
- Real-time validation feedback

**Custom Rules (OCL):**
- User-defined correctness rules
- Consistency checking via Object Constraint Language
- Custom constraint definition

---

## Collaboration Features

### 16. Element References

- Define elements once, reference across diagrams
- Consistent element identity
- Cross-diagram navigation

### 17. Metadata & Documentation

**Element Metadata:**
- Name and ID
- Description
- Author information
- Creation/modification timestamps
- User-defined attributes

---

## Summary: Core UCM Editor Functionalities

| Category | Key Features |
|----------|--------------|
| **Element Creation** | Start/end points, responsibilities, empty points, waiting places, timers, stubs, components |
| **Path Editing** | Path tool, segment creation, extension, merging, deletion, curve control |
| **Flow Control** | OR-forks, OR-joins, AND-forks, AND-joins, contextual menu conversion |
| **Components** | 6 types (team, object, process, agent, actor, parent), binding, nesting |
| **Stubs** | Static/dynamic stubs, plugin maps, in/out binding, conditional execution |
| **Scenarios** | Definition, groups, traversal, highlighting, animation, analysis |
| **Export** | Z.151 XML, images (PNG/BMP/GIF/JPG), reports (PDF/RTF/HTML), MSC |
| **Eclipse Integration** | Outline views, properties, validation, undo/redo, zoom, auto-layout |
| **Validation** | Syntactical correctness, custom OCL rules |

---

## Comparison: UCMNav (C++) vs jUCMNav (Java)

| Aspect | UCMNav (C++) | jUCMNav (Java) |
|--------|--------------|----------------|
| **Platform** | Unix/Linux/Solaris + Cygwin | Cross-platform (Eclipse) |
| **GUI Toolkit** | X-Windows/Motif | Eclipse SWT/GEF |
| **Development** | ~1995-2005 | 2005-present (active) |
| **Export Formats** | XML, EPS, MIF, CGM, PostScript | Z.151 XML, PNG, PDF, MSC, HTML |
| **Scenario Traversal** | Basic | Advanced with animation |
| **Validation** | Syntactical | Syntactical + custom OCL |
| **Performance Analysis** | LQN generation | CSM export |
| **Standards** | Pre-standard | ITU-T Z.151 compliant |

---

*This analysis focuses on core UCM editor functionalities, excluding GRL (Goal-oriented Requirement Language) extensions.*
