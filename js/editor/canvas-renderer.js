/**
 * Canvas Renderer - SVG rendering for nodes, edges, and components
 * 
 * Responsible for:
 * - Rendering nodes, edges, and components to SVG
 * - Updating and removing rendered elements
 * - Selection highlighting
 * - Resize handles
 * - Ghost elements (path creation preview)
 */

import { graph } from '../core/graph.js';
import { createNodeSVG, createNodeLabel, createEdgeSVG, calculateEdgePath, getMidpoint, getAngle, NODE_TYPES, COMPONENT_TYPES, calculateIncomingAngle } from '../core/node-types.js';
import { tracing } from '../core/tracing.js';

class CanvasRenderer {
    constructor() {
        this.layers = {};
    }

    /**
     * Initialize with layer references
     * @param {Object} layers - Object containing layer group elements
     */
    init(layers) {
        this.layers = layers;
    }

    // ============================================
    // Full Rendering
    // ============================================

    /**
     * Render entire graph from scratch
     */
    renderAll() {
        const startTime = performance.now();
        this.clearCanvas();

        // Render components first (background layer)
        const components = graph.getAllComponents();
        components.forEach(comp => this.renderComponent(comp));

        // Render edges (behind nodes)
        const edges = graph.getAllEdges();
        edges.forEach(edge => this.renderEdge(edge));

        // Render nodes
        const nodes = graph.getAllNodes();
        nodes.forEach(node => this.renderNode(node));

        // Trace canvas render with element counts
        const duration = performance.now() - startTime;
        tracing.traceCanvasRender(nodes.length, edges.length, components.length, duration);
    }

    /**
     * Clear all rendered elements
     */
    clearCanvas() {
        Object.values(this.layers).forEach(layer => {
            if (layer) layer.innerHTML = '';
        });
    }

    // ============================================
    // Component Rendering
    // ============================================

    /**
     * Render a component to the canvas
     * @param {Object} comp - Component to render
     */
    renderComponent(comp) {
        const existingComp = this.layers.components.querySelector(`[data-comp-id="${comp.id}"]`);
        if (existingComp) existingComp.remove();

        const typeInfo = COMPONENT_TYPES[comp.type] || COMPONENT_TYPES.team;

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', `ucm-component type-${comp.type}`);
        g.setAttribute('data-comp-id', comp.id);
        g.setAttribute('transform', `translate(${comp.bounds.x}, ${comp.bounds.y})`);

        // Main box
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('width', comp.bounds.width);
        rect.setAttribute('height', comp.bounds.height);
        rect.setAttribute('fill', 'rgba(255,255,255,0.3)');
        rect.setAttribute('stroke', 'black');
        rect.setAttribute('stroke-width', '1');
        if (typeInfo.borderStyle === 'dashed') {
            rect.setAttribute('stroke-dasharray', '5 5');
        }
        g.appendChild(rect);

        // Header bar for grabbing
        const headerHeight = 24;
        const header = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        header.setAttribute('class', 'component-header');
        header.setAttribute('width', comp.bounds.width);
        header.setAttribute('height', headerHeight);
        header.setAttribute('fill', 'rgba(0,0,0,0.05)');
        header.style.cursor = 'move';
        g.appendChild(header);

        // Label
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', 8);
        text.setAttribute('y', 16);
        text.setAttribute('class', 'component-label');
        text.setAttribute('font-size', '12px');
        text.setAttribute('font-weight', 'bold');
        text.setAttribute('fill', 'black');
        text.style.pointerEvents = 'none';
        text.textContent = comp.properties.name;

        g.appendChild(text);
        this.layers.components.appendChild(g);
    }

    /**
     * Update an existing component's render
     * @param {Object} comp - Component to update
     */
    updateComponentRender(comp) {
        const compGroup = this.layers.components.querySelector(`[data-comp-id="${comp.id}"]`);
        if (!compGroup) return this.renderComponent(comp);

        compGroup.setAttribute('transform', `translate(${comp.bounds.x}, ${comp.bounds.y})`);

        // Update main rect
        const mainRect = compGroup.querySelector('rect:not(.component-header)');
        if (mainRect) {
            mainRect.setAttribute('width', comp.bounds.width);
            mainRect.setAttribute('height', comp.bounds.height);
        }

        // Update header bar
        const headerRect = compGroup.querySelector('.component-header');
        if (headerRect) {
            headerRect.setAttribute('width', comp.bounds.width);
        }

        // Update resize handles if selected
        if (compGroup.classList.contains('selected')) {
            this.updateResizeHandles(compGroup, comp.bounds.width, comp.bounds.height);
        }

        // Update label
        const text = compGroup.querySelector('.component-label');
        if (text) {
            text.textContent = comp.properties.name;
        }
    }

