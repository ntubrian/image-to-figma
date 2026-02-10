# Image → JSON → Figma Workflow Template

This document gives you a practical, reusable workflow for your **image-to-figma frame/component generator**.

---

## Why this workflow works

You are splitting one difficult task into 3 smaller tasks:

1. **Design intent spec** (human-readable UI description)
2. **Image validation** (visual sanity check)
3. **Structured JSON generation** (machine-readable output for your converter)

This improves consistency, reduces hallucinations, and makes edits easier.

---

## End-to-End Pipeline (recommended)

### Step 0) Define the target and constraints

Before prompting, define:

- Platform: web / iOS / Android
- Breakpoint: desktop/tablet/mobile
- Theme: light/dark
- Density: compact/cozy
- Scope: full app shell or one screen
- Output target: full page frame vs reusable components

Use this short checklist:

```txt
Project:
Screen:
Viewport (W x H):
Theme:
Density:
States needed:
Variants needed:
Must-have components:
```

---

### Step 1) Use a structured “UI spec prompt” (text-first)

Use your long template (like the one you already wrote), but add strict constraints so the model can’t stay vague.

#### Prompt A — UI Specification Generator

```txt
You are a senior product designer and design-systems engineer.

Goal:
Generate a production-style UI specification for [SCREEN_NAME] for [PLATFORM].

Hard constraints:
- Must include exact dimensions, spacing, and hierarchy.
- Must include all component states (default/hover/focus/disabled/loading/error/selected where applicable).
- Must include responsive behavior at breakpoints: [BREAKPOINTS].
- Must include accessibility notes (contrast, keyboard, focus order, aria labels).
- Must include design tokens (color, type, radius, shadow, spacing).
- Must include data realism (example names/messages/timestamps/counts).

Output format (strict Markdown):
1. App Shell
2. Region Layout
3. Component Inventory
4. Component Specs (size, spacing, states, variants)
5. Interaction Rules
6. Responsive Rules
7. Empty/Loading/Error States
8. Design Tokens
9. Content Dataset (seed data)
10. Acceptance Checklist

Do not output implementation code.
```

---

### Step 2) Generate image from the spec (and iterate)

Create 1–3 images per screen:

- `v1`: baseline
- `v2`: spacing and hierarchy improvements
- `v3`: color/contrast polish

#### Prompt B — Image Generation Prompt

```txt
Create a high-fidelity UI mockup image using this specification:
[PASTE SPEC]

Render requirements:
- Resolution: [e.g., 1440x1024]
- Style: modern SaaS, clean, realistic, no placeholder gibberish
- Use consistent 8px spacing system
- Include realistic sample data
- Keep typography legible
- Keep visual hierarchy clear

Return:
- One full-screen UI image
- Optional close-up crop of message list + composer area
```

#### Visual QA checklist (manual)

Check these before moving to JSON:

- Spacing rhythm matches 8px scale
- Header/composer sticky behavior visually implied
- Left/center/right alignment is consistent
- Bubble widths and timestamps look realistic
- Contrast and readability are acceptable
- No broken icons/text artifacts

If any fail, revise prompt and regenerate.

---

### Step 3) Convert approved image/spec into structured JSON

Use both the spec and approved image together.

#### Prompt C — JSON Generator Prompt (strict)

```txt
You are generating JSON for a figma frame/component generator.

Inputs:
1) UI specification:
[PASTE SPEC]

2) Approved image reference summary:
[PASTE BRIEF DESCRIPTION OF FINAL IMAGE]

Task:
Produce a single JSON document that describes:
- document metadata
- design tokens
- frame tree
- components
- variants
- instances
- interactions
- responsive rules

Requirements:
- Use stable IDs for every node.
- Every node must include: id, type, name, x, y, width, height.
- Use auto-layout metadata where applicable (direction, gap, padding, alignment).
- Components must be reusable; repeated UI patterns should be instances.
- Include explicit states as variants (e.g. conversation_item: default/hover/selected/unread).
- Include text styles and color references via token names, not raw values where possible.
- Include constraints/anchors for responsive behavior.
- Include sample content data bindings (e.g. conversation.title, message.timestamp).
- Include validation section with warnings if any inferred values are uncertain.

Output rules:
- JSON only (no markdown)
- Must be parseable
- Use camelCase keys
```

---

## Suggested JSON Shape (tool-agnostic)

> Adapt field names to your project’s parser, but keep this structure.

