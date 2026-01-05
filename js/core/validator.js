/**
 * UCM Graph Validator
 * Validates UCM structural constraints and best practices
 */

export class UCMValidator {
    constructor() {
        this.issues = {
            errors: [],
            warnings: [],
            info: []
        };
    }

    /**
     * Validate the entire graph
     * @param {UCMGraph} graph - The graph to validate
     * @returns {Object} { valid: boolean, errors: [], warnings: [], info: [] }
     */
    validate(graph) {
        // Reset issues
        this.issues = {
            errors: [],
            warnings: [],
            info: []
        };

        // Run all validation checks
        this.validateStartEndNodes(graph);
        this.validateForkJoinPairs(graph);
        this.validateConnectivity(graph);
        this.validateComponents(graph);
        this.validateEdgeConstraints(graph);
        this.validateOrphanedNodes(graph);

        return {
            valid: this.issues.errors.length === 0,
            ...this.issues
        };
    }

    /**
     * Validate start and end nodes
     */
    validateStartEndNodes(graph) {
        const nodes = graph.getAllNodes();
        const startNodes = nodes.filter(n => n.type === 'start');
        const endNodes = nodes.filter(n => n.type === 'end');

        // Check for start nodes
        if (startNodes.length === 0) {
            this.issues.warnings.push({
                type: 'missing_start',
                message: 'Diagram has no start point',
                suggestion: 'Add at least one start node to indicate the beginning of the use case'
            });
        }

        // Check for end nodes
        if (endNodes.length === 0) {
            this.issues.warnings.push({
                type: 'missing_end',
                message: 'Diagram has no end point',
                suggestion: 'Add at least one end node to indicate completion'
            });
        }

        // Validate start node constraints
        startNodes.forEach(node => {
            const outEdges = Array.from(node.outEdges || []);

            if (outEdges.length === 0) {
                this.issues.errors.push({
                    type: 'start_no_output',
                    nodeId: node.id,
                    nodeName: node.properties.name,
                    message: `Start node "${node.properties.name}" has no outgoing path`,
                    suggestion: 'Connect this start node to a responsibility or other element'
                });
            } else if (outEdges.length > 1) {
                this.issues.errors.push({
                    type: 'start_multiple_outputs',
                    nodeId: node.id,
                    nodeName: node.properties.name,
                    message: `Start node "${node.properties.name}" has ${outEdges.length} outgoing paths (maximum 1 allowed)`,
                    suggestion: 'Start nodes should have exactly one outgoing path'
                });
            }
        });

        // Validate end node constraints
        endNodes.forEach(node => {
            const inEdges = Array.from(node.inEdges || []);
            const outEdges = Array.from(node.outEdges || []);

            if (inEdges.length === 0) {
                this.issues.errors.push({
                    type: 'end_no_input',
                    nodeId: node.id,
                    nodeName: node.properties.name,
                    message: `End node "${node.properties.name}" has no incoming path`,
                    suggestion: 'Connect a responsibility or other element to this end node'
                });
            } else if (inEdges.length > 1) {
                this.issues.warnings.push({
                    type: 'end_multiple_inputs',
                    nodeId: node.id,
                    nodeName: node.properties.name,
                    message: `End node "${node.properties.name}" has ${inEdges.length} incoming paths`,
                    suggestion: 'Consider using a join before this end node'
                });
            }

            if (outEdges.length > 0) {
                this.issues.errors.push({
                    type: 'end_has_output',
                    nodeId: node.id,
                    nodeName: node.properties.name,
                    message: `End node "${node.properties.name}" has outgoing paths (not allowed)`,
                    suggestion: 'End nodes should have no outgoing paths'
                });
            }
        });
    }

    /**
     * Validate fork/join pairing
     */
    validateForkJoinPairs(graph) {
        const nodes = graph.getAllNodes();
        const forks = nodes.filter(n => n.type === 'fork');
        const joins = nodes.filter(n => n.type === 'join');

        // Check for unpaired forks
        if (forks.length > joins.length) {
            this.issues.warnings.push({
                type: 'unpaired_forks',
                message: `${forks.length} fork(s) but only ${joins.length} join(s)`,
                suggestion: 'Each fork should typically have a corresponding join'
            });
        }

        // Check for unpaired joins
        if (joins.length > forks.length) {
            this.issues.warnings.push({
                type: 'unpaired_joins',
                message: `${joins.length} join(s) but only ${forks.length} fork(s)`,
                suggestion: 'Each join should typically correspond to a fork'
            });
        }

        // Validate individual forks
        forks.forEach(fork => {
            const outEdges = Array.from(fork.outEdges || []);

            if (outEdges.length < 2) {
                this.issues.warnings.push({
                    type: 'fork_insufficient_branches',
                    nodeId: fork.id,
                    nodeName: fork.properties.name,
                    message: `Fork "${fork.properties.name}" has only ${outEdges.length} outgoing path(s)`,
                    suggestion: 'Forks should have at least 2 outgoing paths'
                });
            }

            if (outEdges.length > 10) {
                this.issues.warnings.push({
                    type: 'fork_too_many_branches',
                    nodeId: fork.id,
                    nodeName: fork.properties.name,
                    message: `Fork "${fork.properties.name}" has ${outEdges.length} outgoing paths`,
                    suggestion: 'Consider simplifying or breaking down this parallel structure'
                });
            }
        });

        // Validate individual joins
        joins.forEach(join => {
            const inEdges = Array.from(join.inEdges || []);

            if (inEdges.length < 2) {
                this.issues.warnings.push({
                    type: 'join_insufficient_inputs',
                    nodeId: join.id,
                    nodeName: join.properties.name,
                    message: `Join "${join.properties.name}" has only ${inEdges.length} incoming path(s)`,
                    suggestion: 'Joins should have at least 2 incoming paths'
                });
            }
        });
    }

