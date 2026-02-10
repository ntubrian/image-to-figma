# image-to-figma

A small pipeline that turns a reference screenshot into a Figma frame with generated vector/text layers.

## What this project expects from AI output

The server validates model output against a strict schema before the plugin renders nodes into Figma. The output must contain:

- `canvas`: `{ name, width, height }`
- `nodes`: array of nodes (`rect`, `text`, `frame`, `ellipse`, `image`)
- Every node must include numeric `x`, `y`, `width`, `height`

See `packages/shared/src/spec.ts` for the source-of-truth schema.

---

## Recommended workflow (image → validate visually → JSON → Figma)

Use this 3-pass process to improve consistency and reduce malformed JSON.

### Pass 1: Structural brief (no pixels yet)
Give ChatGPT your product spec (like your chat app shell spec) and ask for a concise **layout plan** first.

Prompt template:

```md
You are a UI layout planner.

Goal: produce a concise, implementation-ready layout plan for a [web/mobile] UI.
Constraints:
- Coordinate system origin is top-left.
- Output sections: canvas size, regions, repeated components, state variants.
- Keep to measurable values (px, spacing, row heights, max widths).

Input spec:
[PASTE YOUR SPEC]

Output format:
1) Canvas assumptions
2) Regions with explicit dimensions
3) Component inventory
4) State matrix (default/hover/selected/disabled/error)
5) Risks/ambiguities to resolve before image generation
```

### Pass 2: Image generation pass
Once structure looks right, ask for an image prompt that enforces layout and hierarchy.

Prompt template:

```md
Generate ONE high-fidelity UI mock screenshot prompt.

Requirements:
- Match this layout plan exactly:
[PASTE PASS-1 LAYOUT PLAN]
- Desktop viewport: 1440x1024 unless otherwise specified.
- Sharp UI text, realistic spacing, clear panel boundaries.
- Do not add decorative elements that break layout.
- Maintain accessibility contrast.

Output:
- A single final image-generation prompt.
- A 10-point checklist I can use to judge if the image matches spec.
```

Then generate the image and manually check the checklist.

### Pass 3: JSON extraction pass (for this repo schema)
After image acceptance, ask ChatGPT to produce a schema-compatible JSON.

Prompt template:

```md
Convert the approved UI screenshot into JSON for a Figma generator.

Hard constraints (must follow exactly):
- Return JSON only.
- Top-level shape:
  {
    "canvas": { "name": string, "width": number, "height": number },
    "nodes": DesignNode[]
  }
- Allowed node types only: "rect", "text", "frame", "ellipse", "image".
- Every node must have: x, y, width, height (numbers).
- Colors use 0..1 floats: { r, g, b, a? }.
- If uncertain, prefer fewer nodes with correct geometry.
- Do NOT invent unsupported keys (e.g., button, section, stack, gradient).

Preferred extraction strategy:
1) Create large structural frames first.
2) Add repeated rows/items with consistent heights and spacing.
3) Add text nodes for visible labels.
4) Use rect for icons/placeholders if details are uncertain.
5) Keep node count manageable and coherent.

Quality checks before final output:
- Canvas size matches screenshot.
- No overlapping major panels unintentionally.
- Sidebar/main/right panel widths are plausible.
- Text nodes have readable font sizes.
- JSON parses without comments/trailing commas.

Now output final JSON only.
```

---

## Copy/paste “golden” JSON starter

Use this as a safe starter when prompting the model:

```json
{
  "canvas": { "name": "Generated from Image", "width": 1440, "height": 1024 },
  "nodes": [
    {
      "type": "frame",
      "name": "App Shell",
      "x": 0,
      "y": 0,
      "width": 1440,
      "height": 1024,
      "layoutMode": "NONE",
      "children": [
        {
          "type": "rect",
          "name": "Left Sidebar",
          "x": 0,
          "y": 0,
          "width": 320,
          "height": 1024,
          "fill": { "r": 0.97, "g": 0.97, "b": 0.98, "a": 1 }
        },
        {
          "type": "rect",
          "name": "Main Panel",
          "x": 320,
          "y": 0,
          "width": 800,
          "height": 1024,
          "fill": { "r": 1, "g": 1, "b": 1, "a": 1 }
        },
        {
          "type": "rect",
          "name": "Right Panel",
          "x": 1120,
          "y": 0,
          "width": 320,
          "height": 1024,
          "fill": { "r": 0.99, "g": 0.99, "b": 1, "a": 1 }
        },
        {
          "type": "text",
          "name": "Thread Title",
          "x": 352,
          "y": 18,
          "width": 240,
          "height": 24,
          "text": "Alex Chen",
          "fontFamily": "Inter",
          "fontStyle": "Semibold",
          "fontSize": 18,
          "fill": { "r": 0.1, "g": 0.1, "b": 0.12, "a": 1 }
        }
      ]
    }
  ]
}
```

---

## Practical prompting tips

- Ask the model to **estimate with a grid** (8px spacing) to reduce random coordinates.
- Ask for **bounded complexity**: e.g., “max 120 nodes”.
- Prefer **frames for grouping**, rectangles for simple surfaces, text for labels.
- If output fails validation, retry with: “reduce detail by 40%, preserve panel geometry”.
- Keep image and JSON generation as separate prompts; mixed goals reduce quality.

---


## Troubleshooting: why generated Figma can look very different from source image

If your generated JSON looks "detailed" but rendered Figma is simplified/misaligned, the common causes are:

1. **Absolute vs nested coordinates**
   - This project uses screenshot/canvas absolute coordinates in the schema.
   - If a renderer treats nested frame children as parent-relative, child blocks shift and get clipped.

2. **Unsupported text style keys from model output**
   - Model often emits `fontWeight`, `color`, `textAlign`.
   - Schema expects `fontStyle`, `fill`, `alignHorizontal`.
   - Without normalization, text appears wrong (weight/color/alignment drift).

3. **`image` nodes without image source**
   - Schema requires `imageUrl` or `imageDataUrl` for `image` type.
   - Missing source causes node removal at validation time.
   - Prefer `rect` placeholders unless you really have a valid URL/data URL.

### Recommended process improvements

- During JSON prompt, explicitly require **absolute coordinates for all nodes**, including children.
- Force a strict key whitelist for text nodes:
  - `text`, `fontFamily`, `fontStyle`, `fontSize`, `fill`, `alignHorizontal`
- For thumbnails/icons, ask model to default to `rect` placeholders unless image source is available.
- Add a preflight instruction: “If a key is not in schema, convert it to nearest supported key.”

## Local run

```bash
npm install
npm run build
npm run dev
```