    /**
     * Remove a component's render
     * @param {string} compId - ID of component to remove
     */
    removeComponentRender(compId) {
        const comp = this.layers.components.querySelector(`[data-comp-id="${compId}"]`);
        if (comp) comp.remove();
    }

    // ============================================
    // Node Rendering
    // ============================================

    /**
     * Render a node to the canvas
     * @param {Object} node - Node to render
     */
    renderNode(node) {
        const existingNode = this.layers.nodes.querySelector(`[data-node-id="${node.id}"]`);
        if (existingNode) existingNode.remove();

        const existingLabel = this.layers.labels.querySelector(`[data-label-for="${node.id}"]`);
        if (existingLabel) existingLabel.remove();

        // Calculate incoming angle for end nodes
        let incomingAngle = null;
        if (node.type === 'end' && node.inEdges && node.inEdges.length > 0) {
            const inEdges = node.inEdges.map(edgeId => graph.getEdge(edgeId)).filter(e => e);
            incomingAngle = calculateIncomingAngle(node, inEdges, id => graph.getNode(id));
        }

        const nodeSVG = createNodeSVG(node, incomingAngle);
        if (nodeSVG) {
            this.layers.nodes.appendChild(nodeSVG);
        }

        // Add label for named nodes
        if (node.type !== 'empty' && node.properties.name) {
            const label = createNodeLabel(node);
            this.layers.labels.appendChild(label);
        }
    }

    /**
     * Update an existing node's render
     * @param {Object} node - Node to update
     */
    updateNodeRender(node) {
        // For end nodes, re-render to update bar rotation
        if (node.type === 'end') {
            this.renderNode(node);
        } else {
            const nodeSVG = this.layers.nodes.querySelector(`[data-node-id="${node.id}"]`);
            if (nodeSVG) {
                nodeSVG.setAttribute('transform', `translate(${node.position.x}, ${node.position.y})`);
            }
        }

        // Update label
        const label = this.layers.labels.querySelector(`[data-label-for="${node.id}"]`);
        if (label) {
            label.setAttribute('x', node.position.x);
            label.setAttribute('y', node.position.y + 25);
            label.textContent = node.properties.name || '';
        } else if (node.type !== 'empty' && node.properties.name) {
            const newLabel = createNodeLabel(node);
            this.layers.labels.appendChild(newLabel);
        }

        // Update connected edges
        [...node.inEdges, ...node.outEdges].forEach(edgeId => {
            const edge = graph.getEdge(edgeId);
            if (edge) this.updateEdgeRender(edge);
        });
    }

    /**
     * Remove a node's render
     * @param {string} nodeId - ID of node to remove
     */
    removeNodeRender(nodeId) {
        const nodeSVG = this.layers.nodes.querySelector(`[data-node-id="${nodeId}"]`);
        if (nodeSVG) nodeSVG.remove();

        const label = this.layers.labels.querySelector(`[data-label-for="${nodeId}"]`);
        if (label) label.remove();
    }

    // ============================================
    // Edge Rendering
    // ============================================

    /**
     * Render an edge to the canvas
     * @param {Object} edge - Edge to render
     */
    renderEdge(edge) {
        const existingEdge = this.layers.edges.querySelector(`[data-edge-id="${edge.id}"]`);
        if (existingEdge) existingEdge.remove();

        const sourceNode = graph.getNode(edge.sourceNodeId);
        const targetNode = graph.getNode(edge.targetNodeId);

        if (!sourceNode || !targetNode) return;

        const edgeSVG = createEdgeSVG(edge, sourceNode, targetNode);
        this.layers.edges.appendChild(edgeSVG);
    }

