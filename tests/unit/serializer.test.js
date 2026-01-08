/**
 * Unit tests for DSL Serializer
 */
import { serializer } from '../../js/core/serializer.js';
import { UCMGraph } from '../../js/core/graph.js';

describe('DSL Serializer', () => {
    let graph;

    beforeEach(() => {
        graph = new UCMGraph();
    });

    test('should serialize empty graph', () => {
        const dsl = serializer.serialize(graph);
        expect(dsl).toContain('ucm');
        expect(dsl).toBeDefined();
    });

    test('should serialize basic node types', () => {
        // Note: addNode takes (type, {x, y, name, ...}) - position and props together
        graph.addNode('start', { x: 10, y: 20, name: 'Begin' });
        graph.addNode('end', { x: 100, y: 200, name: 'Finish' });
        graph.addNode('responsibility', { x: 50, y: 100, name: 'Process' });

        const dsl = serializer.serialize(graph);

        // Check for node types and positions
        expect(dsl).toContain('start');
        expect(dsl).toContain('end');
        expect(dsl).toContain('responsibility');
        expect(dsl).toContain('Begin');
        expect(dsl).toContain('Finish');
        expect(dsl).toContain('Process');
        expect(dsl).toContain('at (10, 20)');
        expect(dsl).toContain('at (100, 200)');
    });

    test('should serialize timer node', () => {
        graph.addNode('timer', { x: 50, y: 50, name: 'Timeout' });

        const dsl = serializer.serialize(graph);

        expect(dsl).toContain('timer');
        expect(dsl).toContain('Timeout');
        expect(dsl).toContain('at (50, 50)');
    });

    test('should serialize component', () => {
        graph.addComponent('process', { x: 0, y: 0, width: 300, height: 200, name: 'MyComponent' });

        const dsl = serializer.serialize(graph);

        expect(dsl).toContain('component');
        expect(dsl).toContain('MyComponent');
        expect(dsl).toContain('type process');
        expect(dsl).toContain('at (0, 0)');
        expect(dsl).toContain('size (300, 200)');
    });

    test('should serialize component with bound nodes', () => {
        const comp = graph.addComponent('process', { x: 0, y: 0, width: 300, height: 200, name: 'Container' });
        const node = graph.addNode('responsibility', { x: 50, y: 50, name: 'Task' });
        graph.bindNodeToComponent(node.id, comp.id);

        const dsl = serializer.serialize(graph);

        // Node should be inside component block
        expect(dsl).toContain('component');
        expect(dsl).toContain('Container');
        expect(dsl).toContain('responsibility');
        expect(dsl).toContain('Task');
    });

    test('should properly indent nested components', () => {
        const parent = graph.addComponent('team', { x: 0, y: 0, width: 500, height: 400, name: 'Parent' });
        const child = graph.addComponent('process', { x: 50, y: 50, width: 200, height: 150, name: 'Child' });
        graph.bindComponentToComponent(child.id, parent.id);

        const dsl = serializer.serialize(graph);
        const lines = dsl.split('\n');

        // Find the child component line and verify indentation
        const childLine = lines.find(line => line.includes('Child'));
        expect(childLine).toBeDefined();
        // Child should have deeper indentation than parent (parent has no indent)
        const parentLine = lines.find(line => line.includes('Parent'));
        expect(parentLine).toBeDefined();

        // Get leading whitespace length
        const parentIndent = parentLine.match(/^\s*/)[0].length;
        const childIndent = childLine.match(/^\s*/)[0].length;
        expect(childIndent).toBeGreaterThan(parentIndent);
    });

    test('should serialize edges as links', () => {
        const start = graph.addNode('start', { x: 0, y: 0, name: 'A' });
        const resp = graph.addNode('responsibility', { x: 100, y: 0, name: 'B' });
        const end = graph.addNode('end', { x: 200, y: 0, name: 'C' });

        graph.addEdge(start.id, resp.id);
        graph.addEdge(resp.id, end.id);

        const dsl = serializer.serialize(graph);

        // Should have link definitions
        expect(dsl).toContain('link');
        expect(dsl).toContain('A');
        expect(dsl).toContain('B');
        expect(dsl).toContain('C');
        expect(dsl).toContain('->');
    });

    test('should output valid DSL structure', () => {
        // Create a graph
        const start = graph.addNode('start', { x: 10, y: 10, name: 'Begin' });
        const resp = graph.addNode('responsibility', { x: 50, y: 50, name: 'Work' });
        const end = graph.addNode('end', { x: 100, y: 100, name: 'End' });
        graph.addEdge(start.id, resp.id);
        graph.addEdge(resp.id, end.id);

        // Serialize
        const dsl = serializer.serialize(graph);

        // Verify structure
        expect(dsl).toContain('ucm');
        expect(dsl).toContain('start');
        expect(dsl).toContain('responsibility');
        expect(dsl).toContain('end');
        expect(dsl).toContain('link');
    });

    test('should handle names with spaces via quoting', () => {
        graph.addNode('responsibility', { x: 50, y: 50, name: 'My Task Name' });

        const dsl = serializer.serialize(graph);

        // Names with spaces should be quoted
        expect(dsl).toContain('"My Task Name"');
    });

    test('should output coordinates as integers', () => {
        graph.addNode('responsibility', { x: 50.7, y: 100.3, name: 'Node' });

        const dsl = serializer.serialize(graph);

        // Coordinates should be rounded to integers
        expect(dsl).toContain('at (51, 100)');
    });
});
