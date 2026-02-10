import { build, context } from "esbuild";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";

const watch = process.argv.includes("--watch");

const outdir = "dist";
mkdirSync(outdir, { recursive: true });

const common = {
  bundle: true,
  sourcemap: true,
  target: "es2017",
  logLevel: "info"
};

async function run() {
  const codeBuild = {
    ...common,
    entryPoints: ["src/code.ts"],
    outfile: "dist/code.js",
    format: "iife",
    platform: "browser",
    loader: { ".html": "text" }
  };

  const uiBuild = {
    ...common,
    entryPoints: ["src/ui.ts"],
    outfile: "dist/ui.js",
    format: "iife",
    platform: "browser"
  };

  if (watch) {
    const codeCtx = await context(codeBuild);
    const uiCtx = await context(uiBuild);

    await codeCtx.watch();
    await uiCtx.watch();
  } else {
    await build(codeBuild);
    await build(uiBuild);
  }

  const html = readFileSync("src/ui.html", "utf8");
  writeFileSync("dist/ui.html", html, "utf8");

  console.log(watch ? "watching..." : "build done");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
