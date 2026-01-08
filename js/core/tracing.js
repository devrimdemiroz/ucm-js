/**
 * UCM Editor - OpenTelemetry Tracing with Parallel Worker
 *
 * Architecture:
 * - Main thread creates spans and queues them immediately (non-blocking)
 * - Web Worker handles all network I/O in parallel thread
 * - No operation ever waits for observability data to be sent
 *
 * Span Hierarchy for SPM:
 *   - ucm-browser (CLIENT) -> ucm-editor (SERVER)
 * User actions are CLIENT spans, internal operations are SERVER spans
 */

// Span kinds per OTLP spec
const SPAN_KIND = {
    UNSPECIFIED: 0,
    INTERNAL: 1,
    SERVER: 2,
    CLIENT: 3,
    PRODUCER: 4,
    CONSUMER: 5
};

class UCMTracing {
    constructor() {
        this.enabled = false;
        this.collectorUrl = 'http://localhost:4318/v1/traces';
        this.sessionId = this.generateSpanId();

        // Context stack for nested spans
        this.currentTraceId = null;
        this.currentSpanId = null;

        // Worker for async network operations
        this.worker = null;
        this.workerReady = false;

        // Fallback queue if worker not available
        this.fallbackQueue = [];
        this.fallbackFlushInterval = null;

        // Performance metrics
        this.metrics = {
            spansQueued: 0,
            spansFlushed: 0,
            flushErrors: 0
        };
    }

    /**
     * Initialize the worker for parallel tracing
     * @private
     */
    initWorker() {
        if (this.worker) return;

        try {
            // Create worker from module
            const workerUrl = new URL('./tracing-worker.js', import.meta.url);
            this.worker = new Worker(workerUrl, { type: 'module' });

            this.worker.onmessage = (event) => {
                const { type, ...data } = event.data;
                switch (type) {
                    case 'ready':
                        this.workerReady = true;
                        // Send configuration
                        this.worker.postMessage({
                            type: 'config',
                            collectorUrl: this.collectorUrl
                        });
                        // Flush any queued spans from before worker was ready
                        this.flushFallbackToWorker();
                        break;
                    case 'flushed':
                        this.metrics.spansFlushed += data.count || 0;
                        if (!data.success) {
                            this.metrics.flushErrors++;
                        }
                        break;
                    case 'destroyed':
                        this.worker = null;
                        this.workerReady = false;
                        break;
                }
            };

            this.worker.onerror = (error) => {
                console.warn('Tracing worker error:', error.message);
                this.workerReady = false;
                // Fall back to main thread
                this.initFallback();
            };

            // Initialize worker
            this.worker.postMessage({ type: 'init' });

        } catch (error) {
            // Workers not supported or blocked, use fallback
            console.warn('Web Worker not available for tracing, using fallback:', error.message);
            this.initFallback();
        }
    }

    /**
     * Initialize fallback queue for environments without workers
     * @private
     */
    initFallback() {
        if (this.fallbackFlushInterval) return;

        this.fallbackFlushInterval = setInterval(() => {
            this.flushFallback();
        }, 3000);
    }

    /**
     * Flush fallback queue to worker once ready
     * @private
     */
    flushFallbackToWorker() {
        if (!this.workerReady || this.fallbackQueue.length === 0) return;

        for (const item of this.fallbackQueue) {
            this.worker.postMessage(item);
        }
        this.fallbackQueue = [];
    }

