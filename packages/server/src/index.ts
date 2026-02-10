import express from "express";
import cors from "cors";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { DesignSpecSchema } from "@image-to-figma/shared";

const app = express();
app.use(cors());
app.use(express.json({ limit: "25mb" }));

const port = Number(process.env.PORT ?? 8787);
const model = process.env.OPENAI_MODEL ?? "gpt-5.2-codex";
const provider =
  (process.env.AI_PROVIDER ??
    (process.env.OPENAI_API_KEY ? "openai" : process.env.OLLAMA_URL ? "ollama" : "openai")).toLowerCase();
const ollamaUrl = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const ollamaModel = process.env.OLLAMA_MODEL ?? "qwen2.5vl:3b";

const apiKey = process.env.OPENAI_API_KEY;
const openai = provider === "openai" && apiKey ? new OpenAI({ apiKey }) : null;
if (provider === "openai" && !openai) {
  console.warn("OPENAI_API_KEY is missing. /v1/figma-spec will return 503.");
}

app.get("/health", (_req, res) =>
  res.json({ ok: true, provider, ollamaUrl: provider === "ollama" ? ollamaUrl : undefined })
);

function parseImageDataUrl(dataUrl: string): { mime: string; b64: string } {
  const m = dataUrl.match(/^data:(image\/[^;]+);base64,(.*)$/);
  if (!m) throw new Error("invalid data url");
  return { mime: m[1], b64: m[2] };
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) return fence[1].trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function normalizeNode(input: any): any | null {
  if (!input || typeof input !== "object") return null;
  const type = input.type;
  if (type !== "rect" && type !== "text" && type !== "frame" && type !== "ellipse" && type !== "image") return null;

  const x = toNumber(input.x);
  const y = toNumber(input.y);
  const width = toNumber(input.width);
  const height = toNumber(input.height);
  if (x == null || y == null || width == null || height == null) return null;

  const base: any = {
    type,
    x,
    y,
    width,
    height
  };
  if (typeof input.name === "string") base.name = input.name;
  const opacity = toNumber(input.opacity);
  if (opacity != null) base.opacity = opacity;

  if (type === "text") {
    base.text = typeof input.text === "string" ? input.text : "";
    if (typeof input.fontFamily === "string") base.fontFamily = input.fontFamily;
    if (typeof input.fontStyle === "string") base.fontStyle = input.fontStyle;
    else {
      const weight = toNumber(input.fontWeight);
      if (weight != null) {
        if (weight >= 700) base.fontStyle = "Bold";
        else if (weight >= 600) base.fontStyle = "Semibold";
        else if (weight >= 500) base.fontStyle = "Medium";
        else base.fontStyle = "Regular";
      }
    }
    const fontSize = toNumber(input.fontSize);
    if (fontSize != null) base.fontSize = fontSize;
    if (input.fill) base.fill = input.fill;
    else if (input.color) base.fill = input.color;
    if (typeof input.alignHorizontal === "string") base.alignHorizontal = input.alignHorizontal;
    else if (typeof input.textAlign === "string") {
      const map: Record<string, "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED"> = {
        left: "LEFT",
        center: "CENTER",
        right: "RIGHT",
        justified: "JUSTIFIED"
      };
      const normalized = map[input.textAlign.toLowerCase()];
      if (normalized) base.alignHorizontal = normalized;
    }
    return base;
  }

  if (type === "rect") {
    if (input.fill) base.fill = input.fill;
    if (input.stroke) base.stroke = input.stroke;
    const sw = toNumber(input.strokeWidth);
    if (sw != null) base.strokeWidth = sw;
    const cr = toNumber(input.cornerRadius);
    if (cr != null) base.cornerRadius = cr;
    return base;
  }

  if (type === "ellipse") {
    if (input.fill) base.fill = input.fill;
    if (input.stroke) base.stroke = input.stroke;
    const sw = toNumber(input.strokeWidth);
    if (sw != null) base.strokeWidth = sw;
    return base;
  }

  if (type === "image") {
    if (typeof input.imageUrl !== "string" && typeof input.imageDataUrl !== "string") {
      return {
        type: "rect",
        name: typeof input.name === "string" ? `${input.name} Placeholder` : "Image Placeholder",
        x,
        y,
        width,
        height,
        cornerRadius: toNumber(input.cornerRadius) ?? 8,
        fill: { r: 0.9, g: 0.92, b: 0.95, a: 1 }
      };
    }
    if (typeof input.imageUrl === "string") base.imageUrl = input.imageUrl;
    if (typeof input.imageDataUrl === "string") base.imageDataUrl = input.imageDataUrl;
    if (typeof input.scaleMode === "string") base.scaleMode = input.scaleMode;
    const cr = toNumber(input.cornerRadius);
    if (cr != null) base.cornerRadius = cr;
    if (input.stroke) base.stroke = input.stroke;
    const sw = toNumber(input.strokeWidth);
    if (sw != null) base.strokeWidth = sw;
    return base;
  }

  // frame
  if (typeof input.layoutMode === "string") base.layoutMode = input.layoutMode;
  if (input.padding && typeof input.padding === "object") {
    base.padding = {
      top: toNumber(input.padding.top) ?? undefined,
      right: toNumber(input.padding.right) ?? undefined,
      bottom: toNumber(input.padding.bottom) ?? undefined,
      left: toNumber(input.padding.left) ?? undefined
    };
  }
  const itemSpacing = toNumber(input.itemSpacing);
  if (itemSpacing != null) base.itemSpacing = itemSpacing;
  if (input.fill) base.fill = input.fill;
  if (input.stroke) base.stroke = input.stroke;
  const sw = toNumber(input.strokeWidth);
  if (sw != null) base.strokeWidth = sw;
  const cr = toNumber(input.cornerRadius);
  if (cr != null) base.cornerRadius = cr;
  if (Array.isArray(input.children)) {
    base.children = input.children.map(normalizeNode).filter(Boolean);
  }
  return base;
}

