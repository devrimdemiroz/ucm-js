/**
 * UCM Fork/Join Logic
 * Handles OR/AND fork and join node operations
 */

import { graph } from './graph.js';

export const ForkJoinTypes = {
    OR_FORK: 'or-fork',   // One branch taken (decision)
    AND_FORK: 'and-fork', // All branches taken (parallel)
    OR_JOIN: 'or-join',   // First arrival continues
    AND_JOIN: 'and-join'  // Wait for all branches
};

/**
 * Convert an empty node to a fork
 * Creates additional branches from the fork point
 */
export function convertToFork(nodeId, forkType = 'or') {
    const node = graph.getNode(nodeId);
    if (!node) return null;

    // Update node type
    graph.updateNode(nodeId, {
        type: 'fork',
        properties: {
            ...node.properties,
            forkType
        }
    });

    return graph.getNode(nodeId);
}

/**
 * Convert an empty node to a join
 */
export function convertToJoin(nodeId, joinType = 'or') {
    const node = graph.getNode(nodeId);
    if (!node) return null;

    graph.updateNode(nodeId, {
        type: 'join',
        properties: {
            ...node.properties,
            joinType
        }
    });

    return graph.getNode(nodeId);
}

/**
 * Add a new branch to a fork node
 * Creates an empty node and connects it to the fork
 */
export function addBranch(forkNodeId, targetX, targetY) {
    const forkNode = graph.getNode(forkNodeId);
    if (!forkNode || forkNode.type !== 'fork') return null;

    // Create new empty node for the branch endpoint
    const newNode = graph.addNode('empty', {
        x: targetX,
        y: targetY
    });

    // Connect fork to new node
    const edge = graph.addEdge(forkNodeId, newNode.id);

    return { node: newNode, edge };
}

/**
 * Remove a branch from a fork
 * Removes the edge and optionally the target node if it has no other connections
 */
export function removeBranch(forkNodeId, branchEdgeId) {
    const edge = graph.getEdge(branchEdgeId);
    if (!edge || edge.sourceNodeId !== forkNodeId) return false;

    const targetNode = graph.getNode(edge.targetNodeId);

    // Remove the edge
    graph.removeEdge(branchEdgeId);

    // If target node has no other connections, remove it too
    if (targetNode && targetNode.inEdges.size === 0 && targetNode.outEdges.size === 0) {
        graph.removeNode(targetNode.id);
    }

    return true;
}

/**
 * Merge two paths at a join point
 * Connect a source node to an existing join node
 */
export function connectToJoin(sourceNodeId, joinNodeId) {
    const sourceNode = graph.getNode(sourceNodeId);
    const joinNode = graph.getNode(joinNodeId);

    if (!sourceNode || !joinNode || joinNode.type !== 'join') return null;

    return graph.addEdge(sourceNodeId, joinNodeId);
}

/**
 * Split a path at a point, inserting a fork
 * Takes an existing edge, breaks it, and inserts a fork node
 */
export function insertForkOnPath(edgeId, forkX, forkY, forkType = 'or') {
    const edge = graph.getEdge(edgeId);
    if (!edge) return null;

    const sourceId = edge.sourceNodeId;
    const targetId = edge.targetNodeId;

    // Remove original edge
    graph.removeEdge(edgeId);

    // Create fork node at the specified position
    const forkNode = graph.addNode('fork', {
        x: forkX,
        y: forkY,
        forkType
    });

    // Connect source to fork
    graph.addEdge(sourceId, forkNode.id);

    // Connect fork to original target (first branch)
    graph.addEdge(forkNode.id, targetId);

    return forkNode;
}

/**
 * Insert a join node on a path
 */
export function insertJoinOnPath(edgeId, joinX, joinY, joinType = 'or') {
    const edge = graph.getEdge(edgeId);
    if (!edge) return null;

    const sourceId = edge.sourceNodeId;
    const targetId = edge.targetNodeId;

    // Remove original edge
    graph.removeEdge(edgeId);

    // Create join node
    const joinNode = graph.addNode('join', {
        x: joinX,
        y: joinY,
        joinType
    });

    // Connect source to join
    graph.addEdge(sourceId, joinNode.id);

    // Connect join to target
    graph.addEdge(joinNode.id, targetId);

    return joinNode;
}

/**
 * Get branch information for a fork node
 */
export function getForkBranches(forkNodeId) {
    const forkNode = graph.getNode(forkNodeId);
    if (!forkNode || forkNode.type !== 'fork') return [];

    return [...forkNode.outEdges].map(edgeId => {
        const edge = graph.getEdge(edgeId);
        const targetNode = graph.getNode(edge.targetNodeId);
        return {
            edge,
            targetNode,
            condition: edge.condition
        };
    });
}

/**
 * Get incoming branches for a join node
 */
export function getJoinBranches(joinNodeId) {
    const joinNode = graph.getNode(joinNodeId);
    if (!joinNode || joinNode.type !== 'join') return [];

    return [...joinNode.inEdges].map(edgeId => {
        const edge = graph.getEdge(edgeId);
        const sourceNode = graph.getNode(edge.sourceNodeId);
        return {
            edge,
            sourceNode
        };
    });
}

/**
 * Toggle fork type between OR and AND
 */
export function toggleForkType(forkNodeId) {
    const node = graph.getNode(forkNodeId);
    if (!node || node.type !== 'fork') return null;

    const newType = node.properties.forkType === 'or' ? 'and' : 'or';
    graph.updateNode(forkNodeId, {
        properties: { forkType: newType }
    });

    return graph.getNode(forkNodeId);
}

/**
 * Toggle join type between OR and AND
 */
export function toggleJoinType(joinNodeId) {
    const node = graph.getNode(joinNodeId);
    if (!node || node.type !== 'join') return null;

    const newType = node.properties.joinType === 'or' ? 'and' : 'or';
    graph.updateNode(joinNodeId, {
        properties: { joinType: newType }
    });

    return graph.getNode(joinNodeId);
}
