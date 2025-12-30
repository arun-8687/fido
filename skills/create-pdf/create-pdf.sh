#!/bin/bash
# create-pdf.sh - Create PDF files from text or markdown content
# Usage:
#   create-pdf.sh <output.pdf> <content_type> <content>
#   content_type: "text" or "markdown"
#
# Examples:
#   create-pdf.sh report.pdf markdown "# Report\n\nThis is the content..."
#   create-pdf.sh notes.pdf text "Plain text content here..."

OUTPUT_FILE="$1"
CONTENT_TYPE="${2:-text}"
CONTENT="$3"

if [ -z "$OUTPUT_FILE" ] || [ -z "$CONTENT" ]; then
    echo "Usage: create-pdf.sh <output.pdf> <content_type> <content>"
    echo "  content_type: text or markdown"
    exit 1
fi

# Ensure output has .pdf extension
if [[ "$OUTPUT_FILE" != *.pdf ]]; then
    OUTPUT_FILE="${OUTPUT_FILE}.pdf"
fi

# Create temp file for content
TEMP_FILE=$(mktemp /tmp/pdf_content.XXXXXX)
trap "rm -f $TEMP_FILE" EXIT

# Write content to temp file (interpret \n as newlines)
echo -e "$CONTENT" > "$TEMP_FILE"

# Try pandoc first (best quality) - with hyperlinks enabled
if command -v pandoc &> /dev/null; then
    # Common options for clickable hyperlinks
    HYPERLINK_OPTS="-V colorlinks=true -V linkcolor=blue -V urlcolor=blue"
    
    if [ "$CONTENT_TYPE" = "markdown" ]; then
        pandoc "$TEMP_FILE" -o "$OUTPUT_FILE" --pdf-engine=xelatex $HYPERLINK_OPTS 2>/dev/null \
        || pandoc "$TEMP_FILE" -o "$OUTPUT_FILE" --pdf-engine=pdflatex $HYPERLINK_OPTS 2>/dev/null \
        || pandoc "$TEMP_FILE" -o "$OUTPUT_FILE" $HYPERLINK_OPTS 2>/dev/null
    else
        pandoc "$TEMP_FILE" -o "$OUTPUT_FILE" $HYPERLINK_OPTS 2>/dev/null
    fi
    
    if [ -f "$OUTPUT_FILE" ]; then
        echo "Created PDF: $OUTPUT_FILE (using pandoc)"
        ls -la "$OUTPUT_FILE"
        exit 0
    fi
fi

# Fallback: wkhtmltopdf (HTML to PDF)
if command -v wkhtmltopdf &> /dev/null; then
    # Wrap content in basic HTML
    HTML_TEMP=$(mktemp /tmp/pdf_html.XXXXXX.html)
    trap "rm -f $TEMP_FILE $HTML_TEMP" EXIT
    
    if [ "$CONTENT_TYPE" = "markdown" ]; then
        # If markdown and we have pandoc for HTML conversion
        if command -v pandoc &> /dev/null; then
            pandoc "$TEMP_FILE" -o "$HTML_TEMP" 2>/dev/null
        else
            # Basic markdown-like conversion
            cat > "$HTML_TEMP" << EOF
<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
h1 { color: #333; } h2 { color: #555; } pre { background: #f4f4f4; padding: 10px; }
</style></head><body><pre>$(cat "$TEMP_FILE")</pre></body></html>
EOF
        fi
    else
        cat > "$HTML_TEMP" << EOF
<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; white-space: pre-wrap; }
</style></head><body>$(cat "$TEMP_FILE")</body></html>
EOF
    fi
    
    wkhtmltopdf --quiet "$HTML_TEMP" "$OUTPUT_FILE" 2>/dev/null
    
    if [ -f "$OUTPUT_FILE" ]; then
        echo "Created PDF: $OUTPUT_FILE (using wkhtmltopdf)"
        ls -la "$OUTPUT_FILE"
        exit 0
    fi
fi

# Fallback: enscript + ps2pdf (text only, no markdown)
if command -v enscript &> /dev/null && command -v ps2pdf &> /dev/null; then
    PS_TEMP=$(mktemp /tmp/pdf_ps.XXXXXX.ps)
    trap "rm -f $TEMP_FILE $PS_TEMP" EXIT
    
    enscript -p "$PS_TEMP" "$TEMP_FILE" 2>/dev/null
    ps2pdf "$PS_TEMP" "$OUTPUT_FILE" 2>/dev/null
    
    if [ -f "$OUTPUT_FILE" ]; then
        echo "Created PDF: $OUTPUT_FILE (using enscript)"
        ls -la "$OUTPUT_FILE"
        exit 0
    fi
fi

# Fallback: Python with reportlab
if command -v python3 &> /dev/null; then
    python3 << PYTHON_SCRIPT
import sys
try:
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet
    
    doc = SimpleDocTemplate("$OUTPUT_FILE", pagesize=letter)
    styles = getSampleStyleSheet()
    story = []
    
    with open("$TEMP_FILE", "r") as f:
        for line in f:
            if line.strip():
                story.append(Paragraph(line.strip(), styles["Normal"]))
            story.append(Spacer(1, 6))
    
    doc.build(story)
    print("Created PDF: $OUTPUT_FILE (using Python reportlab)")
except ImportError:
    sys.exit(1)
PYTHON_SCRIPT
    
    if [ -f "$OUTPUT_FILE" ]; then
        ls -la "$OUTPUT_FILE"
        exit 0
    fi
fi

echo "ERROR: No PDF generation tools available."
echo "Install one of: pandoc, wkhtmltopdf, enscript+ghostscript, or python3-reportlab"
exit 1
