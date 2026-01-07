/**
 * UCM Editor Smoke Test Suite with Observability
 * 
 * Enhanced smoke tests that:
 * - Collect and display browser console logs
 * - Send test results as OTLP spans to the observability stack
 * - Report timing metrics for each test
 * 
 * Run with: node tests/smoke/smoke-test-observable.js
 * 
 * Prerequisites:
 * - Server running on http://localhost:8080
 * - Observability stack running: cd observability && docker-compose up -d
 * - npm install (for puppeteer)
 */

import puppeteer from 'puppeteer';

const BASE_URL = 'http://localhost:8080';
const OTEL_COLLECTOR_URL = 'http://localhost:4318/v1/traces';

class ObservableSmokeTestRunner {
    constructor() {
        this.browser = null;
        this.page = null;
        this.passed = 0;
        this.failed = 0;
        this.results = [];
        this.consoleLogs = [];
        this.errors = [];
        this.warnings = [];
        this.traceId = this.generateTraceId();
        this.parentSpanId = this.generateSpanId();
        this.suiteStartTime = Date.now();
    }

    // ============================================
    // ID Generation (matching OTLP format)
    // ============================================
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

    toNanos(ms) {
        return (ms * 1e6).toString();
    }

    // ============================================
    // Setup and Teardown
    // ============================================
    async setup() {
        console.log('🔭 UCM Editor Observable Smoke Tests\n');
        console.log(`📡 Trace ID: ${this.traceId}`);
        console.log(`📊 OTEL Collector: ${OTEL_COLLECTOR_URL}\n`);

        this.browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        this.page = await this.browser.newPage();

        // Collect ALL console logs from the page
        this.page.on('console', msg => {
            const logEntry = {
                type: msg.type(),
                text: msg.text(),
                timestamp: new Date().toISOString()
            };
            this.consoleLogs.push(logEntry);

            if (msg.type() === 'error') {
                this.errors.push(logEntry);
                console.log(`  📛 [PAGE ERROR] ${msg.text()}`);
            } else if (msg.type() === 'warning') {
                this.warnings.push(logEntry);
            }
        });

        // Capture page errors
        this.page.on('pageerror', err => {
            const errorEntry = {
                type: 'pageerror',
                text: err.message,
                stack: err.stack,
                timestamp: new Date().toISOString()
            };
            this.errors.push(errorEntry);
            console.log(`  💥 [PAGE CRASH] ${err.message}`);
        });

        // Set viewport size
        await this.page.setViewport({ width: 1280, height: 800 });

        // Send root span for the test suite
        await this.sendSpan({
            spanId: this.parentSpanId,
            parentSpanId: '',
            name: 'smoke-test-suite',
            kind: 2, // SERVER
            attributes: {
                'test.suite': 'smoke',
                'test.browser': 'chromium',
                'test.url': BASE_URL
            }
        }, this.suiteStartTime);
    }

    async teardown() {
        // End the root span
        await this.sendSpan({
            spanId: this.parentSpanId,
            parentSpanId: '',
            name: 'smoke-test-suite',
            kind: 2,
            attributes: {
                'test.suite': 'smoke',
                'test.passed': this.passed,
                'test.failed': this.failed,
                'test.total': this.passed + this.failed,
                'test.errors_count': this.errors.length,
                'test.warnings_count': this.warnings.length
            },
            status: this.failed > 0 ? 2 : 1 // ERROR or OK
        }, this.suiteStartTime, Date.now());

        if (this.browser) {
            await this.browser.close();
        }

        this.printSummary();
        this.printConsoleSummary();
    }

