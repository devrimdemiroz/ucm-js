/**
 * UCM Editor Performance Benchmarks
 *
 * Measures performance of key operations and sends results to OpenTelemetry.
 * All benchmarks use the tracing system which runs in a parallel worker,
 * ensuring benchmark measurements don't include observability overhead.
 *
 * Usage:
 *   1. Open the app in browser
 *   2. Open DevTools console
 *   3. Run: import('/tests/performance/benchmark.js').then(m => m.runAllBenchmarks())
 *
 * Or from Node.js (limited - DOM operations won't work):
 *   node --experimental-vm-modules tests/performance/benchmark.js
 */

// Configuration
const BENCHMARK_CONFIG = {
    // Number of iterations for each test
    iterations: 5,
    // Node counts to test
    nodeCounts: [10, 50, 100, 250, 500],
    // Warmup runs before measuring
    warmupRuns: 2
};

/**
 * Benchmark result structure
 */
class BenchmarkResult {
    constructor(name) {
        this.name = name;
        this.samples = [];
        this.startTime = performance.now();
    }

    addSample(durationMs) {
        this.samples.push(durationMs);
    }

    get min() {
        return Math.min(...this.samples);
    }

    get max() {
        return Math.max(...this.samples);
    }

    get mean() {
        return this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    }

    get median() {
        const sorted = [...this.samples].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    get stdDev() {
        const mean = this.mean;
        const variance = this.samples.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / this.samples.length;
        return Math.sqrt(variance);
    }

    toJSON() {
        return {
            name: this.name,
            samples: this.samples.length,
            min: this.min.toFixed(3),
            max: this.max.toFixed(3),
            mean: this.mean.toFixed(3),
            median: this.median.toFixed(3),
            stdDev: this.stdDev.toFixed(3)
        };
    }

    toString() {
        return `${this.name}: mean=${this.mean.toFixed(2)}ms, median=${this.median.toFixed(2)}ms, min=${this.min.toFixed(2)}ms, max=${this.max.toFixed(2)}ms (n=${this.samples.length})`;
    }
}

/**
 * Benchmark runner with tracing integration
 */
class Benchmarker {
    constructor() {
        this.results = new Map();
        this.tracing = null;
    }

    async init() {
        // Try to import tracing module
        try {
            const { tracing } = await import('../../js/core/tracing.js');
            this.tracing = tracing;
            // Enable tracing for benchmarks
            this.tracing.setEnabled(true);
            console.log('✅ Tracing enabled for benchmarks');
        } catch (e) {
            console.warn('⚠️ Tracing not available:', e.message);
        }
    }

    /**
     * Run a benchmark function multiple times
     * @param {string} name - Benchmark name
     * @param {Function} fn - Function to benchmark (can be async)
     * @param {Object} options - Options
     */
    async run(name, fn, options = {}) {
        const {
            iterations = BENCHMARK_CONFIG.iterations,
            warmupRuns = BENCHMARK_CONFIG.warmupRuns,
            setup = null,
            teardown = null
        } = options;

        const result = new BenchmarkResult(name);

        // Warmup
        for (let i = 0; i < warmupRuns; i++) {
            if (setup) await setup();
            await fn();
            if (teardown) await teardown();
        }

        // Actual measurements
        for (let i = 0; i < iterations; i++) {
            if (setup) await setup();

            const start = performance.now();
            await fn();
            const duration = performance.now() - start;

            result.addSample(duration);

            // Send to tracing (non-blocking)
            if (this.tracing) {
                this.tracing.traceBenchmark(name, duration, {
                    iteration: i + 1,
                    total_iterations: iterations
                });
            }

            if (teardown) await teardown();
        }

        this.results.set(name, result);
        console.log(`  ${result}`);
        return result;
    }

    /**
     * Get all results
     */
    getResults() {
        const output = {};
        for (const [name, result] of this.results) {
            output[name] = result.toJSON();
        }
        return output;
    }

