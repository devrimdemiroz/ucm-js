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

        // Current trace context for parent-child linking
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        console.log(`OpenTelemetry tracing ${enabled ? 'enabled' : 'disabled'}`);
    }

    init() {
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

        // Store current context for child spans
        this.currentTraceId = traceId;
        this.currentClientSpanId = spanId;

        const span = {
            traceId,
            spanId,
            parentSpanId: '',
            name: action,
            kind: SPAN_KIND.CLIENT,
            startTimeUnixNano: this.toNanos(now),
            endTimeUnixNano: this.toNanos(now + 50), // Client spans are quick
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

        // Queue as browser/client span
        this.queueSpan(span, 'ucm-browser', '1.0.0');

        return { traceId, spanId };
    }

    /**
     * Create a SERVER span (internal operation)
     * Links to current user action as parent
     */
    createServerSpan(operation, attributes = {}, durationMs = 5) {
        if (!this.enabled) return null;

        const now = Date.now();
        const spanId = this.generateSpanId();

        // Use current trace context or create new one
        const traceId = this.currentTraceId || this.generateTraceId();
        const parentSpanId = this.currentClientSpanId || '';

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

        // Queue as ucm-editor/server span
        this.queueSpan(span, 'ucm-editor', '1.0.0');

        return { traceId, spanId };
    }

    /**
     * Create an INTERNAL span (sub-operation within server)
     */
    createInternalSpan(operation, parentSpanId, attributes = {}, durationMs = 2) {
        if (!this.enabled) return null;

        const now = Date.now();
        const spanId = this.generateSpanId();
        const traceId = this.currentTraceId || this.generateTraceId();

        const span = {
            traceId,
            spanId,
            parentSpanId: parentSpanId || '',
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

        // Flush if we have enough spans
        if (this.pendingSpans.length >= 15) {
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

        // Create resourceSpans for each service
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

        console.log(`📊 Flushing ${toFlush.length} spans across ${resourceSpans.length} services:`,
            Array.from(byService.keys()));

        try {
            const response = await fetch(this.collectorUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resourceSpans })
            });

            if (!response.ok) {
                console.warn('📊 Failed to send traces:', response.status);
            }
        } catch (error) {
            console.debug('📊 Trace export failed (collector may be offline)');
        }
    }

    // ========================================
    // High-level tracing methods
    // ========================================

    // User clicks/actions (CLIENT spans)
    traceUserClick(element, details = {}) {
        return this.startUserAction('user.click', {
            'ui.element': element,
            ...details
        });
    }

    traceToolChange(toolName) {
        return this.startUserAction('user.tool_change', {
            'tool.name': toolName
        });
    }

    traceSelection(type, id) {
        return this.startUserAction('user.select', {
            'selection.type': type,
            'selection.id': id
        });
    }

    // Application operations (SERVER spans)
    traceNodeCreation(nodeType, nodeId) {
        // First create client span for user action
        this.startUserAction('user.create_node', { 'node.type': nodeType });

        // Then server span for the operation
        const serverSpan = this.createServerSpan('node.create', {
            'ucm.node.type': nodeType,
            'ucm.node.id': nodeId
        }, 8);

        // Internal span for graph update
        this.createInternalSpan('graph.addNode', serverSpan?.spanId, {
            'node.id': nodeId
        }, 3);

        return serverSpan;
    }

    traceEdgeCreation(sourceId, targetId, edgeId) {
        this.startUserAction('user.create_edge', {
            'edge.source': sourceId,
            'edge.target': targetId
        });

        const serverSpan = this.createServerSpan('edge.create', {
            'ucm.edge.source': sourceId,
            'ucm.edge.target': targetId,
            'ucm.edge.id': edgeId
        }, 6);

        this.createInternalSpan('graph.addEdge', serverSpan?.spanId, {
            'edge.id': edgeId
        }, 2);

        return serverSpan;
    }

    traceComponentCreation(compType, compId) {
        this.startUserAction('user.create_component', {
            'component.type': compType
        });

        const serverSpan = this.createServerSpan('component.create', {
            'ucm.component.type': compType,
            'ucm.component.id': compId
        }, 7);

        this.createInternalSpan('graph.addComponent', serverSpan?.spanId, {
            'component.id': compId
        }, 3);

        return serverSpan;
    }

    traceCanvasRender(nodeCount, edgeCount, componentCount, durationMs = 15) {
        const serverSpan = this.createServerSpan('canvas.render', {
            'canvas.nodes': nodeCount || 0,
            'canvas.edges': edgeCount || 0,
            'canvas.components': componentCount || 0,
            'canvas.duration_ms': Math.round(durationMs)
        }, Math.max(durationMs, 5));

        // Internal spans for render phases (proportional to total duration)
        if (serverSpan) {
            const componentTime = Math.round(durationMs * 0.3);
            const edgeTime = Math.round(durationMs * 0.35);
            const nodeTime = Math.round(durationMs * 0.35);

            this.createInternalSpan('render.components', serverSpan.spanId, {
                'count': componentCount || 0
            }, componentTime);
            this.createInternalSpan('render.edges', serverSpan.spanId, {
                'count': edgeCount || 0
            }, edgeTime);
            this.createInternalSpan('render.nodes', serverSpan.spanId, {
                'count': nodeCount || 0
            }, nodeTime);
        }

        return serverSpan;
    }

    traceUserInteraction(action, details = {}) {
        return this.startUserAction(`user.${action}`, details);
    }

    // Cleanup
    destroy() {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
        }
        this.flush();
    }
}

// Export singleton instance
export const tracing = new UCMTracing();