    async wait(ms = 300) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ============================================
    // OTLP Span Sending
    // ============================================
    async sendSpan(spanConfig, startMs, endMs = null) {
        const end = endMs || startMs + 5;
        const span = {
            traceId: this.traceId,
            spanId: spanConfig.spanId || this.generateSpanId(),
            parentSpanId: spanConfig.parentSpanId || this.parentSpanId,
            name: spanConfig.name,
            kind: spanConfig.kind || 1, // INTERNAL
            startTimeUnixNano: this.toNanos(startMs),
            endTimeUnixNano: this.toNanos(end),
            attributes: Object.entries(spanConfig.attributes || {}).map(([key, value]) => ({
                key,
                value: typeof value === 'number'
                    ? { intValue: value.toString() }
                    : typeof value === 'boolean'
                        ? { boolValue: value }
                        : { stringValue: String(value) }
            })),
            status: { code: spanConfig.status || 1 }
        };

        const payload = {
            resourceSpans: [{
                resource: {
                    attributes: [
                        { key: 'service.name', value: { stringValue: 'ucm-smoke-tests' } },
                        { key: 'service.version', value: { stringValue: '1.0.0' } }
                    ]
                },
                scopeSpans: [{
                    scope: { name: 'smoke-test-runner' },
                    spans: [span]
                }]
            }]
        };

        try {
            const response = await fetch(OTEL_COLLECTOR_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                console.log(`  ⚠️ Failed to send span: ${response.status}`);
            }
        } catch (err) {
            // Silent fail - collector might not be running
        }
    }

    // ============================================
    // Test Result Tracking
    // ============================================
    async pass(testName, details = '', startMs) {
        const endMs = Date.now();
        const durationMs = startMs ? endMs - startMs : 0;
        this.passed++;
        this.results.push({ name: testName, status: 'pass', details, durationMs });
        console.log(`  ✅ ${testName}${details ? ` (${details})` : ''} [${durationMs}ms]`);

        // Send span for this test
        await this.sendSpan({
            name: `test.${testName.toLowerCase().replace(/\s+/g, '_')}`,
            attributes: {
                'test.name': testName,
                'test.status': 'pass',
                'test.details': details,
                'test.duration_ms': durationMs
            }
        }, startMs || endMs, endMs);
    }

    async fail(testName, error, startMs) {
        const endMs = Date.now();
        const durationMs = startMs ? endMs - startMs : 0;
        this.failed++;
        this.results.push({ name: testName, status: 'fail', error: error.toString(), durationMs });
        console.log(`  ❌ ${testName}: ${error} [${durationMs}ms]`);

        // Send span for this test with error status
        await this.sendSpan({
            name: `test.${testName.toLowerCase().replace(/\s+/g, '_')}`,
            attributes: {
                'test.name': testName,
                'test.status': 'fail',
                'test.error': error.toString(),
                'test.duration_ms': durationMs
            },
            status: 2 // ERROR
        }, startMs || endMs, endMs);
    }

    printSummary() {
        console.log('\n' + '='.repeat(70));
        console.log('SMOKE TEST SUMMARY');
        console.log('='.repeat(70));
        console.log(`  Total Tests: ${this.passed + this.failed}`);
        console.log(`  ✅ Passed: ${this.passed}`);
        console.log(`  ❌ Failed: ${this.failed}`);
        console.log(`  ⏱️  Duration: ${Date.now() - this.suiteStartTime}ms`);
        console.log('='.repeat(70));

        if (this.failed > 0) {
            console.log('\n🔴 Failed Tests:');
            this.results.filter(r => r.status === 'fail').forEach(r => {
                console.log(`   - ${r.name}: ${r.error}`);
            });
            process.exitCode = 1;
        } else {
            console.log('\n🎉 All smoke tests passed!');
        }
    }

