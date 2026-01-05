const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    try {
        console.log('Loading UCM Editor...');
        await page.goto('http://localhost:8080', { waitUntil: 'networkidle0' });

        // Helper to get zoom level
        const getZoomLevel = async () => {
            const text = await page.$eval('#zoom-level', el => el.textContent);
            return parseFloat(text);
        };

        // 1. Test Zoom Buttons
        console.log('Testing Zoom Buttons...');
        const initialZoom = await getZoomLevel();
        await page.click('#btn-zoom-in');
        const zoomAfterIn = await getZoomLevel();
        if (zoomAfterIn <= initialZoom) throw new Error('Zoom In button did not increase zoom');

        await page.click('#btn-zoom-out');
        const zoomAfterOut = await getZoomLevel();
        if (zoomAfterOut >= zoomAfterIn) throw new Error('Zoom Out button did not decrease zoom');
        console.log('✅ Zoom Buttons working');

        // 2. Test Shortcuts
        console.log('Testing Keyboard Shortcuts...');
        // Focus canvas
        await page.click('#canvas');

        const zoomBeforeShortcut = await getZoomLevel();
        await page.keyboard.down('Control');
        await page.keyboard.press('=');
        await page.keyboard.up('Control');

        // Wait a bit for update
        await new Promise(r => setTimeout(r, 100));
        const zoomAfterShortcut = await getZoomLevel();

        if (zoomAfterShortcut <= zoomBeforeShortcut) {
            throw new Error(`Ctrl+= did not zoom in (Before: ${zoomBeforeShortcut}, After: ${zoomAfterShortcut})`);
        }
        console.log('✅ Zoom In Shortcut (Ctrl+=) working');

        // Test Ctrl-
        await page.keyboard.down('Control');
        await page.keyboard.press('-');
        await page.keyboard.up('Control');
        await new Promise(r => setTimeout(r, 100));

        const zoomAfterShortcutOut = await getZoomLevel();
        if (zoomAfterShortcutOut >= zoomAfterShortcut) {
            throw new Error(`Ctrl+- did not zoom out`);
        }
        console.log('✅ Zoom Out Shortcut (Ctrl-) working');

        // 3. Test Limits (Quick check)
        console.log('Testing Zoom Limits...');
        for (let i = 0; i < 20; i++) await page.click('#btn-zoom-in');
        const maxZoom = await getZoomLevel();
        if (maxZoom > 400) throw new Error(`Zoom exceeded max limit (Got: ${maxZoom})`);
        console.log('✅ Zoom Max Limit respected');

    } catch (error) {
        console.error('❌ TEST FAILED:', error.message);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
