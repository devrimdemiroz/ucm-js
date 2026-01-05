/**
 * Automated Test Script for UCM Editor Implementation Plan
 * Tests all features from Tasks 1, 2, and 3
 */

const puppeteer = require('puppeteer');

const TEST_URL = 'http://localhost:8088';
const WAIT_TIME = 500; // ms between actions

class UCMTester {
    constructor() {
        this.browser = null;
        this.page = null;
        this.results = {
            passed: [],
            failed: [],
            warnings: []
        };
    }

    async init() {
        console.log('🚀 Launching browser...');
        this.browser = await puppeteer.launch({
            headless: false,
            args: ['--window-size=1920,1080']
        });
        this.page = await this.browser.newPage();
        await this.page.setViewport({ width: 1920, height: 1080 });

        // Listen for console errors
        this.page.on('console', msg => {
            if (msg.type() === 'error') {
                this.results.warnings.push(`Console error: ${msg.text()}`);
            }
        });

        await this.page.goto(TEST_URL, { waitUntil: 'networkidle0' });
        console.log('✅ Browser launched and page loaded\n');
    }

    async wait(ms = WAIT_TIME) {
        await new Promise(resolve => setTimeout(resolve, ms));
    }

    pass(testName) {
        console.log(`✅ PASS: ${testName}`);
        this.results.passed.push(testName);
    }

    fail(testName, error) {
        console.log(`❌ FAIL: ${testName}`);
        console.log(`   Error: ${error}`);
        this.results.failed.push({ test: testName, error });
    }

    // ==================== TASK 1: DSL Editor Sidebar ====================

    async testSidebarTabs() {
        console.log('\n📋 Testing Task 1.1: Tabbed Sidebar Interface');

        try {
            // Check if tabs exist
            const tabs = await this.page.$$('.tab-btn');
            if (tabs.length !== 3) {
                throw new Error(`Expected 3 tabs, found ${tabs.length}`);
            }

            // Test Hierarchy tab
            await this.page.click('.tab-btn[data-tab="hierarchy"]');
            await this.wait();
            let activeTab = await this.page.$eval('#tab-hierarchy', el =>
                el.classList.contains('active')
            );
            if (!activeTab) throw new Error('Hierarchy tab not activated');

            // Test Editor tab
            await this.page.click('.tab-btn[data-tab="editor"]');
            await this.wait();
            activeTab = await this.page.$eval('#tab-editor', el =>
                el.classList.contains('active')
            );
            if (!activeTab) throw new Error('Editor tab not activated');

            // Test Settings tab
            await this.page.click('.tab-btn[data-tab="settings"]');
            await this.wait();
            activeTab = await this.page.$eval('#tab-settings', el =>
                el.classList.contains('active')
            );
            if (!activeTab) throw new Error('Settings tab not activated');

            this.pass('Task 1.1: Tabbed Sidebar UI');
        } catch (error) {
            this.fail('Task 1.1: Tabbed Sidebar UI', error.message);
        }
    }

    async testDSLEditor() {
        console.log('\n📝 Testing Task 1.2: DSL Editor Component');

        try {
            // Switch to editor tab
            await this.page.click('.tab-btn[data-tab="editor"]');
            await this.wait();

            // Check if DSL editor exists
            const editorExists = await this.page.$('#dsl-editor') !== null;
            if (!editorExists) throw new Error('DSL editor textarea not found');

            // Check if Apply button exists
            const applyBtnExists = await this.page.$('#btn-apply-dsl') !== null;
            if (!applyBtnExists) throw new Error('Apply DSL button not found');

            this.pass('Task 1.2: DSL Editor Implementation');
        } catch (error) {
            this.fail('Task 1.2: DSL Editor Implementation', error.message);
        }
    }

