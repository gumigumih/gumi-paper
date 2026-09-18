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

複数のMarkdown資料を、表紙・納品資料概要・本文付録つきPDFにまとめられます。
納品資料は単体Markdown変換とは分けて、`config.json` でタイトル、概要、案件情報、納品物、実施結果、確認事項、対象Markdownファイル、資料ごとの説明を定義します。

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
- `deliveryOverview`: 案件名、対象期間、資料基準日などの表紙情報
- `deliveryItems`: 納品物名、内容、状態
- `deliveryResults`: 対象期間に確認できた実施結果
- `deliveryNotes`: 未確認事項、対象外範囲、その他の備考
- `files`: PDFにまとめるMarkdownファイル
- `fileNotes`: 各Markdownファイルの役割・読みどころ

納品概要、納品物一覧、実施結果、確認事項・備考を、納品書の添付資料として確認しやすい形式で表示します。

```json
{
  "deliveryOverview": [
    { "label": "案件名", "value": "案件名" },
    { "label": "対象期間", "value": "2026年8月1日〜8月31日" },
    { "label": "資料基準日", "value": "2026年8月31日" }
  ],
  "deliveryItems": [
    { "name": "調査資料", "description": "調査内容の概要", "status": "納品" }
  ],
  "deliveryResults": ["対象期間に確認できた結果"],
  "deliveryNotes": ["未確認事項や対象外範囲"]
}
```

旧設定の`deliveredItems`、`changes`、`intentions`、`usableOutcomes`も読み込み可能ですが、新規設定では上記の納品書添付向けフィールドを使用します。
