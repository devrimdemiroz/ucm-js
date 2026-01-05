/**
 * Actions Panel - Context-sensitive actions for selected elements
 * Shows available operations based on what's selected (nodes, edges, components)
 */

import { graph } from '../core/graph.js';
import { selection } from '../editor/selection.js';
import { canvas } from '../editor/canvas.js';
import { convertToFork, convertToJoin, addBranch, toggleForkType, toggleJoinType, insertForkOnPath } from '../core/fork-join.js';
import { validator } from '../core/validator.js';

class ActionsPanel {
    constructor() {
        this.container = null;
    }

    init() {
        this.container = document.getElementById('actions-content');
        if (!this.container) return;

        this.subscribeToEvents();
        this.render();
    }

    subscribeToEvents() {
        selection.on('selection:changed', () => this.render());
    }

    render() {
        if (!this.container) return;

        const nodes = [...selection.selectedNodes].map(id => graph.getNode(id)).filter(Boolean);
        const edges = [...selection.selectedEdges].map(id => graph.getEdge(id)).filter(Boolean);
        const components = [...selection.selectedComponents].map(id => graph.getComponent(id)).filter(Boolean);

        const totalSelected = nodes.length + edges.length + components.length;

        const actions = this.buildActions(nodes, edges, components, totalSelected === 0);

        if (actions.length === 0) {
            this.container.innerHTML = `<p class="placeholder-text">No actions available</p>`;
            return;
        }

        // Group actions by category
        const grouped = this.groupActions(actions);

        let html = '';
        for (const [category, categoryActions] of Object.entries(grouped)) {
            html += `<div class="action-group">`;
            html += `<div class="action-group-title">${category}</div>`;
            for (const action of categoryActions) {
                html += `<button class="action-btn" data-action="${action.id}" title="${action.tooltip || action.label}">
                    <span class="action-icon">${action.icon}</span>
                    <span class="action-label">${action.label}</span>
                </button>`;
            }
            html += `</div>`;
        }

        this.container.innerHTML = html;
        this.attachEventListeners();
    }

    buildActions(nodes, edges, components, nothingSelected = false) {
        const actions = [];

        // Global actions when nothing is selected
        if (nothingSelected) {
            actions.push(...this.getGlobalActions());
            return actions;
        }

        // Single node selected
        if (nodes.length === 1 && edges.length === 0) {
            const node = nodes[0];
            actions.push(...this.getNodeActions(node));
        }

        // Single edge selected
        if (edges.length === 1 && nodes.length === 0) {
            const edge = edges[0];
            actions.push(...this.getEdgeActions(edge));
        }

        // Single component selected
        if (components.length === 1 && nodes.length === 0 && edges.length === 0) {
            const comp = components[0];
            actions.push(...this.getComponentActions(comp));
        }

        // Multiple selection
        if (nodes.length + edges.length + components.length > 1) {
            actions.push({
                id: 'delete-selected',
                label: 'Delete All Selected',
                icon: '🗑',
                category: 'Edit',
                tooltip: 'Delete all selected elements'
            });
        }

        return actions;
    }

