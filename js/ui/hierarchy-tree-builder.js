/**
 * Hierarchy Tree Builder - Builds tree structures from graph data
 * 
 * Responsible for:
 * - Tracing paths from start nodes
 * - Building recursive path tree structures
 * - Handling branches and loops
 */

import { graph } from '../core/graph.js';

/**
 * Build a recursive path tree from all start nodes
 * @returns {Array} Array of path tree objects
 */
export function buildPathTree() {
    const startNodes = graph.getAllNodes().filter(n => n.type === 'start');
    const visitedNodes = new Set();

    return startNodes.map((startNode, index) => {
        visitedNodes.clear();
        return {
            id: `root_path_${index}`,
            name: startNode.properties.name || `Path ${index + 1}`,
            startNode: startNode,
            children: traceSegment(startNode, visitedNodes)
        };
    });
}

/**
 * Recursive function to trace graph segments
 * Returns an array of node items and nested sub-paths (branches)
 * @param {Object} startNode - The node to start tracing from
 * @param {Set} visitedNodes - Set of already visited node IDs (for loop detection)
 * @returns {Array} Array of tree items
 */
function traceSegment(startNode, visitedNodes) {
    const result = [];
    let current = startNode;

    while (current) {
        // Prevent infinite loops
        if (visitedNodes.has(current.id)) {
            result.push({
                type: 'ref',
                node: current,
                label: `(Loop to ${current.properties.name})`
            });
            break;
        }
        visitedNodes.add(current.id);

        // Add current node to list
        result.push({ type: 'node', node: current });

        // Check outgoing edges
        const outEdges = [...current.outEdges];

        if (outEdges.length === 0) {
            // End of path
            break;
        } else if (outEdges.length === 1) {
            // Linear flow
            const edgeId = outEdges[0];
            const edge = graph.getEdge(edgeId);

            // Add edge segment to tree
            if (edge) {
                result.push({
                    type: 'edge',
                    edge: edge,
                    id: `edge_${edge.id}`,
                    name: 'Segment'
                });
                current = graph.getNode(edge.targetNodeId);
            } else {
                current = null;
            }
        } else {
            // Forking logic (DAG split)
            outEdges.forEach((edgeId, idx) => {
                const edge = graph.getEdge(edgeId);
                if (edge) {
                    const targetNode = graph.getNode(edge.targetNodeId);
                    if (targetNode) {
                        result.push({
                            type: 'branch',
                            name: `Branch ${idx + 1}`,
                            id: `branch_${current.id}_${idx}`,
                            children: traceSegment(targetNode, visitedNodes)
                        });
                    }
                }
            });
            break; // Stop linear trace after split
        }
    }
    return result;
}

/**
 * Get the count of start nodes (paths)
 * @returns {number} Number of paths
 */
export function getPathCount() {
    return graph.getAllNodes().filter(n => n.type === 'start').length;
}

/**
 * Get tree structure for components
 * @returns {Array} Array of root components
 */
export function getRootComponents() {
    const components = graph.getAllComponents();
    return components.filter(c => !c.parentComponent);
}

/**
 * Get total component count
 * @returns {number} Number of components
 */
export function getComponentCount() {
    return graph.getAllComponents().length;
}