    async testSerialization() {
        console.log('\n🔄 Testing Task 1.3: Serialization Logic');

        try {
            // Load example diagram
            await this.page.select('#file-dropdown', 'demo-parallel-processing');
            await this.wait(1000);

            // Switch to editor tab
            await this.page.click('.tab-btn[data-tab="editor"]');
            await this.wait();

            // Get DSL content
            const dslContent = await this.page.$eval('#dsl-editor', el => el.value);

            // Verify DSL content has expected structure
            if (!dslContent.includes('ucm')) {
                throw new Error('DSL missing ucm declaration');
            }
            if (!dslContent.includes('component')) {
                throw new Error('DSL missing component declarations');
            }
            if (!dslContent.includes('link')) {
                throw new Error('DSL missing link declarations');
            }

            this.pass('Task 1.3: Serialization (Graph → DSL)');
        } catch (error) {
            this.fail('Task 1.3: Serialization (Graph → DSL)', error.message);
        }
    }

    async testParsing() {
        console.log('\n🔍 Testing Task 1.3: Parsing Logic');

        try {
            // Switch to editor tab
            await this.page.click('.tab-btn[data-tab="editor"]');
            await this.wait();

            // Clear and enter test DSL
            await this.page.click('#dsl-editor', { clickCount: 3 });
            const testDSL = `ucm "Test Diagram"

component "Test Component" type team at (100, 100) size (400, 300) {
  start "Begin" at (150, 150)
  responsibility "Process" at (250, 150)
  end "Done" at (350, 150)
}

link "Begin" -> "Process"
link "Process" -> "Done"`;

            await this.page.type('#dsl-editor', testDSL);
            await this.wait();

            // Click Apply
            await this.page.click('#btn-apply-dsl');
            await this.wait(1000);

            // Check if nodes were created (verify in hierarchy)
            await this.page.click('.tab-btn[data-tab="hierarchy"]');
            await this.wait();

            const hierarchyContent = await this.page.$eval('#hierarchy-tree', el => el.textContent);
            if (!hierarchyContent.includes('Begin') ||
                !hierarchyContent.includes('Process') ||
                !hierarchyContent.includes('Done')) {
                throw new Error('Parsed nodes not found in hierarchy');
            }

            this.pass('Task 1.3: Parsing (DSL → Graph)');
        } catch (error) {
            this.fail('Task 1.3: Parsing (DSL → Graph)', error.message);
        }
    }

    async testBidirectionalSync() {
        console.log('\n🔁 Testing Task 1.4: Bi-directional Synchronization');

        try {
            // Load diagram
            await this.page.select('#file-dropdown', 'dilbert');
            await this.wait(1000);

            // Test Graph → DSL: Get initial DSL
            await this.page.click('.tab-btn[data-tab="editor"]');
            await this.wait();
            const initialDSL = await this.page.$eval('#dsl-editor', el => el.value);

            if (!initialDSL.includes('ucm') || !initialDSL.includes('component')) {
                throw new Error('Graph → DSL sync failed: DSL not generated');
            }

            // Test DSL → Graph: Create simple diagram via DSL
            await this.page.click('#dsl-editor', { clickCount: 3 });
            await this.wait(200);

            const testDSL = `ucm "Sync Test"

component "Test Sync" type team at (100, 100) size (300, 200) {
  start "A" at (150, 150)
  end "B" at (250, 150)
}

link "A" -> "B"`;

            await this.page.evaluate((dsl) => {
                document.getElementById('dsl-editor').value = dsl;
            }, testDSL);
            await this.wait(200);

            // Apply changes
            await this.page.click('#btn-apply-dsl');
            await this.wait(1000);

            // Verify the graph was updated by checking hierarchy
            await this.page.click('.tab-btn[data-tab="hierarchy"]');
            await this.wait();

            const hierarchyContent = await this.page.$eval('#hierarchy-tree', el => el.textContent);
            if (!hierarchyContent.includes('Test Sync')) {
                throw new Error('DSL → Graph sync failed: Changes not applied to graph');
            }

            this.pass('Task 1.4: Bi-directional Synchronization');
        } catch (error) {
            this.fail('Task 1.4: Bi-directional Synchronization', error.message);
        }
    }

    // ==================== TASK 2: Export & Import System ====================

    async testSaveJSON() {
        console.log('\n💾 Testing Task 2.1: Save as JSON');

        try {
            // Check if save button exists
            const saveBtn = await this.page.$('#btn-save');
            if (!saveBtn) throw new Error('Save button not found');

            this.pass('Task 2.1: Save as JSON (UI present)');
        } catch (error) {
            this.fail('Task 2.1: Save as JSON', error.message);
        }
    }

