#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync, execSync } from "node:child_process";
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
    outDir: "output/pdf",
    htmlDir: "tmp/gumi-paper-delivery",
    htmlOnly: false,
    withAppendix: false,
    css: DEFAULT_CSS,
    mmdc: DEFAULT_MMDC,
    mermaidConfig: DEFAULT_MERMAID_CONFIG,
    puppeteerConfig: DEFAULT_PUPPETEER_CONFIG,
    weasyprint: "weasyprint",
  };

  for (const arg of argv) {
    if (arg === "--html-only") args.htmlOnly = true;
    else if (arg === "--with-appendix") args.withAppendix = true;
    else if (arg.startsWith("--config=")) args.config = arg.slice("--config=".length);
    else if (arg.startsWith("--root=")) args.root = arg.slice("--root=".length);
    else if (arg.startsWith("--out-dir=")) args.outDir = arg.slice("--out-dir=".length);
    else if (arg.startsWith("--html-dir=")) args.htmlDir = arg.slice("--html-dir=".length);
    else if (arg.startsWith("--only=")) args.only = arg.slice("--only=".length);
    else if (arg.startsWith("--css=")) args.css = arg.slice("--css=".length);
    else if (arg.startsWith("--mmdc=")) args.mmdc = arg.slice("--mmdc=".length);
    else if (arg.startsWith("--weasyprint=")) args.weasyprint = arg.slice("--weasyprint=".length);
  }

  if (!args.config) {
    throw new Error("Missing --config=path/to/config.json");
  }
  return args;
}

function runGit(root, args) {
  return execSync(`git ${args}`, { cwd: root, encoding: "utf8" }).trim();
}

function readMarkdown(root, theme, file) {
  if (theme.sourceRef) {
    return runGit(root, `show ${theme.sourceRef}:${file}`);
  }
  return fs.readFileSync(path.join(root, file), "utf8");
}

function displayName(file) {
  if (file.endsWith("/README.md")) {
    return path.basename(path.dirname(file));
  }
  return path.basename(file, path.extname(file));
}

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function updatedDate(root, theme, file) {
  const label = theme.dateLabel ?? "更新日";
  const since = theme.since ?? "1970-01-01";
  const until = theme.until ?? "2999-12-31 23:59:59";

  try {
    const updated = runGit(
      root,
      `log -1 --since="${since}" --until="${until}" --date=short --format=%ad ${theme.sourceRef ?? ""} -- "${file}"`,
    );
    return updated || `${label}: 関連資料`;
  } catch {
    return "関連資料";
  }
}

