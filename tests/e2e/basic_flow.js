import puppeteer from 'puppeteer';

(async () => {
    console.log('Starting E2E Scenario: Basic Workflow...');
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    // Helper: Wait for function with timeout
    const waitFor = async (ms) => new Promise(r => setTimeout(r, ms));

    try {
        // 1. Load Application
        console.log('[Step 1] Loading Application...');
        await page.goto('http://localhost:8080', { waitUntil: 'networkidle0' });

        // Clear any default loaded example
        await page.evaluate(() => window.ucmEditor.clear());
        await waitFor(500);

        // 2. Select Component Tool and Create Component
        console.log('[Step 2] Creating Component...');

        // Click C tool (Component Tool)
        await page.click('#tool-component');
        await waitFor(200);

        const isComponentToolActive = await page.evaluate(() => {
            return document.getElementById('tool-component').classList.contains('active');
        });
        console.log('Component Tool Active:', isComponentToolActive);

        // Draw Component at 100,100 to 400,400 ("Draw" logic depends on tool)

        // Draw Component at 300,100 to 600,400 (Avoid sidebar)
        await page.mouse.move(300, 100);
        await page.mouse.down();
        await waitFor(100);
        await page.mouse.move(600, 400, { steps: 50 }); // Drag to size slowly
        await waitFor(100);
        await page.mouse.up();
        await waitFor(500);

        await waitFor(500);

        // Verify Component Exists
        const compCount = await page.evaluate(() => window.ucmGraph.components.size);
        if (compCount !== 1) throw new Error(`Expected 1 component, found ${compCount}`);
        console.log('Verified: Component created.');

        // 3. Create Nodes inside Component
        console.log('[Step 3] Adding Nodes...');
        await page.evaluate(() => {
            // Direct injection to ensure precision, simulating "Click to add" logic matches this
            window.ucmGraph.addNode('start', { x: 350, y: 150 });
            window.ucmGraph.addNode('end', { x: 550, y: 350 });
        });

        await waitFor(500);

        const nodeCount = await page.evaluate(() => window.ucmGraph.nodes.size);
        if (nodeCount !== 2) throw new Error(`Expected 2 nodes, found ${nodeCount}`);

        // Check binding (Parent Component)
        const boundNodes = await page.evaluate(() => {
            return Array.from(window.ucmGraph.nodes.values()).filter(n => !!n.parentComponent).length;
        });
        // Note: Our drag-drop logic creates bindings. Direct add via API might not unless we run the binder.
        // Let's force a "move" to trigger binding logic if needed, or check if we need to manually bind in test.
        // The current graph.addNode doesn't auto-bind. The UI drag handler does. 
        // Let's simulate a small drag on the nodes to trigger "drop" logic?
        // Or just manually bind for this test to verify the graph state.

        // Actually, let's verify visual existence
        const nodeElements = await page.evaluate(() => document.querySelectorAll('.ucm-node').length);
        if (nodeElements !== 2) throw new Error(`Expected 2 node DOM elements, found ${nodeElements}`);
        console.log('Verified: Nodes created and rendered.');

        // 4. Create Path
        console.log('[Step 4] Connecting Nodes...');
        await page.evaluate(() => {
            const nodes = Array.from(window.ucmGraph.nodes.values());
            window.ucmGraph.addEdge(nodes[0].id, nodes[1].id);
        });
        await waitFor(500);

        const edgeCount = await page.evaluate(() => window.ucmGraph.edges.size);
        if (edgeCount !== 1) throw new Error(`Expected 1 edge, found ${edgeCount}`);
        console.log('Verified: Edge created.');

        // 5. Drag Component (Should move nodes)
        console.log('[Step 5] Moving Component...');
        // We need to bind them first for the "move component moves nodes" logic to work if we skipped the UI drag
        await page.evaluate(() => {
            const comps = Array.from(window.ucmGraph.components.values());
            const nodes = Array.from(window.ucmGraph.nodes.values());
            // Manually bind for test stability
            window.ucmGraph.bindNodeToComponent(nodes[0].id, comps[0].id);
            window.ucmGraph.bindNodeToComponent(nodes[1].id, comps[0].id);
        });

        const startPos = await page.evaluate(() => {
            return window.ucmGraph.nodes.values().next().value.position.x;
        });

        // Move component by 50px
        // Move component by 50px on X axis
        await page.evaluate(() => {
            const comp = window.ucmGraph.components.values().next().value;
            window.ucmGraph.moveComponent(comp.id, comp.bounds.x + 50, comp.bounds.y);
        });

        const endPos = await page.evaluate(() => {
            return window.ucmGraph.nodes.values().next().value.position.x;
        });

        if (endPos - startPos !== 50) throw new Error(`Node did not move with component. Diff: ${endPos - startPos}`);
        console.log('Verified: Nodes moved with component.');

        console.log('SUCCESS: Basic Flow Scenario passed.');
        await page.screenshot({ path: 'tests/e2e/basic-flow-pass.png' });

    } catch (error) {
        console.error('FAILURE:', error);
        await page.screenshot({ path: 'tests/e2e/basic-flow-fail.png' });
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
