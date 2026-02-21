# azooKey キーボード評価ツール

azooKey の Custard JSON 形式で定義されたカスタムキーボードを可視化し、打鍵効率を評価する Web ツールです。

## 機能

- **キーボード可視化** — Custard JSON をアップロードまたはサンプルを選択して、キーボードレイアウトを Canvas 上に描画。フリック入力のサブラベルも表示。
- **打鍵シミュレーション** — 日本語ひらがな / ローマ字 / 英字の 3 モードで、組み込みコーパスまたは任意テキストに対する打鍵をシミュレート。
  - 濁音・半濁音・小書きの変換キー対応
  - `replace_last_characters` による多段変換（GODAN 等）
  - ロングプレス・フリックバリエーション対応
  - 多文字出力キーのチェーン解決（例: N+K+A → 「んか」）
- **ヒートマップ** — キー単位 / フリック方向単位の 2 種類のヒートマップで打鍵頻度を可視化。
- **スコアリング** — カバー率・打鍵距離・均等性・同キー連続率を算出し、総合スコアで評価。

## 対応 JSON 形式

[azooKey CustardKit](https://github.com/azooKey/CustardKit) の Custard JSON（v1.0〜1.2）に対応しています。

## 開発

```bash
npm install
npm run dev      # 開発サーバー起動
npm run build    # プロダクションビルド
npm run preview  # ビルド結果のプレビュー
```

## 技術スタック

- TypeScript + Vite（静的サイト生成）
- Canvas API（キーボード描画・ヒートマップ）
- GitHub Pages（ホスティング）

## デプロイ

`main` ブランチへの push で GitHub Actions が自動ビルド・デプロイします。

## ライセンス

MIT
