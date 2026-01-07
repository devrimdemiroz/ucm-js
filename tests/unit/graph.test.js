import { UCMGraph } from '../../js/core/graph.js';

describe('UCMGraph Core', () => {
    let graph;

    beforeEach(() => {
        graph = new UCMGraph();
    });

    test('should add and retrieve a node', () => {
        const node = graph.addNode('start', { x: 10, y: 10 });
        expect(node.id).toBeDefined();
        expect(graph.getNode(node.id)).toBe(node);
        expect(graph.nodes.size).toBe(1);
    });

    test('should connect nodes with an edge', () => {
        const n1 = graph.addNode('start', { x: 0, y: 0 });
        const n2 = graph.addNode('end', { x: 100, y: 0 });
        const edge = graph.addEdge(n1.id, n2.id);

        expect(edge).toBeDefined();
        expect(n1.outEdges).toContain(edge.id);
        expect(n2.inEdges).toContain(edge.id);
    });

    test('should add component and bind node', () => {
        const comp = graph.addComponent('process', { x: 0, y: 0, width: 200, height: 200 });
        const node = graph.addNode('responsibility', { x: 50, y: 50 });

        graph.bindNodeToComponent(node.id, comp.id);

        expect(node.parentComponent).toBe(comp.id);
        expect(node.parentComponent).toBe(comp.id);
        expect(comp.childNodes.has(node.id)).toBe(true);
    });
});
