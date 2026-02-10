import uiHtml from "./ui.html";
import { renderSpecOnly, renderToFigma, renderScreenshotOnly } from "./render";
import { DesignSpecSchema } from "@image-to-figma/shared";

figma.showUI(uiHtml, { width: 360, height: 520 });

function uiLog(message: string) {
  figma.ui.postMessage({ type: "LOG", message });
}

function normalizeImageUrls(spec: any) {
  let fixed = 0;
  let replaced = 0;

  const normalizeUrl = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    try {
      new URL(trimmed);
      return trimmed;
    } catch {
      // fall through
    }

    // Try URI-encoding (handles spaces/unicode in query params)
    try {
      const encoded = encodeURI(trimmed);
      new URL(encoded);
      return encoded;
    } catch {
      // fall through
    }

    if (trimmed.startsWith("//")) {
      return normalizeUrl(`https:${trimmed}`);
    }

    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
      if (/^[\w.-]+\.[a-z]{2,}/i.test(trimmed)) {
        return normalizeUrl(`https://${trimmed}`);
      }
    }

    return null;
  };

  const walk = (node: any) => {
    if (!node || typeof node !== "object") return;

    if (node.type === "image") {
      if (typeof node.imageUrl === "string") {
        const normalized = normalizeUrl(node.imageUrl);
        if (normalized) {
          if (normalized !== node.imageUrl) {
            node.imageUrl = normalized;
            fixed += 1;
          }
        } else if (typeof node.width === "number" && typeof node.height === "number") {
          const w = Math.max(1, Math.round(node.width));
          const h = Math.max(1, Math.round(node.height));
          node.imageUrl = `https://placehold.co/${w}x${h}/png`;
          replaced += 1;
        }
      } else if (!node.imageDataUrl) {
        const w =
          typeof node.width === "number" && isFinite(node.width) ? Math.max(1, Math.round(node.width)) : 80;
        const h =
          typeof node.height === "number" && isFinite(node.height) ? Math.max(1, Math.round(node.height)) : 80;
        node.imageUrl = `https://placehold.co/${w}x${h}/png`;
        replaced += 1;
      }
    }

    if (Array.isArray(node.children)) {
      for (const c of node.children) walk(c);
    }
  };

  if (spec && Array.isArray(spec.nodes)) {
    for (const n of spec.nodes) walk(n);
  }

  return { fixed, replaced };
}

figma.ui.onmessage = async (msg) => {
  if (msg?.type === "RENDER") {
    try {
      uiLog("Validating spec...");
      const urlStats = normalizeImageUrls(msg.spec);
      if (urlStats.fixed || urlStats.replaced) {
        uiLog(`imageUrl normalized: fixed ${urlStats.fixed}, replaced ${urlStats.replaced}`);
      }
      const spec = DesignSpecSchema.parse(msg.spec);

      uiLog("Rendering into Figma...");
      await renderToFigma({
        spec,
        screenshot: { base64: msg.imageBytesBase64 as string, mime: msg.imageMime as string }
      });

      uiLog("Done. Select the generated frame and start tweaking.");
    } catch (e: any) {
      uiLog(`Render failed: ${e?.message ?? String(e)}`);
    }
  }

  if (msg?.type === "RENDER_SCREENSHOT") {
    try {
      uiLog("Placing screenshot...");
      await renderScreenshotOnly({
        screenshot: { base64: msg.imageBytesBase64 as string, mime: msg.imageMime as string }
      });
      uiLog("Done. Screenshot imported.");
    } catch (e: any) {
      uiLog(`Render failed: ${e?.message ?? String(e)}`);
    }
  }

  if (msg?.type === "RENDER_SPEC") {
    try {
      uiLog("Validating spec...");
      const urlStats = normalizeImageUrls(msg.spec);
      if (urlStats.fixed || urlStats.replaced) {
        uiLog(`imageUrl normalized: fixed ${urlStats.fixed}, replaced ${urlStats.replaced}`);
      }
      const spec = DesignSpecSchema.parse(msg.spec);
      uiLog("Rendering into Figma...");
      await renderSpecOnly({
        spec,
        screenshot:
          typeof msg.imageBytesBase64 === "string" && typeof msg.imageMime === "string"
            ? { base64: msg.imageBytesBase64, mime: msg.imageMime }
            : undefined
      });
      uiLog("Done. Select the generated frame and start tweaking.");
    } catch (e: any) {
      uiLog(`Render failed: ${e?.message ?? String(e)}`);
    }
  }
};
