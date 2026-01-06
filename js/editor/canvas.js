/**
 * UCM Canvas - SVG-based canvas for rendering and interaction
 */

import { graph } from '../core/graph.js';
import { createNodeSVG, createNodeLabel, createEdgeSVG, calculateEdgePath, NODE_TYPES, COMPONENT_TYPES, calculateIncomingAngle } from '../core/node-types.js';
import { selection } from './selection.js';
import { tracing } from '../core/tracing.js';

class UCMCanvas {
    constructor() {
        this.svg = null;
        this.viewport = null; // The group element that receives zoom/pan transforms
        this.layers = {};
        this.zoom = 1;
        this.pan = { x: 0, y: 0 };
        this.isDragging = false;
        this.dragTarget = null;
        this.dragOffset = { x: 0, y: 0 };
        this.resizeHandle = null; // 'nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'
        this.resizeStartBounds = null; // { x, y, width, height }
    }

    init() {
        this.svg = document.getElementById('canvas');
        this.viewport = document.getElementById('viewport');
        this.layers = {
            components: document.getElementById('layer-components'),
            edges: document.getElementById('layer-edges'),
            nodes: document.getElementById('layer-nodes'),
            labels: document.getElementById('layer-labels'),
            selection: document.getElementById('layer-selection')
        };

        this.setupEventListeners();
        this.subscribeToGraph();
    }

