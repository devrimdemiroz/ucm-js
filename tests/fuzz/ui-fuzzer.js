import puppeteer from 'puppeteer';

(async () => {
    console.log('Starting UCM UI Fuzzer...');
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Capture console errors
    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.error(`[Browser Error] ${msg.text()}`);
        }
    });

    page.on('pageerror', err => {
        console.error(`[Page Exception] ${err.toString()}`);
    });

    try {
        // Assuming local server is running on 8080 (standard for this project)
        await page.goto('http://localhost:8080', { waitUntil: 'networkidle0' });
        console.log('Page loaded.');

        // Helper to evaluate random actions
        await page.evaluate(async () => {
            const ACTIONS = 50;
            console.log(`Running ${ACTIONS} random actions...`);

            function randomInt(min, max) {
                return Math.floor(Math.random() * (max - min + 1)) + min;
            }

            for (let i = 0; i < ACTIONS; i++) {
                const actionType = randomInt(0, 3);
                const w = window.innerWidth;
                const h = window.innerHeight;

                try {
                    switch (actionType) {
                        case 0: // Add Node via Context Menu (simulated logic call for now)
                            if (window.graph) {
                                const x = randomInt(50, w - 50);
                                const y = randomInt(50, h - 50);
                                window.graph.addNode('responsibility', { x, y });
                                console.log(`Added node at ${x},${y}`);
                            }
                            break;

                        case 1: // Move Random Node
                            if (window.graph && window.graph.nodes.size > 0) {
                                const nodes = Array.from(window.graph.nodes.values());
                                const node = nodes[randomInt(0, nodes.length - 1)];
                                node.position.x += randomInt(-20, 20);
                                node.position.y += randomInt(-20, 20);
                                window.graph.updateNode(node.id, { position: node.position });
                                console.log(`Moved node ${node.id}`);
                            }
                            break;

                        case 2: // Selection Toggle
                            if (window.graph && window.graph.nodes.size > 0) {
                                const nodes = Array.from(window.graph.nodes.values());
                                const node = nodes[randomInt(0, nodes.length - 1)];
                                // Simulate selection logic
                                // window.selection.select(node);
                            }
                            break;
                    }
                    // Small delay
                    await new Promise(r => setTimeout(r, 50));
                } catch (e) {
                    console.error('Fuzzer Action Failed:', e);
                }
            }
        });

        console.log('Fuzzing complete. capturing screenshot...');
        await page.screenshot({ path: 'fuzz-report.png' });

    } catch (error) {
        console.error('Fuzzer failed:', error);
    } finally {
        await browser.close();
    }
})();