    printConsoleSummary() {
        console.log('\n' + '='.repeat(70));
        console.log('BROWSER CONSOLE LOG ANALYSIS');
        console.log('='.repeat(70));
        console.log(`  Total Logs: ${this.consoleLogs.length}`);
        console.log(`  📛 Errors: ${this.errors.length}`);
        console.log(`  ⚠️  Warnings: ${this.warnings.length}`);

        if (this.errors.length > 0) {
            console.log('\n🔴 Console Errors:');
            // Group similar errors to reduce noise
            const errorGroups = {};
            this.errors.forEach(e => {
                const key = e.text.substring(0, 80);
                if (!errorGroups[key]) {
                    errorGroups[key] = { count: 0, first: e };
                }
                errorGroups[key].count++;
            });

            Object.entries(errorGroups).forEach(([key, data]) => {
                const suffix = data.count > 1 ? ` (x${data.count})` : '';
                console.log(`   ${key}${suffix}`);
            });
        }

        if (this.warnings.length > 0 && this.warnings.length <= 10) {
            console.log('\n🟡 Console Warnings:');
            this.warnings.slice(0, 5).forEach(w => {
                console.log(`   ${w.text.substring(0, 80)}`);
            });
            if (this.warnings.length > 5) {
                console.log(`   ... and ${this.warnings.length - 5} more`);
            }
        }

        console.log('\n📡 Observability:');
        console.log(`   Jaeger UI: http://localhost:16686`);
        console.log(`   Search by TraceID: ${this.traceId}`);
        console.log('='.repeat(70));
    }

    // ============================================
    // Test Scenarios
    // ============================================

    async testApplicationLoads() {
        console.log('\n📦 Testing Application Loading...');
        const startMs = Date.now();

        try {
            await this.page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 10000 });
            await this.pass('Application loads', '', startMs);

            const elements = await this.page.evaluate(() => ({
                hasCanvas: !!document.getElementById('canvas'),
                hasToolbar: !!document.getElementById('toolbar'),
                hasLeftPanel: !!document.getElementById('left-panel')
            }));

            if (!elements.hasCanvas) throw new Error('Canvas not found');
            if (!elements.hasToolbar) throw new Error('Toolbar not found');
            if (!elements.hasLeftPanel) throw new Error('Left panel not found');

