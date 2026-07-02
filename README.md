# gumi-paper

読みやすい紙面風のMarkdownテーマと、そのテーマを使った任意の変換ツールです。

このリポジトリでは、テーマ本体と変換ツールを分けて管理しています。

## 構成

- [theme](theme): Markdownプレビュー用CSSテーマ
- [tools/converter](tools/converter): MarkdownをHTML/PDFへ変換する任意ツール

`theme/gumi-paper.css` が本体です。
変換ツールは、同じテーマを使って単体HTMLや納品用PDFを作りたい場合だけ使います。

## はじめる

MarkdownレンダラーのカスタムCSSとして使う場合:

```html
<link rel="stylesheet" href="theme/gumi-paper.css">
```

変換ツールを使う場合:

```bash
cd tools/converter
npm install
npm run html -- --markdown=theme/examples/sample.md
```

詳しい使い方は、それぞれの README を参照してください。

## ライセンス

MIT
