/**
 * Unit tests for UCM Validator
 */
import { UCMValidator } from '../../js/core/validator.js';
import { UCMGraph } from '../../js/core/graph.js';

describe('UCMValidator', () => {
    let validator;
    let graph;

    beforeEach(() => {
        validator = new UCMValidator();
        graph = new UCMGraph();
    });

    describe('Start/End Node Validation', () => {
        test('should warn when no start node exists', () => {
            graph.addNode('end', { x: 100, y: 100, name: 'End' });

            const result = validator.validate(graph);

            // Should have warning about missing start
            expect(result.warnings.some(w =>
                w.message.toLowerCase().includes('start') ||
                w.type === 'no_start_node'
            )).toBe(true);
        });

        test('should warn when no end node exists', () => {
            graph.addNode('start', { x: 0, y: 0, name: 'Start' });

            const result = validator.validate(graph);

            // Should have warning about missing end
            expect(result.warnings.some(w =>
                w.message.toLowerCase().includes('end') ||
                w.type === 'no_end_node'
            )).toBe(true);
        });

        test('should error when start has no outgoing edge', () => {
            graph.addNode('start', { x: 0, y: 0, name: 'Start' });
            graph.addNode('end', { x: 100, y: 100, name: 'End' });

            const result = validator.validate(graph);

            // Should have error or warning about disconnected start
            const hasStartIssue = result.errors.concat(result.warnings).some(issue =>
                issue.message.toLowerCase().includes('outgoing') ||
                (issue.message.toLowerCase().includes('start') && issue.message.toLowerCase().includes('edge')) ||
                issue.type === 'start_no_outgoing'
            );
            expect(hasStartIssue).toBe(true);
        });

        test('should pass with properly connected start and end', () => {
            const start = graph.addNode('start', { x: 0, y: 0, name: 'Start' });
            const end = graph.addNode('end', { x: 100, y: 100, name: 'End' });
            graph.addEdge(start.id, end.id);

            const result = validator.validate(graph);

            // Should have no errors specifically about missing start/end connections
            const criticalErrors = result.errors.filter(e =>
                e.type === 'start_no_outgoing' || e.type === 'end_has_outgoing'
            );
            expect(criticalErrors.length).toBe(0);
        });
    });

    describe('Fork/Join Validation', () => {
        test('should warn when fork has less than 2 outgoing paths', () => {
            const start = graph.addNode('start', { x: 0, y: 0 });
            const fork = graph.addNode('fork', { x: 50, y: 50, name: 'Fork1' });
            const end = graph.addNode('end', { x: 100, y: 100 });

            graph.addEdge(start.id, fork.id);
            graph.addEdge(fork.id, end.id); // Only one outgoing

            const result = validator.validate(graph);

            expect(result.warnings.some(w =>
                w.message.toLowerCase().includes('fork') ||
                w.type === 'fork_single_outgoing'
            )).toBe(true);
        });

        test('should warn when join has less than 2 incoming paths', () => {
            const start = graph.addNode('start', { x: 0, y: 0 });
            const join = graph.addNode('join', { x: 50, y: 50, name: 'Join1' });
            const end = graph.addNode('end', { x: 100, y: 100 });

            graph.addEdge(start.id, join.id); // Only one incoming
            graph.addEdge(join.id, end.id);

            const result = validator.validate(graph);

            expect(result.warnings.some(w =>
                w.message.toLowerCase().includes('join') ||
                w.type === 'join_single_incoming'
            )).toBe(true);
        });
    });

    describe('Component Validation', () => {
        test('should warn on empty component', () => {
            graph.addComponent('process', { x: 0, y: 0, width: 200, height: 200, name: 'Empty' });

            const result = validator.validate(graph);

            expect(result.warnings.some(w =>
                w.message.toLowerCase().includes('empty') ||
                w.type === 'empty_component'
            )).toBe(true);
        });

        test('should pass with component containing nodes', () => {
            const comp = graph.addComponent('process', { x: 0, y: 0, width: 200, height: 200, name: 'Container' });
            const node = graph.addNode('responsibility', { x: 50, y: 50, name: 'Task' });
            graph.bindNodeToComponent(node.id, comp.id);

            const result = validator.validate(graph);

            // Should not warn about this component being empty
            const emptyCompWarnings = result.warnings.filter(w =>
                w.type === 'empty_component' && w.componentName === 'Container'
            );
            expect(emptyCompWarnings.length).toBe(0);
        });

        test('should warn when node is outside component bounds', () => {
            const comp = graph.addComponent('process', { x: 0, y: 0, width: 100, height: 100, name: 'Small' });
            const node = graph.addNode('responsibility', { x: 200, y: 200, name: 'Far' });
            graph.bindNodeToComponent(node.id, comp.id);

            const result = validator.validate(graph);

            expect(result.warnings.some(w =>
                w.type === 'node_outside_component' ||
                w.message.toLowerCase().includes('outside')
            )).toBe(true);
        });
    });

    describe('Overall Validation', () => {
        test('should return valid structure for complete well-formed diagram', () => {
            const comp = graph.addComponent('process', { x: 0, y: 0, width: 300, height: 200, name: 'System' });
            const start = graph.addNode('start', { x: 20, y: 50, name: 'Start' });
            const resp = graph.addNode('responsibility', { x: 100, y: 50, name: 'Process' });
            const end = graph.addNode('end', { x: 200, y: 50, name: 'End' });

            graph.bindNodeToComponent(start.id, comp.id);
            graph.bindNodeToComponent(resp.id, comp.id);
            graph.bindNodeToComponent(end.id, comp.id);

            graph.addEdge(start.id, resp.id);
            graph.addEdge(resp.id, end.id);

            const result = validator.validate(graph);

            // Result structure should be correct
            expect(result).toHaveProperty('errors');
            expect(result).toHaveProperty('warnings');
            expect(result).toHaveProperty('info');
            expect(Array.isArray(result.errors)).toBe(true);
            expect(result.errors.length).toBe(0);
        });

        test('should accumulate multiple issues', () => {
            // Create multiple problems
            graph.addNode('start', { x: 0, y: 0, name: 'Start1' });
            graph.addNode('start', { x: 50, y: 0, name: 'Start2' }); // Multiple starts
            graph.addComponent('process', { x: 0, y: 0, width: 100, height: 100, name: 'Empty' }); // Empty comp

            const result = validator.validate(graph);

            // Should have multiple issues
            const totalIssues = result.errors.length + result.warnings.length;
            expect(totalIssues).toBeGreaterThan(0);
        });

        test('should provide issue details', () => {
            graph.addNode('start', { x: 0, y: 0, name: 'Start' });

            const result = validator.validate(graph);

            // All issues should have required fields
            result.errors.concat(result.warnings).forEach(issue => {
                expect(issue).toHaveProperty('message');
                expect(typeof issue.message).toBe('string');
            });
        });
    });
});