function renderMermaid(root, args, theme, file, markdown) {
  const mermaidDir = path.join(path.resolve(root, args.htmlDir), "mermaid");
  fs.mkdirSync(mermaidDir, { recursive: true });
  let index = 0;

  return markdown.replace(/```mermaid\n([\s\S]*?)```/g, (_match, diagramSource) => {
    if (!fs.existsSync(args.mmdc)) {
      return `\n\`\`\`mermaid\n${diagramSource}\`\`\`\n`;
    }

    const hash = createHash("sha1")
      .update(`${theme.slug}:${file}:${index}:${diagramSource}`)
      .digest("hex")
      .slice(0, 12);
    const inputPath = path.join(mermaidDir, `${theme.slug}-${hash}.mmd`);
    const outputPath = path.join(mermaidDir, `${theme.slug}-${hash}.png`);
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

function listItems(items = []) {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function appendix(root, args, theme, file) {
  const markdown = renderMermaid(root, args, theme, file, readMarkdown(root, theme, file));
  const note = theme.fileNotes?.[file] ?? "対象資料";

  return `
    <section class="paper appendix">
      <div class="appendix-head">
        <p class="appendix-label">付録</p>
        <h1>${escapeHtml(displayName(file))}</h1>
        <p class="doc-path">${escapeHtml(file)}</p>
        <p class="doc-updated">${escapeHtml(theme.dateLabel ?? "更新日")}: ${escapeHtml(updatedDate(root, theme, file))}</p>
        <p>${escapeHtml(note)}</p>
      </div>
      <article class="markdown-body">${marked.parse(markdown)}</article>
    </section>
  `;
}

function buildHtml(root, args, theme, css) {
  const fileRows = theme.files
    .map(
      (file) => `
        <tr>
          <td>${escapeHtml(file)}</td>
          <td>${escapeHtml(updatedDate(root, theme, file))}</td>
        </tr>
      `,
    )
    .join("");
  const appendices = args.withAppendix
    ? theme.files.map((file) => appendix(root, args, theme, file)).join("")
    : "";

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(theme.title)}</title>
  <style>
${css}

@page { size: A4; margin: 11mm 10mm 12mm; }
:root { --accent: #7f5a3f; --accent-soft: #efe3d1; --ink-soft: #5f6674; }
html { background: var(--page-bg); }
body { max-width: none; margin: 0; padding: 0; border: 0; box-shadow: none; background: transparent; }
.paper { page-break-after: always; }
.paper:last-child { page-break-after: auto; }
.cover, .summary, .doc-section, .appendix {
  background: var(--content-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 20px 22px;
}
.cover { min-height: 270mm; display: flex; flex-direction: column; justify-content: space-between; }
.cover h1 { margin-top: 0; font-size: 22px; }
.cover-lead { font-size: 12px; color: var(--muted); }
.cover-brief, .summary-card {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fbfcfd;
}
.cover-brief { margin-top: 28px; padding: 14px 16px; }
.cover-brief h2, .summary-card h2 {
  margin: 0 0 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--heading-rule);
  color: #123f50;
  font-size: 14px;
}
.cover-brief li, .summary-card li { font-size: 10.5px; line-height: 1.38; }
.cover table { font-size: 10px; }
.summary { min-height: 270mm; }
.summary h1, .doc-section h1 { font-size: 20px; }
.summary-intro, .doc-section > p { color: var(--muted); font-size: 11px; line-height: 1.45; }
.summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; align-items: start; }
.summary-card { padding: 10px 12px; break-inside: avoid; }
.summary-card ul { margin: 0; padding-left: 1.2em; }
.doc-path, .doc-updated { margin: 0 0 6px; color: var(--ink-soft); font-size: 10px; word-break: break-all; }
.doc-section { page-break-before: always; }
.appendix { padding: 18px 20px; }
.appendix-head { margin-bottom: 14px; padding-bottom: 10px; border-bottom: 2px solid var(--heading-rule); }
.appendix-label { margin: 0 0 6px; color: var(--accent); font-size: 10px; font-weight: 700; }
.appendix-head h1 { margin: 0 0 6px; padding-bottom: 0; border-bottom: 0; font-size: 20px; }
.appendix-head p { margin: 0 0 5px; font-size: 10.5px; line-height: 1.4; }
.appendix .markdown-body, .appendix .markdown-body p, .appendix .markdown-body li, .appendix .markdown-body td, .appendix .markdown-body th { font-size: 10.5px; line-height: 1.45; }
.appendix .markdown-body h1 { font-size: 18px; }
.appendix .markdown-body h2 { margin-top: 1.2em; font-size: 15px; }
.appendix .markdown-body h3 { font-size: 13px; }
.appendix .markdown-body table { font-size: 9.5px; }
.appendix .markdown-body pre { white-space: pre-wrap; overflow-wrap: anywhere; }
.mermaid-figure { margin: 14px 0; padding: 10px; border: 1px solid var(--border-soft); border-radius: 8px; background: #fff; break-inside: avoid; }
.mermaid-figure img { display: block; max-width: 100%; height: auto; }
  </style>
</head>
<body>
  <section class="paper cover">
    <div>
      <h1>${escapeHtml(theme.title)}</h1>
      <p class="cover-lead">${escapeHtml(theme.summary)}</p>
      <section class="cover-brief">
        <h2>主な整備内容</h2>
        <ul>${listItems(theme.deliveredItems?.slice(0, 3))}</ul>
      </section>
    </div>
    <div>
      <table><thead><tr><th>資料</th><th>${escapeHtml(theme.dateLabel ?? "更新日")}</th></tr></thead><tbody>${fileRows}</tbody></table>
    </div>
  </section>

  <section class="paper summary">
    <h1>納品サマリー</h1>
    <p class="summary-intro">${escapeHtml(theme.summaryIntro ?? "対象資料を、変更履歴だけでなく整備内容・意図・実務で使えることまで含めて整理しています。")}</p>
    <div class="summary-grid">
      <section class="summary-card"><h2>整備した内容</h2><ul>${listItems(theme.deliveredItems)}</ul></section>
      <section class="summary-card"><h2>主な変更</h2><ul>${listItems(theme.changes)}</ul></section>
      <section class="summary-card"><h2>変更意図</h2><ul>${listItems(theme.intentions)}</ul></section>
      <section class="summary-card"><h2>活用できること</h2><ul>${listItems(theme.usableOutcomes)}</ul></section>
    </div>
  </section>

  ${args.withAppendix ? `<section class="paper doc-section"><h1>付録: 対象資料本文</h1><p>納品サマリーの根拠として、対象資料の本文を後続ページに収録しています。</p></section>${appendices}` : ""}
</body>
</html>`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(args.root);
  const config = JSON.parse(fs.readFileSync(path.resolve(root, args.config), "utf8"));
  const css = fs.readFileSync(path.resolve(args.css), "utf8");
  const themes = Array.isArray(config.themes) ? config.themes : [config];
  const htmlDir = path.resolve(root, args.htmlDir);
  const outDir = path.resolve(root, args.outDir);

  fs.mkdirSync(htmlDir, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });

  for (const theme of themes.filter((item) => !args.only || item.slug === args.only)) {
    const suffix = args.withAppendix ? "-delivery" : "";
    const html = buildHtml(root, args, theme, css);
    const htmlPath = path.join(htmlDir, `${theme.slug}${suffix}.html`);
    const pdfPath = path.join(outDir, `${theme.slug}${suffix}.pdf`);
    fs.writeFileSync(htmlPath, html, "utf8");
    console.log(path.relative(root, htmlPath));

    if (!args.htmlOnly) {
      execFileSync(args.weasyprint, [htmlPath, pdfPath], { cwd: root, stdio: "inherit" });
      console.log(path.relative(root, pdfPath));
    }
  }
}

main();
