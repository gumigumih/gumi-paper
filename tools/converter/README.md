# gumi-paper converter

`theme/gumi-paper.css` を使ってMarkdownをHTML/PDFへ変換する任意ツールです。

## セットアップ

```bash
cd tools/converter
npm install
```

## MarkdownをHTML化

単体のMarkdownを、`gumi-paper.css` を埋め込んだHTMLに変換できます。
Mermaidブロックは `@mermaid-js/mermaid-cli` でPNG化してHTMLへ埋め込みます。

```bash
npm run html -- --markdown=theme/examples/sample.md
```

別リポジトリや別ディレクトリのMarkdownを変換する場合は、`--root` に対象ディレクトリを指定します。

```bash
npm run html -- --root=/path/to/project --markdown=docs/sample.md
```

## PDF納品資料の生成

複数のMarkdown資料を、表紙・納品サマリー・本文付録つきPDFにまとめられます。
納品資料は単体Markdown変換とは分けて、`config.json` でタイトル、概要、整備内容、変更意図、対象Markdownファイル、資料ごとの説明を定義します。

記入用テンプレートをコピーして、案件ごとの内容に書き換えます。

```bash
cp templates/delivery-template.json path/to/config.json
```

HTMLだけ生成する場合:

```bash
npm run delivery -- --config=path/to/config.json --html-only --with-appendix
```

PDFまで生成する場合:

```bash
npm run delivery -- --config=path/to/config.json --with-appendix
```

別リポジトリの資料をまとめる場合は、`--root` に対象リポジトリを指定します。

```bash
npm run delivery -- --root=/path/to/project --config=path/to/config.json --with-appendix
```

`config.json` の主な記入項目:

- `slug`: 出力ファイル名に使う短いID
- `title`: 表紙に出す納品資料タイトル
- `summary`: 表紙とサマリー冒頭に出す概要
- `since` / `until`: 更新日の取得に使う対象期間
- `sourceRef`: 特定のGit参照から本文を読む場合に指定。通常は空欄でOK
- `deliveredItems`: 納品した成果・整備内容
- `changes`: 対象期間の主な変更点
- `intentions`: 変更した意図や背景
- `usableOutcomes`: 資料によって活用できること
- `files`: PDFにまとめるMarkdownファイル
- `fileNotes`: 各Markdownファイルの役割・読みどころ