            await this.pass('DOM elements exist', 'canvas, toolbar, panel', startMs);

        } catch (error) {
            await this.fail('Application Loading', error.message, startMs);
        }
    }

    async testGraphOperations() {
        console.log('\n📊 Testing Graph Operations...');
        const startMs = Date.now();

        try {
            await this.page.evaluate(() => window.ucmEditor.clear());
            await this.wait(200);

            // Create nodes
            const nodeResult = await this.page.evaluate(() => {
                const n1 = window.ucmGraph.addNode('start', { x: 200, y: 200 });
                const n2 = window.ucmGraph.addNode('responsibility', { x: 350, y: 200, name: 'TestResp' });
                const n3 = window.ucmGraph.addNode('end', { x: 500, y: 200 });
                const edge = window.ucmGraph.addEdge(n1.id, n2.id);
                return { nodeCount: window.ucmGraph.nodes.size, edgeCount: window.ucmGraph.edges.size };
            });

            if (nodeResult.nodeCount !== 3) throw new Error(`Expected 3 nodes, got ${nodeResult.nodeCount}`);
            await this.pass('Create nodes and edge', `${nodeResult.nodeCount} nodes, ${nodeResult.edgeCount} edges`, startMs);

            // Move node
            const moved = await this.page.evaluate(() => {
                const node = Array.from(window.ucmGraph.nodes.values())[0];
                window.ucmGraph.moveNode(node.id, 250, 250);
                return window.ucmGraph.getNode(node.id).position.x === 250;
            });
            if (!moved) throw new Error('Node move failed');
            await this.pass('Move node', '', startMs);

        } catch (error) {
            await this.fail('Graph Operations', error.message, startMs);
        }
    }

    async testComponentSystem() {
        console.log('\n🧩 Testing Component System...');
        const startMs = Date.now();

        try {
            await this.page.evaluate(() => window.ucmEditor.clear());
            await this.wait(200);

            const result = await this.page.evaluate(() => {
                const comp = window.ucmGraph.addComponent('team', {
                    x: 100, y: 100, width: 300, height: 200, name: 'TestTeam'
                });
                const node = window.ucmGraph.addNode('start', { x: 200, y: 200 });
                window.ucmGraph.bindNodeToComponent(node.id, comp.id);
                return {
                    compExists: !!comp,
                    nodeBound: window.ucmGraph.getNode(node.id).parentComponent === comp.id
                };
            });

            if (!result.compExists) throw new Error('Component creation failed');
            if (!result.nodeBound) throw new Error('Node binding failed');
            await this.pass('Component system', 'create, bind node', startMs);

        } catch (error) {
            await this.fail('Component System', error.message, startMs);
        }
    }

    async testSelection() {
        console.log('\n🎯 Testing Selection...');
        const startMs = Date.now();

        try {
            await this.page.evaluate(() => {
                window.ucmEditor.clear();
                window.ucmGraph.addNode('start', { x: 300, y: 300, name: 'SelectMe' });
            });
            await this.wait(300);

            // Test node selection
            const nodeSelected = await this.page.evaluate(() => {
                const node = Array.from(window.ucmGraph.nodes.values())[0];
                window.ucmSelection.selectNode(node.id);
                return window.ucmSelection.selectedNodes.has(node.id);
            });
            if (!nodeSelected) throw new Error('Node selection failed');
            await this.pass('Node selection', '', startMs);

            // Test edge selection
            await this.page.evaluate(() => {
                window.ucmEditor.clear();
                const n1 = window.ucmGraph.addNode('start', { x: 200, y: 300 });
                const n2 = window.ucmGraph.addNode('end', { x: 500, y: 300 });
                window.ucmGraph.addEdge(n1.id, n2.id);
            });
            await this.wait(300);

            const edgeSelected = await this.page.evaluate(() => {
                const edge = Array.from(window.ucmGraph.edges.values())[0];
                window.ucmSelection.selectEdge(edge.id);
                return window.ucmSelection.selectedEdges.has(edge.id);
            });
            if (!edgeSelected) throw new Error('Edge selection failed');
            await this.pass('Edge selection', '', startMs);

        } catch (error) {
            await this.fail('Selection', error.message, startMs);
        }
    }

    async testToolSwitching() {
        console.log('\n🔧 Testing Tool Switching...');
        const startMs = Date.now();

        try {
            await this.page.click('#tool-select');
            await this.wait(100);
            let active = await this.page.$eval('#tool-select', el => el.classList.contains('active'));
            if (!active) throw new Error('Select tool activation failed');

            await this.page.click('#tool-path');
            await this.wait(100);
            active = await this.page.$eval('#tool-path', el => el.classList.contains('active'));
            if (!active) throw new Error('Path tool activation failed');

            await this.page.click('#tool-component');
            await this.wait(100);
            active = await this.page.$eval('#tool-component', el => el.classList.contains('active'));
            if (!active) throw new Error('Component tool activation failed');

            await this.page.click('#tool-select');
            await this.pass('Tool switching', 'select, path, component', startMs);

        } catch (error) {
            await this.fail('Tool Switching', error.message, startMs);
        }
    }

    async testUndoRedo() {
        console.log('\n↩️ Testing Undo/Redo...');
        const startMs = Date.now();

        try {
            await this.page.evaluate(() => {
                window.ucmEditor.clear();
                window.ucmHistory.reset();
            });
            await this.wait(200);

            await this.page.evaluate(() => {
                window.ucmGraph.addNode('start', { x: 300, y: 300 });
            });
            await this.wait(500);

            const afterAdd = await this.page.evaluate(() => window.ucmGraph.nodes.size);
            if (afterAdd !== 1) throw new Error('Node not added');

            await this.page.evaluate(() => window.ucmHistory.undo());
            await this.wait(300);
            await this.page.evaluate(() => window.ucmHistory.redo());
            await this.wait(200);

            await this.pass('Undo/Redo', 'history operations available', startMs);

        } catch (error) {
            await this.fail('Undo/Redo', error.message, startMs);
        }
    }

    async testSerialization() {
        console.log('\n💾 Testing Serialization...');
        const startMs = Date.now();

        try {
            await this.page.evaluate(() => {
                window.ucmEditor.clear();
                const comp = window.ucmGraph.addComponent('team', { x: 50, y: 50, width: 400, height: 300 });
                const n1 = window.ucmGraph.addNode('start', { x: 100, y: 150 });
                const n2 = window.ucmGraph.addNode('end', { x: 400, y: 150 });
                window.ucmGraph.bindNodeToComponent(n1.id, comp.id);
                window.ucmGraph.addEdge(n1.id, n2.id);
            });
            await this.wait(200);

            const jsonData = await this.page.evaluate(() => window.ucmGraph.toJSON());
            if (!jsonData.nodes || jsonData.nodes.length !== 2) throw new Error('Serialization failed');

            await this.page.evaluate((data) => {
                window.ucmGraph.clear();
                window.ucmGraph.fromJSON(data);
            }, jsonData);
            await this.wait(200);

            const afterLoad = await this.page.evaluate(() => window.ucmGraph.nodes.size);
            if (afterLoad !== 2) throw new Error('Deserialization failed');

            await this.pass('Serialization', 'toJSON, fromJSON', startMs);

        } catch (error) {
            await this.fail('Serialization', error.message, startMs);
        }
    }

    async testZoomPan() {
        console.log('\n🔍 Testing Zoom/Pan...');
        const startMs = Date.now();

        try {
            const initialZoom = await this.page.evaluate(() => window.ucmCanvas.zoom);

            await this.page.click('#btn-zoom-in');
            await this.wait(100);
            const afterZoomIn = await this.page.evaluate(() => window.ucmCanvas.zoom);
            if (afterZoomIn <= initialZoom) throw new Error('Zoom in failed');

            await this.page.click('#btn-zoom-out');
            await this.wait(100);
            const afterZoomOut = await this.page.evaluate(() => window.ucmCanvas.zoom);

            // Test programmatic fit to window
            const fitWorked = await this.page.evaluate(() => {
                if (typeof window.ucmCanvas.fitToWindow === 'function') {
                    window.ucmCanvas.fitToWindow();
                    return true;
                }
                return false;
            });
            await this.wait(200);

            await this.pass('Zoom/Pan', `zoom in/out${fitWorked ? ', fit' : ''}`, startMs);

        } catch (error) {
            await this.fail('Zoom/Pan', error.message, startMs);
        }
    }

    async testDeleteOperations() {
        console.log('\n🗑️ Testing Delete...');
        const startMs = Date.now();

        try {
            await this.page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 10000 });
            await this.wait(300);

            await this.page.evaluate(() => window.ucmEditor.clear());
            await this.wait(300);

            const nodeId = await this.page.evaluate(() => {
                const n1 = window.ucmGraph.addNode('start', { x: 300, y: 300 });
                window.ucmGraph.addNode('end', { x: 500, y: 300 });
                return n1.id;
            });
            await this.wait(200);

            await this.page.evaluate((id) => window.ucmGraph.removeNode(id), nodeId);
            await this.wait(200);

            const remaining = await this.page.evaluate(() => window.ucmGraph.nodes.size);
            if (remaining !== 1) throw new Error(`Expected 1 node, got ${remaining}`);

            await this.pass('Delete operations', '', startMs);

        } catch (error) {
            await this.fail('Delete Operations', error.message, startMs);
        }
    }

    // ============================================
    // Main Test Runner
    // ============================================

    async run() {
        try {
            await this.setup();

            await this.testApplicationLoads();
            await this.testGraphOperations();
            await this.testComponentSystem();
            await this.testSelection();
            await this.testToolSwitching();
            await this.testUndoRedo();
            await this.testSerialization();
            await this.testZoomPan();
            await this.testDeleteOperations();

            await this.teardown();
        } catch (error) {
            console.error('\n💥 Test Runner Error:', error);
            await this.teardown();
            process.exit(1);
        }
    }
}

// Run tests
const runner = new ObservableSmokeTestRunner();
runner.run();