    /**
     * Flush fallback queue directly (when worker unavailable)
     * Uses fire-and-forget fetch to avoid blocking
     * @private
     */
    flushFallback() {
        if (this.fallbackQueue.length === 0) return;

        const toFlush = this.fallbackQueue.filter(item => item.type === 'span');
        this.fallbackQueue = [];

        if (toFlush.length === 0) return;

        // Group by service
        const byService = new Map();
        for (const { span, serviceName, serviceVersion } of toFlush) {
            const key = `${serviceName}:${serviceVersion}`;
            if (!byService.has(key)) {
                byService.set(key, { serviceName, serviceVersion, spans: [] });
            }
            byService.get(key).spans.push(span);
        }

        const resourceSpans = [];
        for (const { serviceName, serviceVersion, spans } of byService.values()) {
            resourceSpans.push({
                resource: {
                    attributes: [
                        { key: 'service.name', value: { stringValue: serviceName } },
                        { key: 'service.version', value: { stringValue: serviceVersion } },
                        { key: 'telemetry.sdk.language', value: { stringValue: 'javascript' } },
                        { key: 'telemetry.sdk.name', value: { stringValue: 'ucm-tracing' } }
                    ]
                },
                scopeSpans: [{
                    scope: { name: serviceName, version: serviceVersion },
                    spans
                }]
            });
        }

        // Fire-and-forget - don't await
        fetch(this.collectorUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resourceSpans })
        }).then(response => {
            this.metrics.spansFlushed += toFlush.length;
            if (!response.ok) {
                this.metrics.flushErrors++;
            }
        }).catch(() => {
            this.metrics.flushErrors++;
        });
    }

    /**
     * Enable or disable tracing
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        if (enabled) {
            this.initWorker();
            // Send initial session span
            this.startUserAction('session.start', { 'session.id': this.sessionId });
            console.log('📊 OpenTelemetry tracing enabled (parallel worker)');
        } else {
            this.destroy();
            console.log('📊 OpenTelemetry tracing disabled');
        }
    }

    /**
     * Set the collector URL
     */
    setCollectorUrl(url) {
        this.collectorUrl = url;
        if (this.workerReady && this.worker) {
            this.worker.postMessage({ type: 'config', collectorUrl: url });
        }
        console.log(`OpenTelemetry collector URL set to: ${url}`);
    }

    // ========================================
    // ID Generation
    // ========================================

    generateTraceId() {
        return this.randomHex(32);
    }

    generateSpanId() {
        return this.randomHex(16);
    }

    randomHex(length) {
        let result = '';
        for (let i = 0; i < length; i++) {
            result += Math.floor(Math.random() * 16).toString(16);
        }
        return result;
    }

    // ========================================
    // Span Helpers
    // ========================================

    toNanos(ms) {
        return String(Math.floor(ms * 1000000));
    }

    toAttributeValue(value) {
        if (typeof value === 'number') {
            return Number.isInteger(value)
                ? { intValue: String(value) }
                : { doubleValue: value };
        }
        if (typeof value === 'boolean') {
            return { boolValue: value };
        }
        if (typeof value === 'object' && value !== null) {
            try {
                return { stringValue: JSON.stringify(value) };
            } catch {
                return { stringValue: '[Circular Object]' };
            }
        }
        return { stringValue: String(value) };
    }

    /**
     * Queue a span - NEVER BLOCKS
     * Immediately returns, span is sent asynchronously
     * @private
     */
    queueSpan(span, serviceName, serviceVersion) {
        this.metrics.spansQueued++;

        const message = {
            type: 'span',
            span,
            serviceName,
            serviceVersion
        };

        if (this.workerReady && this.worker) {
            // Send to worker (non-blocking postMessage)
            this.worker.postMessage(message);
        } else {
            // Queue for fallback or later worker delivery
            this.fallbackQueue.push(message);
        }
    }

    // ========================================
    // Span Creation - All Non-Blocking
    // ========================================

    /**
     * Start a user action (CLIENT span from browser)
     * Returns context for child SERVER spans
     * NEVER BLOCKS - returns immediately
     */
    startUserAction(action, attributes = {}) {
        if (!this.enabled) return null;

        const now = Date.now();
        const traceId = this.generateTraceId();
        const spanId = this.generateSpanId();

        // Update context immediately
        this.currentTraceId = traceId;
        this.currentSpanId = spanId;

        const span = {
            traceId,
            spanId,
            parentSpanId: '',
            name: action,
            kind: SPAN_KIND.CLIENT,
            startTimeUnixNano: this.toNanos(now),
            endTimeUnixNano: this.toNanos(now + 20),
            attributes: [
                { key: 'session.id', value: { stringValue: this.sessionId } },
                { key: 'user.action', value: { stringValue: action } },
                ...Object.entries(attributes).map(([key, value]) => ({
                    key,
                    value: this.toAttributeValue(value)
                }))
            ],
            status: { code: 1 }
        };

        this.queueSpan(span, 'ucm-browser', '1.0.0');
        return { traceId, spanId };
    }

    /**
     * Create a SERVER span (internal operation)
     * Links to current active span as parent
     * NEVER BLOCKS - returns immediately
     */
    createServerSpan(operation, attributes = {}, durationMs = 5) {
        if (!this.enabled) return null;

        const now = Date.now();
        const spanId = this.generateSpanId();
        const traceId = this.currentTraceId || this.generateTraceId();
        const parentSpanId = this.currentSpanId || '';

        const span = {
            traceId,
            spanId,
            parentSpanId,
            name: operation,
            kind: SPAN_KIND.SERVER,
            startTimeUnixNano: this.toNanos(now - durationMs),
            endTimeUnixNano: this.toNanos(now),
            attributes: [
                { key: 'operation', value: { stringValue: operation } },
                ...Object.entries(attributes).map(([key, value]) => ({
                    key,
                    value: this.toAttributeValue(value)
                }))
            ],
            status: { code: 1 }
        };

        this.queueSpan(span, 'ucm-editor', '1.0.0');
        return { traceId, spanId };
    }

    /**
     * Create an INTERNAL span (sub-operation)
     * NEVER BLOCKS - returns immediately
     */
    createInternalSpan(operation, parentSpanId, attributes = {}, durationMs = 2) {
        if (!this.enabled) return null;

        const now = Date.now();
        const spanId = this.generateSpanId();
        const traceId = this.currentTraceId || this.generateTraceId();

        const span = {
            traceId,
            spanId,
            parentSpanId: parentSpanId || this.currentSpanId || '',
            name: operation,
            kind: SPAN_KIND.INTERNAL,
            startTimeUnixNano: this.toNanos(now - durationMs),
            endTimeUnixNano: this.toNanos(now),
            attributes: Object.entries(attributes).map(([key, value]) => ({
                key,
                value: this.toAttributeValue(value)
            })),
            status: { code: 1 }
        };

        this.queueSpan(span, 'ucm-editor', '1.0.0');
        return { traceId, spanId };
    }

    // ========================================
    // Performance Benchmark Spans
    // ========================================

    /**
     * Create a benchmark span with timing data
     * Use for performance measurement
     */
    traceBenchmark(name, durationMs, attributes = {}) {
        return this.createServerSpan(`benchmark.${name}`, {
            'benchmark.name': name,
            'benchmark.duration_ms': Math.round(durationMs * 100) / 100,
            ...attributes
        }, durationMs);
    }

    /**
     * Measure and trace a synchronous operation
     * @param {string} name - Benchmark name
     * @param {Function} fn - Function to measure
     * @returns {*} Result of fn()
     */
    measureSync(name, fn) {
        const start = performance.now();
        const result = fn();
        const duration = performance.now() - start;
        this.traceBenchmark(name, duration);
        return result;
    }

    /**
     * Measure and trace an async operation
     * @param {string} name - Benchmark name
     * @param {Function} fn - Async function to measure
     * @returns {Promise<*>} Result of fn()
     */
    async measureAsync(name, fn) {
        const start = performance.now();
        const result = await fn();
        const duration = performance.now() - start;
        this.traceBenchmark(name, duration);
        return result;
    }

    // ========================================
    // Convenience Methods - All Non-Blocking
    // ========================================

    traceSelection(type, id) {
        return this.startUserAction('user.select', { type, id });
    }

    traceNodeCreation(nodeType, nodeId) {
        this.startUserAction('user.create_node', { 'node.type': nodeType });
        return this.createServerSpan('node.create', {
            'node.id': nodeId,
            type: nodeType
        });
    }

    traceEdgeCreation(sourceId, targetId, edgeId) {
        this.startUserAction('user.create_edge', {
            source: sourceId,
            target: targetId
        });
        return this.createServerSpan('edge.create', { 'edge.id': edgeId });
    }

    traceComponentCreation(compType, compId) {
        this.startUserAction('user.create_component', { type: compType });
        return this.createServerSpan('component.create', {
            'component.id': compId
        });
    }

    traceCanvasRender(nodeCount, edgeCount, componentCount, durationMs) {
        return this.createServerSpan('canvas.render', {
            nodes: nodeCount,
            edges: edgeCount,
            components: componentCount,
            duration_ms: Math.round(durationMs)
        }, durationMs);
    }

    traceDSLParse(charCount, nodeCount, durationMs) {
        return this.createServerSpan('dsl.parse', {
            char_count: charCount,
            node_count: nodeCount,
            duration_ms: Math.round(durationMs * 100) / 100
        }, durationMs);
    }

    traceDSLSerialize(nodeCount, durationMs) {
        return this.createServerSpan('dsl.serialize', {
            node_count: nodeCount,
            duration_ms: Math.round(durationMs * 100) / 100
        }, durationMs);
    }

    traceScenarioTraversal(scenarioId, nodeCount, edgeCount, durationMs) {
        return this.createServerSpan('scenario.traverse', {
            scenario_id: scenarioId,
            nodes_traversed: nodeCount,
            edges_traversed: edgeCount,
            duration_ms: Math.round(durationMs * 100) / 100
        }, durationMs);
    }

    traceHistoryOperation(operation, stackSize, durationMs) {
        return this.createServerSpan(`history.${operation}`, {
            stack_size: stackSize,
            duration_ms: Math.round(durationMs * 100) / 100
        }, durationMs);
    }

    // ========================================
    // Metrics & Cleanup
    // ========================================

    /**
     * Get current metrics
     */
    getMetrics() {
        return { ...this.metrics };
    }

    /**
     * Force flush pending spans
     */
    flush() {
        if (this.workerReady && this.worker) {
            this.worker.postMessage({ type: 'flush' });
        } else {
            this.flushFallback();
        }
    }

    /**
     * Cleanup resources
     */
    destroy() {
        if (this.fallbackFlushInterval) {
            clearInterval(this.fallbackFlushInterval);
            this.fallbackFlushInterval = null;
        }

        if (this.worker) {
            this.worker.postMessage({ type: 'destroy' });
        }

        // Final fallback flush
        this.flushFallback();
    }
}

// Singleton instance
export const tracing = new UCMTracing();
