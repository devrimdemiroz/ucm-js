/**
 * Action Definitions - Defines available actions for nodes, edges, and components
 * 
 * This module contains the menu structure and action metadata.
 * Actual action execution is in action-handlers.js
 */

/**
 * Get actions available when nothing is selected
 * @returns {Array} Array of action definitions
 */
export function getGlobalActions() {
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

/**
 * Get actions available for a selected node
 * @param {Object} node - The selected node
 * @returns {Array} Array of action definitions
 */
export function getNodeActions(node) {
    const actions = [];

    // Insert actions (for nodes that are on a path)
    if (node.outEdges.size > 0 && node.type !== 'end') {
        actions.push({
            id: 'insert-resp-after',
            label: 'Insert Responsibility',
            icon: '✕',
            category: 'Insert',
            tooltip: 'Add a responsibility node after this one'
        });
        actions.push({
            id: 'insert-timer-after',
            label: 'Insert Timer',
            icon: '⏰',
            category: 'Insert',
            tooltip: 'Add a timer after this one'
        });
        actions.push({
            id: 'insert-empty-after',
            label: 'Insert Waypoint',
            icon: '○',
            category: 'Insert',
            tooltip: 'Add an empty waypoint after this node'
        });
    }

    if (node.inEdges.size > 0 && node.type !== 'start') {
        actions.push({
            id: 'insert-resp-before',
            label: 'Insert Resp. Before',
            icon: '✕',
            category: 'Insert',
            tooltip: 'Add a responsibility node before this one'
        });
    }

    // Conversion actions based on node type
    actions.push(...getNodeConversionActions(node));

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

/**
 * Get conversion actions for a specific node type
 * @param {Object} node - The node
 * @returns {Array} Array of conversion action definitions
 */
function getNodeConversionActions(node) {
    const actions = [];

    switch (node.type) {
        case 'empty':
            actions.push(
                { id: 'convert-to-resp', label: 'Convert to Responsibility', icon: '✕', category: 'Convert' },
                { id: 'convert-to-timer', label: 'Convert to Timer', icon: '⏰', category: 'Convert' },
                { id: 'convert-to-or-fork', label: 'Convert to OR-Fork', icon: '◇', category: 'Convert' },
                { id: 'convert-to-and-fork', label: 'Convert to AND-Fork', icon: '◆', category: 'Convert' },
                { id: 'convert-to-or-join', label: 'Convert to OR-Join', icon: '◇', category: 'Convert' },
                { id: 'convert-to-and-join', label: 'Convert to AND-Join', icon: '◆', category: 'Convert' }
            );
            break;

        case 'responsibility':
            actions.push({ id: 'convert-to-empty', label: 'Convert to Empty', icon: '○', category: 'Convert' });
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
            actions.push({ id: 'convert-to-empty', label: 'Convert to Empty', icon: '○', category: 'Convert' });
            break;

        case 'join':
            actions.push({
                id: 'toggle-join-type',
                label: node.properties.joinType === 'or' ? 'Switch to AND-Join' : 'Switch to OR-Join',
                icon: node.properties.joinType === 'or' ? '◆' : '◇',
                category: 'Convert'
            });
            actions.push({ id: 'convert-to-empty', label: 'Convert to Empty', icon: '○', category: 'Convert' });
            break;
    }

    return actions;
}

/**
 * Get actions available for a selected edge
 * @param {Object} edge - The selected edge
 * @param {Function} getNode - Function to get a node by ID
 * @returns {Array} Array of action definitions
 */
export function getEdgeActions(edge, getNode) {
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

    // Delete edge action with validation
    const deleteAction = getEdgeDeleteAction(edge, getNode);
    actions.push(deleteAction);

    return actions;
}

/**
 * Determine if an edge can be deleted and return the appropriate action
 * @param {Object} edge - The edge
 * @param {Function} getNode - Function to get a node by ID
 * @returns {Object} Delete action definition
 */
function getEdgeDeleteAction(edge, getNode) {
    const sourceNode = getNode(edge.sourceNodeId);
    const targetNode = getNode(edge.targetNodeId);

    if (!sourceNode || !targetNode) {
        return {
            id: 'delete-edge',
            label: 'Delete Edge',
            icon: '🗑',
            category: 'Edit'
        };
    }

    const sourceIsTerminal = sourceNode.type === 'start' || sourceNode.type === 'end';
    const targetIsTerminal = targetNode.type === 'start' || targetNode.type === 'end';
    const sourceHasOtherOutEdges = sourceNode.outEdges.size > 1;
    const targetHasOtherInEdges = targetNode.inEdges.size > 1;

    const canDelete = (sourceIsTerminal && targetIsTerminal) ||
        sourceHasOtherOutEdges ||
        targetHasOtherInEdges;

    if (canDelete) {
        return {
            id: 'delete-edge',
            label: 'Delete Edge',
            icon: '🗑',
            category: 'Edit'
        };
    } else {
        return {
            id: 'delete-edge-disabled',
            label: 'Delete Edge (blocked)',
            icon: '🔒',
            category: 'Edit',
            tooltip: 'Cannot delete: would break path continuity. Delete adjacent nodes instead.',
            disabled: true
        };
    }
}

/**
 * Get actions available for a selected component
 * @param {Object} comp - The selected component
 * @returns {Array} Array of action definitions
 */
export function getComponentActions(comp) {
    return [
        {
            id: 'add-resp-inside',
            label: 'Add Responsibility Inside',
            icon: '✕',
            category: 'Insert'
        },
        {
            id: 'add-component-inside',
            label: 'Add Nested Component',
            icon: '□',
            category: 'Insert'
        },
        {
            id: 'delete-component',
            label: 'Delete Component',
            icon: '🗑',
            category: 'Edit'
        }
    ];
}

/**
 * Group actions by category in a predefined order
 * @param {Array} actions - Array of action definitions
 * @returns {Object} Actions grouped by category
 */
export function groupActions(actions) {
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
