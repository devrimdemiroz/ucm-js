/**
 * UCM Scenario Manager
 * Manages scenario definitions and path traversal highlighting
 *
 * Based on jUCMNav's scenario traversal semantics:
 * - Define scenarios with start points, conditions, and expected end points
 * - Traverse paths and highlight the route taken
 * - Support for OR-fork decisions and AND-fork parallel paths
 */

import { graph } from './graph.js';

class ScenarioManager {
    constructor() {
        this.scenarios = new Map();
        this.activeScenario = null;
        this.traversedPath = [];
        this.listeners = new Map();
        this.idCounter = 0;
    }

    // ============================================
    // Event System
    // ============================================

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
        return () => this.off(event, callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).delete(callback);
        }
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(cb => cb(data));
        }
    }

    // ============================================
    // Scenario CRUD
    // ============================================

    /**
     * Create a new scenario definition
     * @param {Object} config - Scenario configuration
     * @returns {Object} The created scenario
     */
    createScenario(config = {}) {
        const id = `scenario_${++this.idCounter}`;

        const scenario = {
            id,
            name: config.name || `Scenario ${this.idCounter}`,
            description: config.description || '',
            startNodeId: config.startNodeId || null,
            expectedEndNodeIds: config.expectedEndNodeIds || [],
            // Variables for conditional paths (OR-forks)
            variables: config.variables || {},
            // Conditions for OR-fork decisions (edgeId -> boolean expression)
            conditions: config.conditions || {},
            // Color for highlighting this scenario's path
            highlightColor: config.highlightColor || '#ff6b6b',
            // Traversal state
            traversed: false,
            traversedNodes: [],
            traversedEdges: [],
            reachedEndNodes: [],
            errors: []
        };

        this.scenarios.set(id, scenario);
        this.emit('scenario:created', scenario);
        return scenario;
    }

    /**
     * Update an existing scenario
     */
    updateScenario(id, updates) {
        const scenario = this.scenarios.get(id);
        if (!scenario) return null;

        Object.assign(scenario, updates);
        this.emit('scenario:updated', scenario);
        return scenario;
    }

    /**
     * Delete a scenario
     */
    deleteScenario(id) {
        const scenario = this.scenarios.get(id);
        if (!scenario) return false;

        if (this.activeScenario === id) {
            this.clearHighlighting();
        }

        this.scenarios.delete(id);
        this.emit('scenario:deleted', { id });
        return true;
    }

    /**
     * Get all scenarios
     */
    getAllScenarios() {
        return Array.from(this.scenarios.values());
    }

    /**
     * Get a scenario by ID
     */
    getScenario(id) {
        return this.scenarios.get(id);
    }

    // ============================================
    // Quick Scenario Creation
    // ============================================

    /**
     * Create a scenario from a selected start node
     * Automatically finds all reachable end nodes
     */
    createFromStartNode(startNodeId) {
        const startNode = graph.getNode(startNodeId);
        if (!startNode || startNode.type !== 'start') {
            return null;
        }

        // Find all reachable end nodes
        const endNodes = this.findReachableEndNodes(startNodeId);

        return this.createScenario({
            name: startNode.properties.name || 'New Scenario',
            startNodeId,
            expectedEndNodeIds: endNodes.map(n => n.id)
        });
    }

    /**
     * Find all end nodes reachable from a start node
     */
    findReachableEndNodes(startNodeId) {
        const visited = new Set();
        const endNodes = [];

        const traverse = (nodeId) => {
            if (visited.has(nodeId)) return;
            visited.add(nodeId);

            const node = graph.getNode(nodeId);
            if (!node) return;

            if (node.type === 'end') {
                endNodes.push(node);
                return;
            }

            // Follow all outgoing edges
            for (const edgeId of node.outEdges) {
                const edge = graph.getEdge(edgeId);
                if (edge) {
                    traverse(edge.targetNodeId);
                }
            }
        };

        traverse(startNodeId);
        return endNodes;
    }

    // ============================================
    // Path Traversal
    // ============================================

    /**
     * Execute a scenario - traverse from start to end following conditions
     * @param {string} scenarioId - The scenario to execute
     * @returns {Object} Traversal result with path and any errors
     */
    executeScenario(scenarioId) {
        const scenario = this.scenarios.get(scenarioId);
        if (!scenario) {
            return { success: false, error: 'Scenario not found' };
        }

        // Reset traversal state
        scenario.traversedNodes = [];
        scenario.traversedEdges = [];
        scenario.reachedEndNodes = [];
        scenario.errors = [];

        const startNode = graph.getNode(scenario.startNodeId);
        if (!startNode) {
            scenario.errors.push('Start node not found');
            return { success: false, error: 'Start node not found' };
        }

        // Perform traversal
        const result = this.traverse(startNode, scenario, new Set());

        scenario.traversed = true;
        this.activeScenario = scenarioId;

        // Emit traversal complete event
        this.emit('scenario:traversed', {
            scenario,
            result
        });

        return result;
    }

    /**
     * Recursive traversal algorithm
     */
    traverse(node, scenario, visited) {
        if (visited.has(node.id)) {
            // Cycle detected
            scenario.errors.push(`Cycle detected at node: ${node.properties.name}`);
            return { success: false, cycleDetected: true };
        }

        visited.add(node.id);
        scenario.traversedNodes.push(node.id);

        // Check if we reached an end node
        if (node.type === 'end') {
            scenario.reachedEndNodes.push(node.id);
            return { success: true, reachedEnd: true };
        }

        // Get outgoing edges
        const outEdges = Array.from(node.outEdges || [])
            .map(id => graph.getEdge(id))
            .filter(Boolean);

        if (outEdges.length === 0) {
            // Dead end (not an end node)
            scenario.errors.push(`Dead end at node: ${node.properties.name}`);
            return { success: false, deadEnd: true };
        }

        // Handle different node types
        if (node.type === 'fork') {
            return this.handleFork(node, outEdges, scenario, visited);
        }

        // For regular nodes (responsibility, timer, empty, join)
        // Follow the first available edge (or condition-selected edge)
        const selectedEdge = this.selectEdge(outEdges, scenario);
        if (!selectedEdge) {
            scenario.errors.push(`No valid edge from node: ${node.properties.name}`);
            return { success: false, noValidEdge: true };
        }

        scenario.traversedEdges.push(selectedEdge.id);
        const targetNode = graph.getNode(selectedEdge.targetNodeId);
        if (!targetNode) {
            scenario.errors.push(`Target node not found for edge: ${selectedEdge.id}`);
            return { success: false, missingTarget: true };
        }

        return this.traverse(targetNode, scenario, visited);
    }

    /**
     * Handle fork node traversal
     */
    handleFork(forkNode, outEdges, scenario, visited) {
        const forkType = forkNode.properties.forkType || 'or';

        if (forkType === 'and') {
            // AND-fork: traverse ALL branches (parallel)
            const results = [];
            for (const edge of outEdges) {
                scenario.traversedEdges.push(edge.id);
                const targetNode = graph.getNode(edge.targetNodeId);
                if (targetNode) {
                    // Clone visited set for parallel branches
                    const branchVisited = new Set(visited);
                    results.push(this.traverse(targetNode, scenario, branchVisited));
                }
            }
            // AND-fork succeeds if ALL branches succeed
            const allSuccess = results.every(r => r.success);
            return { success: allSuccess, parallel: true, results };
        } else {
            // OR-fork: select ONE branch based on conditions
            const selectedEdge = this.selectEdgeWithCondition(outEdges, scenario);
            if (!selectedEdge) {
                // Default to first edge if no condition matches
                const defaultEdge = outEdges[0];
                scenario.traversedEdges.push(defaultEdge.id);
                const targetNode = graph.getNode(defaultEdge.targetNodeId);
                if (targetNode) {
                    return this.traverse(targetNode, scenario, visited);
                }
            } else {
                scenario.traversedEdges.push(selectedEdge.id);
                const targetNode = graph.getNode(selectedEdge.targetNodeId);
                if (targetNode) {
                    return this.traverse(targetNode, scenario, visited);
                }
            }
            return { success: false, noValidBranch: true };
        }
    }

    /**
     * Select an edge based on scenario conditions
     */
    selectEdge(edges, scenario) {
        // Check if any edge has a matching condition
        for (const edge of edges) {
            const condition = scenario.conditions[edge.id];
            if (condition === undefined || this.evaluateCondition(condition, scenario.variables)) {
                return edge;
            }
        }
        // Return first edge as default
        return edges[0];
    }

    /**
     * Select edge at OR-fork with condition evaluation
     */
    selectEdgeWithCondition(edges, scenario) {
        for (const edge of edges) {
            const condition = scenario.conditions[edge.id];
            if (condition !== undefined && this.evaluateCondition(condition, scenario.variables)) {
                return edge;
            }
        }
        return null;
    }

    /**
     * Evaluate a condition expression
     * Simple boolean evaluation with variable substitution
     */
    evaluateCondition(condition, variables) {
        if (typeof condition === 'boolean') {
            return condition;
        }
        if (typeof condition === 'string') {
            // Simple variable lookup
            if (condition in variables) {
                return !!variables[condition];
            }
            // Try to evaluate as expression (careful with security)
            try {
                // Only allow simple comparisons
                const safeExpr = condition.replace(/[^a-zA-Z0-9_<>=!&|() ]/g, '');
                // Create variable context
                const varContext = Object.entries(variables)
                    .map(([k, v]) => `const ${k} = ${JSON.stringify(v)};`)
                    .join('');
                // eslint-disable-next-line no-new-func
                return new Function(varContext + `return (${safeExpr});`)();
            } catch {
                return false;
            }
        }
        return false;
    }

    // ============================================
    // Highlighting
    // ============================================

    /**
     * Get the currently highlighted path
     */
    getHighlightedPath() {
        if (!this.activeScenario) return null;

        const scenario = this.scenarios.get(this.activeScenario);
        if (!scenario) return null;

        return {
            scenarioId: this.activeScenario,
            nodes: scenario.traversedNodes,
            edges: scenario.traversedEdges,
            color: scenario.highlightColor,
            endNodes: scenario.reachedEndNodes,
            errors: scenario.errors
        };
    }

    /**
     * Clear all highlighting
     */
    clearHighlighting() {
        this.activeScenario = null;
        this.emit('scenario:cleared', {});
    }

    /**
     * Set active scenario (for highlighting)
     */
    setActiveScenario(scenarioId) {
        if (scenarioId && !this.scenarios.has(scenarioId)) {
            return false;
        }
        this.activeScenario = scenarioId;
        this.emit('scenario:activated', { scenarioId });
        return true;
    }

    // ============================================
    // Serialization
    // ============================================

    /**
     * Export scenarios to JSON
     */
    toJSON() {
        const scenarios = [];
        for (const [id, scenario] of this.scenarios) {
            scenarios.push({
                id,
                name: scenario.name,
                description: scenario.description,
                startNodeId: scenario.startNodeId,
                expectedEndNodeIds: scenario.expectedEndNodeIds,
                variables: scenario.variables,
                conditions: scenario.conditions,
                highlightColor: scenario.highlightColor
            });
        }
        return scenarios;
    }

    /**
     * Import scenarios from JSON
     */
    fromJSON(data) {
        this.scenarios.clear();
        this.activeScenario = null;
        this.idCounter = 0;

        if (!Array.isArray(data)) return;

        for (const scenarioData of data) {
            const id = scenarioData.id || `scenario_${++this.idCounter}`;
            // Update counter if needed
            const num = parseInt(id.split('_')[1]);
            if (!isNaN(num) && num > this.idCounter) {
                this.idCounter = num;
            }

            this.scenarios.set(id, {
                ...scenarioData,
                id,
                traversed: false,
                traversedNodes: [],
                traversedEdges: [],
                reachedEndNodes: [],
                errors: []
            });
        }

        this.emit('scenarios:loaded', { count: this.scenarios.size });
    }

    /**
     * Clear all scenarios
     */
    clear() {
        this.scenarios.clear();
        this.activeScenario = null;
        this.idCounter = 0;
        this.emit('scenarios:cleared', {});
    }
}

// Singleton instance
export const scenarioManager = new ScenarioManager();
