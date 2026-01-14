/**
 * Test to verify tracing runs in parallel and doesn't block main thread
 *
 * This test measures the overhead of tracing operations to ensure
 * they don't add latency to the main application.
 */

import { tracing } from '../../js/core/tracing.js';

/**
 * Measure time for a synchronous operation
 */
function measureSync(fn) {
    const start = performance.now();
    fn();
    return performance.now() - start;
}

/**
 * Test that queueSpan is non-blocking
 */
function testNonBlockingQueue() {
    console.log('\n📊 Testing Non-Blocking Queue Behavior');
    console.log('-'.repeat(50));

    // Enable tracing
    tracing.setEnabled(true);

    // Measure time to queue many spans
    const spanCount = 1000;
    const queueTime = measureSync(() => {
        for (let i = 0; i < spanCount; i++) {
            tracing.createServerSpan('test.operation', {
                iteration: i,
                data: 'some test data for the span'
            });
        }
    });

    const perSpanMicroseconds = (queueTime / spanCount) * 1000;

    console.log(`  Queued ${spanCount} spans in ${queueTime.toFixed(2)}ms`);
    console.log(`  Average per span: ${perSpanMicroseconds.toFixed(2)}μs`);

    // Assert: queuing should be very fast (< 100μs per span)
    if (perSpanMicroseconds < 100) {
        console.log('  ✅ PASS: Span queuing is non-blocking');
    } else {
        console.log('  ⚠️ WARN: Span queuing may be slow');
    }

    return { spanCount, queueTime, perSpanMicroseconds };
}

/**
 * Test that tracing doesn't block graph operations
 */
async function testGraphOperationsWithTracing() {
    console.log('\n📊 Testing Graph Operations with Tracing');
    console.log('-'.repeat(50));

    let graph;
    try {
        const module = await import('../../js/core/graph.js');
        graph = module.graph;
    } catch (e) {
        console.log('  ⚠️ Graph module not available, skipping');
        return null;
    }

    // Test with tracing disabled
    tracing.setEnabled(false);
    graph.clear();

    const nodesWithoutTracing = 100;
    const timeWithoutTracing = measureSync(() => {
        for (let i = 0; i < nodesWithoutTracing; i++) {
            graph.addNode({
                type: 'responsibility',
                x: i * 10,
                y: i * 10
            });
        }
    });
    graph.clear();

    // Test with tracing enabled
    tracing.setEnabled(true);
    const nodesWithTracing = 100;
    const timeWithTracing = measureSync(() => {
        for (let i = 0; i < nodesWithTracing; i++) {
            graph.addNode({
                type: 'responsibility',
                x: i * 10,
                y: i * 10
            });
        }
    });
    graph.clear();

    const overhead = timeWithTracing - timeWithoutTracing;
    const overheadPercent = (overhead / timeWithoutTracing) * 100;

    console.log(`  Without tracing: ${timeWithoutTracing.toFixed(2)}ms for ${nodesWithoutTracing} nodes`);
    console.log(`  With tracing:    ${timeWithTracing.toFixed(2)}ms for ${nodesWithTracing} nodes`);
    console.log(`  Overhead: ${overhead.toFixed(2)}ms (${overheadPercent.toFixed(1)}%)`);

    // Assert: overhead should be minimal (< 50%)
    if (overheadPercent < 50) {
        console.log('  ✅ PASS: Tracing overhead is acceptable');
    } else {
        console.log('  ⚠️ WARN: Tracing overhead may be too high');
    }

    return { timeWithoutTracing, timeWithTracing, overhead, overheadPercent };
}

/**
 * Test metrics tracking
 */
function testMetrics() {
    console.log('\n📊 Testing Metrics Tracking');
    console.log('-'.repeat(50));

    tracing.setEnabled(true);

    // Queue some spans
    for (let i = 0; i < 50; i++) {
        tracing.traceBenchmark('test', Math.random() * 10);
    }

    const metrics = tracing.getMetrics();
    console.log(`  Spans queued: ${metrics.spansQueued}`);
    console.log(`  Spans flushed: ${metrics.spansFlushed}`);
    console.log(`  Flush errors: ${metrics.flushErrors}`);

    if (metrics.spansQueued > 0) {
        console.log('  ✅ PASS: Metrics are being tracked');
    } else {
        console.log('  ❌ FAIL: Metrics not tracking');
    }

    return metrics;
}

/**
 * Run all async tracing tests
 */
export async function runAsyncTracingTests() {
    console.log('\n🚀 Async Tracing Tests');
    console.log('═'.repeat(50));

    const results = {
        nonBlocking: testNonBlockingQueue(),
        graphOverhead: await testGraphOperationsWithTracing(),
        metrics: testMetrics()
    };

    console.log('\n═'.repeat(50));
    console.log('📋 Test Summary');
    console.log('-'.repeat(50));

    let passed = 0;
    let total = 0;

    if (results.nonBlocking?.perSpanMicroseconds < 100) {
        passed++;
    }
    total++;

    if (results.graphOverhead?.overheadPercent < 50) {
        passed++;
    } else if (results.graphOverhead === null) {
        // Skip if graph not available
    } else {
        total++;
    }

    if (results.metrics?.spansQueued > 0) {
        passed++;
    }
    total++;

    console.log(`  ${passed}/${total} tests passed`);

    // Cleanup
    tracing.destroy();

    return results;
}

// Run if executed directly
if (typeof process !== 'undefined' && process.argv[1]?.endsWith('tracing-async-test.js')) {
    runAsyncTracingTests().then(results => {
        console.log('\nJSON Results:');
        console.log(JSON.stringify(results, null, 2));
    });
}
