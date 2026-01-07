import { parser } from '../../js/core/parser.js';
import { UCMGraph } from '../../js/core/graph.js';

describe('DSL Parser', () => {
    let graph;

    beforeEach(() => {
        graph = new UCMGraph();
    });

    test('should parse basic node types', () => {
        const dsl = `
            ucm "Test"
            start "StartPoint" at (10, 10)
            end "EndPoint" at (100, 100)
            responsibility "Resp" at (50, 50)
        `;
        const result = parser.parse(dsl, graph);
        expect(result.success).toBe(true);
        expect(graph.nodes.size).toBe(3);
    });

    test('should parse timer node', () => {
        const dsl = `
            timer "MyTimer" at (50, 50)
        `;
        const result = parser.parse(dsl, graph);
        expect(result.success).toBe(true);

        const nodes = Array.from(graph.nodes.values());
        expect(nodes.length).toBe(1);
        expect(nodes[0].type).toBe('timer');
        expect(nodes[0].properties.name).toBe('MyTimer');
    });

    test('should parse component binding', () => {
        const dsl = `
            component "Comp1" type process at (0, 0) size (200, 200) {
                timer "InnerTimer" at (50, 50)
            }
        `;
        const result = parser.parse(dsl, graph);
        expect(result.success).toBe(true);

        const comp = Array.from(graph.components.values())[0];
        const node = Array.from(graph.nodes.values())[0];

        expect(comp).toBeDefined();
        expect(node).toBeDefined();
        expect(node.parentComponent).toBe(comp.id);
        expect(comp.childNodes.has(node.id)).toBe(true);
    });
});
