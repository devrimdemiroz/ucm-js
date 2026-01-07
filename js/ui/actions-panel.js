/**
 * Actions Panel - Context-sensitive actions for selected elements
 * 
 * This is the main orchestrator that:
 * - Renders the action buttons based on selection
 * - Delegates to action-definitions.js for menu structure
 * - Delegates to action-handlers.js for execution
 */

import { graph } from '../core/graph.js';
import { selection } from '../editor/selection.js';
import { canvas } from '../editor/canvas.js';
import {
    getGlobalActions,
    getNodeActions,
    getEdgeActions,
    getComponentActions,
    groupActions
} from './action-definitions.js';
import { executeAction } from './action-handlers.js';

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
        const grouped = groupActions(actions);
        this.container.innerHTML = this.renderActionGroups(grouped);
        this.attachEventListeners();
    }

    /**
     * Build the list of available actions based on selection
     */
    buildActions(nodes, edges, components, nothingSelected = false) {
        const actions = [];

        // Global actions when nothing is selected
        if (nothingSelected) {
            return getGlobalActions();
        }

        // Single node selected
        if (nodes.length === 1 && edges.length === 0) {
            actions.push(...getNodeActions(nodes[0]));
        }

        // Single edge selected
        if (edges.length === 1 && nodes.length === 0) {
            actions.push(...getEdgeActions(edges[0], id => graph.getNode(id)));
        }

        // Single component selected
        if (components.length === 1 && nodes.length === 0 && edges.length === 0) {
            actions.push(...getComponentActions(components[0]));
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

    /**
     * Render grouped actions as HTML
     */
    renderActionGroups(grouped) {
        let html = '';
        for (const [category, categoryActions] of Object.entries(grouped)) {
            html += `<div class="action-group">`;
            html += `<div class="action-group-title">${category}</div>`;
            for (const action of categoryActions) {
                const disabledAttr = action.disabled ? 'disabled' : '';
                html += `
                    <button class="action-btn" data-action="${action.id}" 
                            title="${action.tooltip || action.label}" ${disabledAttr}>
                        <span class="action-icon">${action.icon}</span>
                        <span class="action-label">${action.label}</span>
                    </button>`;
            }
            html += `</div>`;
        }
        return html;
    }

    attachEventListeners() {
        this.container.querySelectorAll('.action-btn:not([disabled])').forEach(btn => {
            btn.addEventListener('click', () => {
                const actionId = btn.dataset.action;
                this.handleAction(actionId);
            });
        });
    }

    /**
     * Handle action execution
     */
    handleAction(actionId) {
        const context = {
            nodes: [...selection.selectedNodes].map(id => graph.getNode(id)).filter(Boolean),
            edges: [...selection.selectedEdges].map(id => graph.getEdge(id)).filter(Boolean),
            components: [...selection.selectedComponents].map(id => graph.getComponent(id)).filter(Boolean)
        };

        executeAction(actionId, context);

        canvas.renderAll();
        this.render();
    }
}

export const actionsPanel = new ActionsPanel();
