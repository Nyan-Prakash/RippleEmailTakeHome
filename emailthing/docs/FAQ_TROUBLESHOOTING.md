# FAQ Mini Troubleshooting Guide

## Issue: FAQ section showing only title, no Q&A items

### Root Cause
The FAQ section requires blocks to be structured in a specific alternating pattern:
- Heading block (question)
- Paragraph block (answer)
- Heading block (question)
- Paragraph block (answer)
- Heading block (question)
- Paragraph block (answer)

If this pattern isn't followed, the rendering code won't find any Q&A pairs to display.

### Correct Structure Example

```json
{
  "id": "faq-01",
  "type": "faqMini",
  "blocks": [
    {
      "type": "heading",
      "text": "What is your return policy?",
      "level": 3
    },
    {
      "type": "paragraph",
      "text": "We offer a 30-day money-back guarantee on all purchases. If you're not completely satisfied, simply contact our support team to initiate a return. We'll process your refund within 5-7 business days."
    },
    {
      "type": "heading",
      "text": "How long does shipping take?",
      "level": 3
    },
    {
      "type": "paragraph",
      "text": "Standard shipping typically takes 3-5 business days within the continental US. Expedited shipping options are available at checkout for faster delivery. International orders may take 7-14 business days depending on customs processing."
    },
    {
      "type": "heading",
      "text": "Do you offer customer support?",
      "level": 3
    },
    {
      "type": "paragraph",
      "text": "Yes, our customer support team is available 24/7 via email, phone, and live chat. We pride ourselves on responding to all inquiries within 2 hours during business hours. Our team is here to help with any questions or concerns you may have."
    }
  ]
}
```

### Common Mistakes

❌ **Wrong: Missing blocks array**
```json
{
  "type": "faqMini",
  "blocks": []  // Empty!
}
```

❌ **Wrong: Only headings, no paragraphs**
```json
{
  "type": "faqMini",
  "blocks": [
    {"type": "heading", "text": "Question 1?"},
    {"type": "heading", "text": "Question 2?"},
    {"type": "heading", "text": "Question 3?"}
  ]
}
```

❌ **Wrong: Paragraphs before headings**
```json
{
  "type": "faqMini",
  "blocks": [
    {"type": "paragraph", "text": "Answer 1"},
    {"type": "heading", "text": "Question 1?"}
  ]
}
```

### How to Verify Your FAQ Section

1. **Check the JSON structure**: Ensure blocks array has exactly 6 items (3 headings + 3 paragraphs)

2. **Check the pattern**: Items must alternate: heading → paragraph → heading → paragraph → heading → paragraph

3. **Check block types**: All questions must be `type: "heading"` and all answers must be `type: "paragraph"`

4. **Check text content**: Both `text` fields should have non-empty strings

### Debug Mode

The latest version of the renderer now shows a helpful message if no Q&A pairs are found:

```
Frequently Asked Questions

No FAQ items available. Please ensure the section has heading and paragraph blocks in alternating order.
```

If you see this message, check your email spec JSON to ensure the FAQ section blocks are properly structured.

### Expected Output

When working correctly, you should see:

```
Frequently Asked Questions

🔵 1  What is your return policy?
       We offer a 30-day money-back guarantee on all purchases...

🔵 2  How long does shipping take?
       Standard shipping typically takes 3-5 business days...

🔵 3  Do you offer customer support?
       Yes, our customer support team is available 24/7...
```

(🔵 represents the numbered circle in your brand's primary color)

### LLM Generation Check

If you're generating emails via the LLM, ensure:
1. The prompt includes the FAQ Mini example (it does as of the latest update)
2. The LLM is instructed to create EXACTLY 3 Q&A pairs
3. Each answer must be 2-3 sentences

The system prompt includes this example at lines 465-477 in `lib/llm/generateEmailSpec.ts`.

### Quick Fix

If you need to manually create an FAQ section, use this template:

```json
{
  "id": "faq-section",
  "type": "faqMini",
  "style": {
    "background": "base"
  },
  "blocks": [
    {"type": "heading", "text": "Your Question Here?", "level": 3},
    {"type": "paragraph", "text": "Your detailed 2-3 sentence answer here. Make it helpful and informative. Provide real value to the reader."},
    {"type": "heading", "text": "Another Question?", "level": 3},
    {"type": "paragraph", "text": "Another detailed 2-3 sentence answer. Keep answers concise but complete. Address the reader's concern fully."},
    {"type": "heading", "text": "Final Question?", "level": 3},
    {"type": "paragraph", "text": "Final detailed answer with 2-3 sentences. Conclude with value. Leave the reader satisfied."}
  ]
}
```

## Still Having Issues?

1. Copy your FAQ section JSON
2. Verify it matches the structure above
3. Check that there are exactly 6 blocks (3 Q + 3 A)
4. Ensure the order is: H P H P H P (Heading, Paragraph, Heading, Paragraph, Heading, Paragraph)
5. Run the rendering tests to verify the renderer is working: `npm test -- lib/render/mjml/__tests__/faqMiniRendering.test.ts`
