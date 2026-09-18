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

function tableRows(items = []) {
  return items
    .map(
      (item) => `
        <tr>
          <th>${escapeHtml(item.label)}</th>
          <td>${escapeHtml(item.value)}</td>
        </tr>
      `,
    )
    .join("");
}

function deliveryItemRows(items = []) {
  return items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.name)}</td>
          <td>${escapeHtml(item.description)}</td>
          <td>${escapeHtml(item.status ?? "納品")}</td>
        </tr>
      `,
    )
    .join("");
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
  const overview = theme.deliveryOverview?.length
    ? theme.deliveryOverview
    : [
        { label: "対象期間", value: `${theme.since ?? ""}〜${theme.until ?? ""}` },
        { label: "収録資料", value: `${theme.files.length}件` },
      ];
  const deliveryItems = theme.deliveryItems?.length
    ? theme.deliveryItems
    : (theme.deliveredItems ?? []).map((description, index) => ({
        name: `納品物 ${index + 1}`,
        description,
        status: "納品",
      }));
  const deliveryResults = theme.deliveryResults ?? theme.changes ?? [];
  const deliveryNotes = theme.deliveryNotes ?? [
    ...(theme.intentions ?? []),
    ...(theme.usableOutcomes ?? []),
  ];
  const overviewRows = tableRows(overview);
  const deliveryRows = deliveryItemRows(deliveryItems);
  const appendices = args.withAppendix
    ? theme.files.map((file) => appendix(root, args, theme, file)).join("")
    : "";
  const coverDetail = `
      <section class="cover-brief invoice-cover-brief">
        <h2>納品概要</h2>
        <table class="overview-table"><tbody>${overviewRows}</tbody></table>
      </section>
    `;
  const coverFooter = `<p class="cover-note">本資料は納品書の添付資料として、対象期間の業務成果と確認事項をまとめたものです。</p>`;
  const summarySection = `
      <section class="paper summary invoice-summary">
        <h1>納品資料概要</h1>
        <p class="summary-intro">${escapeHtml(theme.summaryIntro ?? theme.summary)}</p>
        <section class="invoice-section">
          <h2>納品物一覧</h2>
          <table class="delivery-items-table">
            <thead><tr><th>納品物</th><th>内容</th><th>状態</th></tr></thead>
            <tbody>${deliveryRows}</tbody>
          </table>
        </section>
        <section class="invoice-section">
          <h2>実施結果</h2>
          <ul>${listItems(deliveryResults)}</ul>
        </section>
        <section class="invoice-section">
          <h2>確認事項・備考</h2>
          <ul>${listItems(deliveryNotes)}</ul>
        </section>
      </section>
    `;

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
.cover-brief {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fbfcfd;
}
.cover-brief { margin-top: 28px; padding: 14px 16px; }
.cover-brief h2 {
  margin: 0 0 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--heading-rule);
  color: #123f50;
  font-size: 14px;
}
.cover-brief li { font-size: 10.5px; line-height: 1.38; }
.cover table { font-size: 10px; }
.summary { min-height: 270mm; }
.summary h1, .doc-section h1 { font-size: 20px; }
.summary-intro, .doc-section > p { color: var(--muted); font-size: 11px; line-height: 1.45; }
.invoice-cover-brief { max-width: 150mm; }
.overview-table { margin: 0; font-size: 11px; }
.overview-table th { width: 28mm; background: #edf3f5; text-align: left; }
.cover-note { margin: 0; color: var(--ink-soft); font-size: 10px; }
.invoice-summary { padding: 24px 26px; }
.invoice-summary h1 { margin-bottom: 16px; }
.invoice-section { margin-top: 18px; break-inside: avoid; }
.invoice-section h2 {
  margin: 0 0 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--heading-rule);
  color: #123f50;
  font-size: 15px;
}
.invoice-section ul { margin: 0; padding-left: 1.3em; }
.invoice-section li { margin-bottom: 4px; font-size: 10.5px; line-height: 1.5; }
.delivery-items-table { font-size: 10px; }
.delivery-items-table th:last-child, .delivery-items-table td:last-child { width: 18mm; text-align: center; }
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
      ${coverDetail}
    </div>
    <div>
      ${coverFooter}
    </div>
  </section>

  ${summarySection}

  ${args.withAppendix ? `<section class="paper doc-section"><h1>付録: 対象資料本文</h1><p>納品資料概要に記載した成果物の本文を後続ページに収録しています。</p></section>${appendices}` : ""}
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
