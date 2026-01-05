
import { UCMGraph } from '../../js/core/graph.js';
import { parser } from '../../js/core/parser.js';
import { serializer } from '../../js/core/serializer.js';
import { validator } from '../../js/core/validator.js';

// Simple Test Runner
const tests = [];
let passed = 0;
let failed = 0;

function describe(name, fn) {
    console.log(`\n📦 ${name}`);
    fn();
}

function it(name, fn) {
    tests.push({ name, fn });
}

async function run() {
    for (const test of tests) {
        try {
            await test.fn();
            console.log(`  ✅ ${test.name}`);
            passed++;
        } catch (e) {
            console.error(`  ❌ ${test.name}`);
            console.error(`     Error: ${e.message}`);
            failed++;
        }
    }
    console.log(`\nSummary: ${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
}

function expect(actual) {
    return {
        toBe: (expected) => {
            if (actual !== expected) throw new Error(`Expected ${expected} but got ${actual}`);
        },
        toBeTruthy: () => {
            if (!actual) throw new Error(`Expected truthy but got ${actual}`);
        },
        toBeFalsy: () => {
            if (actual) throw new Error(`Expected falsy but got ${actual}`);
        },
        toContain: (item) => {
            if (Array.isArray(actual)) {
                if (!actual.includes(item)) throw new Error(`Expected array to contain ${item}`);
            } else if (typeof actual === 'string') {
                if (!actual.includes(item)) throw new Error(`Expected string to contain "${item}"`);
            } else {
                throw new Error('toContain only works with arrays and strings');
            }
        },
        toEqual: (expected) => {
            const actualStr = JSON.stringify(actual);
            const expectedStr = JSON.stringify(expected);
            if (actualStr !== expectedStr) throw new Error(`Expected ${expectedStr} but got ${actualStr}`);
        },
        toBeGreaterThan: (val) => {
            if (actual <= val) throw new Error(`Expected ${actual} to be greater than ${val}`);
        },
        toHaveLength: (len) => {
            if (actual.length !== len) throw new Error(`Expected length ${len} but got ${actual.length}`);
        }
    };
}

// ==========================================
// TESTS
// ==========================================

describe('Serializer (P1.2)', () => {
    it('should correctly indent nested components', () => {
        const graph = new UCMGraph();
        // Create root component
        const parent = graph.addComponent('team', { name: 'Parent', x: 0, y: 0, width: 800, height: 600 });

        // Create child component
        const child = graph.addComponent('system', { name: 'Child', x: 100, y: 100, width: 400, height: 300 });

        // Bind child to parent
        graph.bindComponentToComponent(child.id, parent.id);

        // Create node inside child
        const node = graph.addNode('start', { name: 'StartNode', x: 150, y: 150 });
        graph.bindNodeToComponent(node.id, child.id);

        const dsl = serializer.serialize(graph);

        // Check indentation
        const lines = dsl.split('\n');

        // Parent should start with "component" (0 indent)
        // Note: Name might not be quoted if simple
        const parentLine = lines.find(l => l.includes('component Parent') || l.includes('component "Parent"'));
        if (!parentLine) {
            console.log('--- DSL START ---');
            console.log(dsl);
            console.log('--- DSL END ---');
            throw new Error('Parent line not found in DSL output');
        }
        expect(parentLine.trim().startsWith('component')).toBe(true);

        // Child should have 2 spaces indentation
        const childLine = lines.find(l => l.includes('component Child') || l.includes('component "Child"'));
        if (!childLine) throw new Error('Child line not found');
        expect(childLine.startsWith('  component')).toBe(true);

        // Node should have 4 spaces indentation
        const nodeLine = lines.find(l => l.includes('start StartNode') || l.includes('start "StartNode"'));
        if (!nodeLine) throw new Error('Node line not found');
        expect(nodeLine.startsWith('    start')).toBe(true);
    });
});

describe('Parser (P1.3)', () => {
    it('should validate coordinates', () => {
        const graph = new UCMGraph();
        // Invalid negative coordinates
        const dsl = `
            ucm "Test"
            start "A" at (-100, 50)
        `;
        const result = parser.parse(dsl, graph);
        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0].message).toContain('negative coordinates');
    });

    it('should detect duplicate names', () => {
        const graph = new UCMGraph();
        const dsl = `
            ucm "Test"
            start "A" at (100, 100)
            end "A" at (200, 200)
        `;
        const result = parser.parse(dsl, graph);
        // It's a warning, not error
        expect(result.success).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings[0].message).toContain('Duplicate node name');
    });
});

describe('Validator (P2.2)', () => {
    it('should detect missing start/end nodes', () => {
        const graph = new UCMGraph();
        const issues = validator.validate(graph);

        const hasMissingStart = issues.warnings.some(w => w.type === 'missing_start');
        const hasMissingEnd = issues.warnings.some(w => w.type === 'missing_end');

        expect(hasMissingStart).toBe(true);
        expect(hasMissingEnd).toBe(true);
    });

    it('should detect isolated nodes', () => {
        const graph = new UCMGraph();
        graph.addNode('responsibility', { name: 'Lonely', x: 100, y: 100 });
        // Add start/end to avoid those warnings masking inspection
        graph.addNode('start', { name: 'S', x: 0, y: 0 });
        graph.addNode('end', { name: 'E', x: 200, y: 0 });

        const issues = validator.validate(graph);
        const orphanWarning = issues.warnings.find(w => w.type === 'completely_disconnected');
        expect(!!orphanWarning).toBe(true);
    });

    it('should detect start node with multiple outputs', () => {
        const graph = new UCMGraph();
        const s = graph.addNode('start', { name: 'S', x: 0, y: 0 });
        const r1 = graph.addNode('responsibility', { name: 'R1', x: 100, y: 0 });
        const r2 = graph.addNode('responsibility', { name: 'R2', x: 100, y: 100 });

        graph.addEdge(s.id, r1.id);

        // Manually inject invalid state (as addEdge prevents it)
        const edgeId = 'force_edge_2';
        const edge = {
            id: edgeId,
            sourceNodeId: s.id,
            targetNodeId: r2.id,
            properties: {}
        };
        graph.edges.set(edgeId, edge);
        s.outEdges.add(edgeId);
        r2.inEdges.add(edgeId);

        const issues = validator.validate(graph);
        const error = issues.errors.find(e => e.type === 'start_multiple_outputs');
        expect(!!error).toBe(true);
    });
});

describe('Graph Core', () => {
    it('should emit events on changes', () => {
        const graph = new UCMGraph();
        let callCount = 0;
        graph.on('node:added', () => callCount++);

        graph.addNode('start', { x: 0, y: 0 });
        expect(callCount).toBe(1);
    });

    it('should handle component nesting', () => {
        const graph = new UCMGraph();
        const p = graph.addComponent('team', { name: 'P' });
        const c = graph.addComponent('system', { name: 'C' });

        const result = graph.bindComponentToComponent(c.id, p.id);
        expect(result).toBe(true);
        expect(p.childComponents.has(c.id)).toBe(true);
        expect(c.parentComponent).toBe(p.id);
    });

    it('should prevent circular nesting', () => {
        const graph = new UCMGraph();
        const a = graph.addComponent('team', { name: 'A' });
        const b = graph.addComponent('system', { name: 'B' });

        graph.bindComponentToComponent(b.id, a.id);
        const result = graph.bindComponentToComponent(a.id, b.id); // Should fail
        expect(result).toBe(false);
    });
});

run();
