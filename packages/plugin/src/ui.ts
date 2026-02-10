type PluginMessage =
  | { type: "LOG"; message: string }
  | { type: "RENDER"; spec: any; imageBytesBase64: string; imageMime: string }
  | { type: "RENDER_SCREENSHOT"; imageBytesBase64: string; imageMime: string };

const $ = (id: string) => document.getElementById(id) as HTMLElement | null;

let logEl = $("log");
const statusEl = $("status");
function log(msg: string) {
  if (!logEl) {
    logEl = document.createElement("pre");
    logEl.id = "log";
    logEl.style.whiteSpace = "pre-wrap";
    logEl.style.background = "#f6f6f6";
    logEl.style.padding = "8px";
    logEl.style.borderRadius = "6px";
    logEl.style.maxHeight = "200px";
    logEl.style.overflow = "auto";
    document.body.appendChild(logEl);
  }
  logEl.textContent = (logEl.textContent ?? "") + msg + "\n";
  console.log(msg);
}

if (statusEl) {
  statusEl.textContent = `Status: JS loaded at ${new Date().toLocaleTimeString()}`;
}
log("UI loaded.");
window.addEventListener("error", (e) => {
  log(`Error: ${e.message}`);
});
window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
  const reason = (e.reason as any)?.message ?? String(e.reason);
  log(`Unhandled: ${reason}`);
});

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function dataUrlToBase64(dataUrl: string): { mime: string; b64: string } {
  const m = dataUrl.match(/^data:(image\/[^;]+);base64,(.*)$/);
  if (!m) throw new Error("invalid data url");
  return { mime: m[1], b64: m[2] };
}

async function getImageSizeFromDataUrl(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("failed to load image"));
    img.src = dataUrl;
  });
}

async function run() {
  const backendInput = document.getElementById("backend") as HTMLInputElement | null;
  const fileInput = document.getElementById("file") as HTMLInputElement | null;
  if (!backendInput || !fileInput) {
    log("UI elements missing (backend/file). Rebuild and reload the plugin.");
    return;
  }
  const backend = backendInput.value.trim();
  const file = fileInput.files?.[0];
  if (!file) {
    log("Pick an image first.");
    return;
  }

  log("Reading image...");
  const dataUrl = await fileToDataUrl(file);
  const size = await getImageSizeFromDataUrl(dataUrl);
  const { mime, b64 } = dataUrlToBase64(dataUrl);

  log(`Calling backend: ${backend}/v1/figma-spec`);
  const res = await fetch(`${backend.replace(/\/$/, "")}/v1/figma-spec`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageDataUrl: dataUrl, width: size.width, height: size.height })
  });

  if (!res.ok) {
    const txt = await res.text();
    log(`Backend error (${res.status}): ${txt}`);
    return;
  }

  const spec = await res.json();
  log("Spec received. Sending to plugin renderer...");

  parent.postMessage(
    { pluginMessage: { type: "RENDER", spec, imageBytesBase64: b64, imageMime: mime } satisfies PluginMessage },
    "*"
  );
}

const goBtn = document.getElementById("go") as HTMLButtonElement | null;
if (goBtn) {
  goBtn.onclick = () => {
    run().catch((e) => log(`Error: ${e?.message ?? String(e)}`));
  };
} else {
  log("Missing button: #go");
}

const shotBtn = document.getElementById("shot") as HTMLButtonElement | null;
if (shotBtn) {
  shotBtn.onclick = () => {
    const fileInput = document.getElementById("file") as HTMLInputElement | null;
    if (!fileInput) {
      log("UI element missing: #file");
      return;
    }
    const file = fileInput.files?.[0];
    if (!file) {
      log("Pick an image first.");
      return;
    }

  log("Importing screenshot only...");
  fileToDataUrl(file)
    .then((dataUrl) => Promise.all([Promise.resolve(dataUrl), getImageSizeFromDataUrl(dataUrl)]))
    .then(([dataUrl, size]) => {
      const { mime, b64 } = dataUrlToBase64(dataUrl);
      parent.postMessage(
        {
          pluginMessage: {
            type: "RENDER_SCREENSHOT",
            imageBytesBase64: b64,
            imageMime: mime
          } satisfies PluginMessage
        },
        "*"
      );
      log(`Screenshot imported (${size.width}x${size.height}).`);
    })
    .catch((e) => log(`Error: ${e?.message ?? String(e)}`));
  };
} else {
  log("Missing button: #shot");
}

window.onmessage = (event) => {
  const msg = event.data?.pluginMessage as PluginMessage | undefined;
  if (!msg) return;
  if (msg.type === "LOG") log(msg.message);
};