    async testExportFormats() {
        console.log('\n📤 Testing Task 2.2 & 2.3: Export Formats');

        try {
            // Load a diagram first
            await this.page.select('#file-dropdown', 'demo-parallel-processing');
            await this.wait(1000);

            // Click export menu
            await this.page.click('#btn-export-menu');
            await this.wait();

            // Check all export options
            const exportOptions = await this.page.$$eval('.dropdown-menu .menu-item',
                items => items.map(item => item.textContent)
            );

            const expectedFormats = ['PDF (Image)', 'jUCM Format', 'D3.js Data', 'Cytoscape Data', 'SVG Vector'];
            for (const format of expectedFormats) {
                if (!exportOptions.includes(format)) {
                    throw new Error(`Missing export format: ${format}`);
                }
            }

            this.pass('Task 2.2 & 2.3: Export Format Options');
        } catch (error) {
            this.fail('Task 2.2 & 2.3: Export Format Options', error.message);
        }
    }

    async testImport() {
        console.log('\n📥 Testing Task 2.4: Import Functionality');

        try {
            // Check if import button exists
            const importBtn = await this.page.$('#btn-import-json');
            if (!importBtn) throw new Error('Import button not found');

            // Check if file input exists
            const fileInput = await this.page.$('#file-input');
            if (!fileInput) throw new Error('File input not found');

            this.pass('Task 2.4: Import UI Elements');
        } catch (error) {
            this.fail('Task 2.4: Import UI Elements', error.message);
        }
    }

    // ==================== TASK 3: Settings Panel ====================

    async testSettingsPanel() {
        console.log('\n⚙️  Testing Task 3.1: Settings Panel');

        try {
            // Switch to settings tab
            await this.page.click('.tab-btn[data-tab="settings"]');
            await this.wait();

            // Check Transit Map Mode toggle
            const transitMode = await this.page.$('#setting-transit-mode');
            if (!transitMode) throw new Error('Transit Map Mode toggle not found');

            // Check Show Grid toggle
            const showGrid = await this.page.$('#setting-show-grid');
            if (!showGrid) throw new Error('Show Grid toggle not found');

            // Check Show Labels toggle
            const showLabels = await this.page.$('#setting-show-labels');
            if (!showLabels) throw new Error('Show Labels toggle not found');

            // Check Snap to Grid toggle
            const snapGrid = await this.page.$('#setting-snap-grid');
            if (!snapGrid) throw new Error('Snap to Grid toggle not found');

            // Check Auto-layout toggle
            const autoLayout = await this.page.$('#setting-auto-layout');
            if (!autoLayout) throw new Error('Auto-layout toggle not found');

            // Check Edge Routing selector
            const routingMode = await this.page.$('#setting-routing-mode');
            if (!routingMode) throw new Error('Edge Routing selector not found');

            this.pass('Task 3.1: Settings Panel UI');
        } catch (error) {
            this.fail('Task 3.1: Settings Panel UI', error.message);
        }
    }

    async testSettingsToggles() {
        console.log('\n🎨 Testing Settings Functionality');

        try {
            // Switch to settings tab
            await this.page.click('.tab-btn[data-tab="settings"]');
            await this.wait(500);

            // Test Transit Map Mode - get initial state
            const initialTransitMode = await this.page.$eval('#setting-transit-mode', el => el.checked);

            // Click the label slider to toggle (more reliable than clicking the checkbox directly)
            await this.page.evaluate(() => {
                const checkbox = document.getElementById('setting-transit-mode');
                checkbox.click();
            });
            await this.wait(300);

            const newTransitMode = await this.page.$eval('#setting-transit-mode', el => el.checked);
            if (initialTransitMode === newTransitMode) {
                throw new Error('Transit mode toggle did not change state');
            }

            // Test Show Grid toggle
            await this.page.evaluate(() => {
                const checkbox = document.getElementById('setting-show-grid');
                checkbox.click();
            });
            await this.wait(300);

            // Test Show Labels toggle
            await this.page.evaluate(() => {
                const checkbox = document.getElementById('setting-show-labels');
                checkbox.click();
            });
            await this.wait(300);

            this.pass('Task 3.1: Settings Toggles Functional');
        } catch (error) {
            this.fail('Task 3.1: Settings Toggles Functional', error.message);
        }
    }