    getNodeActions(node) {
        const actions = [];

        // Insert actions (for nodes that are on a path)
        if (node.outEdges.size > 0 && node.type !== 'end') {
            actions.push({
                id: 'insert-resp-after',
                label: 'Insert Responsibility After',
                icon: '✕',
                category: 'Insert',
                tooltip: 'Add a responsibility node after this one'
            });
            actions.push({
                id: 'insert-empty-after',
                label: 'Insert Waypoint After',
                icon: '○',
                category: 'Insert',
                tooltip: 'Add an empty waypoint after this node'
            });
        }

        if (node.inEdges.size > 0 && node.type !== 'start') {
            actions.push({
                id: 'insert-resp-before',
                label: 'Insert Responsibility Before',
                icon: '✕',
                category: 'Insert',
                tooltip: 'Add a responsibility node before this one'
            });
        }

        // Conversion actions based on node type
        switch (node.type) {
            case 'empty':
                actions.push({
                    id: 'convert-to-resp',
                    label: 'Convert to Responsibility',
                    icon: '✕',
                    category: 'Convert'
                });
                actions.push({
                    id: 'convert-to-or-fork',
                    label: 'Convert to OR-Fork',
                    icon: '◇',
                    category: 'Convert'
                });
                actions.push({
                    id: 'convert-to-and-fork',
                    label: 'Convert to AND-Fork',
                    icon: '◆',
                    category: 'Convert'
                });
                actions.push({
                    id: 'convert-to-or-join',
                    label: 'Convert to OR-Join',
                    icon: '◇',
                    category: 'Convert'
                });
                actions.push({
                    id: 'convert-to-and-join',
                    label: 'Convert to AND-Join',
                    icon: '◆',
                    category: 'Convert'
                });
                break;

            case 'responsibility':
                actions.push({
                    id: 'convert-to-empty',
                    label: 'Convert to Empty',
                    icon: '○',
                    category: 'Convert'
                });
                break;

            case 'fork':
                actions.push({
                    id: 'add-branch',
                    label: 'Add Branch',
                    icon: '⑂',
                    category: 'Branch'
                });
                actions.push({
                    id: 'toggle-fork-type',
                    label: node.properties.forkType === 'or' ? 'Switch to AND-Fork' : 'Switch to OR-Fork',
                    icon: node.properties.forkType === 'or' ? '◆' : '◇',
                    category: 'Convert'
                });
                actions.push({
                    id: 'convert-to-empty',
                    label: 'Convert to Empty',
                    icon: '○',
                    category: 'Convert'
                });
                break;

            case 'join':
                actions.push({
                    id: 'toggle-join-type',
                    label: node.properties.joinType === 'or' ? 'Switch to AND-Join' : 'Switch to OR-Join',
                    icon: node.properties.joinType === 'or' ? '◆' : '◇',
                    category: 'Convert'
                });
                actions.push({
                    id: 'convert-to-empty',
                    label: 'Convert to Empty',
                    icon: '○',
                    category: 'Convert'
                });
                break;
        }

        // Delete action (not for start/end unless specifically needed)
        if (node.type !== 'start' && node.type !== 'end') {
            actions.push({
                id: 'delete-node',
                label: 'Delete Node',
                icon: '🗑',
                category: 'Edit'
            });
        }

        return actions;
    }

    getEdgeActions(edge) {
        const actions = [];

        // Insert on path
        actions.push({
            id: 'insert-resp-on-edge',
            label: 'Insert Responsibility',
            icon: '✕',
            category: 'Insert',
            tooltip: 'Insert a responsibility on this path'
        });
        actions.push({
            id: 'insert-waypoint-on-edge',
            label: 'Add Waypoint',
            icon: '○',
            category: 'Insert',
            tooltip: 'Add a waypoint to bend the path'
        });

        // Fork insertion
        actions.push({
            id: 'insert-or-fork-on-edge',
            label: 'Insert OR-Fork',
            icon: '◇',
            category: 'Branch',
            tooltip: 'Insert an OR-Fork (decision point)'
        });
        actions.push({
            id: 'insert-and-fork-on-edge',
            label: 'Insert AND-Fork',
            icon: '◆',
            category: 'Branch',
            tooltip: 'Insert an AND-Fork (parallel split)'
        });

        // Path control
        if (edge.controlPoints && edge.controlPoints.length > 0) {
            actions.push({
                id: 'straighten-edge',
                label: 'Straighten Path',
                icon: '—',
                category: 'Edit',
                tooltip: 'Remove all waypoints'
            });
        }

        actions.push({
            id: 'delete-edge',
            label: 'Delete Edge',
            icon: '🗑',
            category: 'Edit'
        });

        return actions;
    }

    getComponentActions(comp) {
        const actions = [];

        actions.push({
            id: 'add-resp-inside',
            label: 'Add Responsibility Inside',
            icon: '✕',
            category: 'Insert'
        });

        actions.push({
            id: 'add-component-inside',
            label: 'Add Nested Component',
            icon: '□',
            category: 'Insert'
        });

        actions.push({
            id: 'delete-component',
            label: 'Delete Component',
            icon: '🗑',
            category: 'Edit'
        });

        return actions;
    }

    getGlobalActions() {
        // Actions available when nothing is selected
        return [
            {
                id: 'add-start-bundle',
                label: 'Add New Path',
                icon: '●→▮',
                category: 'Create',
                tooltip: 'Add start + end points with connection'
            },
            {
                id: 'add-component-actor',
                label: 'Add Actor',
                icon: '👤',
                category: 'Create',
                tooltip: 'Add an actor component'
            },
            {
                id: 'add-component-team',
                label: 'Add Team/System',
                icon: '□',
                category: 'Create',
                tooltip: 'Add a team/system component'
            },
            {
                id: 'validate-diagram',
                label: 'Validate Diagram',
                icon: '✓',
                category: 'Quality',
                tooltip: 'Check diagram for structural issues and UCM constraints'
            }
        ];
    }

