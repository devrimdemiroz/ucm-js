# Project Specifications: UCM Mermaid Extension

## 1. Core Philosophy: The Abstract Network Graph
At its fundamental level, the Use Case Map (UCM) system is an abstraction of a **Network Graph**. Consequently, the implementation should treat all elements—regardless of their visual representation (Rectangle, Station, Line)—as nodes and edges in a graph structure.

### Graph Mapping
| UCM Element | Graph Representation |
| :--- | :--- |
| **Component** | Container Node (Subgraph/Cluster) |
| **Responsibility** (Station) | Operational Node |
| **Start Point** | Source Node |
| **End Point** | Sink Node |
| **Stub/Plug-in** | Hierarchical Node (Reference to another Map) |
| **Path** | Directed Edge (Causal Flow) |
| **Fork/Join** | Control Flow Node |

## 2. Historical Context & References
The design of this extension must respect the established standards and legacy tools, using them as the source of truth for declarative abstractions.

### Standard Tools
-   **jUCMNav (Java/Eclipse)**: [GitHub](https://github.com/JUCMNAV/jUCMNav). The current reference implementation.
-   **UCMNav (C++)**: The original tool (mid-90s to ~2005) running on Unix/X-Windows. Known for powerful simulation capabilities.
-   **Traceability**: This project should aim to be "Mermaid-native" but semantically compatible with jUCMNav's object types and relationships.

### Key Literature
1.  **"Use Case Maps as Architectural Entities for Complex Systems"** (R.J.A. Buhr, 1998): Defines "paths" as first-class architectural entities showing causal relationships, superimposed on abstract components.
2.  **"Use Case Maps and UML for Complex Software-Driven Systems"** (Daniel Amyot, 1999): Explains UCMs as filling the "modeling gap" in UML, focusing on logic flow before message/object definition.

### Standards
-   **ITU-T Z.151 (URN/UCM)**: [Recommendation Z.151](https://www.itu.int/rec/T-REC-Z.151). The formal definition.
-   **UseCaseMaps.org**: [Original Resource](http://usecasemaps.org).

## 3. Visual Language (The Notation)
The extension implements the "Path-Centric Visualization" described in the literature, styled essentially as a "network map" (e.g., London Tube Map).

-   **Start Points**: Filled circles (Triggers/Pre-conditions).
-   **Responsibilities**: Crosses or "Stations" (Tasks/Functions).
-   **End Points**: Bars (Effects/Post-conditions).
-   **Components**: Rectangular containers ("Boxes") representing system/actor boundaries. Paths traverse these.
-   **Stubs/Plug-ins**: Diamonds representing hierarchical expansion (Zoom-in capability).

### Rendering Style

-   **London Tube Map Style**: Paths and responsibilities as stations on transit map style. somehow modernized UCM in that sense
-   **High Contrast B&W**: Thick black lines for paths, white fills for components.
-   **Interactivity**: Click-to-expand stubs/components, hover effects for path tracing.

## 4. DSL Design Principles
**Do Not Invent The Wheel.** The syntax should mirror existing declarative languages (jUCMNav, PlantUML, Mermaid) rather than creating a novel, incompatible grammar.

### Syntax Goals
-   **Declarative**: Describe *what* connects to *what*, not coordinates.
-   **Abstraction**: `Path "P1" connects "Start" to "End"` is the primitive.
-   **Simulation Ready**: The underlying data structure (`db.js`) should be robust enough to support simulation logic (token traversal) in the future, inspired by the C++ UCMNav capabilities.

## 5. Application Requirements
-   **Live Editor**: Browser-based, real-time update loop.
-   **Manual Rendering Pipeline**: Bypass strict Mermaid v10 integration issues by exposing independent `parser` and `renderer` modules while maintaining the plugin structure for future compatibility.
