/**
 * Canvas Interactions - Mouse and keyboard event handling
 * 
 * Responsible for:
 * - Mouse events (click, drag, double-click, context menu)
 * - Keyboard events (shortcuts, tool switching)
 * - Drag operations (nodes, components, waypoints, resize)
 * - Panning with space+drag or middle mouse
 */

import { graph } from '../core/graph.js';
import { selection } from './selection.js';
import { transforms } from './canvas-transforms.js';
import { renderer } from './canvas-renderer.js';

class CanvasInteractions {
    constructor() {
        this.svg = null;
        this.layers = {};

        // Drag state
        this.isDragging = false;
        this.dragTarget = null;
        this.dragType = null; // 'node', 'component', 'waypoint', 'resize'
        this.dragOffset = { x: 0, y: 0 };
        this.waypointIndex = null;

        // Resize state
        this.resizeHandle = null;
        this.resizeStartBounds = null;

        // Pan state
        this.isPanning = false;
        this.panStart = { x: 0, y: 0 };
        this.initialPan = { x: 0, y: 0 };
        this.isSpacePressed = false;
    }

    /**
     * Initialize with SVG and layer references
     */
    init(svg, layers) {
        this.svg = svg;
        this.layers = layers;
        this.setupEventListeners();
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
                transforms.updateTransform();
            }, 100);
        });
    }

    // ============================================
    // Mouse Events
    // ============================================

    handleMouseDown(e) {
        // Component tool has its own handling
        if (selection.currentTool === 'component') {
            const point = transforms.getSVGPoint(e.clientX, e.clientY);
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
            this.initialPan = { x: transforms.pan.x, y: transforms.pan.y };
            this.svg.style.cursor = 'grabbing';
            return;
        }

        const point = transforms.getSVGPoint(e.clientX, e.clientY);

        // Check if clicking on a node OR its label
        let nodeElement = e.target.closest('.ucm-node');
        let nodeId = nodeElement ? nodeElement.getAttribute('data-node-id') : null;

        // If not directly on node, check if clicking label
        if (!nodeId) {
            const labelElement = e.target.closest('.node-label');
            if (labelElement) {
                nodeId = labelElement.getAttribute('data-label-for');
                if (nodeId) {
                    nodeElement = this.layers.nodes.querySelector(`[data-node-id="${nodeId}"]`);
                }
            }
        }

        if (nodeId && nodeElement) {
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
                return;
            }
        }

        // Check waypoint markers
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
                this.dragOffset = { x: 0, y: 0 };
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
                this.dragOffset = { x: point.x, y: point.y };
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
        const point = transforms.getSVGPoint(e.clientX, e.clientY);

        if (this.isPanning) {
            const dx = e.clientX - this.panStart.x;
            const dy = e.clientY - this.panStart.y;
            transforms.setPan(this.initialPan.x + dx, this.initialPan.y + dy);
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
                    renderer.showGhostLine(node.position.x, node.position.y, point.x, point.y);
                    renderer.showGhostNode(point.x, point.y);
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
            const point = transforms.getSVGPoint(e.clientX, e.clientY);
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
                this.handleNodeDropOnComponent(this.dragTarget);
            } else if (this.dragType === 'component') {
                // Check if component dropped into another component
                this.handleComponentDropOnComponent(this.dragTarget);
            }
        }

        this.resetDragState();
    }

    handleClick(e) {
        const point = transforms.getSVGPoint(e.clientX, e.clientY);

        const nodeElement = e.target.closest('.ucm-node');
        const edgeGroup = e.target.closest('.ucm-edge-group');
        const compElement = e.target.closest('.ucm-component');

        // Check for label click
        let nodeId = nodeElement ? nodeElement.getAttribute('data-node-id') : null;
        if (!nodeId) {
            const labelElement = e.target.closest('.node-label');
            if (labelElement) {
                nodeId = labelElement.getAttribute('data-label-for');
            }
        }

        if (selection.currentTool === 'select') {
            // Priority: 1) Nodes/Labels, 2) Edges, 3) Components
            if (nodeId) {
                selection.selectNode(nodeId, e.shiftKey);
            } else if (edgeGroup) {
                const edgeId = edgeGroup.getAttribute('data-edge-id');
                selection.selectEdge(edgeId, e.shiftKey);
            } else if (compElement) {
                const compId = compElement.getAttribute('data-comp-id');
                selection.selectComponent(compId, e.shiftKey);
            } else {
                selection.clearSelection();
            }
        } else if (selection.currentTool === 'path') {
            selection.handlePathClick(point.x, point.y);
        }
    }

    handleDoubleClick(e) {
        const point = transforms.getSVGPoint(e.clientX, e.clientY);

        if (selection.currentTool === 'path' && selection.pathCreation.active) {
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
                const controlPoints = edge.controlPoints ? [...edge.controlPoints] : [];
                const sourceNode = graph.getNode(edge.sourceNodeId);
                const targetNode = graph.getNode(edge.targetNodeId);

                if (sourceNode && targetNode) {
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

        // Double-click on empty node to convert to responsibility
        const nodeElement = e.target.closest('.ucm-node');
        if (nodeElement) {
            const nodeId = nodeElement.getAttribute('data-node-id');
            const node = graph.getNode(nodeId);

            if (node && node.type === 'empty') {
                graph.updateNode(nodeId, { type: 'responsibility' });
                renderer.renderNode(node);
            }
        }
    }

    handleContextMenu(e) {
        e.preventDefault();

        const nodeElement = e.target.closest('.ucm-node');
        const edgeGroup = e.target.closest('.ucm-edge-group');

        import('./context-menu.js').then(({ contextMenu }) => {
            if (nodeElement) {
                const nodeId = nodeElement.getAttribute('data-node-id');
                const node = graph.getNode(nodeId);
                contextMenu.show(e.clientX, e.clientY, node, null);
            } else if (edgeGroup) {
                const edgeId = edgeGroup.getAttribute('data-edge-id');
                const edge = graph.getEdge(edgeId);
                contextMenu.show(e.clientX, e.clientY, null, edge);
            }
        });
    }

    handleWheel(e) {
        e.preventDefault();

        // Ctrl/Cmd + Wheel = Zoom
        if (e.ctrlKey || e.metaKey) {
            const rect = this.svg.getBoundingClientRect();
            const centerX = e.clientX - rect.left;
            const centerY = e.clientY - rect.top;

            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            const newZoom = Math.max(0.1, Math.min(5, transforms.zoom + delta));

            transforms.setZoom(newZoom, { x: centerX, y: centerY });
        } else {
            // Plain wheel/trackpad scroll = Pan
            transforms.panBy(-e.deltaX, -e.deltaY);
        }
    }

    // ============================================
    // Keyboard Events
    // ============================================

    handleKeyDown(e) {
        // Spacebar for Panning
        if (e.code === 'Space' && !this.isSpacePressed) {
            if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
            e.preventDefault();
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
            renderer.hideGhostLine();
            renderer.hideGhostNode();
        }

        // Delete selected elements
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
                selection.deleteSelected();
            }
        }

        // Tool shortcuts and other keyboard handling
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
            if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
                e.preventDefault();
                import('../core/history.js').then(({ history }) => history.redo());
            }

            // Zoom Shortcuts
            if (e.metaKey || e.ctrlKey) {
                if (e.key === '=' || e.key === '+') {
                    e.preventDefault();
                    transforms.zoomIn();
                }
                if (e.key === '-') {
                    e.preventDefault();
                    transforms.zoomOut();
                }
                if (e.key === '0') {
                    e.preventDefault();
                    transforms.fitToWindow();
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
    // Helper Methods
    // ============================================

    resetDragState() {
        this.isDragging = false;
        this.dragTarget = null;
        this.dragType = null;
        this.resizeHandle = null;
        this.resizeStartBounds = null;
        this.dragOffset = { x: 0, y: 0 };
        this.waypointIndex = null;

        // Remove any lingering dragging classes
        this.svg.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
    }

    /**
     * Check if a node was dropped on a component and bind it
     */
    handleNodeDropOnComponent(nodeId) {
        const node = graph.getNode(nodeId);
        const comps = graph.getAllComponents();
        const cx = node.position.x;
        const cy = node.position.y;

        let foundComp = null;
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
    }

    /**
     * Check if a component was dropped on another component and nest it
     */
    handleComponentDropOnComponent(compId) {
        const draggedComp = graph.getComponent(compId);
        if (!draggedComp) return;

        const comps = graph.getAllComponents();
        const cx = draggedComp.bounds.x + draggedComp.bounds.width / 2;
        const cy = draggedComp.bounds.y + draggedComp.bounds.height / 2;

        let foundParent = null;
        let maxDepth = -1;

        for (const comp of comps) {
            if (comp.id === compId) continue;
            if (this.isDescendantComponent(comp.id, compId)) continue;

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
                graph.bindComponentToComponent(compId, foundParent.id);
            }
        } else {
            if (draggedComp.parentComponent) {
                graph.unbindComponentFromParent(compId);
            }
        }
    }

    /**
     * Check if compId is a descendant of ancestorId
     */
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

    /**
     * Find where to insert a new waypoint to maintain path order
     */
    findWaypointInsertIndex(source, target, controlPoints, newPoint) {
        if (controlPoints.length === 0) return 0;

        const allPoints = [source, ...controlPoints, target];
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

        return bestIndex;
    }

    /**
     * Calculate distance from point to line segment
     */
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
}

export const interactions = new CanvasInteractions();
