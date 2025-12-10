# AI介護記録アプリ (care-log-ai-jp)

音声または自然言語テキストで入力された介護記録をAIで解析・構造化し、データベースに保存・可視化するWebアプリケーションです。

## デモ・ドキュメント

| リンク | 説明 |
|--------|------|
| [本番環境](https://care-log-ai-jp.vercel.app) | Vercelにデプロイされたアプリ |
| [システムドキュメント](https://yasushihonda-acg.github.io/care-log-ai-jp/) | GitHub Pages (設計書・API仕様) |

## 主な機能

- **AI解析入力**: 「お茶200ml飲みました」→ `fluid_type: "お茶"`, `fluid_ml: "200"` に自動分離
- **音声入力対応**: Web Speech APIによる音声認識
- **RAGチャット**: 過去の記録を参照したAI相談機能
- **動的フィールド設定**: 施設ごとのカスタマイズ対応

## 技術スタック

| カテゴリ | 技術 |
|----------|------|
| Frontend | React (Vite) + Tailwind CSS |
| Backend | Vercel Serverless Functions |
| Database | Vercel Postgres (JSONB) |
| AI | Google Gemini 2.5 Flash |

## ローカル開発

```bash
# 依存関係インストール
npm install

# 環境変数設定
cp .env.local.example .env.local
# GEMINI_API_KEY を設定

# 開発サーバー起動
npm run dev
```

## ドキュメント構成

```
docs/
├── index.html          # GitHub Pages (統合ドキュメント)
├── ARCHITECTURE.md     # アーキテクチャ設計
├── DATABASE_SCHEMA.md  # データベース設計
├── API_REFERENCE.md    # API仕様書
├── FEATURE_SPECS.md    # 機能仕様詳細
└── CHANGELOG.md        # 変更履歴
```

## ライセンス

MIT License