    // ==================== Additional Tests ====================

    async testExampleDiagrams() {
        console.log('\n📊 Testing Example Diagrams');

        const examples = [
            'demo-parallel-processing',
            'observability-stack',
            'dilbert'
        ];

        for (const example of examples) {
            try {
                await this.page.select('#file-dropdown', example);
                await this.wait(1000);

                // Verify diagram loaded by checking hierarchy
                await this.page.click('.tab-btn[data-tab="hierarchy"]');
                await this.wait();

                const hierarchyContent = await this.page.$eval('#hierarchy-tree', el => el.textContent);
                if (!hierarchyContent || hierarchyContent.trim().length === 0) {
                    throw new Error(`No content loaded for ${example}`);
                }

                this.pass(`Example diagram: ${example}`);
            } catch (error) {
                this.fail(`Example diagram: ${example}`, error.message);
            }
        }
    }

    async testToolbar() {
        console.log('\n🔧 Testing Toolbar Functionality');

        try {
            // Check tools exist
            const tools = await this.page.$$('.tool-btn');
            if (tools.length < 4) {
                throw new Error('Missing toolbar tools');
            }

            // Test tool selection
            await this.page.click('#tool-select');
            await this.wait();
            const isActive = await this.page.$eval('#tool-select', el =>
                el.classList.contains('active')
            );
            if (!isActive) throw new Error('Tool selection failed');

            this.pass('Toolbar tools present and functional');
        } catch (error) {
            this.fail('Toolbar tools', error.message);
        }
    }

    // ==================== Test Runner ====================

    async runAllTests() {
        console.log('\n' + '='.repeat(60));
        console.log('UCM EDITOR IMPLEMENTATION PLAN TEST SUITE');
        console.log('='.repeat(60));

        await this.init();

        // Task 1: DSL Editor Sidebar
        await this.testSidebarTabs();
        await this.testDSLEditor();
        await this.testSerialization();
        await this.testParsing();
        await this.testBidirectionalSync();

        // Task 2: Export & Import
        await this.testSaveJSON();
        await this.testExportFormats();
        await this.testImport();

        // Task 3: Settings
        await this.testSettingsPanel();
        await this.testSettingsToggles();

        // Additional
        await this.testExampleDiagrams();
        await this.testToolbar();

        this.printResults();
    }

    printResults() {
        console.log('\n' + '='.repeat(60));
        console.log('TEST RESULTS');
        console.log('='.repeat(60));

        console.log(`\n✅ Passed: ${this.results.passed.length}`);
        this.results.passed.forEach(test => {
            console.log(`   • ${test}`);
        });

        if (this.results.failed.length > 0) {
            console.log(`\n❌ Failed: ${this.results.failed.length}`);
            this.results.failed.forEach(({ test, error }) => {
                console.log(`   • ${test}`);
                console.log(`     → ${error}`);
            });
        }

        if (this.results.warnings.length > 0) {
            console.log(`\n⚠️  Warnings: ${this.results.warnings.length}`);
            this.results.warnings.forEach(warning => {
                console.log(`   • ${warning}`);
            });
        }

        const totalTests = this.results.passed.length + this.results.failed.length;
        const passRate = ((this.results.passed.length / totalTests) * 100).toFixed(1);

        console.log('\n' + '='.repeat(60));
        console.log(`SUMMARY: ${this.results.passed.length}/${totalTests} tests passed (${passRate}%)`);
        console.log('='.repeat(60) + '\n');
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
        }
    }
}

// Run tests
(async () => {
    const tester = new UCMTester();
    try {
        await tester.runAllTests();
    } catch (error) {
        console.error('Test suite error:', error);
    } finally {
        await tester.cleanup();
        process.exit(tester.results.failed.length > 0 ? 1 : 0);
    }
})();
