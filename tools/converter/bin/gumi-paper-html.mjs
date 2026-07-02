#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { marked } from "marked";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const TOOL_ROOT = path.resolve(SCRIPT_DIR, "..");
const REPO_ROOT = path.resolve(TOOL_ROOT, "../..");
const DEFAULT_CSS = path.join(REPO_ROOT, "theme", "gumi-paper.css");
const DEFAULT_MERMAID_CONFIG = path.join(TOOL_ROOT, "config", "mermaid.json");
const DEFAULT_PUPPETEER_CONFIG = path.join(TOOL_ROOT, "config", "puppeteer.json");
const DEFAULT_MMDC = path.join(TOOL_ROOT, "node_modules", ".bin", "mmdc");

function parseArgs(argv) {
  const args = {
    root: REPO_ROOT,
    outDir: "output/html",
    css: DEFAULT_CSS,
    mmdc: DEFAULT_MMDC,
    mermaidConfig: DEFAULT_MERMAID_CONFIG,
    puppeteerConfig: DEFAULT_PUPPETEER_CONFIG,
  };

  for (const arg of argv) {
    if (arg.startsWith("--markdown=")) args.markdown = arg.slice("--markdown=".length);
    else if (arg.startsWith("--root=")) args.root = arg.slice("--root=".length);
    else if (arg.startsWith("--out-dir=")) args.outDir = arg.slice("--out-dir=".length);
    else if (arg.startsWith("--css=")) args.css = arg.slice("--css=".length);
    else if (arg.startsWith("--mmdc=")) args.mmdc = arg.slice("--mmdc=".length);
  }

  if (!args.markdown) {
    throw new Error("Missing --markdown=path/to/file.md");
  }
  return args;
}

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function slugFromFile(file) {
  return path
    .basename(file, path.extname(file))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "document";
}

function titleFromMarkdown(markdown, file) {
  const heading = markdown.match(/^#\s+(.+)$/m);
  return heading?.[1]?.trim() || path.basename(file, path.extname(file));
}

function renderMermaid(root, args, slug, markdown) {
  const mermaidDir = path.join(path.resolve(root, args.outDir), "mermaid");
  fs.mkdirSync(mermaidDir, { recursive: true });
  let index = 0;

  return markdown.replace(/```mermaid\n([\s\S]*?)```/g, (_match, diagramSource) => {
    if (!fs.existsSync(args.mmdc)) {
      return `\n\`\`\`mermaid\n${diagramSource}\`\`\`\n`;
    }

    const hash = createHash("sha1")
      .update(`${slug}:${index}:${diagramSource}`)
      .digest("hex")
      .slice(0, 12);
    const inputPath = path.join(mermaidDir, `${slug}-${hash}.mmd`);
    const outputPath = path.join(mermaidDir, `${slug}-${hash}.png`);
    index += 1;

    fs.writeFileSync(inputPath, diagramSource.trim(), "utf8");
    const mmdcArgs = [
      "-i",
      inputPath,
      "-o",
      outputPath,
      "-e",
      "png",
      "-b",
      "white",
      "-t",
      "neutral",
    ];
    if (fs.existsSync(args.mermaidConfig)) {
      mmdcArgs.push("-c", args.mermaidConfig);
    }
    if (fs.existsSync(args.puppeteerConfig)) {
      mmdcArgs.push("-p", args.puppeteerConfig);
    }

    execFileSync(args.mmdc, mmdcArgs, { cwd: root, stdio: "pipe" });
    return `<figure class="mermaid-figure"><img src="${pathToFileURL(outputPath).href}" alt="Mermaid diagram"></figure>`;
  });
}

function buildHtml(title, css, body) {
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
${css}

.mermaid-figure {
  margin: 1.4rem 0;
  padding: 1rem;
  border: 1px solid var(--border-soft);
  border-radius: 10px;
  background: #fff;
}
.mermaid-figure img {
  display: block;
  max-width: 100%;
  height: auto;
}
  </style>
</head>
<body>
  <main class="markdown-body">${body}</main>
</body>
</html>`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(args.root);
  const markdownPath = path.resolve(root, args.markdown);
  const markdown = fs.readFileSync(markdownPath, "utf8");
  const css = fs.readFileSync(path.resolve(args.css), "utf8");
  const slug = slugFromFile(args.markdown);
  const title = titleFromMarkdown(markdown, args.markdown);
  const outDir = path.resolve(root, args.outDir);

  fs.mkdirSync(outDir, { recursive: true });

  const rendered = renderMermaid(root, args, slug, markdown);
  const html = buildHtml(title, css, marked.parse(rendered));
  const htmlPath = path.join(outDir, `${slug}.html`);
  fs.writeFileSync(htmlPath, html, "utf8");
  console.log(path.relative(root, htmlPath));
}

main();
