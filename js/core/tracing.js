/**
 * UCM Editor - OpenTelemetry Tracing
 * Proper span hierarchy for SPM:
 *   - ucm-browser (CLIENT) -> ucm-editor (SERVER)
 * 
 * User actions are CLIENT spans, internal operations are SERVER spans
 * This creates proper service graph in Jaeger SPM
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
        this.pendingSpans = [];
        this.flushInterval = null;
        this.sessionId = this.generateSpanId(); // Unique session ID

        // Context stack for nested spans
        this.contextStack = [];
        this.currentTraceId = null;
        this.currentSpanId = null;
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        if (enabled && !this.flushInterval) {
            this.init();
        } else if (!enabled && this.flushInterval) {
            this.destroy();
        }
        console.log(`OpenTelemetry tracing ${enabled ? 'enabled' : 'disabled'}`);
    }

    setCollectorUrl(url) {
        this.collectorUrl = url;
        console.log(`OpenTelemetry collector URL set to: ${url}`);
    }

    init() {
        if (this.flushInterval) return; // Prevent multiple intervals

        // Start periodic flush of spans
        this.flushInterval = setInterval(() => this.flush(), 3000);
        console.log('📊 OpenTelemetry tracing initialized (OTLP/HTTP)');

        // Send initial session span
        this.startUserAction('session.start', { 'session.id': this.sessionId });
    }

    // Generate trace/span IDs (simple random hex)
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

    // Convert to nanoseconds
    toNanos(ms) {
        return String(Math.floor(ms * 1000000));
    }

    toAttributeValue(value) {
        if (typeof value === 'number') {
            return Number.isInteger(value) ? { intValue: String(value) } : { doubleValue: value };
        }
        if (typeof value === 'boolean') {
            return { boolValue: value };
        }
        if (typeof value === 'object' && value !== null) {
            try {
                return { stringValue: JSON.stringify(value) };
            } catch (e) {
                return { stringValue: '[Circular Object]' };
            }
        }
        return { stringValue: String(value) };
    }

    /**
     * Start a user action (CLIENT span from browser)
     * Returns context for child SERVER spans
     */
    startUserAction(action, attributes = {}) {
        if (!this.enabled) return null;

        const now = Date.now();
        const traceId = this.generateTraceId();
        const spanId = this.generateSpanId();

        // Update context
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
            status: { code: 1 } // Status Ok
        };

        this.queueSpan(span, 'ucm-browser', '1.0.0');

        return { traceId, spanId };
    }

    /**
     * Create a SERVER span (internal operation)
     * Links to current active span as parent
     */
    createServerSpan(operation, attributes = {}, durationMs = 5) {
        if (!this.enabled) return null;

        const now = Date.now();
        const spanId = this.generateSpanId();

        // Use current context or root
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

    // Queue span with service metadata
    queueSpan(span, serviceName, serviceVersion) {
        this.pendingSpans.push({ span, serviceName, serviceVersion });

        if (this.pendingSpans.length >= 20) {
            this.flush();
        }
    }

    // Flush pending spans to collector
    async flush() {
        if (this.pendingSpans.length === 0) return;

        const toFlush = [...this.pendingSpans];
        this.pendingSpans = [];

        // Group spans by service
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

        try {
            const response = await fetch(this.collectorUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resourceSpans })
            });

            if (!response.ok) {
                console.warn('📊 Trace export failed:', response.status);
            }
        } catch (error) {
            // Silently fail if collector offline
        }
    }

    // User interaction tracing
    traceSelection(type, id) {
        return this.startUserAction('user.select', { 'type': type, 'id': id });
    }

    traceNodeCreation(nodeType, nodeId) {
        this.startUserAction('user.create_node', { 'node.type': nodeType });
        return this.createServerSpan('node.create', { 'node.id': nodeId, 'type': nodeType });
    }

    traceEdgeCreation(sourceId, targetId, edgeId) {
        this.startUserAction('user.create_edge', { 'source': sourceId, 'target': targetId });
        return this.createServerSpan('edge.create', { 'edge.id': edgeId });
    }

    traceComponentCreation(compType, compId) {
        this.startUserAction('user.create_component', { 'type': compType });
        return this.createServerSpan('component.create', { 'component.id': compId });
    }

    traceCanvasRender(nodeCount, edgeCount, componentCount, durationMs) {
        return this.createServerSpan('canvas.render', {
            'nodes': nodeCount,
            'edges': edgeCount,
            'components': componentCount,
            'duration_ms': Math.round(durationMs)
        }, durationMs);
    }

    // Cleanup
    destroy() {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
            this.flushInterval = null;
        }
        this.flush();
    }
}

export const tracing = new UCMTracing();
