import type { DesignNode, DesignSpec, RGBA } from "@image-to-figma/shared";

type Screenshot = { base64: string; mime: string };

function normalizeScreenshot(screenshot?: Screenshot) {
  if (!screenshot) return null;
  const mime = (screenshot.mime || "").toLowerCase();
  if (!mime || (mime !== "image/png" && mime !== "image/jpeg" && mime !== "image/jpg")) {
    throw new Error(`Unsupported image type: ${screenshot.mime}. Use PNG or JPEG.`);
  }
  if (!screenshot.base64 || screenshot.base64.length < 16) {
    throw new Error("Image data is empty or too small.");
  }
  return { mime, base64: screenshot.base64 };
}

export async function renderScreenshotOnly(args: { screenshot: Screenshot }) {
  const screenshot = normalizeScreenshot(args.screenshot);
  if (!screenshot) throw new Error("Missing screenshot.");

  const root = figma.createFrame();
  root.name = "Screenshot";
  root.resize(1, 1);
  root.x = figma.viewport.center.x;
  root.y = figma.viewport.center.y;
  root.clipsContent = true;

  const bytes = base64ToBytes(screenshot.base64);
  const img = figma.createImage(bytes);

  const size = await img.getSizeAsync();
  root.resize(size.width, size.height);
  root.x = figma.viewport.center.x - root.width / 2;
  root.y = figma.viewport.center.y - root.height / 2;

  root.fills = [{ type: "IMAGE", imageHash: img.hash, scaleMode: "FILL" }];

  figma.currentPage.appendChild(root);
  figma.currentPage.selection = [root];
  figma.viewport.scrollAndZoomIntoView([root]);
}

export async function renderToFigma(args: { spec: DesignSpec; screenshot?: Screenshot }) {
  const { spec } = args;
  const screenshot = normalizeScreenshot(args.screenshot);

  const root = figma.createFrame();
  root.name = spec.canvas.name || "Generated";
  root.resize(spec.canvas.width, spec.canvas.height);
  root.x = figma.viewport.center.x - root.width / 2;
  root.y = figma.viewport.center.y - root.height / 2;
  root.clipsContent = true;

  if (screenshot) {
    const bytes = base64ToBytes(screenshot.base64);
    const img = figma.createImage(bytes);
    root.fills = [{ type: "IMAGE", imageHash: img.hash, scaleMode: "FILL" }];
  } else {
    root.fills = [];
  }

  const overlay = figma.createFrame();
  overlay.name = "AI layers";
  overlay.resize(root.width, root.height);
  overlay.x = 0;
  overlay.y = 0;
  overlay.fills = [];
  overlay.strokes = [];
  root.appendChild(overlay);

  const fontCache = new Map<string, Promise<void>>();
  const loadFont = (family: string, style: string) => {
    const key = `${family}::${style}`;
    if (!fontCache.has(key)) {
      fontCache.set(key, figma.loadFontAsync({ family, style }));
    }
    return fontCache.get(key)!;
  };

  for (const n of spec.nodes) {
    await renderNode(n, overlay, loadFont);
  }

  figma.currentPage.appendChild(root);
  figma.currentPage.selection = [root];
  figma.viewport.scrollAndZoomIntoView([root]);
}

export async function renderSpecOnly(args: { spec: DesignSpec; screenshot?: Screenshot }) {
  return renderToFigma(args);
}