    groupActions(actions) {
        const groups = {};
        const order = ['Create', 'Insert', 'Branch', 'Convert', 'Edit', 'Quality'];

        for (const action of actions) {
            const category = action.category || 'Other';
            if (!groups[category]) groups[category] = [];
            groups[category].push(action);
        }

        // Sort by predefined order
        const sorted = {};
        for (const cat of order) {
            if (groups[cat]) sorted[cat] = groups[cat];
        }
        // Add any remaining categories
        for (const cat of Object.keys(groups)) {
            if (!sorted[cat]) sorted[cat] = groups[cat];
        }

        return sorted;
    }

    attachEventListeners() {
        this.container.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const actionId = btn.dataset.action;
                this.executeAction(actionId);
            });
        });
    }

    executeAction(actionId) {
        const nodes = [...selection.selectedNodes].map(id => graph.getNode(id)).filter(Boolean);
        const edges = [...selection.selectedEdges].map(id => graph.getEdge(id)).filter(Boolean);
        const components = [...selection.selectedComponents].map(id => graph.getComponent(id)).filter(Boolean);

        const node = nodes[0];
        const edge = edges[0];
        const comp = components[0];

        switch (actionId) {
            // Node insert actions
            case 'insert-resp-after':
                if (node) this.insertNodeAfter(node, 'responsibility');
                break;
            case 'insert-empty-after':
                if (node) this.insertNodeAfter(node, 'empty');
                break;
            case 'insert-resp-before':
                if (node) this.insertNodeBefore(node, 'responsibility');
                break;

            // Node conversion actions
            case 'convert-to-resp':
                if (node) graph.updateNode(node.id, { type: 'responsibility' });
                break;
            case 'convert-to-empty':
                if (node) graph.updateNode(node.id, { type: 'empty' });
                break;
            case 'convert-to-or-fork':
                if (node) convertToFork(node.id, 'or');
                break;
            case 'convert-to-and-fork':
                if (node) convertToFork(node.id, 'and');
                break;
            case 'convert-to-or-join':
                if (node) convertToJoin(node.id, 'or');
                break;
            case 'convert-to-and-join':
                if (node) convertToJoin(node.id, 'and');
                break;
            case 'toggle-fork-type':
                if (node) toggleForkType(node.id);
                break;
            case 'toggle-join-type':
                if (node) toggleJoinType(node.id);
                break;
            case 'add-branch':
                if (node) addBranch(node.id, node.position.x + 100, node.position.y + 80);
                break;

            // Edge actions
            case 'insert-resp-on-edge':
                if (edge) this.insertNodeOnEdge(edge, 'responsibility');
                break;
            case 'insert-waypoint-on-edge':
                if (edge) this.insertNodeOnEdge(edge, 'empty');
                break;
            case 'insert-or-fork-on-edge':
                if (edge) this.insertForkOnEdge(edge, 'or');
                break;
            case 'insert-and-fork-on-edge':
                if (edge) this.insertForkOnEdge(edge, 'and');
                break;
            case 'straighten-edge':
                if (edge) graph.updateEdge(edge.id, { controlPoints: [] });
                break;

            // Delete actions
            case 'delete-node':
                if (node) graph.removeNode(node.id);
                selection.clearSelection();
                break;
            case 'delete-edge':
                if (edge) graph.removeEdge(edge.id);
                selection.clearSelection();
                break;
            case 'delete-component':
                if (comp) graph.removeComponent(comp.id);
                selection.clearSelection();
                break;
            case 'delete-selected':
                selection.deleteSelected();
                break;

            // Component actions
            case 'add-resp-inside':
                if (comp) {
                    const newNode = graph.addNode('responsibility', {
                        x: comp.bounds.x + comp.bounds.width / 2,
                        y: comp.bounds.y + comp.bounds.height / 2
                    });
                    graph.bindNodeToComponent(newNode.id, comp.id);
                }
                break;
            case 'add-component-inside':
                if (comp) {
                    const newComp = graph.addComponent('team', {
                        x: comp.bounds.x + 20,
                        y: comp.bounds.y + 40,
                        width: comp.bounds.width - 40,
                        height: comp.bounds.height - 60,
                        name: 'Nested'
                    });
                    graph.bindComponentToComponent(newComp.id, comp.id);
                }
                break;

            // Global actions (when nothing selected)
            case 'add-start-bundle':
                this.addPathBundle();
                break;
            case 'add-component-actor':
                this.addComponentAtCenter('actor');
                break;
            case 'add-component-team':
                this.addComponentAtCenter('team');
                break;
            case 'validate-diagram':
                this.validateDiagram();
                break;
        }

        canvas.renderAll();
        this.render();
    }

    // Validate diagram and show results
    validateDiagram() {
        const result = validator.validate(graph);
        const report = validator.generateReport(result);

        // Log to console
        console.log(report);

        // Show alert with summary
        const summary = result.valid
            ? `✅ Diagram is valid!\n\nNo structural errors found.${result.warnings.length > 0 ? `\n\n⚠️ ${result.warnings.length} warning(s) - check console for details.` : ''}`
            : `❌ Diagram has issues:\n\n` +
              `Errors: ${result.errors.length}\n` +
              `Warnings: ${result.warnings.length}\n\n` +
              `See console for detailed report.`;

        alert(summary);

        // Also emit an event for other panels to listen to
        document.dispatchEvent(new CustomEvent('validation:complete', {
            detail: result
        }));
    }

    // Helper: Add a complete path bundle (start + end + edge)
    addPathBundle() {
        const canvasEl = document.getElementById('canvas');
        const rect = canvasEl.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        // Create start and end nodes with connection
        const startNode = graph.addNode('start', { x: centerX - 150, y: centerY });
        const endNode = graph.addNode('end', { x: centerX + 150, y: centerY });
        graph.addEdge(startNode.id, endNode.id);

        selection.selectNode(startNode.id);
    }

    // Helper: Add node at canvas center
    addNodeAtCenter(nodeType) {
        const canvasEl = document.getElementById('canvas');
        const rect = canvasEl.getBoundingClientRect();
        const x = rect.width / 2;
        const y = rect.height / 2;
        const newNode = graph.addNode(nodeType, { x, y });
        selection.selectNode(newNode.id);
    }

    // Helper: Add component at canvas center
    addComponentAtCenter(compType) {
        const canvasEl = document.getElementById('canvas');
        const rect = canvasEl.getBoundingClientRect();
        const x = rect.width / 2 - 100;
        const y = rect.height / 2 - 75;
        const newComp = graph.addComponent(compType, {
            x, y, width: 200, height: 150
        });
        selection.selectComponent(newComp.id);
    }

    // Helper: Insert node after another node
    insertNodeAfter(node, nodeType) {
        if (node.outEdges.size === 0) return;

        // Get first outgoing edge
        const edgeId = [...node.outEdges][0];
        const edge = graph.getEdge(edgeId);
        if (!edge) return;

        const targetNode = graph.getNode(edge.targetNodeId);
        if (!targetNode) return;

        // Calculate midpoint
        const midX = (node.position.x + targetNode.position.x) / 2;
        const midY = (node.position.y + targetNode.position.y) / 2;

        // Create new node at midpoint
        const newNode = graph.addNode(nodeType, { x: midX, y: midY });

        // Remove old edge, create two new ones
        graph.removeEdge(edgeId);
        graph.addEdge(node.id, newNode.id);
        graph.addEdge(newNode.id, targetNode.id);

        // Inherit parent component if applicable
        if (node.parentComponent) {
            graph.bindNodeToComponent(newNode.id, node.parentComponent);
        }

        selection.selectNode(newNode.id);
    }

    // Helper: Insert node before another node
    insertNodeBefore(node, nodeType) {
        if (node.inEdges.size === 0) return;

        // Get first incoming edge
        const edgeId = [...node.inEdges][0];
        const edge = graph.getEdge(edgeId);
        if (!edge) return;

        const sourceNode = graph.getNode(edge.sourceNodeId);
        if (!sourceNode) return;

        // Calculate midpoint
        const midX = (node.position.x + sourceNode.position.x) / 2;
        const midY = (node.position.y + sourceNode.position.y) / 2;

        // Create new node at midpoint
        const newNode = graph.addNode(nodeType, { x: midX, y: midY });

        // Remove old edge, create two new ones
        graph.removeEdge(edgeId);
        graph.addEdge(sourceNode.id, newNode.id);
        graph.addEdge(newNode.id, node.id);

        // Inherit parent component if applicable
        if (node.parentComponent) {
            graph.bindNodeToComponent(newNode.id, node.parentComponent);
        }

        selection.selectNode(newNode.id);
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

        // Inherit parent component from source or target
        const parentComp = sourceNode.parentComponent || targetNode.parentComponent;
        if (parentComp) {
            graph.bindNodeToComponent(newNode.id, parentComp);
        }

        selection.selectNode(newNode.id);
    }

    // Helper: Insert fork on an edge
    insertForkOnEdge(edge, forkType) {
        const sourceNode = graph.getNode(edge.sourceNodeId);
        const targetNode = graph.getNode(edge.targetNodeId);
        if (!sourceNode || !targetNode) return;

        const midX = (sourceNode.position.x + targetNode.position.x) / 2;
        const midY = (sourceNode.position.y + targetNode.position.y) / 2;

        insertForkOnPath(edge.id, midX, midY, forkType);
    }
}

export const actionsPanel = new ActionsPanel();