    /**
     * Validate connectivity (reachability from start to end)
     */
    validateConnectivity(graph) {
        const nodes = graph.getAllNodes();
        const startNodes = nodes.filter(n => n.type === 'start');

        if (startNodes.length === 0) return; // Already warned about missing start

        // Find all nodes reachable from start nodes
        const reachable = new Set();
        const toVisit = [...startNodes];

        while (toVisit.length > 0) {
            const current = toVisit.pop();
            if (reachable.has(current.id)) continue;

            reachable.add(current.id);

            const outEdges = Array.from(current.outEdges || []);
            outEdges.forEach(edgeId => {
                const edge = graph.getEdge(edgeId);
                if (edge) {
                    const targetNode = graph.getNode(edge.targetNodeId);
                    if (targetNode && !reachable.has(targetNode.id)) {
                        toVisit.push(targetNode);
                    }
                }
            });
        }

        // Find orphaned nodes (not reachable from start)
        const orphanedNodes = nodes.filter(n =>
            n.type !== 'start' && !reachable.has(n.id)
        );

        orphanedNodes.forEach(node => {
            this.issues.warnings.push({
                type: 'orphaned_node',
                nodeId: node.id,
                nodeName: node.properties.name,
                message: `Node "${node.properties.name}" is not reachable from any start point`,
                suggestion: 'Connect this node to the main scenario path or remove it'
            });
        });
    }

    /**
     * Validate component containment
     */
    validateComponents(graph) {
        const components = graph.getAllComponents();

        components.forEach(comp => {
            // Check for empty components
            const childNodes = comp.childNodes ? Array.from(comp.childNodes) : [];
            const childComps = comp.childComponents ? Array.from(comp.childComponents) : [];

            if (childNodes.length === 0 && childComps.length === 0) {
                this.issues.warnings.push({
                    type: 'empty_component',
                    componentId: comp.id,
                    componentName: comp.properties.name,
                    message: `Component "${comp.properties.name}" is empty`,
                    suggestion: 'Add responsibilities or nested components, or remove this component'
                });
            }

            // Validate child nodes are within bounds (basic check)
            childNodes.forEach(nodeId => {
                const node = graph.getNode(nodeId);
                if (!node) return;

                const outOfBounds =
                    node.position.x < comp.bounds.x ||
                    node.position.y < comp.bounds.y ||
                    node.position.x > comp.bounds.x + comp.bounds.width ||
                    node.position.y > comp.bounds.y + comp.bounds.height;

                if (outOfBounds) {
                    this.issues.warnings.push({
                        type: 'node_outside_component',
                        nodeId: node.id,
                        nodeName: node.properties.name,
                        componentName: comp.properties.name,
                        message: `Node "${node.properties.name}" is outside component "${comp.properties.name}" bounds`,
                        suggestion: 'Resize the component or move the node within bounds'
                    });
                }
            });
        });

        // Check for circular component nesting
        this.validateCircularNesting(graph);
    }

    /**
     * Check for circular component nesting
     */
    validateCircularNesting(graph) {
        const components = graph.getAllComponents();

        const isCircular = (compId, visited = new Set()) => {
            if (visited.has(compId)) return true;
            visited.add(compId);

            const comp = graph.getComponent(compId);
            if (!comp || !comp.childComponents) return false;

            for (const childId of comp.childComponents) {
                if (isCircular(childId, new Set(visited))) {
                    return true;
                }
            }

            return false;
        };

        components.forEach(comp => {
            if (isCircular(comp.id)) {
                this.issues.errors.push({
                    type: 'circular_nesting',
                    componentId: comp.id,
                    componentName: comp.properties.name,
                    message: `Component "${comp.properties.name}" has circular nesting`,
                    suggestion: 'Remove circular parent-child relationships'
                });
            }
        });
    }

