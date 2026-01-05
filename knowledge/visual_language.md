# Visual Language Settings

Based on the UCM original specification and the "Collector Pipelines" visual language by Devrim Demiroz, the editor supports two primary visual modes: **Classic** and **Transit**.

## 🎨 Visual Language Rules

| Element | Classic Mode (Default) | Transit Mode |
| :--- | :--- | :--- |
| **Responsibility Node** | **X Mark**. Represented by a cross (✕) on the path. | **Station**. Represented by a small circle (dot) on the path. |
| **Path Connections** | **Mid-Arrow**. Directional arrow is placed in the **middle** of the connection segment. | **No Arrow**. The path is a continuous line (typically thicker) without arrows. |
| **Aesthetic Direction** | Fine lines, classic documentation style. | Bold lines, high-contrast, "Metro map" style. |

## 📐 Implementation Notes

- Use the global `.transit-mode` class on the `<body>` to toggle these styles.
- Strict **Black & White** palette applies to both modes.
- Responsibilities in Transit mode should look like "stops" on a metro line.
- Arrows in Classic mode should be centered on the segment to avoid cluttering at the nodes.

---
*Reference: [Collector Pipelines Visual Language](https://tractatus.one/observant-mind-0621569c22fe)*
