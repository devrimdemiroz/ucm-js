/**
 * UCM Selection Manager - Handles node/edge selection and tool state
 */

import { graph } from '../core/graph.js';
import { COMPONENT_TYPES } from '../core/node-types.js';

class SelectionManager {
    constructor() {
        this.selectedNodes = new Set();
        this.selectedEdges = new Set();
        this.selectedComponents = new Set();
        this.currentTool = 'select'; // 'select' | 'path' | 'component' | 'delete'
        this.pathCreation = {
            active: false,
            nodes: []
        };
        this.listeners = new Map();
    }

    // ============================================
    // Event System
    // ============================================

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
    }

    // Subscribe to graph events to clear selection on reset
    init() {
        graph.on('graph:cleared', () => {
            this.clearSelection();
        });
        graph.on('graph:loaded', () => {
            this.clearSelection();
        });
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(cb => cb(data));
        }
    }

    // ============================================
    // Tool Management
    // ============================================

    setTool(tool) {
        // Cancel any active path creation when switching tools
        if (this.pathCreation.active && tool !== 'path') {
            this.cancelPath();
        }

        this.currentTool = tool;
        this.updateToolUI();
        this.emit('tool:changed', { tool });

        // Update canvas cursor - use setAttribute for SVG
        const canvas = document.getElementById('canvas');
        if (canvas) {
            canvas.setAttribute('class', `tool-${tool}`);
        }
    }

    updateToolUI() {
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        const toolBtn = document.getElementById(`tool-${this.currentTool}`);
        if (toolBtn) {
            toolBtn.classList.add('active');
        }
    }

    // ============================================
    // Selection Management
    // ============================================

    selectNode(nodeId, addToSelection = false) {
        if (!addToSelection) {
            this.clearSelection();
        }

        this.selectedNodes.add(nodeId);
        this.emit('selection:changed', {
            nodes: [...this.selectedNodes],
            edges: [...this.selectedEdges]
        });

        // Update visual highlight
        this.updateSelectionHighlights();
    }

    selectEdge(edgeId, addToSelection = false) {
        if (!addToSelection) {
            this.clearSelection();
        }

        this.selectedEdges.add(edgeId);
        this.emit('selection:changed', {
            nodes: [...this.selectedNodes],
            edges: [...this.selectedEdges]
        });

        this.updateSelectionHighlights();
    }

    deselectNode(nodeId) {
        this.selectedNodes.delete(nodeId);
        this.emit('selection:changed', {
            nodes: [...this.selectedNodes],
            edges: [...this.selectedEdges]
        });
        this.updateSelectionHighlights();
    }

    deselectEdge(edgeId) {
        this.selectedEdges.delete(edgeId);
        this.emit('selection:changed', {
            nodes: [...this.selectedNodes],
            edges: [...this.selectedEdges]
        });
        this.updateSelectionHighlights();
    }

    selectComponent(compId, addToSelection = false) {
        if (!addToSelection) {
            this.clearSelection();
        }

        this.selectedComponents.add(compId);
        this.emit('selection:changed', {
            nodes: [...this.selectedNodes],
            edges: [...this.selectedEdges],
            components: [...this.selectedComponents]
        });

        this.updateSelectionHighlights();
    }

    deselectComponent(compId) {
        this.selectedComponents.delete(compId);
        this.emit('selection:changed', {
            nodes: [...this.selectedNodes],
            edges: [...this.selectedEdges],
            components: [...this.selectedComponents]
        });
        this.updateSelectionHighlights();
    }

    clearSelection() {
        this.selectedNodes.clear();
        this.selectedEdges.clear();
        this.selectedComponents.clear();
        this.emit('selection:changed', { nodes: [], edges: [], components: [] });
        this.updateSelectionHighlights();
    }

    updateSelectionHighlights() {
        // Remove all highlights
        document.querySelectorAll('.ucm-node.selected').forEach(el => {
            el.classList.remove('selected');
        });
        document.querySelectorAll('.ucm-edge.selected').forEach(el => {
            el.classList.remove('selected');
        });
        document.querySelectorAll('.ucm-component.selected').forEach(el => {
            el.classList.remove('selected');
            // Reset stroke style for components
            const rect = el.querySelector('rect');
            if (rect) {
                const compId = el.getAttribute('data-comp-id');
                const comp = graph.getComponent(compId);
                const typeInfo = COMPONENT_TYPES[comp?.type] || COMPONENT_TYPES.team;

                rect.setAttribute('stroke-width', '1');
                rect.setAttribute('stroke-dasharray', typeInfo?.borderStyle === 'dashed' ? '5 5' : 'none');
            }
        });

        // Add highlights to selected elements
        this.selectedNodes.forEach(nodeId => {
            const el = document.querySelector(`[data-node-id="${nodeId}"]`);
            if (el) el.classList.add('selected');
        });
        this.selectedEdges.forEach(edgeId => {
            const el = document.querySelector(`[data-edge-id="${edgeId}"]`);
            if (el) el.classList.add('selected');
        });

        // Highlight components (using canvas helper)
        if (this.selectedComponents.size > 0) {
            import('./canvas.js').then(({ canvas }) => {
                this.selectedComponents.forEach(compId => canvas.highlightComponent(compId, true));
            });
        }
    }

    getSelectedComponents() {
        return [...this.selectedComponents].map(id => graph.getComponent(id)).filter(Boolean);
    }

    hasSelection() {
        return this.selectedNodes.size > 0 || this.selectedEdges.size > 0 || this.selectedComponents.size > 0;
    }

    // ============================================
    // Path Creation
    // ============================================

    handlePathClick(x, y) {
        if (!this.pathCreation.active) {
            // Start new path with start node
            this.pathCreation.active = true;
            this.pathCreation.nodes = [];

            const startNode = graph.addNode('start', { x, y });
            this.pathCreation.nodes.push(startNode.id);

            document.getElementById('canvas').classList.add('creating-path');
        } else {
            // Add intermediate node
            const emptyNode = graph.addNode('empty', { x, y });
            this.pathCreation.nodes.push(emptyNode.id);

            // Connect to previous node
            const prevNodeId = this.pathCreation.nodes[this.pathCreation.nodes.length - 2];
            graph.addEdge(prevNodeId, emptyNode.id);
        }
    }

    finishPath() {
        if (!this.pathCreation.active || this.pathCreation.nodes.length === 0) {
            this.cancelPath();
            return;
        }

        const lastNodeId = this.pathCreation.nodes[this.pathCreation.nodes.length - 1];
        const lastNode = graph.getNode(lastNodeId);

        if (lastNode) {
            // If only start node exists, add an end node
            if (this.pathCreation.nodes.length === 1) {
                const endNode = graph.addNode('end', { x: lastNode.position.x + 100, y: lastNode.position.y });
                graph.addEdge(lastNodeId, endNode.id);
            } else {
                // Convert last empty node to end node
                if (lastNode.type === 'empty') {
                    graph.updateNode(lastNodeId, { type: 'end' });
                }
            }
        }

        this.pathCreation.active = false;
        this.pathCreation.nodes = [];

        document.getElementById('canvas')?.classList.remove('creating-path');

        this.emit('path:created', {});
    }

    cancelPath() {
        // Remove all nodes created during this path creation
        this.pathCreation.nodes.forEach(nodeId => {
            graph.removeNode(nodeId);
        });

        this.pathCreation.active = false;
        this.pathCreation.nodes = [];

        document.getElementById('canvas')?.classList.remove('creating-path');
    }

    // ============================================
    // Delete Operations
    // ============================================

    deleteSelected() {
        // Delete selected edges first
        this.selectedEdges.forEach(edgeId => {
            graph.removeEdge(edgeId);
        });

        // Delete selected nodes (and their edges)
        this.selectedNodes.forEach(nodeId => {
            graph.removeNode(nodeId);
        });

        // Delete selected components
        this.selectedComponents.forEach(compId => {
            graph.removeComponent(compId);
        });

        this.clearSelection();
    }
}

export const selection = new SelectionManager();
