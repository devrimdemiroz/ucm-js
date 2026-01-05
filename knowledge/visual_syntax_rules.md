# Visual Syntax Rules & Implementation Status

## 🎨 Visual Modes

The UCM Editor supports two distinct visual styles.

| Feature | **Classic Mode** (Default) | **Transit Mode** |
| :--- | :--- | :--- |
| **Metaphor** | Standard Engineering Diagram | Metro / Subway Map |
| **Responsibility** | **X-Mark** (✕) | **Station** (●) |
| **Path Style** | Thin black lines | Thick colored tubes |
| **Arrows** | Mid-segment directional arrows | No arrows (continuous flow) |

---

## 🛠 Implemented Syntax

The following Core UCM elements are fully implemented and visually verified.

### 1. Path Elements

| Element | Notation | Description |
| :--- | :--- | :--- |
| **Start Point** | ⚫ **Filled Circle** | Initiates a scenario. Can have a label. |
| **End Point** | ▬ **Bar** | Terminates a scenario. Perpendicular to the path. |
| **Responsibility** | ✕ / ● | An action performed along the path. See *Visual Modes*. |
| **Path** | 〰️ **Bezier Curve** | Causal linkage between elements. |

### 2. Forks & Joins (Logic)

Distinction logic follows standard UCM notation (and *455695538.pdf*):

| Logic Type | Component | Visual Representation | Meaning |
| :--- | :--- | :--- | :--- |
| **OR** (Alternative) | **Fork** | • **Point** (Small Circle) | Path splits into alternatives (one is chosen). |
| **OR** (Merge) | **Join** | • **Point** (Small Circle) | Multiple paths merge into one (asynchronous). |
| **AND** (Parallel) | **Fork** | ▌ **Bar** (Thick Rect) | Path splits into concurrent parallel threads. |
| **AND** (Sync) | **Join** | ▌ **Bar** (Thick Rect) | Concurrent paths wait for each other to sync. |

### 3. Structure

| Element | Notation | Description |
| :--- | :--- | :--- |
| **Component** | ⬜ **Rectangle** | Container for responsibilities. Includes a header bar for dragging. |

---

## 🔮 Future Roadmap

Based on standard UCM notation (*URN - User Requirements Notation*), the following elements are candidates for future implementation:

1.  **Timers**: Special Start Points or Waiting Places (often denoted by a clock symbol).
2.  **Stubs**: Diamond shapes indicating a sub-map or plugin map (Hierarchical UCMs).
    -   *Static Stubs*: Fixed sub-map.
    -   *Dynamic Stubs*: Run-time choice of sub-maps.
3.  **Failure Points**: Notation for "abort" or exception handling (often a lightning bolt or ground symbol).
4.  **Condition Labels**: Explicit text labels on paths leaving an OR-Fork (e.g., `[x > 5]`).

---

## 📚 References

The knowledge base has been updated with the following materials found in the workspace:

1.  **455695538.pdf**: Source for specific Fork/Join visual notation rules.
2.  **Collector Pipelines Visual Language**: Basis for the "Transit Mode" aesthetic.
3.  **Enhanced_Use_Case_Map_Traversal_Semantics.pdf**: Reference for path semantics.
4.  **SDL2015-BraunEtAl.pdf**: Academic reference.

```mermaid
graph LR
    subgraph Legend [Visual Dictionary]
        direction TB
        S((Start)) --> R{Responsibility}
        R -->|OR Fork| F1((.))
        R -->|AND Fork| F2[|]
        F1 --> E[End]
        F2 --> E
    end
```