    /**
     * Print summary report
     */
    printReport() {
        console.log('\n📊 Benchmark Results Summary');
        console.log('═'.repeat(80));
        for (const result of this.results.values()) {
            console.log(result.toString());
        }
        console.log('═'.repeat(80));
    }
}

// ============================================
// Graph Benchmarks
// ============================================

async function benchmarkGraphOperations(benchmarker) {
    console.log('\n📈 Graph Operations Benchmarks');
    console.log('-'.repeat(40));

    let graph;
    try {
        const module = await import('../../js/core/graph.js');
        graph = module.graph;
    } catch (e) {
        console.warn('⚠️ Graph module not available');
        return;
    }

    for (const nodeCount of BENCHMARK_CONFIG.nodeCounts) {
        // Benchmark: Add nodes
        await benchmarker.run(`graph.addNode (${nodeCount} nodes)`, async () => {
            for (let i = 0; i < nodeCount; i++) {
                graph.addNode({
                    type: 'responsibility',
                    x: Math.random() * 1000,
                    y: Math.random() * 600,
                    properties: { name: `Node ${i}` }
                });
            }
        }, {
            setup: () => graph.clear(),
            teardown: () => graph.clear()
        });

        // Setup for edge benchmarks
        const nodes = [];
        for (let i = 0; i < nodeCount; i++) {
            const node = graph.addNode({
                type: i === 0 ? 'start' : i === nodeCount - 1 ? 'end' : 'responsibility',
                x: (i % 10) * 100 + 50,
                y: Math.floor(i / 10) * 80 + 50
            });
            nodes.push(node);
        }

        // Benchmark: Add edges
        await benchmarker.run(`graph.addEdge (${nodeCount - 1} edges)`, async () => {
            for (let i = 0; i < nodes.length - 1; i++) {
                graph.addEdge(nodes[i].id, nodes[i + 1].id);
            }
        }, {
            teardown: () => {
                // Remove edges but keep nodes
                for (const edge of graph.getAllEdges()) {
                    graph.removeEdge(edge.id);
                }
            }
        });

        // Benchmark: Get all nodes
        await benchmarker.run(`graph.getAllNodes (${nodeCount} nodes)`, async () => {
            for (let i = 0; i < 100; i++) {
                graph.getAllNodes();
            }
        });

        // Benchmark: Find node by ID
        const targetNode = nodes[Math.floor(nodes.length / 2)];
        await benchmarker.run(`graph.getNode (${nodeCount} nodes, 1000 lookups)`, async () => {
            for (let i = 0; i < 1000; i++) {
                graph.getNode(targetNode.id);
            }
        });

        graph.clear();
    }
}

// ============================================
// DSL Benchmarks
// ============================================

async function benchmarkDSLOperations(benchmarker) {
    console.log('\n📝 DSL Operations Benchmarks');
    console.log('-'.repeat(40));

    let parser, serializer, graph;
    try {
        const parserMod = await import('../../js/core/parser.js');
        const serializerMod = await import('../../js/core/serializer.js');
        const graphMod = await import('../../js/core/graph.js');
        parser = parserMod.parser;
        serializer = serializerMod.serializer;
        graph = graphMod.graph;
    } catch (e) {
        console.warn('⚠️ DSL modules not available:', e.message);
        return;
    }

    // Generate DSL strings of various sizes
    for (const nodeCount of BENCHMARK_CONFIG.nodeCounts) {
        // Generate DSL
        let dsl = 'map "Benchmark Map" {\n';
        dsl += '  component Actor "User" {\n';
        for (let i = 0; i < nodeCount; i++) {
            if (i === 0) {
                dsl += `    start "Start" at (50, 50)\n`;
            } else if (i === nodeCount - 1) {
                dsl += `    end "End" at (${(i % 10) * 100 + 50}, ${Math.floor(i / 10) * 80 + 50})\n`;
            } else {
                dsl += `    resp "Task${i}" at (${(i % 10) * 100 + 50}, ${Math.floor(i / 10) * 80 + 50})\n`;
            }
        }
        dsl += '  }\n';
        // Add path connections
        dsl += '  path {\n';
        for (let i = 0; i < nodeCount - 1; i++) {
            const from = i === 0 ? 'Start' : `Task${i}`;
            const to = i === nodeCount - 2 ? 'End' : `Task${i + 1}`;
            dsl += `    "${from}" -> "${to}"\n`;
        }
        dsl += '  }\n';
        dsl += '}\n';

        const charCount = dsl.length;

        // Benchmark: Parse DSL
        await benchmarker.run(`parser.parse (${nodeCount} nodes, ${charCount} chars)`, async () => {
            parser.parse(dsl);
        }, {
            teardown: () => graph.clear()
        });

        // Setup graph for serialization
        parser.parse(dsl);

        // Benchmark: Serialize to DSL
        await benchmarker.run(`serializer.serialize (${nodeCount} nodes)`, async () => {
            serializer.serialize();
        });

        graph.clear();
    }
}

// ============================================
// Canvas Rendering Benchmarks
// ============================================

async function benchmarkCanvasRendering(benchmarker) {
    console.log('\n🎨 Canvas Rendering Benchmarks');
    console.log('-'.repeat(40));

    // Only run in browser environment
    if (typeof document === 'undefined') {
        console.warn('⚠️ Canvas benchmarks require browser environment');
        return;
    }

    let renderer, graph;
    try {
        const rendererMod = await import('../../js/editor/canvas-renderer.js');
        const graphMod = await import('../../js/core/graph.js');
        renderer = rendererMod.renderer;
        graph = graphMod.graph;
    } catch (e) {
        console.warn('⚠️ Renderer module not available:', e.message);
        return;
    }

    for (const nodeCount of BENCHMARK_CONFIG.nodeCounts.slice(0, 3)) { // Limit for rendering
        // Setup: Create nodes and edges
        graph.clear();
        const nodes = [];
        for (let i = 0; i < nodeCount; i++) {
            const node = graph.addNode({
                type: i === 0 ? 'start' : i === nodeCount - 1 ? 'end' : 'responsibility',
                x: (i % 10) * 100 + 50,
                y: Math.floor(i / 10) * 80 + 50,
                properties: { name: `Node ${i}` }
            });
            nodes.push(node);
        }
        for (let i = 0; i < nodes.length - 1; i++) {
            graph.addEdge(nodes[i].id, nodes[i + 1].id);
        }

        // Benchmark: Full render
        await benchmarker.run(`renderer.render (${nodeCount} nodes)`, async () => {
            renderer.render();
        });

        graph.clear();
    }
}

// ============================================
// History/Undo Benchmarks
// ============================================

async function benchmarkHistory(benchmarker) {
    console.log('\n⏪ History Operations Benchmarks');
    console.log('-'.repeat(40));

    let history, graph;
    try {
        const historyMod = await import('../../js/core/history.js');
        const graphMod = await import('../../js/core/graph.js');
        history = historyMod.history;
        graph = graphMod.graph;
    } catch (e) {
        console.warn('⚠️ History module not available:', e.message);
        return;
    }

    // Benchmark: Push to history
    await benchmarker.run('history.push (100 operations)', async () => {
        for (let i = 0; i < 100; i++) {
            graph.addNode({
                type: 'responsibility',
                x: i * 10,
                y: i * 10
            });
        }
    }, {
        setup: () => {
            graph.clear();
            history.clear();
        },
        teardown: () => {
            graph.clear();
            history.clear();
        }
    });

    // Setup for undo benchmark
    graph.clear();
    history.clear();
    for (let i = 0; i < 50; i++) {
        graph.addNode({
            type: 'responsibility',
            x: i * 10,
            y: i * 10
        });
    }

    // Benchmark: Undo operations
    await benchmarker.run('history.undo (50 undos)', async () => {
        for (let i = 0; i < 50 && history.canUndo(); i++) {
            history.undo();
        }
    });

    graph.clear();
    history.clear();
}

// ============================================
// Scenario Traversal Benchmarks
// ============================================

async function benchmarkScenario(benchmarker) {
    console.log('\n🎯 Scenario Traversal Benchmarks');
    console.log('-'.repeat(40));

    let scenarioManager, graph;
    try {
        const scenarioMod = await import('../../js/core/scenario.js');
        const graphMod = await import('../../js/core/graph.js');
        scenarioManager = scenarioMod.scenarioManager;
        graph = graphMod.graph;
    } catch (e) {
        console.warn('⚠️ Scenario module not available:', e.message);
        return;
    }

    for (const nodeCount of BENCHMARK_CONFIG.nodeCounts.slice(0, 3)) {
        // Setup: Create linear path
        graph.clear();
        scenarioManager.clear();

        const nodes = [];
        for (let i = 0; i < nodeCount; i++) {
            const node = graph.addNode({
                type: i === 0 ? 'start' : i === nodeCount - 1 ? 'end' : 'responsibility',
                x: (i % 10) * 100 + 50,
                y: Math.floor(i / 10) * 80 + 50
            });
            nodes.push(node);
        }
        for (let i = 0; i < nodes.length - 1; i++) {
            graph.addEdge(nodes[i].id, nodes[i + 1].id);
        }

        // Create scenario
        const scenario = scenarioManager.createFromStartNode(nodes[0].id);

        // Benchmark: Execute scenario
        await benchmarker.run(`scenario.execute (${nodeCount} nodes)`, async () => {
            scenarioManager.executeScenario(scenario.id);
        });

        graph.clear();
        scenarioManager.clear();
    }
}

// ============================================
// Main Entry Point
// ============================================

export async function runAllBenchmarks() {
    console.log('🚀 UCM Editor Performance Benchmarks');
    console.log('═'.repeat(80));
    console.log(`Configuration: ${BENCHMARK_CONFIG.iterations} iterations, ${BENCHMARK_CONFIG.warmupRuns} warmup runs`);
    console.log(`Node counts: ${BENCHMARK_CONFIG.nodeCounts.join(', ')}`);

    const benchmarker = new Benchmarker();
    await benchmarker.init();

    const startTime = performance.now();

    try {
        await benchmarkGraphOperations(benchmarker);
        await benchmarkDSLOperations(benchmarker);
        await benchmarkCanvasRendering(benchmarker);
        await benchmarkHistory(benchmarker);
        await benchmarkScenario(benchmarker);
    } catch (e) {
        console.error('Benchmark error:', e);
    }

    const totalTime = performance.now() - startTime;

    benchmarker.printReport();
    console.log(`\n⏱️ Total benchmark time: ${(totalTime / 1000).toFixed(2)}s`);

    // Flush tracing data
    if (benchmarker.tracing) {
        benchmarker.tracing.flush();
        const metrics = benchmarker.tracing.getMetrics();
        console.log(`📊 Tracing metrics: ${metrics.spansQueued} spans queued, ${metrics.spansFlushed} flushed, ${metrics.flushErrors} errors`);
    }

    return benchmarker.getResults();
}

// Run individual benchmark suites
export { benchmarkGraphOperations, benchmarkDSLOperations, benchmarkCanvasRendering, benchmarkHistory, benchmarkScenario };

// Auto-run if executed directly in Node.js
if (typeof process !== 'undefined' && process.argv[1]?.endsWith('benchmark.js')) {
    runAllBenchmarks().then(results => {
        console.log('\nJSON Results:');
        console.log(JSON.stringify(results, null, 2));
    });
}
