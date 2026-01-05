/**
 * UCM Context Menu
 * Right-click menu for node operations
 */

import { graph } from '../core/graph.js';
import { selection } from './selection.js';
import { canvas } from './canvas.js';
import { convertToFork, convertToJoin, addBranch, toggleForkType, toggleJoinType } from '../core/fork-join.js';

class ContextMenu {
    constructor() {
        this.menuElement = null;
        this.targetNode = null;
        this.targetEdge = null;
        this.position = { x: 0, y: 0 };
    }

    init() {
        this.createMenuElement();
        this.setupEventListeners();
    }

    createMenuElement() {
        this.menuElement = document.createElement('div');
        this.menuElement.id = 'context-menu';
        this.menuElement.className = 'context-menu';
        this.menuElement.style.display = 'none';
        document.body.appendChild(this.menuElement);
    }

    setupEventListeners() {
        // Close menu on click outside
        document.addEventListener('click', (e) => {
            if (!this.menuElement.contains(e.target)) {
                this.hide();
            }
        });

        // Close on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hide();
            }
        });
    }

    show(x, y, node = null, edge = null) {
        this.targetNode = node;
        this.targetEdge = edge;
        this.position = { x, y };

        // Build menu based on target
        const menuItems = this.buildMenuItems();

        if (menuItems.length === 0) {
            this.hide();
            return;
        }

        this.menuElement.innerHTML = menuItems.map(item => {
            if (item.separator) {
                return '<div class="menu-separator"></div>';
            }
            return `<div class="menu-item" data-action="${item.action}">${item.label}</div>`;
        }).join('');

        // Attach click handlers
        this.menuElement.querySelectorAll('.menu-item').forEach(el => {
            el.addEventListener('click', () => {
                const action = el.dataset.action;
                this.executeAction(action);
                this.hide();
            });
        });

        // Position and show
        this.menuElement.style.left = `${x}px`;
        this.menuElement.style.top = `${y}px`;
        this.menuElement.style.display = 'block';

        // Ensure menu stays in viewport
        const rect = this.menuElement.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            this.menuElement.style.left = `${x - rect.width}px`;
        }
        if (rect.bottom > window.innerHeight) {
            this.menuElement.style.top = `${y - rect.height}px`;
        }
    }

    hide() {
        this.menuElement.style.display = 'none';
        this.targetNode = null;
        this.targetEdge = null;
    }

    buildMenuItems() {
        const items = [];

        if (this.targetNode) {
            const node = this.targetNode;

            // Insert actions for nodes on paths
            if (node.outEdges.size > 0 && node.type !== 'end') {
                items.push({ label: '✕ Insert Responsibility After', action: 'insert-resp-after' });
                items.push({ label: '○ Insert Waypoint After', action: 'insert-empty-after' });
                items.push({ separator: true });
            }

            switch (node.type) {
                case 'empty':
                    items.push({ label: '✕ Convert to Responsibility', action: 'to-responsibility' });
                    items.push({ separator: true });
                    items.push({ label: '◇ Convert to OR-Fork', action: 'to-or-fork' });
                    items.push({ label: '◆ Convert to AND-Fork', action: 'to-and-fork' });
                    items.push({ label: '◇ Convert to OR-Join', action: 'to-or-join' });
                    items.push({ label: '◆ Convert to AND-Join', action: 'to-and-join' });
                    break;

                case 'responsibility':
                    items.push({ label: '○ Convert to Empty', action: 'to-empty' });
                    break;

                case 'fork':
                    items.push({ label: '+ Add Branch', action: 'add-branch' });
                    items.push({ separator: true });
                    items.push({
                        label: node.properties.forkType === 'or'
                            ? '◆ Switch to AND-Fork'
                            : '◇ Switch to OR-Fork',
                        action: 'toggle-fork-type'
                    });
                    items.push({ separator: true });
                    items.push({ label: '○ Convert to Empty', action: 'to-empty' });
                    break;

                case 'join':
                    items.push({
                        label: node.properties.joinType === 'or'
                            ? '◆ Switch to AND-Join'
                            : '◇ Switch to OR-Join',
                        action: 'toggle-join-type'
                    });
                    items.push({ separator: true });
                    items.push({ label: '○ Convert to Empty', action: 'to-empty' });
                    break;
            }

            // Common actions for non-start/end nodes
            if (node.type !== 'start' && node.type !== 'end') {
                items.push({ separator: true });
                items.push({ label: '🗑 Delete Node', action: 'delete' });
            }
        }

        if (this.targetEdge) {
            items.push({ label: '✕ Insert Responsibility', action: 'insert-resp-on-edge' });
            items.push({ label: '○ Add Waypoint', action: 'insert-empty-on-edge' });
            items.push({ separator: true });
            items.push({ label: '◇ Insert OR-Fork', action: 'insert-or-fork' });
            items.push({ label: '◆ Insert AND-Fork', action: 'insert-and-fork' });

            // Show straighten option if edge has control points
            if (this.targetEdge.controlPoints && this.targetEdge.controlPoints.length > 0) {
                items.push({ separator: true });
                items.push({ label: '— Straighten Path', action: 'straighten-edge' });
            }

            items.push({ separator: true });
            items.push({ label: '🗑 Delete Edge', action: 'delete-edge' });
        }

        return items;
    }

    executeAction(action) {
        if (!this.targetNode && !this.targetEdge) return;

        switch (action) {
            case 'to-responsibility':
                graph.updateNode(this.targetNode.id, { type: 'responsibility' });
                canvas.renderAll();
                break;

            case 'to-empty':
                graph.updateNode(this.targetNode.id, { type: 'empty' });
                canvas.renderAll();
                break;

            case 'to-or-fork':
                convertToFork(this.targetNode.id, 'or');
                canvas.renderAll();
                break;

            case 'to-and-fork':
                convertToFork(this.targetNode.id, 'and');
                canvas.renderAll();
                break;

            case 'to-or-join':
                convertToJoin(this.targetNode.id, 'or');
                canvas.renderAll();
                break;

            case 'to-and-join':
                convertToJoin(this.targetNode.id, 'and');
                canvas.renderAll();
                break;

            case 'toggle-fork-type':
                toggleForkType(this.targetNode.id);
                canvas.renderAll();
                break;

            case 'toggle-join-type':
                toggleJoinType(this.targetNode.id);
                canvas.renderAll();
                break;

            case 'add-branch':
                // Add branch with offset from fork position
                addBranch(this.targetNode.id,
                    this.targetNode.position.x + 100,
                    this.targetNode.position.y + 80
                );
                canvas.renderAll();
                break;

            case 'delete':
                graph.removeNode(this.targetNode.id);
                selection.clearSelection();
                canvas.renderAll();
                break;

            case 'insert-resp-after':
                this.insertNodeAfter(this.targetNode, 'responsibility');
                break;

            case 'insert-empty-after':
                this.insertNodeAfter(this.targetNode, 'empty');
                break;

            case 'insert-resp-on-edge':
                this.insertNodeOnEdge(this.targetEdge, 'responsibility');
                break;

            case 'insert-empty-on-edge':
                this.insertNodeOnEdge(this.targetEdge, 'empty');
                break;

            case 'straighten-edge':
                graph.updateEdge(this.targetEdge.id, { controlPoints: [] });
                canvas.renderAll();
                break;

            case 'insert-or-fork':
                // Insert fork at click position (approximate midpoint)
                const forkEdge = this.targetEdge;
                const source = graph.getNode(forkEdge.sourceNodeId);
                const target = graph.getNode(forkEdge.targetNodeId);
                const midX = (source.position.x + target.position.x) / 2;
                const midY = (source.position.y + target.position.y) / 2;

                import('../core/fork-join.js').then(({ insertForkOnPath }) => {
                    insertForkOnPath(forkEdge.id, midX, midY, 'or');
                    canvas.renderAll();
                });
                break;

            case 'insert-and-fork':
                const andEdge = this.targetEdge;
                const andSource = graph.getNode(andEdge.sourceNodeId);
                const andTarget = graph.getNode(andEdge.targetNodeId);
                const andMidX = (andSource.position.x + andTarget.position.x) / 2;
                const andMidY = (andSource.position.y + andTarget.position.y) / 2;

                import('../core/fork-join.js').then(({ insertForkOnPath }) => {
                    insertForkOnPath(andEdge.id, andMidX, andMidY, 'and');
                    canvas.renderAll();
                });
                break;

            case 'delete-edge':
                graph.removeEdge(this.targetEdge.id);
                selection.clearSelection();
                canvas.renderAll();
                break;
        }
    }

    // Helper: Insert node after another node
    insertNodeAfter(node, nodeType) {
        if (node.outEdges.size === 0) return;

        const edgeId = [...node.outEdges][0];
        const edge = graph.getEdge(edgeId);
        if (!edge) return;

        const targetNode = graph.getNode(edge.targetNodeId);
        if (!targetNode) return;

        const midX = (node.position.x + targetNode.position.x) / 2;
        const midY = (node.position.y + targetNode.position.y) / 2;

        const newNode = graph.addNode(nodeType, { x: midX, y: midY });

        graph.removeEdge(edgeId);
        graph.addEdge(node.id, newNode.id);
        graph.addEdge(newNode.id, targetNode.id);

        if (node.parentComponent) {
            graph.bindNodeToComponent(newNode.id, node.parentComponent);
        }

        selection.selectNode(newNode.id);
        canvas.renderAll();
    }

    // Helper: Insert node on an edge
    insertNodeOnEdge(edge, nodeType) {
        const sourceNode = graph.getNode(edge.sourceNodeId);
        const targetNode = graph.getNode(edge.targetNodeId);
        if (!sourceNode || !targetNode) return;

        const midX = (sourceNode.position.x + targetNode.position.x) / 2;
        const midY = (sourceNode.position.y + targetNode.position.y) / 2;

        const newNode = graph.addNode(nodeType, { x: midX, y: midY });

        graph.removeEdge(edge.id);
        graph.addEdge(sourceNode.id, newNode.id);
        graph.addEdge(newNode.id, targetNode.id);

        const parentComp = sourceNode.parentComponent || targetNode.parentComponent;
        if (parentComp) {
            graph.bindNodeToComponent(newNode.id, parentComp);
        }

        selection.selectNode(newNode.id);
        canvas.renderAll();
    }
}

export const contextMenu = new ContextMenu();
