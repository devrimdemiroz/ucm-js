/**
 * UCM Serializer - Converts Graph to DSL Text
 * Format v3: Human & Regex Friendly
 */

const quote = (str) => {
    // If string has spaces or special chars, quote it
    if (!str) return '""';
    if (/[\s(){},]/.test(str)) {
        return `"${str}"`;
    }
    return str;
};

export const serializer = {
    serialize(graph) {
        // 1. Definition
        let lines = ['ucm "Untitled"'];
        lines.push('');

        const nodesInComponents = new Set();
        const nodeIdToName = new Map();

        // Map IDs to Names for linking
        graph.getAllNodes().forEach(node => {
            nodeIdToName.set(node.id, node.properties.name || node.id);
        });

        // 2. Components and their children
        const rootComponents = graph.getRootComponents ? graph.getRootComponents() :
            graph.getAllComponents().filter(c => !c.parentComponent);

        const serializeComponent = (comp, depth = 0) => {
            const indent = '  '.repeat(depth);
            const childIndent = '  '.repeat(depth + 1);

            const name = quote(comp.properties.name);
            const x = Math.round(comp.bounds.x);
            const y = Math.round(comp.bounds.y);
            const w = Math.round(comp.bounds.width);
            const h = Math.round(comp.bounds.height);

            lines.push(`${indent}component ${name} type ${comp.type} at (${x}, ${y}) size (${w}, ${h}) {`);

            // Serialize child nodes
            // Note: In this graph model, nodes are bound to components.
            if (comp.childNodes && comp.childNodes.size > 0) {
                comp.childNodes.forEach(nodeId => {
                    const node = graph.getNode(nodeId);
                    if (node) {
                        nodesInComponents.add(nodeId);
                        const nName = quote(node.properties.name);
                        const nx = Math.round(node.position.x);
                        const ny = Math.round(node.position.y);
                        lines.push(`${childIndent}${node.type} ${nName} at (${nx}, ${ny})`);
                    }
                });
            }

            // Serialize nested components (recursive with proper indentation)
            if (comp.childComponents && comp.childComponents.size > 0) {
                comp.childComponents.forEach(childId => {
                    const childComp = graph.getComponent(childId);
                    if (childComp) {
                        serializeComponent(childComp, depth + 1);
                    }
                });
            }

            lines.push(`${indent}}`);
            if (depth === 0) {
                lines.push('');
            }
        };

        rootComponents.forEach(c => serializeComponent(c, 0));

        // 3. Standalone Nodes
        const allNodes = graph.getAllNodes();
        const standaloneNodes = allNodes.filter(n => !nodesInComponents.has(n.id));

        if (standaloneNodes.length > 0) {
            standaloneNodes.forEach(node => {
                const nName = quote(node.properties.name);
                const nx = Math.round(node.position.x);
                const ny = Math.round(node.position.y);
                lines.push(`${node.type} ${nName} at (${nx}, ${ny})`);
            });
            lines.push('');
        }

        // 4. Links
        const edges = graph.getAllEdges();
        if (edges.length > 0) {
            edges.forEach(edge => {
                const srcName = quote(nodeIdToName.get(edge.sourceNodeId) || edge.sourceNodeId);
                const tgtName = quote(nodeIdToName.get(edge.targetNodeId) || edge.targetNodeId);
                lines.push(`link ${srcName} -> ${tgtName}`);
            });
        }

        return lines.join('\n').trim();
    }
};