    /**
     * Validate edge constraints
     */
    validateEdgeConstraints(graph) {
        const edges = graph.getAllEdges();

        edges.forEach(edge => {
            const sourceNode = graph.getNode(edge.sourceNodeId);
            const targetNode = graph.getNode(edge.targetNodeId);

            if (!sourceNode) {
                this.issues.errors.push({
                    type: 'edge_invalid_source',
                    edgeId: edge.id,
                    message: `Edge has invalid source node ID: ${edge.sourceNodeId}`,
                    suggestion: 'Remove this edge or fix the source node reference'
                });
            }

            if (!targetNode) {
                this.issues.errors.push({
                    type: 'edge_invalid_target',
                    edgeId: edge.id,
                    message: `Edge has invalid target node ID: ${edge.targetNodeId}`,
                    suggestion: 'Remove this edge or fix the target node reference'
                });
            }

            // Check for self-loops
            if (sourceNode && targetNode && edge.sourceNodeId === edge.targetNodeId) {
                this.issues.warnings.push({
                    type: 'self_loop',
                    edgeId: edge.id,
                    nodeId: sourceNode.id,
                    nodeName: sourceNode.properties.name,
                    message: `Node "${sourceNode.properties.name}" has a self-loop`,
                    suggestion: 'Self-loops are unusual in UCM diagrams'
                });
            }
        });
    }

    /**
     * Validate orphaned nodes (no connections)
     */
    validateOrphanedNodes(graph) {
        const nodes = graph.getAllNodes();

        nodes.forEach(node => {
            const inEdges = Array.from(node.inEdges || []);
            const outEdges = Array.from(node.outEdges || []);

            // Skip start and end nodes (already validated separately)
            if (node.type === 'start' || node.type === 'end') return;

            if (inEdges.length === 0 && outEdges.length === 0) {
                this.issues.warnings.push({
                    type: 'completely_disconnected',
                    nodeId: node.id,
                    nodeName: node.properties.name,
                    message: `Node "${node.properties.name}" has no connections`,
                    suggestion: 'Connect this node to the scenario path or remove it'
                });
            } else if (node.type === 'responsibility' && inEdges.length === 0) {
                this.issues.warnings.push({
                    type: 'responsibility_no_input',
                    nodeId: node.id,
                    nodeName: node.properties.name,
                    message: `Responsibility "${node.properties.name}" has no incoming path`,
                    suggestion: 'Connect a path leading to this responsibility'
                });
            } else if (node.type === 'responsibility' && outEdges.length === 0) {
                this.issues.warnings.push({
                    type: 'responsibility_no_output',
                    nodeId: node.id,
                    nodeName: node.properties.name,
                    message: `Responsibility "${node.properties.name}" has no outgoing path`,
                    suggestion: 'Connect this responsibility to the next element or an end point'
                });
            }
        });
    }

    /**
     * Generate a human-readable report
     */
    generateReport(validationResult) {
        const lines = [];

        lines.push('='.repeat(60));
        lines.push('UCM DIAGRAM VALIDATION REPORT');
        lines.push('='.repeat(60));
        lines.push('');

        // Summary
        const status = validationResult.valid ? '✅ VALID' : '❌ INVALID';
        lines.push(`Status: ${status}`);
        lines.push(`Errors: ${validationResult.errors.length}`);
        lines.push(`Warnings: ${validationResult.warnings.length}`);
        lines.push(`Info: ${validationResult.info.length}`);
        lines.push('');

        // Errors
        if (validationResult.errors.length > 0) {
            lines.push('ERRORS:');
            lines.push('-'.repeat(60));
            validationResult.errors.forEach((error, i) => {
                lines.push(`${i + 1}. ${error.message}`);
                if (error.suggestion) {
                    lines.push(`   → ${error.suggestion}`);
                }
                lines.push('');
            });
        }

        // Warnings
        if (validationResult.warnings.length > 0) {
            lines.push('WARNINGS:');
            lines.push('-'.repeat(60));
            validationResult.warnings.forEach((warning, i) => {
                lines.push(`${i + 1}. ${warning.message}`);
                if (warning.suggestion) {
                    lines.push(`   → ${warning.suggestion}`);
                }
                lines.push('');
            });
        }

        // Info
        if (validationResult.info.length > 0) {
            lines.push('INFORMATION:');
            lines.push('-'.repeat(60));
            validationResult.info.forEach((info, i) => {
                lines.push(`${i + 1}. ${info.message}`);
                lines.push('');
            });
        }

        if (validationResult.valid) {
            lines.push('='.repeat(60));
            lines.push('✅ Diagram structure is valid!');
            lines.push('='.repeat(60));
        }

        return lines.join('\n');
    }
}

export const validator = new UCMValidator();