function normalizeSpec(input: any, width: number, height: number): any {
  const canvasName = typeof input?.canvas?.name === "string" ? input.canvas.name : "Generated from Image";
  const canvasWidth = toNumber(input?.canvas?.width) ?? width;
  const canvasHeight = toNumber(input?.canvas?.height) ?? height;
  const nodes = Array.isArray(input?.nodes) ? input.nodes.map(normalizeNode).filter(Boolean) : [];
  return {
    canvas: { name: canvasName, width: canvasWidth, height: canvasHeight },
    nodes
  };
}

app.post("/v1/figma-spec", async (req, res) => {
  try {
    const { imageDataUrl, width, height } = req.body ?? {};
    const streamMode =
      String(req.query?.stream ?? "").toLowerCase() === "1" ||
      String(req.query?.stream ?? "").toLowerCase() === "true" ||
      req.header("x-stream") === "1";

    if (typeof imageDataUrl !== "string" || !imageDataUrl.startsWith("data:image/")) {
      return res.status(400).json({ error: "imageDataUrl must be a data:image/* base64 data URL" });
    }
    if (typeof width !== "number" || typeof height !== "number") {
      return res.status(400).json({ error: "width/height must be numbers" });
    }

    const system = [
      "You are a UI reverse-engineering tool.",
      "Goal: convert the screenshot into a simplified but editable Figma node tree.",
      "Return ONLY valid JSON. No markdown, no prose.",
      "Prefer fewer, higher-level nodes (<= 50).",
      "Use rectangles for backgrounds/sections/buttons; text nodes for visible labels.",
      "If unsure, approximate."
    ].join("\n");

    const schemaExample = [
      "Output JSON only, with this shape:",
      "{",
      '  "canvas": { "name": "Generated from Image", "width": 1200, "height": 800 },',
      '  "nodes": [',
      '    { "type": "rect", "x": 0, "y": 0, "width": 1200, "height": 60, "fill": { "r": 0.1, "g": 0.1, "b": 0.1, "a": 1 } },',
      '    { "type": "text", "x": 24, "y": 18, "width": 200, "height": 24, "text": "Title", "fontSize": 20, "fill": { "r": 1, "g": 1, "b": 1, "a": 1 } },',
      '    { "type": "frame", "x": 0, "y": 60, "width": 1200, "height": 740, "children": [] }',
      "  ]",
      "}",
      "Rules:",
      "- Allowed node types ONLY: rect, text, frame, ellipse, image (no 'section', 'button', etc).",
      "- Every node MUST include numeric x, y, width, height.",
      "- image nodes must include imageUrl or imageDataUrl.",
      "- If you are unsure about structure, return an empty nodes array."
    ].join("\n");

    const user = [
      `Screenshot size: ${width}x${height}px.`,
      "Extract a reasonable layout.",
      "Do NOT include images besides basic rectangles/text (the plugin will place the screenshot as a background layer).",
      schemaExample
    ].join("\n");

    if (provider !== "ollama" && provider !== "openai") {
      return res.status(400).json({
        error: "invalid_ai_provider",
        message: "AI_PROVIDER must be 'openai' or 'ollama'."
      });
    }

    if (provider === "ollama") {
      const { b64 } = parseImageDataUrl(imageDataUrl);
      let ollamaRes: Response;
      const url = `${ollamaUrl.replace(/\/$/, "")}/api/generate`;
      try {
        ollamaRes = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: ollamaModel,
            stream: streamMode,
            system,
            prompt: user,
            images: [b64],
            format: "json"
          })
        });
      } catch (e: any) {
        return res.status(502).json({
          error: "ollama_fetch_failed",
          message: e?.message ?? String(e),
          url
        });
      }

      if (!ollamaRes.ok) {
        const txt = await ollamaRes.text();
        return res.status(502).json({ error: "ollama_error", status: ollamaRes.status, details: txt });
      }

      if (streamMode && ollamaRes.body) {
        res.status(200);
        res.setHeader("Content-Type", "application/x-ndjson");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        const reader = ollamaRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let full = "";

        const writeLine = (obj: any) => {
          res.write(`${JSON.stringify(obj)}\n`);
        };

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, idx).trim();
            buffer = buffer.slice(idx + 1);
            if (!line) continue;
            try {
              const data = JSON.parse(line);
              if (typeof data?.response === "string" && data.response) {
                full += data.response;
                writeLine({ type: "delta", text: data.response });
              }
              if (data?.error) {
                writeLine({ type: "error", error: data.error });
              }
            } catch {
              // ignore malformed lines
            }
          }
        }

        const jsonText = extractJson(full);
        let parsed: unknown;
        try {
          parsed = JSON.parse(jsonText);
        } catch (e: any) {
          writeLine({
            type: "error",
            error: "ollama_invalid_json",
            message: e?.message ?? String(e)
          });
          return res.end();
        }

        try {
          const normalized = normalizeSpec(parsed, width, height);
          const spec = DesignSpecSchema.parse(normalized);
          writeLine({ type: "spec", spec });
        } catch (e: any) {
          writeLine({ type: "error", error: "invalid_spec", message: e?.message ?? String(e) });
        }
        return res.end();
      }

      const data = await ollamaRes.json();
      const raw = data?.response ?? "";
      const jsonText = extractJson(raw);
      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonText);
      } catch (e: any) {
        return res.status(502).json({
          error: "ollama_invalid_json",
          message: e?.message ?? String(e),
          raw: raw.slice(0, 1000)
        });
      }

      const normalized = normalizeSpec(parsed, width, height);
      const spec = DesignSpecSchema.parse(normalized);
      return res.json(spec);
    }

    if (!openai) {
      return res.status(503).json({
        error: "missing_openai_api_key",
        message: "Set OPENAI_API_KEY to enable AI generation."
      });
    }

    const response = await openai.responses.parse({
      model,
      input: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "input_text", text: user },
            { type: "input_image", image_url: imageDataUrl }
          ]
        }
      ],
      text: {
        format: zodTextFormat(DesignSpecSchema, "figma_spec")
      }
    });

    if (response.status !== "completed") {
      return res.status(502).json({
        error: "model_response_not_completed",
        status: response.status,
        incomplete_details: response.incomplete_details ?? null
      });
    }

    const spec = response.output_parsed;
    return res.json(spec);
  } catch (err: any) {
    return res.status(500).json({
      error: "server_error",
      message: err?.message ?? String(err)
    });
  }
});

app.listen(port, () => {
  console.log(`server listening on http://localhost:${port}`);
});