    updateEdgeRender(edge) {
        const group = this.layers.edges.querySelector(`[data-edge-id="${edge.id}"]`);

        // If edge doesn't exist, full render
        if (!group) {
            this.renderEdge(edge);
            return;
        }

        const sourceNode = graph.getNode(edge.sourceNodeId);
        const targetNode = graph.getNode(edge.targetNodeId);
        if (!sourceNode || !targetNode) return;

        // Calculate new path data
        const sourcePos = sourceNode.position || sourceNode;
        const targetPos = targetNode.position || targetNode;
        const sourceType = sourceNode.type;
        const targetType = targetNode.type;

        // Recalculate path
        const d = calculateEdgePath(sourcePos, targetPos, edge.controlPoints, { sourceType, targetType });
        const midPoint = getMidpoint(sourcePos, targetPos, edge.controlPoints);
        const angle = getAngle(sourcePos, targetPos, edge.controlPoints);

        // Update Paths (Visual and Hit Area)
        const path = group.querySelector('.ucm-edge');
        const hitPath = group.querySelector('.edge-hit-area');
        if (path) path.setAttribute('d', d);
        if (hitPath) hitPath.setAttribute('d', d);

        // Update Arrow
        const arrow = group.querySelector('.mid-arrow');
        if (arrow) {
            arrow.setAttribute('transform', `translate(${midPoint.x}, ${midPoint.y}) rotate(${angle})`);
        }

        // Update Waypoints (Re-render as count/position changes)
        // Clean up old waypoints
        group.querySelectorAll('.waypoint-marker').forEach(el => el.remove());

        // Add current waypoints
        if (edge.controlPoints && edge.controlPoints.length > 0) {
            edge.controlPoints.forEach((cp, index) => {
                const waypoint = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                waypoint.setAttribute('class', 'waypoint-marker');
                waypoint.setAttribute('data-waypoint-index', index);
                waypoint.setAttribute('cx', cp.x);
                waypoint.setAttribute('cy', cp.y);
                waypoint.setAttribute('r', 5);
                group.appendChild(waypoint);
            });
        }

        // If target is an end node, re-render it to update bar rotation
        if (targetNode && targetNode.type === 'end') {
            this.renderNode(targetNode);
        }
    }

    /**
     * Remove an edge's render
     * @param {string} edgeId - ID of edge to remove
     */
    removeEdgeRender(edgeId) {
        const edgeSVG = this.layers.edges.querySelector(`[data-edge-id="${edgeId}"]`);
        if (edgeSVG) edgeSVG.remove();
    }

    // ============================================
    // Selection Highlighting
    // ============================================

    /**
     * Highlight or unhighlight a node
     * @param {string} nodeId - Node ID
     * @param {boolean} highlight - Whether to highlight
     */
    highlightNode(nodeId, highlight = true) {
        const nodeSVG = this.layers.nodes.querySelector(`[data-node-id="${nodeId}"]`);
        if (nodeSVG) {
            nodeSVG.classList.toggle('selected', highlight);
        }
    }

    /**
     * Highlight or unhighlight an edge
     * @param {string} edgeId - Edge ID
     * @param {boolean} highlight - Whether to highlight
     */
    highlightEdge(edgeId, highlight = true) {
        const edgeSVG = this.layers.edges.querySelector(`[data-edge-id="${edgeId}"]`);
        if (edgeSVG) {
            edgeSVG.classList.toggle('selected', highlight);
        }
    }

    /**
     * Highlight or unhighlight a component
     * @param {string} compId - Component ID
     * @param {boolean} highlight - Whether to highlight
     */
    highlightComponent(compId, highlight = true) {
        const compGroup = this.layers.components.querySelector(`[data-comp-id="${compId}"]`);
        if (!compGroup) return;

        compGroup.classList.toggle('selected', highlight);
        const rect = compGroup.querySelector('rect');
        if (rect) {
            rect.setAttribute('stroke-width', highlight ? '2' : '1');
            rect.setAttribute('stroke-dasharray', highlight ? '2 2' : (COMPONENT_TYPES[graph.getComponent(compId)?.type]?.borderStyle === 'dashed' ? '5 5' : 'none'));
        }

        if (highlight) {
            const comp = graph.getComponent(compId);
            if (comp) {
                this.addResizeHandles(compGroup, comp.bounds.width, comp.bounds.height);
            }
        } else {
            this.removeResizeHandles(compGroup);
        }
    }

