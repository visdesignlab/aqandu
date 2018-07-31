const puppeteer = require('puppeteer');

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setViewport({width: 1301, height: 948});
    await page.goto('http://127.0.0.1:8080/', {waitUntil: 'networkidle2'});
    await timeout(8000);
    await page.screenshot({path: 'contourScreenshots/40.png'});

    // await page.evaluate(function() {
    // 	imageUrl = 'static/friday.svg';
    //
    // 	location.reload();
    // });
    //
    // await timeout(10000);
    // await page.screenshot({path: 'testFriday.png'});

    browser.close();
})();