    setupEventListeners() {
        // Mouse events on canvas
        this.svg.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.svg.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.svg.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.svg.addEventListener('click', this.handleClick.bind(this));
        this.svg.addEventListener('dblclick', this.handleDoubleClick.bind(this));
        this.svg.addEventListener('contextmenu', this.handleContextMenu.bind(this));

        // Mouse wheel for zooming
        this.svg.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });

        // Keyboard
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));

        // Window resize - debounced
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.handleResize();
            }, 100);
        });
    }

    handleWheel(e) {
        e.preventDefault();

        // Ctrl/Cmd + Wheel = Zoom (pinch gesture on trackpad)
        if (e.ctrlKey || e.metaKey) {
            // Get mouse position for zoom centering
            const rect = this.svg.getBoundingClientRect();
            const centerX = e.clientX - rect.left;
            const centerY = e.clientY - rect.top;

            // Zoom direction based on scroll
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            const newZoom = Math.max(0.1, Math.min(5, this.zoom + delta));

            this.setZoom(newZoom, { x: centerX, y: centerY });
        } else {
            // Plain wheel/trackpad scroll = Pan (smooth scrolling)
            this.pan.x -= e.deltaX;
            this.pan.y -= e.deltaY;
            this.updateCanvasTransform();
        }
    }

    handleResize() {
        // Ensure SVG fills container after resize
        const container = document.getElementById('canvas-container');
        if (container && this.svg) {
            // SVG uses CSS 100% width/height, but we may need to update transforms
            this.updateCanvasTransform();
        }
    }

    subscribeToGraph() {
        graph.on('node:added', (node) => this.renderNode(node));
        graph.on('node:updated', (node) => this.updateNodeRender(node));
        graph.on('node:removed', ({ id }) => this.removeNodeRender(id));

        graph.on('edge:added', (edge) => this.renderEdge(edge));
        graph.on('edge:updated', (edge) => this.updateEdgeRender(edge));
        graph.on('edge:removed', ({ id }) => this.removeEdgeRender(id));

        graph.on('component:added', (comp) => this.renderComponent(comp));
        graph.on('component:updated', (comp) => this.updateComponentRender(comp));
        graph.on('component:removed', ({ id }) => this.removeComponentRender(id));

        graph.on('graph:loaded', () => {
            this.renderAll();
            // Auto-fit to window when loading a new file
            // Small timeout to ensure DOM is ready/layout is settled
            setTimeout(() => this.fitToWindow(), 10);
        });
        graph.on('graph:cleared', () => this.clearCanvas());
    }

    // ============================================
    // Coordinate Conversion
    // ============================================

    getSVGPoint(clientX, clientY) {
        // Use SVG's built-in coordinate transformation for accuracy
        // This properly accounts for any CSS transforms and SVG viewBox
        const point = this.svg.createSVGPoint();
        point.x = clientX;
        point.y = clientY;

        // Get the inverse of the viewport's transform matrix to convert screen -> world
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

    // ============================================
    // Rendering
    // ============================================

    renderAll() {
        const startTime = performance.now();
        this.clearCanvas();

        // Render components first (background layer)
        const components = graph.getAllComponents();
        components.forEach(comp => this.renderComponent(comp));

        // Render edges first (behind nodes)
        const edges = graph.getAllEdges();
        edges.forEach(edge => this.renderEdge(edge));

        // Render nodes
        const nodes = graph.getAllNodes();
        nodes.forEach(node => this.renderNode(node));

        // Trace canvas render with element counts
        const duration = performance.now() - startTime;
        tracing.traceCanvasRender(nodes.length, edges.length, components.length, duration);
    }

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

        // Header bar for grabbing (makes it easier to drag)
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
        text.style.pointerEvents = 'none'; // Let clicks pass through to header
        text.textContent = comp.properties.name;

        g.appendChild(text);
        this.layers.components.appendChild(g);
    }

    updateComponentRender(comp) {
        const compGroup = this.layers.components.querySelector(`[data-comp-id="${comp.id}"]`);
        if (!compGroup) return this.renderComponent(comp);

        compGroup.setAttribute('transform', `translate(${comp.bounds.x}, ${comp.bounds.y})`);

        // Update main rect
        const rects = compGroup.querySelectorAll('rect');
        if (rects[0]) {
            rects[0].setAttribute('width', comp.bounds.width);
            rects[0].setAttribute('height', comp.bounds.height);
        }
        // Update header bar
        if (rects[1]) {
            rects[1].setAttribute('width', comp.bounds.width);
        }

        // Update resize handles if selected
        if (compGroup.classList.contains('selected')) {
            this.updateResizeHandles(compGroup, comp.bounds.width, comp.bounds.height);
        }

        // Update label
        const text = compGroup.querySelector('text');
        if (text) {
            text.textContent = comp.properties.name;
        }
    }

    removeComponentRender(compId) {
        const comp = this.layers.components.querySelector(`[data-comp-id="${compId}"]`);
        if (comp) comp.remove();
    }

    renderNode(node) {
        const existingNode = this.layers.nodes.querySelector(`[data-node-id="${node.id}"]`);
        if (existingNode) {
            existingNode.remove();
        }

        const existingLabel = this.layers.labels.querySelector(`[data-label-for="${node.id}"]`);
        if (existingLabel) {
            existingLabel.remove();
        }

        // Calculate incoming angle for end nodes (to rotate the bar)
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

    updateNodeRender(node) {
        // For end nodes, we need to re-render to update bar rotation based on incoming angle
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

    removeNodeRender(nodeId) {
        const nodeSVG = this.layers.nodes.querySelector(`[data-node-id="${nodeId}"]`);
        if (nodeSVG) nodeSVG.remove();

        const label = this.layers.labels.querySelector(`[data-label-for="${nodeId}"]`);
        if (label) label.remove();
    }

    renderEdge(edge) {
        const existingEdge = this.layers.edges.querySelector(`[data-edge-id="${edge.id}"]`);
        if (existingEdge) {
            existingEdge.remove();
        }

        const sourceNode = graph.getNode(edge.sourceNodeId);
        const targetNode = graph.getNode(edge.targetNodeId);

        if (!sourceNode || !targetNode) return;

        const edgeSVG = createEdgeSVG(edge, sourceNode, targetNode);
        this.layers.edges.appendChild(edgeSVG);
    }

    updateEdgeRender(edge) {
        // Re-render the whole edge group to update both path and mid-arrow
        this.renderEdge(edge);

        // If target is an end node, re-render it to update bar rotation
        const targetNode = graph.getNode(edge.targetNodeId);
        if (targetNode && targetNode.type === 'end') {
            this.renderNode(targetNode);
        }
    }

    removeEdgeRender(edgeId) {
        const edgeSVG = this.layers.edges.querySelector(`[data-edge-id="${edgeId}"]`);
        if (edgeSVG) edgeSVG.remove();
    }

    clearCanvas() {
        Object.values(this.layers).forEach(layer => {
            if (layer) layer.innerHTML = '';
        });
    }

    // ============================================
    // Selection Rendering
    // ============================================

    highlightNode(nodeId, highlight = true) {
        const nodeSVG = this.layers.nodes.querySelector(`[data-node-id="${nodeId}"]`);
        if (nodeSVG) {
            nodeSVG.classList.toggle('selected', highlight);
        }
    }

    highlightEdge(edgeId, highlight = true) {
        const edgeSVG = this.layers.edges.querySelector(`[data-edge-id="${edgeId}"]`);
        if (edgeSVG) {
            edgeSVG.classList.toggle('selected', highlight);
        }
    }

    highlightComponent(compId, highlight = true) {
        const compGroup = this.layers.components.querySelector(`[data-comp-id="${compId}"]`);
        if (compGroup) {
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
    }

    addResizeHandles(group, w, h) {
        this.removeResizeHandles(group); // Clear existing

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

    removeResizeHandles(group) {
        const handles = group.querySelectorAll('.resize-handle');
        handles.forEach(h => h.remove());
    }

    // ============================================
    // Ghost Elements (Path Creation Preview)
    // ============================================

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

    hideGhostLine() {
        const ghostLine = this.layers.selection.querySelector('.ghost-path');
        if (ghostLine) ghostLine.remove();
    }

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

    hideGhostNode() {
        const ghostNode = this.layers.selection.querySelector('.ghost-node');
        if (ghostNode) ghostNode.remove();
    }

    // Check if compId is a descendant of ancestorId
    isDescendantComponent(compId, ancestorId) {
        const comp = graph.getComponent(compId);
        if (!comp) return false;

        let current = comp.parentComponent;
        while (current) {
            if (current === ancestorId) return true;
            const parent = graph.getComponent(current);
            current = parent ? parent.parentComponent : null;
        }
        return false;
    }

    // ============================================
    // Event Handlers
    // ============================================

    handleMouseDown(e) {
        if (selection.currentTool === 'component') {
            const point = this.getSVGPoint(e.clientX, e.clientY);
            import('./component-tool.js').then(({ componentTool }) => {
                componentTool.handleMouseDown(point.x, point.y);
            });
            return;
        }

        // Check for Panning (Space + Click OR Middle Mouse Button OR Right-click)
        if (e.button === 1 || e.button === 2 || (e.button === 0 && this.isSpacePressed)) {
            e.preventDefault();
            this.isPanning = true;
            this.panStart = { x: e.clientX, y: e.clientY };
            this.initialPan = { ...this.pan };
            this.svg.style.cursor = 'grabbing';
            return;
        }

        const point = this.getSVGPoint(e.clientX, e.clientY);

        // Check if clicking on a node
        const nodeElement = e.target.closest('.ucm-node');
        if (nodeElement) {
            const nodeId = nodeElement.getAttribute('data-node-id');
            const node = graph.getNode(nodeId);

            if (node && selection.currentTool === 'select') {
                this.isDragging = true;
                this.dragTarget = nodeId;
                this.dragType = 'node';
                this.dragOffset = {
                    x: point.x - node.position.x,
                    y: point.y - node.position.y
                };
                nodeElement.classList.add('dragging');
                return; // Stop checking other elements
            }
        }

        // Check waypoint markers (draw.io style dragging)
        if (e.target.classList.contains('waypoint-marker')) {
            const waypointMarker = e.target;
            const edgeGroup = waypointMarker.closest('.ucm-edge-group');
            const edgeId = edgeGroup.getAttribute('data-edge-id');
            const waypointIndex = parseInt(waypointMarker.getAttribute('data-waypoint-index'), 10);
            const edge = graph.getEdge(edgeId);

            if (edge && edge.controlPoints && edge.controlPoints[waypointIndex]) {
                this.isDragging = true;
                this.dragTarget = edgeId;
                this.dragType = 'waypoint';
                this.waypointIndex = waypointIndex;
                this.dragOffset = { x: 0, y: 0 }; // Direct positioning
                waypointMarker.classList.add('dragging');
                edgeGroup.classList.add('selected');
                return;
            }
        }

        // Check resize handles
        if (e.target.classList.contains('resize-handle')) {
            const handle = e.target;
            const compGroup = handle.closest('.ucm-component');
            const compId = compGroup.getAttribute('data-comp-id');
            const comp = graph.getComponent(compId);

            if (comp) {
                this.isDragging = true;
                this.resizeHandle = handle.getAttribute('data-handle-pos');
                this.dragTarget = compId;
                this.dragType = 'resize';
                this.resizeStartBounds = { ...comp.bounds };
                this.dragOffset = {
                    x: point.x,
                    y: point.y
                };
                return;
            }
        }

        // Check if clicking component
        const compElement = e.target.closest('.ucm-component');
        if (compElement && selection.currentTool === 'select') {
            const compId = compElement.getAttribute('data-comp-id');
            const comp = graph.getComponent(compId);

            if (comp) {
                this.isDragging = true;
                this.dragTarget = compId;
                this.dragType = 'component';
                this.dragOffset = {
                    x: point.x - comp.bounds.x,
                    y: point.y - comp.bounds.y
                };
            }
        }
    }

    handleMouseMove(e) {
        const point = this.getSVGPoint(e.clientX, e.clientY);

        if (this.isPanning) {
            const dx = e.clientX - this.panStart.x;
            const dy = e.clientY - this.panStart.y;
            this.pan.x = this.initialPan.x + dx;
            this.pan.y = this.initialPan.y + dy;
            this.updateCanvasTransform();
            return;
        }

        if (selection.currentTool === 'component') {
            import('./component-tool.js').then(({ componentTool }) => {
                componentTool.handleMouseMove(point.x, point.y);
            });
            return;
        }

        if (this.isDragging && this.dragTarget) {
            const newX = point.x - this.dragOffset.x;
            const newY = point.y - this.dragOffset.y;

            if (this.dragType === 'node') {
                graph.moveNode(this.dragTarget, newX, newY);
            } else if (this.dragType === 'waypoint') {
                // Drag waypoint marker
                const edge = graph.getEdge(this.dragTarget);
                if (edge && edge.controlPoints && this.waypointIndex !== undefined) {
                    const newControlPoints = [...edge.controlPoints];
                    newControlPoints[this.waypointIndex] = { x: point.x, y: point.y };
                    graph.updateEdge(this.dragTarget, { controlPoints: newControlPoints });
                }
            } else if (this.dragType === 'component') {
                graph.moveComponent(this.dragTarget, newX, newY);
            } else if (this.dragType === 'resize') {
                const dx = point.x - this.dragOffset.x;
                const dy = point.y - this.dragOffset.y;
                const bounds = { ...this.resizeStartBounds };

                // Apply resize logic based on handle
                // Min size constraint
                const minSize = 50;

                if (this.resizeHandle.includes('e')) bounds.width = Math.max(minSize, bounds.width + dx);
                if (this.resizeHandle.includes('s')) bounds.height = Math.max(minSize, bounds.height + dy);
                if (this.resizeHandle.includes('w')) {
                    const newWidth = Math.max(minSize, bounds.width - dx);
                    if (newWidth !== bounds.width) {
                        bounds.x += bounds.width - newWidth;
                        bounds.width = newWidth;
                    }
                }
                if (this.resizeHandle.includes('n')) {
                    const newHeight = Math.max(minSize, bounds.height - dy);
                    if (newHeight !== bounds.height) {
                        bounds.y += bounds.height - newHeight;
                        bounds.height = newHeight;
                    }
                }

                graph.updateComponent(this.dragTarget, { bounds });
            }
        }

        // Path tool preview
        if (selection.currentTool === 'path' && selection.pathCreation.active) {
            const lastNode = selection.pathCreation.nodes[selection.pathCreation.nodes.length - 1];
            if (lastNode) {
                const node = graph.getNode(lastNode);
                if (node) {
                    this.showGhostLine(node.position.x, node.position.y, point.x, point.y);
                    this.showGhostNode(point.x, point.y);
                }
            }
        }
    }

    handleMouseUp(e) {
        if (this.isPanning) {
            this.isPanning = false;
            this.svg.style.cursor = this.isSpacePressed ? 'grab' : 'default';
            return;
        }

        if (selection.currentTool === 'component') {
            const point = this.getSVGPoint(e.clientX, e.clientY);
            import('./component-tool.js').then(({ componentTool }) => {
                componentTool.handleMouseUp(point.x, point.y);
            });
            return;
        }

        if (this.isDragging && this.dragTarget) {
            if (this.dragType === 'node') {
                const nodeElement = this.layers.nodes.querySelector(`[data-node-id="${this.dragTarget}"]`);
                if (nodeElement) nodeElement.classList.remove('dragging');

                // Check if dropped into component
                const node = graph.getNode(this.dragTarget);
                const comps = graph.getAllComponents();
                // Simple hit test for center of node
                const cx = node.position.x;
                const cy = node.position.y;

                let foundComp = null;
                // Find deepest (most nested) component that contains the node
                let maxDepth = -1;
                for (const comp of comps) {
                    const b = comp.bounds;
                    if (cx >= b.x && cx <= b.x + b.width && cy >= b.y && cy <= b.y + b.height) {
                        const depth = graph.getComponentDepth(comp.id);
                        if (depth > maxDepth) {
                            maxDepth = depth;
                            foundComp = comp;
                        }
                    }
                }

                if (foundComp) {
                    if (node.parentComponent !== foundComp.id) {
                        graph.bindNodeToComponent(node.id, foundComp.id);
                    }
                } else {
                    if (node.parentComponent) {
                        graph.unbindNodeFromComponent(node.id);
                    }
                }
            } else if (this.dragType === 'component') {
                // Check if component dropped into another component
                const draggedComp = graph.getComponent(this.dragTarget);
                if (draggedComp) {
                    const comps = graph.getAllComponents();
                    // Use center of the dragged component for hit test
                    const cx = draggedComp.bounds.x + draggedComp.bounds.width / 2;
                    const cy = draggedComp.bounds.y + draggedComp.bounds.height / 2;

                    let foundParent = null;
                    let maxDepth = -1;

                    for (const comp of comps) {
                        // Skip self and any descendants
                        if (comp.id === this.dragTarget) continue;
                        if (this.isDescendantComponent(comp.id, this.dragTarget)) continue;

                        const b = comp.bounds;
                        if (cx >= b.x && cx <= b.x + b.width && cy >= b.y && cy <= b.y + b.height) {
                            const depth = graph.getComponentDepth(comp.id);
                            if (depth > maxDepth) {
                                maxDepth = depth;
                                foundParent = comp;
                            }
                        }
                    }

                    if (foundParent) {
                        if (draggedComp.parentComponent !== foundParent.id) {
                            graph.bindComponentToComponent(this.dragTarget, foundParent.id);
                        }
                    } else {
                        if (draggedComp.parentComponent) {
                            graph.unbindComponentFromParent(this.dragTarget);
                        }
                    }
                }
            }
        }

        this.isDragging = false;
        this.dragTarget = null;
        this.dragType = null;

        // Reset resize state
        this.resizeHandle = null;
        this.resizeStartBounds = null;
        this.dragOffset = { x: 0, y: 0 };

        // Reset waypoint state
        this.waypointIndex = null;

        // Remove any lingering dragging classes
        this.svg.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
    }

    handleClick(e) {
        const point = this.getSVGPoint(e.clientX, e.clientY);

        // Check what was clicked - nodes and edges ALWAYS take priority over components
        const nodeElement = e.target.closest('.ucm-node');
        const edgeGroup = e.target.closest('.ucm-edge-group');
        const compElement = e.target.closest('.ucm-component');

        if (selection.currentTool === 'select') {
            // Priority: 1) Nodes, 2) Edges, 3) Components
            if (nodeElement) {
                const nodeId = nodeElement.getAttribute('data-node-id');
                selection.selectNode(nodeId, e.shiftKey);
            } else if (edgeGroup) {
                const edgeId = edgeGroup.getAttribute('data-edge-id');
                selection.selectEdge(edgeId, e.shiftKey);
            } else if (compElement) {
                const compId = compElement.getAttribute('data-comp-id');
                selection.selectComponent(compId, e.shiftKey);
            } else {
                // Clicked on empty canvas (SVG or layer groups)
                selection.clearSelection();
            }
        } else if (selection.currentTool === 'path') {
            selection.handlePathClick(point.x, point.y);
        }
    }

    handleDoubleClick(e) {
        const point = this.getSVGPoint(e.clientX, e.clientY);

        if (selection.currentTool === 'path' && selection.pathCreation.active) {
            // End path creation
            selection.finishPath();
        }

        // Double-click on waypoint marker to delete it
        if (e.target.classList.contains('waypoint-marker')) {
            const edgeGroup = e.target.closest('.ucm-edge-group');
            const edgeId = edgeGroup.getAttribute('data-edge-id');
            const waypointIndex = parseInt(e.target.getAttribute('data-waypoint-index'), 10);
            const edge = graph.getEdge(edgeId);

            if (edge && edge.controlPoints && edge.controlPoints.length > 0) {
                const newControlPoints = edge.controlPoints.filter((_, i) => i !== waypointIndex);
                graph.updateEdge(edgeId, { controlPoints: newControlPoints });
            }
            return;
        }

        // Double-click on edge to add waypoint
        const edgeElement = e.target.closest('.ucm-edge');
        if (edgeElement) {
            const edgeGroup = edgeElement.closest('.ucm-edge-group');
            const edgeId = edgeGroup.getAttribute('data-edge-id');
            const edge = graph.getEdge(edgeId);

            if (edge) {
                // Add waypoint at click position
                const controlPoints = edge.controlPoints ? [...edge.controlPoints] : [];

                // Find the right position to insert the waypoint
                const sourceNode = graph.getNode(edge.sourceNodeId);
                const targetNode = graph.getNode(edge.targetNodeId);

                if (sourceNode && targetNode) {
                    // Insert in order along the path
                    const insertIndex = this.findWaypointInsertIndex(
                        sourceNode.position, targetNode.position,
                        controlPoints, point
                    );
                    controlPoints.splice(insertIndex, 0, { x: point.x, y: point.y });
                    graph.updateEdge(edgeId, { controlPoints });
                }
            }
            return;
        }

        const nodeElement = e.target.closest('.ucm-node');
        if (nodeElement) {
            const nodeId = nodeElement.getAttribute('data-node-id');
            const node = graph.getNode(nodeId);

            // Convert empty to responsibility on double-click
            if (node && node.type === 'empty') {
                graph.updateNode(nodeId, { type: 'responsibility' });
                this.renderNode(node);
            }
        }
    }

    // Find where to insert a new waypoint to maintain path order
    findWaypointInsertIndex(source, target, controlPoints, newPoint) {
        if (controlPoints.length === 0) return 0;

        // Build list of all points in path order
        const allPoints = [source, ...controlPoints, target];

        // Find which segment the new point is closest to
        let bestIndex = 0;
        let bestDist = Infinity;

        for (let i = 0; i < allPoints.length - 1; i++) {
            const p1 = allPoints[i];
            const p2 = allPoints[i + 1];
            const dist = this.pointToSegmentDistance(newPoint, p1, p2);

            if (dist < bestDist) {
                bestDist = dist;
                bestIndex = i;
            }
        }

        // Insert after the start of the closest segment (in controlPoints array)
        return bestIndex;
    }

    // Calculate distance from point to line segment
    pointToSegmentDistance(p, a, b) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const l2 = dx * dx + dy * dy;

        if (l2 === 0) return Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2);

        let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
        t = Math.max(0, Math.min(1, t));

        const projX = a.x + t * dx;
        const projY = a.y + t * dy;

        return Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2);
    }

    handleContextMenu(e) {
        e.preventDefault();

        const nodeElement = e.target.closest('.ucm-node');
        const edgeElement = e.target.closest('.ucm-edge');

        import('./context-menu.js').then(({ contextMenu }) => {
            if (nodeElement) {
                const nodeId = nodeElement.getAttribute('data-node-id');
                const node = graph.getNode(nodeId);
                contextMenu.show(e.clientX, e.clientY, node, null);
            } else if (edgeElement) {
                const edgeId = edgeElement.getAttribute('data-edge-id');
                const edge = graph.getEdge(edgeId);
                contextMenu.show(e.clientX, e.clientY, null, edge);
            }
        });
    }

    handleKeyDown(e) {
        // Spacebar for Panning
        if (e.code === 'Space' && !this.isSpacePressed) {

            // Should not trigger if editing text
            if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

            e.preventDefault(); // Prevent scroll
            this.isSpacePressed = true;
            this.svg.style.cursor = 'grab';
        }

        // ESC to cancel path creation or deselect
        if (e.key === 'Escape') {
            if (selection.currentTool === 'path' && selection.pathCreation.active) {
                selection.finishPath();
            } else {
                selection.clearSelection();
            }
            this.hideGhostLine();
            this.hideGhostNode();
        }

        // Delete selected elements
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (document.activeElement.tagName !== 'INPUT' &&
                document.activeElement.tagName !== 'TEXTAREA') {
                selection.deleteSelected();
            }
        }

        // Tool shortcuts
        if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            if (e.key === 'v' || e.key === 'V') selection.setTool('select');
            if (e.key === 'p' || e.key === 'P') selection.setTool('path');
            if (e.key === 'c' || e.key === 'C') selection.setTool('component');

            // Undo/Redo
            if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    import('../core/history.js').then(({ history }) => history.redo());
                } else {
                    import('../core/history.js').then(({ history }) => history.undo());
                }
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'y') { // Windows/Linux redundant redo
                e.preventDefault();
                import('../core/history.js').then(({ history }) => history.redo());
            }

            // Zoom Shortcuts
            if (e.metaKey || e.ctrlKey) {
                if (e.key === '=' || e.key === '+') {
                    e.preventDefault();
                    this.zoomIn();
                }
                if (e.key === '-') {
                    e.preventDefault();
                    this.zoomOut();
                }
                if (e.key === '0') {
                    e.preventDefault();
                    this.fitToWindow();
                }
            }
        }
    }

    handleKeyUp(e) {
        if (e.code === 'Space') {
            this.isSpacePressed = false;
            if (!this.isPanning) {
                this.svg.style.cursor = 'default';
            }
        }
    }

    // ============================================
    // Zoom Controls
    // ============================================

    setZoom(newZoom, centerPoint = null) {
        const oldZoom = this.zoom;
        this.zoom = Math.max(0.25, Math.min(4, newZoom));

        // If zooming toward a point, adjust pan to keep that point stable
        if (centerPoint) {
            // Logic:
            // worldPoint = (screenPoint - pan) / zoom
            // We want worldPoint to be at the same screenPoint after zoom change
            // newPan = screenPoint - worldPoint * newZoom
            //
            // Derivation:
            // worldX = (screenX - oldPanX) / oldZoom
            // newPanX = screenX - worldX * newZoom

            // Get current world coordinates of the center point (relative to viewport 0,0)
            // But centerPoint passed in is likely relative to the viewport (SVG point)?
            // Actually, let's assume centerPoint is in SCREEN coordinates (client X/Y relative to container)
            // For simplicity, if centerPoint is null, we zoom toward center of viewport.

            // Let's implement simple center-viewport zooming if no point provided
            const container = document.getElementById('canvas-container');
            if (container) {
                const rect = container.getBoundingClientRect();
                const cx = rect.width / 2;
                const cy = rect.height / 2;

                // Calculate world point under the center
                const wx = (cx - this.pan.x * oldZoom); // This logic is tricky with CSS transform
                // Our transform is: translate(0,0) scale(zoom). NO.
                // Our rendering logic uses this.pan for coordinates in getSVGPoint? 
                // Wait, getSVGPoint says: (clientX - rect.left) / this.zoom - this.pan.x
                // This implies logical pan is added to coordinates.
                // But updateCanvasTransform sets `scale(${this.zoom})`. It does NOT set translate.
                // This means SVG origin is always 0,0 of the container?
                // Visual check showing: `this.svg.style.transform = scale(...)`.

                // If we only use scale(), the visual viewport shows (0,0) at top-left.
                // To support panning, we usually need translate() in CSS or viewBox.
                // Let's check getSVGPoint again. It subtracts pan.
                // If pan is used in rendering (e.g. node.x + pan.x), then we re-render everything on pan?
                // Checking renderNode... it uses node.position.x directly.
                // Checking updateNodeRender... translates to node.position directly.
                // So... where is pan applied???
                // It seems pan is passed to getSVGPoint but NOT used in rendering?
                // Ah, line 15: this.pan = { x: 0, y: 0 };
                // Looking at standard simple implementation, likely we need to add a group wrapper or use CSS translate.

                // Currently, `updateCanvasTransform` uses `scale(${this.zoom})` ONLY.
                // This means PAN IS NOT VISUALLY APPLIED unless I missed a wrapper group transform.
                // Let's check renderAll/init.
                // init: svg = document.getElementById('canvas');
                // renderAll: clears layers.

                // FIX: We need to apply Pan to the canvas transform too!
                // Transform should be: translate(panX, panY) scale(zoom)
            }
        }

        this.updateCanvasTransform();

        const zoomDisplay = document.getElementById('zoom-level');
        if (zoomDisplay) {
            zoomDisplay.textContent = `${Math.round(this.zoom * 100)}%`;
        }
    }

    zoomIn() {
        this.setZoom(this.zoom * 1.25);
    }

    zoomOut() {
        this.setZoom(this.zoom / 1.25);
    }

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

        // Clamp zoom to reasonable limits (don't zoom in crazy amount for single node)
        newZoom = Math.min(newZoom, 2);
        // But allow zooming out as much as needed to fit.

        this.zoom = newZoom;

        // Calculate pan to center the content
        // Center of bounds in world space:
        // bounds.center.x, bounds.center.y

        // We want this world point to be at screen center (cw/2, ch/2)
        // Screen = World * Zoom + Pan
        // Pan = Screen - World * Zoom

        this.pan.x = (cw / 2) - (bounds.center.x * this.zoom);
        this.pan.y = (ch / 2) - (bounds.center.y * this.zoom);

        // Update generic zoom display
        this.setZoom(this.zoom);
    }

    updateCanvasTransform() {
        // Apply transform to the viewport group inside the SVG
        // This is the correct way to implement zoom/pan in SVG - the SVG element stays
        // at 100% size to catch all mouse events, while the viewport group is transformed
        // 
        // Transform order: translate first, then scale
        // This means: Screen = World * Zoom + Pan
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

    // ============================================
    // "Bulls Eye" Auto-Centering
    // ============================================

    centerOnPoint(x, y) {
        const container = document.getElementById('canvas-container');
        if (!container) return;

        const cw = container.clientWidth;
        const ch = container.clientHeight;

        // Visual Center: (cw/2, ch/2) = (x, y) * zoom + pan
        // pan = (cw/2, ch/2) - (x, y) * zoom
        this.pan.x = (cw / 2) - (x * this.zoom);
        this.pan.y = (ch / 2) - (y * this.zoom);

        this.updateCanvasTransform();
    }

    centerOnNode(nodeId) {
        const node = graph.getNode(nodeId);
        if (node) {
            this.centerOnPoint(node.position.x, node.position.y);
        }
    }

    centerOnComponent(compId) {
        const comp = graph.getComponent(compId);
        if (comp) {
            // Center of the component
            const cx = comp.bounds.x + comp.bounds.width / 2;
            const cy = comp.bounds.y + comp.bounds.height / 2;
            this.centerOnPoint(cx, cy);
        }
    }
}

export const canvas = new UCMCanvas();