    // ============================================
    // Resize Handles
    // ============================================

    /**
     * Add resize handles to a component group
     * @param {SVGGElement} group - Component group
     * @param {number} w - Width
     * @param {number} h - Height
     */
    addResizeHandles(group, w, h) {
        this.removeResizeHandles(group);

        const handles = [
            { pos: 'nw', x: -4, y: -4 },
            { pos: 'n', x: w / 2 - 4, y: -4 },
            { pos: 'ne', x: w - 4, y: -4 },
            { pos: 'e', x: w - 4, y: h / 2 - 4 },
            { pos: 'se', x: w - 4, y: h - 4 },
            { pos: 's', x: w / 2 - 4, y: h - 4 },
            { pos: 'sw', x: -4, y: h - 4 },
            { pos: 'w', x: -4, y: h / 2 - 4 }
        ];

        handles.forEach(hData => {
            const handle = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            handle.setAttribute('class', 'resize-handle');
            handle.setAttribute('data-handle-pos', hData.pos);
            handle.setAttribute('x', hData.x);
            handle.setAttribute('y', hData.y);
            handle.setAttribute('width', 6);
            handle.setAttribute('height', 6);
            handle.setAttribute('fill', '#29b6f6');
            handle.setAttribute('stroke', 'white');
            handle.setAttribute('stroke-width', '1');
            handle.style.cursor = `${hData.pos}-resize`;
            group.appendChild(handle);
        });
    }

    /**
     * Update resize handle positions
     * @param {SVGGElement} group - Component group
     * @param {number} w - Width
     * @param {number} h - Height
     */
    updateResizeHandles(group, w, h) {
        const handles = group.querySelectorAll('.resize-handle');
        handles.forEach(handle => {
            const pos = handle.getAttribute('data-handle-pos');
            let x = 0, y = 0;
            switch (pos) {
                case 'nw': x = -4; y = -4; break;
                case 'n': x = w / 2 - 4; y = -4; break;
                case 'ne': x = w - 4; y = -4; break;
                case 'e': x = w - 4; y = h / 2 - 4; break;
                case 'se': x = w - 4; y = h - 4; break;
                case 's': x = w / 2 - 4; y = h - 4; break;
                case 'sw': x = -4; y = h - 4; break;
                case 'w': x = -4; y = h / 2 - 4; break;
            }
            handle.setAttribute('x', x);
            handle.setAttribute('y', y);
        });
    }

    /**
     * Remove resize handles from a group
     * @param {SVGGElement} group - Component group
     */
    removeResizeHandles(group) {
        const handles = group.querySelectorAll('.resize-handle');
        handles.forEach(h => h.remove());
    }

    // ============================================
    // Ghost Elements (Path Creation Preview)
    // ============================================

    /**
     * Show a ghost line during path creation
     */
    showGhostLine(fromX, fromY, toX, toY) {
        let ghostLine = this.layers.selection.querySelector('.ghost-path');
        if (!ghostLine) {
            ghostLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            ghostLine.setAttribute('class', 'ghost-path');
            this.layers.selection.appendChild(ghostLine);
        }

        ghostLine.setAttribute('x1', fromX);
        ghostLine.setAttribute('y1', fromY);
        ghostLine.setAttribute('x2', toX);
        ghostLine.setAttribute('y2', toY);
    }

    /**
     * Hide the ghost line
     */
    hideGhostLine() {
        const ghostLine = this.layers.selection.querySelector('.ghost-path');
        if (ghostLine) ghostLine.remove();
    }

    /**
     * Show a ghost node during path creation
     */
    showGhostNode(x, y) {
        let ghostNode = this.layers.selection.querySelector('.ghost-node');
        if (!ghostNode) {
            ghostNode = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            ghostNode.setAttribute('class', 'ghost-node');
            ghostNode.setAttribute('r', 8);
            this.layers.selection.appendChild(ghostNode);
        }

        ghostNode.setAttribute('cx', x);
        ghostNode.setAttribute('cy', y);
    }

    /**
     * Hide the ghost node
     */
    hideGhostNode() {
        const ghostNode = this.layers.selection.querySelector('.ghost-node');
        if (ghostNode) ghostNode.remove();
    }
}

export const renderer = new CanvasRenderer();
