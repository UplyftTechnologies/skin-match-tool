const puppeteer = require('puppeteer-core');

const width = Number(process.argv[2]) || 390;
const height = Number(process.argv[3]) || 844;
const out = process.argv[4] || 'pshot.png';
const port = process.argv[5] || 3000;

(async () => {
    const browser = await puppeteer.launch({
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        headless: 'new',
        userDataDir: `${process.env.TEMP}\\claude-pptr-${Date.now()}`,
        args: ['--disable-gpu', '--no-sandbox'],
        protocolTimeout: 60000,
    });
    const page = await browser.newPage();
    await page.setViewport({ width, height });
    await page.goto(`http://localhost:${port}/MatchStudio`, { waitUntil: 'load', timeout: 45000 });
    await new Promise(r => setTimeout(r, 1200));
    const el = await page.$('nav[aria-label="How Roopsee works"]');
    if (el) {
        await el.screenshot({ path: out });
    } else {
        await page.screenshot({ path: out });
    }
    await browser.close();
})();
