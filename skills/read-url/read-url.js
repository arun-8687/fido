#!/usr/bin/env node
/**
 * read-url.js - Fetch and extract text content from a URL using Playwright
 * 
 * Usage: node read-url.js <url> [options]
 * 
 * Options:
 *   --screenshot    Save a screenshot to /tmp/screenshot.png
 *   --full          Extract full page content (default: main content only)
 *   --vision        Use Gemini Vision to analyze the page screenshot
 */

const { chromium } = require('playwright');

const url = process.argv[2];
const takeScreenshot = process.argv.includes('--screenshot');
const takeVision = process.argv.includes('--vision');
const fullPage = process.argv.includes('--full');

if (!url) {
    console.error('Usage: node read-url.js <url> [--screenshot] [--full] [--vision]');
    process.exit(1);
}

/**
 * Use Gemini Vision API to analyze a screenshot
 */
async function analyzeWithVision(screenshotBuffer) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('[Vision] Error: GEMINI_API_KEY not set');
        return null;
    }

    const base64Image = screenshotBuffer.toString('base64');

    const requestBody = {
        contents: [{
            parts: [
                {
                    text: "Extract all readable text from this webpage screenshot. Also describe any important visual elements like images, charts, diagrams, or infographics. Format the output as markdown with clear sections."
                },
                {
                    inline_data: {
                        mime_type: "image/png",
                        data: base64Image
                    }
                }
            ]
        }]
    };

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            }
        );

        if (!response.ok) {
            const error = await response.text();
            console.error(`[Vision] API Error: ${response.status} - ${error}`);
            return null;
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch (err) {
        console.error(`[Vision] Error: ${err.message}`);
        return null;
    }
}

(async () => {
    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });

        const page = await context.newPage();

        // Navigate with timeout
        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });

        // Wait a bit for JS to render
        await page.waitForTimeout(2000);

        // Take screenshot if requested (or needed for vision)
        let screenshotBuffer = null;
        if (takeScreenshot || takeVision) {
            screenshotBuffer = await page.screenshot({ path: takeScreenshot ? '/tmp/screenshot.png' : undefined, fullPage: true });
            if (takeScreenshot) {
                console.log('[Screenshot saved to /tmp/screenshot.png]');
            }
        }

        // Vision analysis
        if (takeVision && screenshotBuffer) {
            console.log('[Vision Analysis]\n');
            const visionResult = await analyzeWithVision(screenshotBuffer);
            if (visionResult) {
                console.log(visionResult);
                console.log('\n---\n');
            }
        }

        // Get page title
        const title = await page.title();

        // Try Readability.js via CDN (injected into page context)
        let text;
        let usedReadability = false;

        if (!fullPage) {
            try {
                const article = await page.evaluate(async () => {
                    // Dynamically import Readability from CDN
                    const { Readability } = await import('https://cdn.jsdelivr.net/npm/@mozilla/readability@0.6.0/+esm');
                    const documentClone = document.cloneNode(true);
                    const reader = new Readability(documentClone);
                    return reader.parse();
                });

                if (article && article.textContent && article.textContent.length > 200) {
                    usedReadability = true;
                    text = article.textContent;
                    console.log(`# ${article.title || title}\n`);
                    if (article.byline) {
                        console.log(`*By: ${article.byline}*\n`);
                    }
                }
            } catch (err) {
                // Readability import failed (CSP or other issue), fall back to DOM extraction
            }
        }

        // Fallback to DOM extraction
        if (!text) {
            if (fullPage) {
                text = await page.evaluate(() => document.body.innerText);
            } else {
                text = await page.evaluate(() => {
                    // Remove noise elements
                    const removeSelectors = [
                        'script', 'style', 'nav', 'header', 'footer',
                        '.nav', '.header', '.footer', '.sidebar', '.menu',
                        '.advertisement', '.ad', '.ads', '[role="navigation"]',
                        '.cookie-banner', '.popup', '.modal'
                    ];
                    removeSelectors.forEach(sel => {
                        document.querySelectorAll(sel).forEach(el => el.remove());
                    });

                    // Try to find main content
                    const mainSelectors = ['main', 'article', '[role="main"]', '.content', '.post', '.article'];
                    for (const sel of mainSelectors) {
                        const el = document.querySelector(sel);
                        if (el && el.innerText.length > 200) {
                            return el.innerText;
                        }
                    }

                    // Fallback to body
                    return document.body.innerText;
                });
            }
            console.log(`# ${title}\n`);
        }

        console.log(`URL: ${url}\n`);
        if (usedReadability) {
            console.log(`[Extracted with Readability.js]\n`);
        }
        console.log('---\n');

        // Clean up and limit output
        const cleanText = text
            .replace(/\n{3,}/g, '\n\n')
            .replace(/\t+/g, ' ')
            .trim()
            .slice(0, 8000);

        console.log(cleanText);

    } catch (err) {
        console.error(`Error fetching URL: ${err.message}`);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
