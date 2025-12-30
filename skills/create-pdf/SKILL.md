# create-pdf Skill

Create PDF files from text or markdown content and **send them to the user immediately**.

## Usage

```bash
~/clawd/skills/create-pdf/create-pdf.sh <output.pdf> <content_type> <content>
```

### Parameters
- `output.pdf`: Output file path (will add .pdf if missing)
- `content_type`: "text" or "markdown"
- `content`: The content to convert (use \n for newlines)

## Examples

### Create a Markdown PDF
```bash
~/clawd/skills/create-pdf/create-pdf.sh ~/clawd/report.pdf markdown "# Report Title\n\n## Summary\n\nThis is the report content with **bold** and *italic* text."
```

### Create a Plain Text PDF
```bash
~/clawd/skills/create-pdf/create-pdf.sh ~/clawd/notes.pdf text "Meeting Notes\n\n- Point 1\n- Point 2\n- Action items"
```

## IMPORTANT: After Creating the PDF

**You MUST immediately send the PDF file to the user in the same response.** Do NOT just announce that the file was created - include the file path in your media response so it gets sent automatically.

After running the create-pdf command, include the output file path (e.g., `~/clawd/report.pdf`) as an attachment in your reply to send it to the user.

## Requirements

Requires `pandoc` on the system (falls back to other tools if unavailable).

