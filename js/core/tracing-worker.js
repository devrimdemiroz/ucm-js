/**
 * Tracing Worker - Runs in a separate thread to handle observability
 *
 * This worker receives span data via postMessage and handles all network
 * operations asynchronously, ensuring main thread operations never wait
 * for tracing/observability.
 *
 * Message Types:
 * - { type: 'config', collectorUrl: string } - Configure collector endpoint
 * - { type: 'span', span: object, serviceName: string, serviceVersion: string } - Queue a span
 * - { type: 'flush' } - Force flush pending spans
 * - { type: 'destroy' } - Cleanup and stop worker
 */

// Worker state
let collectorUrl = 'http://localhost:4318/v1/traces';
let pendingSpans = [];
let flushIntervalId = null;
const FLUSH_INTERVAL_MS = 3000;
const MAX_BATCH_SIZE = 50;

/**
 * Initialize the worker
 */
function init() {
    if (flushIntervalId) return;
    flushIntervalId = setInterval(flush, FLUSH_INTERVAL_MS);
    self.postMessage({ type: 'ready' });
}

/**
 * Queue a span for batch sending
 */
function queueSpan(span, serviceName, serviceVersion) {
    pendingSpans.push({ span, serviceName, serviceVersion });

    // Auto-flush if batch is large enough
    if (pendingSpans.length >= MAX_BATCH_SIZE) {
        flush();
    }
}

/**
 * Flush all pending spans to the collector
 * Grouped by service for proper OTLP format
 */
async function flush() {
    if (pendingSpans.length === 0) return;

    const toFlush = pendingSpans;
    pendingSpans = [];

    // Group spans by service
    const byService = new Map();
    for (const { span, serviceName, serviceVersion } of toFlush) {
        const key = `${serviceName}:${serviceVersion}`;
        if (!byService.has(key)) {
            byService.set(key, { serviceName, serviceVersion, spans: [] });
        }
        byService.get(key).spans.push(span);
    }

    // Build OTLP resource spans
    const resourceSpans = [];
    for (const { serviceName, serviceVersion, spans } of byService.values()) {
        resourceSpans.push({
            resource: {
                attributes: [
                    { key: 'service.name', value: { stringValue: serviceName } },
                    { key: 'service.version', value: { stringValue: serviceVersion } },
                    { key: 'telemetry.sdk.language', value: { stringValue: 'javascript' } },
                    { key: 'telemetry.sdk.name', value: { stringValue: 'ucm-tracing-worker' } }
                ]
            },
            scopeSpans: [{
                scope: { name: serviceName, version: serviceVersion },
                spans
            }]
        });
    }

    try {
        const response = await fetch(collectorUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resourceSpans })
        });

        if (response.ok) {
            self.postMessage({
                type: 'flushed',
                count: toFlush.length,
                success: true
            });
        } else {
            self.postMessage({
                type: 'flushed',
                count: toFlush.length,
                success: false,
                status: response.status
            });
        }
    } catch (error) {
        // Network error - silently fail, collector may be offline
        self.postMessage({
            type: 'flushed',
            count: toFlush.length,
            success: false,
            error: error.message
        });
    }
}

/**
 * Cleanup worker resources
 */
function destroy() {
    if (flushIntervalId) {
        clearInterval(flushIntervalId);
        flushIntervalId = null;
    }
    // Final flush before shutdown
    flush().then(() => {
        self.postMessage({ type: 'destroyed' });
    });
}

// Message handler
self.onmessage = function(event) {
    const { type, ...data } = event.data;

    switch (type) {
        case 'init':
            init();
            break;

        case 'config':
            if (data.collectorUrl) {
                collectorUrl = data.collectorUrl;
            }
            break;

        case 'span':
            queueSpan(data.span, data.serviceName, data.serviceVersion);
            break;

        case 'flush':
            flush();
            break;

        case 'destroy':
            destroy();
            break;

        default:
            console.warn('Unknown message type:', type);
    }
};

// Auto-initialize
init();
