# gumi-paper theme

読みやすい紙面風のMarkdownプレビュー用CSSです。

`gumi-paper.css` は Markdown Quick Look / QLMarkdown 系のプレビューで使うことを想定した軽量テーマです。通常のMarkdownレンダリング結果に加えて、GitHub風の `.markdown-body` ラッパーにも効くようにしています。

## 特徴

- 紙面らしい余白、本文幅、境界線、控えめな影
- 装飾を強くしすぎない見出し階層
- 濃いめの表ヘッダーと交互背景のテーブル
- 引用、インラインコード、コードブロックの整形
- 狭い画面でのテーブル横スクロール

## 使い方

MarkdownレンダラーのカスタムCSSとして `gumi-paper.css` を指定します。

HTMLプレビューで使う場合は、`head` から読み込みます。

```html
<link rel="stylesheet" href="theme/gumi-paper.css">
```

`.markdown-body` で本文を包むレンダラーでも、そのまま使えます。

## サンプル

見出し、引用、コード、テーブル、Mermaid図の雰囲気を確認するためのサンプルを用意しています。

- [examples/sample.md](examples/sample.md)

## カスタマイズ

色は `gumi-paper.css` の先頭にあるCSS変数で調整できます。

```css
:root {
  --page-bg: #f7f8fa;
  --content-bg: #ffffff;
  --text: #1d2433;
  --link: #176b87;
  --table-head: #dce8ee;
  --table-row-alt: #f0f5f7;
}
```

まずはこのあたりの値を変えると、余白や組版を保ったまま雰囲気だけ調整できます。
