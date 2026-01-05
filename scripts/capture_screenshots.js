const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
    // Ensure docs/images exists
    const imagesDir = path.resolve(__dirname, '../docs/images');
    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
    }

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
        defaultViewport: { width: 1920, height: 1080 }
    });

    const page = await browser.newPage();

    // Log console output for debugging
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    console.log('Navigating to http://localhost:8080/');
    await page.goto('http://localhost:8080/', { waitUntil: 'networkidle0' });

    console.log('Taking default screenshot...');
    await page.screenshot({ path: path.join(imagesDir, 'ucm-editor-default.png') });

    // Load Dilbert Commute example
    console.log('Loading Dilbert Commute example...');
    await page.select('#file-dropdown', 'dilbert');

    // Manually trigger change event just in case
    await page.evaluate(() => {
        const select = document.querySelector('#file-dropdown');
        const event = new Event('change', { bubbles: true });
        select.dispatchEvent(event);
    });

    // Wait for the diagram to re-render. 
    // Since we don't have a clear loading indicator, we'll wait 2 seconds.
    await new Promise(r => setTimeout(r, 2000));

    // Refocus canvas/body to close any dropdowns if open?
    await page.mouse.click(500, 500);

    console.log('Taking Dilbert diagram screenshot...');
    await page.screenshot({ path: path.join(imagesDir, 'ucm-dilbert-diagram.png') });

    // Open DSL Editor tab
    console.log('Opening DSL Editor tab...');
    await page.click('button[data-tab="editor"]');

    // Wait for animation/switch
    await new Promise(r => setTimeout(r, 500));

    console.log('Taking DSL Editor screenshot...');
    await page.screenshot({ path: path.join(imagesDir, 'ucm-dsl-editor.png') });

    // Open Settings tab
    console.log('Opening Settings tab...');
    await page.click('button[data-tab="settings"]');

    // Wait for animation/switch
    await new Promise(r => setTimeout(r, 500));

    console.log('Taking Settings screenshot...');
    await page.screenshot({ path: path.join(imagesDir, 'ucm-settings.png') });

    await browser.close();
    console.log('Screenshots captured successfully.');
})();
