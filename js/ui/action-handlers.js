/**
 * Action Handlers - Executes actions triggered from the actions panel
 * 
 * This module contains the business logic for all actions.
 * Action definitions/metadata are in action-definitions.js
 */

import { graph } from '../core/graph.js';
import { selection } from '../editor/selection.js';
import { convertToFork, convertToJoin, addBranch, toggleForkType, toggleJoinType, insertForkOnPath } from '../core/fork-join.js';
import { validator } from '../core/validator.js';

/**
 * Execute an action by ID
 * @param {string} actionId - The action identifier
 * @param {Object} context - Context with selected nodes, edges, components
 */
export function executeAction(actionId, context) {
    const { nodes, edges, components } = context;
    const node = nodes[0];
    const edge = edges[0];
    const comp = components[0];

    switch (actionId) {
        // Node insert actions
        case 'insert-resp-after':
            if (node) insertNodeAfter(node, 'responsibility');
            break;
        case 'insert-timer-after':
            if (node) insertNodeAfter(node, 'timer');
            break;
        case 'insert-empty-after':
            if (node) insertNodeAfter(node, 'empty');
            break;
        case 'insert-resp-before':
            if (node) insertNodeBefore(node, 'responsibility');
            break;
        case 'insert-timer-before':
            if (node) insertNodeBefore(node, 'timer');
            break;

        // Node conversion actions
        case 'convert-to-resp':
            if (node) graph.updateNode(node.id, { type: 'responsibility' });
            break;
        case 'convert-to-timer':
            if (node) graph.updateNode(node.id, { type: 'timer' });
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
            if (edge) insertNodeOnEdge(edge, 'responsibility');
            break;
        case 'insert-timer-on-edge':
            if (edge) insertNodeOnEdge(edge, 'timer');
            break;
        case 'insert-waypoint-on-edge':
            if (edge) insertNodeOnEdge(edge, 'empty');
            break;
        case 'insert-or-fork-on-edge':
            if (edge) insertForkOnEdge(edge, 'or');
            break;
        case 'insert-and-fork-on-edge':
            if (edge) insertForkOnEdge(edge, 'and');
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
            if (comp) addNodeInsideComponent(comp, 'responsibility');
            break;
        case 'add-component-inside':
            if (comp) addNestedComponent(comp);
            break;

        // Global actions (when nothing selected)
        case 'add-start-bundle':
            addPathBundle();
            break;
        case 'add-component-actor':
            addComponentAtCenter('actor');
            break;
        case 'add-component-team':
            addComponentAtCenter('team');
            break;
        case 'validate-diagram':
            validateDiagram();
            break;
    }
}

// ============================================
// Node Operations
// ============================================

/**
 * Insert a node after another node
 */
function insertNodeAfter(node, nodeType) {
    if (node.outEdges.size === 0) return;

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

/**
 * Insert a node before another node
 */
function insertNodeBefore(node, nodeType) {
    if (node.inEdges.size === 0) return;

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

// ============================================
// Edge Operations
// ============================================

/**
 * Insert a node on an edge (splits the edge)
 */
function insertNodeOnEdge(edge, nodeType) {
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

/**
 * Insert a fork on an edge
 */
function insertForkOnEdge(edge, forkType) {
    const sourceNode = graph.getNode(edge.sourceNodeId);
    const targetNode = graph.getNode(edge.targetNodeId);
    if (!sourceNode || !targetNode) return;

    const midX = (sourceNode.position.x + targetNode.position.x) / 2;
    const midY = (sourceNode.position.y + targetNode.position.y) / 2;

    insertForkOnPath(edge.id, midX, midY, forkType);
}

// ============================================
// Component Operations
// ============================================

/**
 * Add a node inside a component
 */
function addNodeInsideComponent(comp, nodeType) {
    const newNode = graph.addNode(nodeType, {
        x: comp.bounds.x + comp.bounds.width / 2,
        y: comp.bounds.y + comp.bounds.height / 2
    });
    graph.bindNodeToComponent(newNode.id, comp.id);
}

/**
 * Add a nested component inside a component
 */
function addNestedComponent(comp) {
    const newComp = graph.addComponent('team', {
        x: comp.bounds.x + 20,
        y: comp.bounds.y + 40,
        width: comp.bounds.width - 40,
        height: comp.bounds.height - 60,
        name: 'Nested'
    });
    graph.bindComponentToComponent(newComp.id, comp.id);
}

// ============================================
// Global Operations
// ============================================

/**
 * Add a complete path bundle (start + end + edge)
 */
function addPathBundle() {
    const canvasEl = document.getElementById('canvas');
    const rect = canvasEl.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const startNode = graph.addNode('start', { x: centerX - 150, y: centerY });
    const endNode = graph.addNode('end', { x: centerX + 150, y: centerY });
    graph.addEdge(startNode.id, endNode.id);

    selection.selectNode(startNode.id);
}

/**
 * Add a component at canvas center
 */
function addComponentAtCenter(compType) {
    const canvasEl = document.getElementById('canvas');
    const rect = canvasEl.getBoundingClientRect();
    const x = rect.width / 2 - 100;
    const y = rect.height / 2 - 75;

    const newComp = graph.addComponent(compType, {
        x, y, width: 200, height: 150
    });
    selection.selectComponent(newComp.id);
}

/**
 * Validate the diagram and show results
 */
function validateDiagram() {
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

    // Emit event for other panels
    document.dispatchEvent(new CustomEvent('validation:complete', {
        detail: result
    }));
}
