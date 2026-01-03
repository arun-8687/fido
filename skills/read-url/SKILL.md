# Read URL Skill

Fido can read and extract content from any web URL using a headless browser.

## When to Use

Use this skill when user asks to:
- Read/view a webpage
- Extract content from a URL
- Summarize a web article
- Check what's on a website
- Get text from a link someone shared

## Usage

```bash
node /home/ubuntu/clawd/skills/read-url/read-url.js "URL" [options]
```

### Options
- `--screenshot` - Save a screenshot to /tmp/screenshot.png
- `--full` - Extract full page (not just main content)
- `--vision` - Use Gemini Vision AI to analyze the page screenshot

## Examples

### Read an article (uses Readability.js for clean extraction):
```bash
node /home/ubuntu/clawd/skills/read-url/read-url.js "https://example.com/article"
```

### Read with AI vision analysis:
```bash
node /home/ubuntu/clawd/skills/read-url/read-url.js "https://example.com" --vision
```

### Read and take screenshot:
```bash
node /home/ubuntu/clawd/skills/read-url/read-url.js "https://example.com" --screenshot
```

## Notes

- **Readability.js** is used by default for cleaner article extraction (same as Firefox Reader View)
- **Vision mode** uses Gemini to describe visual elements like charts, images, and infographics
- Output is limited to ~8000 characters to stay within context limits
- Works with JavaScript-rendered pages (uses headless Chromium)
- Screenshots are saved to /tmp/screenshot.png

## After Reading

After extracting content, summarize or answer the user's question based on the extracted text.