```json
{
  "meta": {
    "project": "chat-ui",
    "screen": "thread-desktop",
    "version": "1.0.0",
    "frame": { "width": 1440, "height": 1024 },
    "theme": "light"
  },
  "tokens": {
    "color": {
      "bg": "#0F1115",
      "surface": "#151A21",
      "textPrimary": "#F5F7FA",
      "textMuted": "#9AA4B2",
      "accent": "#4F8CFF",
      "border": "#2A3240",
      "danger": "#EF4444",
      "success": "#22C55E"
    },
    "spacing": { "xs": 4, "sm": 8, "md": 12, "lg": 16, "xl": 24 },
    "radius": { "input": 10, "bubble": 12, "pill": 999 },
    "typography": {
      "title": { "fontFamily": "Inter", "fontSize": 16, "fontWeight": 600, "lineHeight": 24 },
      "body": { "fontFamily": "Inter", "fontSize": 14, "fontWeight": 400, "lineHeight": 20 },
      "meta": { "fontFamily": "Inter", "fontSize": 12, "fontWeight": 400, "lineHeight": 16 }
    }
  },
  "components": [
    {
      "id": "cmp.conversationItem",
      "type": "componentSet",
      "name": "Conversation Item",
      "variants": [
        { "state": "default", "props": { "unread": false, "selected": false } },
        { "state": "hover", "props": { "unread": false, "selected": false } },
        { "state": "selected", "props": { "unread": false, "selected": true } },
        { "state": "unread", "props": { "unread": true, "selected": false } }
      ],
      "layout": { "width": 320, "height": 72, "autoLayout": { "direction": "horizontal", "gap": 12, "padding": [12, 12, 12, 12] } }
    }
  ],
  "frames": [
    {
      "id": "frm.thread.desktop",
      "type": "frame",
      "name": "Thread/Desktop",
      "x": 0,
      "y": 0,
      "width": 1440,
      "height": 1024,
      "children": [
        {
          "id": "panel.leftSidebar",
          "type": "frame",
          "name": "Left Sidebar",
          "x": 0,
          "y": 0,
          "width": 320,
          "height": 1024
        },
        {
          "id": "panel.mainThread",
          "type": "frame",
          "name": "Main Thread",
          "x": 320,
          "y": 0,
          "width": 800,
          "height": 1024
        },
        {
          "id": "panel.rightDetails",
          "type": "frame",
          "name": "Right Details",
          "x": 1120,
          "y": 0,
          "width": 320,
          "height": 1024
        }
      ]
    }
  ],
  "instances": [
    {
      "id": "ins.convItem.001",
      "componentId": "cmp.conversationItem",
      "variant": { "state": "unread" },
      "bindings": {
        "name": "Alex Chen",
        "timestamp": "10:24 AM",
        "snippet": "Can we review the handoff now?",
        "unreadCount": 3
      }
    }
  ],
  "responsive": {
    "breakpoints": [
      { "name": "desktop", "min": 1200 },
      { "name": "tablet", "min": 1024, "max": 1199 },
      { "name": "mobile", "max": 1023 }
    ],
    "rules": [
      "rightDetails hidden below 1200",
      "leftSidebar becomes drawer below 1024",
      "header backButton visible below 1024"
    ]
  },
  "validation": {
    "warnings": [],
    "assumptions": [
      "Icon set assumed as 20px outline style",
      "Message bubble max width set to 68%"
    ]
  }
}
```

---

## Recommended “two-pass JSON” method (important)

### Pass 1: Skeleton JSON

Ask model to output only:

- `meta`
- `tokens`
- top-level frames/panels
- component inventory list

Validate quickly (parsing + required keys).

### Pass 2: Full detail JSON

Then ask model to expand with:

- full component nodes
- variants + instances
- bindings + responsive rules
- interaction definitions

This reduces format breakage and makes debugging easy.

---

## Validation prompt (use before feeding your generator)

#### Prompt D — JSON Linter/Reviewer

```txt
Review this JSON for a figma frame/component generator.

Checks:
1) Valid JSON syntax
2) Required keys present on every node: id,type,name,x,y,width,height
3) No duplicated IDs
4) All instance componentId values exist
5) Variant references exist in component sets
6) Token references resolve
7) No negative sizes unless explicitly allowed
8) Responsive rules are complete for all breakpoints

Return only:
- "pass": true/false
- "errors": []
- "warnings": []
- "autofix": { ...correctedJson }
```

---

## Naming conventions (strongly recommended)

Use deterministic IDs and names:

- Frames: `frm.<screen>.<breakpoint>`
- Panels: `panel.<regionName>`
- Components: `cmp.<componentName>`
- Instances: `ins.<componentName>.<index>`
- Text nodes: `txt.<semanticName>`
- Icons: `ic.<name>.<size>`

This keeps diffs stable and makes regeneration safer.

---

## Minimal operating workflow you can reuse every time

1. Fill short checklist (Step 0)
2. Run Prompt A → get spec
3. Run Prompt B → generate image(s)
4. Human QA image with checklist
5. Run Prompt C → generate JSON
6. Run Prompt D → validate/autofix JSON
7. Feed final JSON to your figma generator

---

## Quick starter package (copy/paste)

If you want to move fast, keep these as reusable files in your own project:

- `prompts/ui-spec.md` (Prompt A)
- `prompts/image-gen.md` (Prompt B)
- `prompts/json-gen.md` (Prompt C)
- `prompts/json-validate.md` (Prompt D)
- `templates/base-chat-spec.md` (your large layout template)
- `examples/thread-desktop.v1.json` (known-good sample)

