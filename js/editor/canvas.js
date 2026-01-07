/**
 * UCM Canvas - Main orchestrator for SVG canvas rendering and interaction
 * 
 * This module coordinates:
 * - canvas-transforms.js: Zoom, pan, coordinate conversion
 * - canvas-renderer.js: SVG rendering for nodes, edges, components
 * - canvas-interactions.js: Mouse and keyboard event handling
 * 
 * The canvas uses an SVG with a viewport group that receives transforms.
 * Layers are organized as: components (back) → edges → nodes → labels → selection (front)
 */

import { graph } from '../core/graph.js';
import { transforms } from './canvas-transforms.js';
import { renderer } from './canvas-renderer.js';
import { interactions } from './canvas-interactions.js';

class UCMCanvas {
    constructor() {
        this.svg = null;
        this.viewport = null;
        this.layers = {};
    }

    /**
     * Initialize the canvas with DOM elements and event subscriptions
     */
    init() {
        // Get DOM references
        this.svg = document.getElementById('canvas');
        this.viewport = document.getElementById('viewport');
        this.layers = {
            components: document.getElementById('layer-components'),
            edges: document.getElementById('layer-edges'),
            nodes: document.getElementById('layer-nodes'),
            labels: document.getElementById('layer-labels'),
            selection: document.getElementById('layer-selection')
        };

        // Initialize sub-modules
        transforms.init(this.svg, this.viewport);
        renderer.init(this.layers);
        interactions.init(this.svg, this.layers);

        // Subscribe to graph events
        this.subscribeToGraph();
    }

    /**
     * Subscribe to graph state changes
     */
    subscribeToGraph() {
        // Node events
        graph.on('node:added', (node) => renderer.renderNode(node));
        graph.on('node:updated', (node) => renderer.updateNodeRender(node));
        graph.on('node:removed', ({ id }) => renderer.removeNodeRender(id));

        // Edge events
        graph.on('edge:added', (edge) => renderer.renderEdge(edge));
        graph.on('edge:updated', (edge) => renderer.updateEdgeRender(edge));
        graph.on('edge:removed', ({ id }) => renderer.removeEdgeRender(id));

        // Component events
        graph.on('component:added', (comp) => renderer.renderComponent(comp));
        graph.on('component:updated', (comp) => renderer.updateComponentRender(comp));
        graph.on('component:removed', ({ id }) => renderer.removeComponentRender(id));

        // Graph lifecycle events
        graph.on('graph:loaded', () => {
            renderer.renderAll();
            // Auto-fit to window when loading a new file
            setTimeout(() => transforms.fitToWindow(), 10);
        });
        graph.on('graph:cleared', () => renderer.clearCanvas());
    }

    // ============================================
    // Public API - Delegates to sub-modules
    // ============================================

    // Rendering
    render() { renderer.renderAll(); }
    renderAll() { renderer.renderAll(); }
    clearCanvas() { renderer.clearCanvas(); }

    renderNode(node) { renderer.renderNode(node); }
    updateNodeRender(node) { renderer.updateNodeRender(node); }
    removeNodeRender(id) { renderer.removeNodeRender(id); }

    renderEdge(edge) { renderer.renderEdge(edge); }
    updateEdgeRender(edge) { renderer.updateEdgeRender(edge); }
    removeEdgeRender(id) { renderer.removeEdgeRender(id); }

    renderComponent(comp) { renderer.renderComponent(comp); }
    updateComponentRender(comp) { renderer.updateComponentRender(comp); }
    removeComponentRender(id) { renderer.removeComponentRender(id); }

    // Selection highlighting
    highlightNode(nodeId, highlight = true) { renderer.highlightNode(nodeId, highlight); }
    highlightEdge(edgeId, highlight = true) { renderer.highlightEdge(edgeId, highlight); }
    highlightComponent(compId, highlight = true) { renderer.highlightComponent(compId, highlight); }

    // Ghost elements for path creation
    showGhostLine(fromX, fromY, toX, toY) { renderer.showGhostLine(fromX, fromY, toX, toY); }
    hideGhostLine() { renderer.hideGhostLine(); }
    showGhostNode(x, y) { renderer.showGhostNode(x, y); }
    hideGhostNode() { renderer.hideGhostNode(); }

    // Transforms - zoom and pan
    get zoom() { return transforms.zoom; }
    get pan() { return transforms.pan; }

    setZoom(newZoom, centerPoint = null) { transforms.setZoom(newZoom, centerPoint); }
    zoomIn() { transforms.zoomIn(); }
    zoomOut() { transforms.zoomOut(); }
    fitToWindow() { transforms.fitToWindow(); }

    // Coordinate conversion
    getSVGPoint(clientX, clientY) { return transforms.getSVGPoint(clientX, clientY); }
    screenToCanvas(clientX, clientY) { return transforms.getSVGPoint(clientX, clientY); }

    // Centering ("Bulls Eye")
    centerOnPoint(x, y) { transforms.centerOnPoint(x, y); }
    centerOnNode(nodeId) { transforms.centerOnNode(nodeId); }
    centerOnComponent(compId) { transforms.centerOnComponent(compId); }

    // Transform update
    updateCanvasTransform() { transforms.updateTransform(); }
}

export const canvas = new UCMCanvas();
