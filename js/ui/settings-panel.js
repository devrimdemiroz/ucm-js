/**
 * Settings Panel - Handles global editor settings
 */

import { canvas } from '../editor/canvas.js';
import { setRoutingMode, getRoutingMode, ROUTING_MODES } from '../core/node-types.js';

class SettingsPanel {
    constructor() {
        this.transitModeToggle = null;
        this.showGridToggle = null;
        this.showLabelsToggle = null;
        this.snapToGridToggle = null;
        this.autoLayoutToggle = null;
        this.routingModeSelect = null;
        this.showAutoWaypointsToggle = null;

        // Global settings state
        this.settings = {
            transitMode: true,
            showGrid: true,
            showLabels: true,
            snapToGrid: false,
            autoLayout: false,
            observability: false,
            showAutoWaypoints: false,
            gridSize: 20,
            routingMode: 'octilinear'
        };
    }

    init() {
        this.transitModeToggle = document.getElementById('setting-transit-mode');
        this.showGridToggle = document.getElementById('setting-show-grid');
        this.showLabelsToggle = document.getElementById('setting-show-labels');
        this.snapToGridToggle = document.getElementById('setting-snap-grid');
        this.autoLayoutToggle = document.getElementById('setting-auto-layout');
        this.observabilityToggle = document.getElementById('setting-observability');
        this.routingModeSelect = document.getElementById('setting-routing-mode');
        this.showAutoWaypointsToggle = document.getElementById('setting-show-auto-waypoints');

        if (!this.transitModeToggle) return;

        this.transitModeToggle.addEventListener('change', (e) => {
            this.setTransitMode(e.target.checked);
        });

        this.showGridToggle.addEventListener('change', (e) => {
            this.setGridVisibility(e.target.checked);
        });

        this.showLabelsToggle?.addEventListener('change', (e) => {
            this.setLabelVisibility(e.target.checked);
        });

        this.snapToGridToggle?.addEventListener('change', (e) => {
            this.setSnapToGrid(e.target.checked);
        });

        this.autoLayoutToggle?.addEventListener('change', (e) => {
            this.setAutoLayout(e.target.checked);
        });

        this.observabilityToggle?.addEventListener('change', (e) => {
            this.setObservability(e.target.checked);
        });

        this.routingModeSelect?.addEventListener('change', (e) => {
            this.setRoutingMode(e.target.value);
        });

        this.showAutoWaypointsToggle?.addEventListener('change', (e) => {
            this.setShowAutoWaypoints(e.target.checked);
        });

        // Apply initial settings
        this.setTransitMode(this.transitModeToggle.checked);
        this.setGridVisibility(this.showGridToggle.checked);
        this.setLabelVisibility(this.showLabelsToggle?.checked ?? true);
        this.setSnapToGrid(this.snapToGridToggle?.checked ?? false);
        this.setAutoLayout(this.autoLayoutToggle?.checked ?? false);
        this.setObservability(this.observabilityToggle?.checked ?? false);

        // Set initial routing mode
        if (this.routingModeSelect) {
            this.routingModeSelect.value = getRoutingMode();
        }
        this.setShowAutoWaypoints(this.showAutoWaypointsToggle?.checked ?? false);
    }

    setTransitMode(enabled) {
        this.settings.transitMode = enabled;
        document.body.classList.toggle('transit-mode', enabled);
        canvas.renderAll();
    }

    setGridVisibility(visible) {
        this.settings.showGrid = visible;
        const canvasContainer = document.getElementById('canvas-container');
        if (canvasContainer) {
            canvasContainer.classList.toggle('hide-grid', !visible);
        }
        canvas.renderAll();
    }

    setLabelVisibility(visible) {
        this.settings.showLabels = visible;
        document.body.classList.toggle('hide-labels', !visible);
        canvas.renderAll();
    }

    setSnapToGrid(enabled) {
        this.settings.snapToGrid = enabled;
    }

    setAutoLayout(enabled) {
        this.settings.autoLayout = enabled;
    }

    setObservability(enabled) {
        this.settings.observability = enabled;
        // Import dynamically to avoid circular deps if needed, though tracing is core
        import('../core/tracing.js').then(({ tracing }) => {
            tracing.setEnabled(enabled);
        });
    }

    setRoutingMode(mode) {
        this.settings.routingMode = mode;
        setRoutingMode(mode);
        canvas.renderAll();
    }

    setShowAutoWaypoints(enabled) {
        this.settings.showAutoWaypoints = enabled;
        document.body.classList.toggle('show-auto-waypoints', enabled);
        canvas.renderAll();
    }

    // Snap a position to the grid
    snapPosition(x, y) {
        if (!this.settings.snapToGrid) {
            return { x, y };
        }
        const gridSize = this.settings.gridSize;
        return {
            x: Math.round(x / gridSize) * gridSize,
            y: Math.round(y / gridSize) * gridSize
        };
    }

    // Simple auto-layout algorithm
    applyAutoLayout() {
        // Import graph dynamically to avoid circular deps
        import('../core/graph.js').then(({ graph }) => {
            const nodes = graph.getAllNodes();
            if (nodes.length === 0) return;

            // Simple horizontal flow layout
            const startX = 100;
            const startY = 200;
            const spacingX = 180;
            const spacingY = 120;

            // Group nodes by type for layering
            const starts = nodes.filter(n => n.type === 'start');
            const ends = nodes.filter(n => n.type === 'end');
            const others = nodes.filter(n => n.type !== 'start' && n.type !== 'end');

            let x = startX;
            let y = startY;

            // Position start nodes
            starts.forEach((node, i) => {
                graph.updateNode(node.id, { position: { x, y: y + i * spacingY } });
            });
            x += spacingX;

            // Position middle nodes
            others.forEach((node, i) => {
                const row = Math.floor(i / 4);
                const col = i % 4;
                graph.updateNode(node.id, {
                    position: { x: x + col * spacingX, y: startY + row * spacingY }
                });
            });
            x += Math.ceil(others.length / 4) * spacingX;

            // Position end nodes
            ends.forEach((node, i) => {
                graph.updateNode(node.id, { position: { x, y: y + i * spacingY } });
            });

            canvas.renderAll();
        });
    }

    // Get current settings (for use by other modules)
    getSettings() {
        return { ...this.settings };
    }
}

export const settingsPanel = new SettingsPanel();