async function renderNode(
  node: DesignNode,
  parent: FrameNode | ComponentNode | InstanceNode,
  loadFont: (family: string, style: string) => Promise<void>
) {
  if (node.type === "rect") {
    const r = figma.createRectangle();
    r.name = node.name || "Rect";
    r.x = node.x;
    r.y = node.y;
    r.resize(node.width, node.height);

    if (node.cornerRadius != null) r.cornerRadius = node.cornerRadius;

    if (node.fill) r.fills = [solid(node.fill)];
    else r.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 }, opacity: 0.0 }];

    if (node.stroke && node.strokeWidth != null) {
      r.strokes = [solid(node.stroke)];
      r.strokeWeight = node.strokeWidth;
    } else {
      r.strokes = [];
    }

    if (node.opacity != null) r.opacity = node.opacity;
    parent.appendChild(r);
    return;
  }

  if (node.type === "text") {
    const t = figma.createText();
    t.name = node.name || "Text";
    t.x = node.x;
    t.y = node.y;

    const family = node.fontFamily || "Inter";
    const style = node.fontStyle || "Regular";

    await loadFont(family, style);

    t.fontName = { family, style };
    t.characters = node.text;
    if (node.fontSize) t.fontSize = node.fontSize;
    if (node.fill) t.fills = [solid(node.fill)];
    if (node.alignHorizontal) t.textAlignHorizontal = node.alignHorizontal;
    if (node.opacity != null) t.opacity = node.opacity;

    try {
      t.resize(node.width, node.height);
    } catch {
      // ignore
    }

    parent.appendChild(t);
    return;
  }

  if (node.type === "ellipse") {
    const e = figma.createEllipse();
    e.name = node.name || "Ellipse";
    e.x = node.x;
    e.y = node.y;
    e.resize(node.width, node.height);

    if (node.fill) e.fills = [solid(node.fill)];
    else e.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 }, opacity: 0.0 }];

    if (node.stroke && node.strokeWidth != null) {
      e.strokes = [solid(node.stroke)];
      e.strokeWeight = node.strokeWidth;
    } else {
      e.strokes = [];
    }

    if (node.opacity != null) e.opacity = node.opacity;
    parent.appendChild(e);
    return;
  }

  if (node.type === "image") {
    const r = figma.createRectangle();
    r.name = node.name || "Image";
    r.x = node.x;
    r.y = node.y;
    r.resize(node.width, node.height);
    if (node.cornerRadius != null) r.cornerRadius = node.cornerRadius;

    const paint = await imagePaintFromNode(node);
    if (paint) r.fills = [paint];
    else r.fills = [{ type: "SOLID", color: { r: 0.9, g: 0.9, b: 0.9 }, opacity: 1 }];

    if (node.stroke && node.strokeWidth != null) {
      r.strokes = [solid(node.stroke)];
      r.strokeWeight = node.strokeWidth;
    } else {
      r.strokes = [];
    }

    if (node.opacity != null) r.opacity = node.opacity;
    parent.appendChild(r);
    return;
  }

  const f = figma.createFrame();
  f.name = node.name || "Frame";
  f.x = node.x;
  f.y = node.y;
  f.resize(node.width, node.height);

  if (node.fill) f.fills = [solid(node.fill)];
  else f.fills = [];

  if (node.stroke && node.strokeWidth != null) {
    f.strokes = [solid(node.stroke)];
    f.strokeWeight = node.strokeWidth;
  } else {
    f.strokes = [];
  }

  if (node.cornerRadius != null) f.cornerRadius = node.cornerRadius;
  if (node.opacity != null) f.opacity = node.opacity;

  if (node.layoutMode && node.layoutMode !== "NONE") {
    f.layoutMode = node.layoutMode;
    if (node.padding) {
      f.paddingTop = node.padding.top ?? 0;
      f.paddingRight = node.padding.right ?? 0;
      f.paddingBottom = node.padding.bottom ?? 0;
      f.paddingLeft = node.padding.left ?? 0;
    }
    if (node.itemSpacing != null) f.itemSpacing = node.itemSpacing;
    f.primaryAxisSizingMode = "AUTO";
    f.counterAxisSizingMode = "AUTO";
  } else {
    f.layoutMode = "NONE";
  }

  parent.appendChild(f);

  for (const c of node.children ?? []) {
    await renderNode(c, f, loadFont);
  }
}

function solid(c: RGBA): SolidPaint {
  return {
    type: "SOLID",
    color: { r: c.r, g: c.g, b: c.b },
    opacity: c.a
  };
}

async function imagePaintFromNode(node: Extract<DesignNode, { type: "image" }>): Promise<ImagePaint | null> {
  const scaleMode = node.scaleMode ?? "FILL";
  if (node.imageDataUrl) {
    const m = node.imageDataUrl.match(/^data:(image\/[^;]+);base64,(.*)$/);
    if (!m) return null;
    const bytes = base64ToBytes(m[2]);
    const img = figma.createImage(bytes);
    return { type: "IMAGE", imageHash: img.hash, scaleMode };
  }
  if (node.imageUrl) {
    const res = await fetch(node.imageUrl);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const img = figma.createImage(new Uint8Array(buf));
    return { type: "IMAGE", imageHash: img.hash, scaleMode };
  }
  return null;
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof atob === "function") {
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  }
  if (typeof figma !== "undefined" && typeof figma.base64Decode === "function") {
    return figma.base64Decode(b64);
  }
  throw new Error("No base64 decoder available in this environment.");
}
