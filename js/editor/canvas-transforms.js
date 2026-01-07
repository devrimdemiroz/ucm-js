/**
 * Canvas Transforms - Zoom, pan, and coordinate conversion utilities
 * 
 * Responsible for:
 * - Zoom in/out/fit-to-window
 * - Pan (scroll)
 * - Coordinate conversions (screen ↔ world)
 * - Auto-centering ("Bulls Eye")
 */

import { graph } from '../core/graph.js';

class CanvasTransforms {
    constructor() {
        this.zoom = 1;
        this.pan = { x: 0, y: 0 };
        this.svg = null;
        this.viewport = null;
    }

    /**
     * Initialize with reference to SVG elements
     * @param {SVGElement} svg - The main SVG element
     * @param {SVGGElement} viewport - The viewport group that receives transforms
     */
    init(svg, viewport) {
        this.svg = svg;
        this.viewport = viewport;
    }

    // ============================================
    // Coordinate Conversion
    // ============================================

    /**
     * Convert screen (client) coordinates to SVG world coordinates
     * @param {number} clientX - Screen X coordinate
     * @param {number} clientY - Screen Y coordinate
     * @returns {{ x: number, y: number }} World coordinates
     */
    getSVGPoint(clientX, clientY) {
        // Use SVG's built-in coordinate transformation for accuracy
        const point = this.svg.createSVGPoint();
        point.x = clientX;
        point.y = clientY;

        // Get the inverse of the viewport's transform matrix
        const ctm = this.viewport.getScreenCTM();
        if (ctm) {
            const inverted = ctm.inverse();
            const transformed = point.matrixTransform(inverted);
            return { x: transformed.x, y: transformed.y };
        }

        // Fallback if matrix not available
        const rect = this.svg.getBoundingClientRect();
        return {
            x: (clientX - rect.left - this.pan.x) / this.zoom,
            y: (clientY - rect.top - this.pan.y) / this.zoom
        };
    }

    /**
     * Convert world coordinates to screen coordinates
     * @param {number} worldX - World X coordinate
     * @param {number} worldY - World Y coordinate
     * @returns {{ x: number, y: number }} Screen coordinates
     */
    worldToScreen(worldX, worldY) {
        return {
            x: worldX * this.zoom + this.pan.x,
            y: worldY * this.zoom + this.pan.y
        };
    }

    // ============================================
    // Zoom Controls
    // ============================================

    /**
     * Set zoom level, optionally centering on a point
     * @param {number} newZoom - New zoom level
     * @param {{ x: number, y: number }} [centerPoint] - Point to keep stable during zoom
     */
    setZoom(newZoom, centerPoint = null) {
        const oldZoom = this.zoom;
        this.zoom = Math.max(0.25, Math.min(4, newZoom));

        // If zooming toward a point, adjust pan to keep that point stable
        if (centerPoint && oldZoom !== this.zoom) {
            // worldPoint stays at same screenPoint after zoom
            // worldX = (screenX - pan) / zoom
            // newPan = screenX - worldX * newZoom
            const worldX = (centerPoint.x - this.pan.x) / oldZoom;
            const worldY = (centerPoint.y - this.pan.y) / oldZoom;
            this.pan.x = centerPoint.x - worldX * this.zoom;
            this.pan.y = centerPoint.y - worldY * this.zoom;
        }

        this.updateTransform();
        this.updateZoomDisplay();
    }

    /**
     * Zoom in by 25%
     */
    zoomIn() {
        this.setZoom(this.zoom * 1.25);
    }

    /**
     * Zoom out by 20%
     */
    zoomOut() {
        this.setZoom(this.zoom / 1.25);
    }

    /**
     * Fit diagram content to window with padding
     */
    fitToWindow() {
        const bounds = graph.getBoundingBox(50); // 50px padding
        const container = document.getElementById('canvas-container');
        if (!container || bounds.width === 0) return;

        const cw = container.clientWidth;
        const ch = container.clientHeight;

        // Calculate scale to fit
        const scaleX = cw / bounds.width;
        const scaleY = ch / bounds.height;
        let newZoom = Math.min(scaleX, scaleY);

        // Clamp to reasonable limits
        newZoom = Math.min(newZoom, 2);

        this.zoom = newZoom;

        // Calculate pan to center the content
        // Screen = World * Zoom + Pan
        // Pan = Screen - World * Zoom
        this.pan.x = (cw / 2) - (bounds.center.x * this.zoom);
        this.pan.y = (ch / 2) - (bounds.center.y * this.zoom);

        this.updateTransform();
        this.updateZoomDisplay();
    }

    // ============================================
    // Pan Controls
    // ============================================

    /**
     * Apply a delta to current pan
     * @param {number} dx - Pan delta X
     * @param {number} dy - Pan delta Y
     */
    panBy(dx, dy) {
        this.pan.x += dx;
        this.pan.y += dy;
        this.updateTransform();
    }

    /**
     * Set absolute pan position
     * @param {number} x - Pan X
     * @param {number} y - Pan Y
     */
    setPan(x, y) {
        this.pan.x = x;
        this.pan.y = y;
        this.updateTransform();
    }

    // ============================================
    // "Bulls Eye" Auto-Centering
    // ============================================

    /**
     * Center the viewport on a specific world point
     * @param {number} x - World X coordinate
     * @param {number} y - World Y coordinate
     */
    centerOnPoint(x, y) {
        const container = document.getElementById('canvas-container');
        if (!container) return;

        const cw = container.clientWidth;
        const ch = container.clientHeight;

        // pan = screenCenter - worldPoint * zoom
        this.pan.x = (cw / 2) - (x * this.zoom);
        this.pan.y = (ch / 2) - (y * this.zoom);

        this.updateTransform();
    }

    /**
     * Center the viewport on a node
     * @param {string} nodeId - ID of the node to center on
     */
    centerOnNode(nodeId) {
        const node = graph.getNode(nodeId);
        if (node) {
            this.centerOnPoint(node.position.x, node.position.y);
        }
    }

    /**
     * Center the viewport on a component
     * @param {string} compId - ID of the component to center on
     */
    centerOnComponent(compId) {
        const comp = graph.getComponent(compId);
        if (comp) {
            const cx = comp.bounds.x + comp.bounds.width / 2;
            const cy = comp.bounds.y + comp.bounds.height / 2;
            this.centerOnPoint(cx, cy);
        }
    }

    // ============================================
    // Transform Application
    // ============================================

    /**
     * Apply current zoom and pan to the viewport
     */
    updateTransform() {
        if (this.viewport) {
            this.viewport.setAttribute('transform',
                `translate(${this.pan.x}, ${this.pan.y}) scale(${this.zoom})`
            );
        }

        // Clear any legacy CSS transforms on the SVG itself
        if (this.svg) {
            this.svg.style.transform = '';
            this.svg.style.transformOrigin = '';
        }
    }

    /**
     * Update the zoom level display in the UI
     */
    updateZoomDisplay() {
        const zoomDisplay = document.getElementById('zoom-level');
        if (zoomDisplay) {
            zoomDisplay.textContent = `${Math.round(this.zoom * 100)}%`;
        }
    }
}

export const transforms = new CanvasTransforms();
