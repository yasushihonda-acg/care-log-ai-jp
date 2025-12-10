# AI介護記録アプリ (care-log-ai-jp)

音声または自然言語テキストで入力された介護記録をAIで解析・構造化し、データベースに保存・可視化するWebアプリケーションです。

## 🎉 Phase 1 完了 - 本番テスト利用開始可能

| 項目 | 状態 |
|------|------|
| Parse API (AI解析) | ✅ A評価 |
| Records API (CRUD) | ✅ A評価 |
| Chat API (RAG) | ✅ A評価 |
| 音声入力 | ⚠️ B評価 (長時間使用で制限あり) |

## リンク

| リンク | 説明 |
|--------|------|
| **[本番環境](https://care-log-ai-jp.web.app)** | Firebase Hosting |
| **[API Base](https://asia-northeast1-care-log-ai-jp.cloudfunctions.net)** | Cloud Functions |
| [システムドキュメント](https://yasushihonda-acg.github.io/care-log-ai-jp/) | GitHub Pages (設計書・API仕様) |

## 主な機能

- **AI解析入力**: 「お茶200ml飲みました」→ `fluid_type: "お茶"`, `fluid_ml: "200"` に自動分離
- **音声入力対応**: Web Speech APIによる音声認識 (手動開始/停止)
- **RAGチャット**: 過去の記録を参照したAI相談機能
- **動的フィールド設定**: 施設ごとのカスタマイズ対応

## 技術スタック変遷

Google AI Studio (Build) → Vercel → GCP/Firebase という変遷を経て現在の構成に至りました。

### 現行構成 (Phase 1 - GCP/Firebase)

| カテゴリ | 技術 |
|----------|------|
| Frontend | React 18 (Vite 5) + Tailwind CSS |
| Hosting | Firebase Hosting |
| Backend | Cloud Functions 2nd Gen |
| Database | Firestore (asia-northeast1) |
| AI | Vertex AI Gemini 2.5 Flash (Workload Identity) |
| CI/CD | GitHub Actions + Workload Identity Federation |

## ローカル開発

```bash
# 依存関係インストール
npm install

# 開発サーバー起動 (フロントエンドのみ)
npm run dev

# Cloud Functions ローカル実行
cd functions && npm run serve
```

## プロジェクト構成

```
care-log-ai-jp/
├── src/                    # Reactフロントエンド
├── components/             # UIコンポーネント
├── functions/              # Cloud Functions
│   └── src/
│       └── index.ts        # parse, records, chat API
├── docs/                   # ドキュメント
│   ├── index.html          # GitHub Pages
│   ├── ARCHITECTURE.md     # アーキテクチャ設計
│   ├── API_REFERENCE.md    # API仕様書
│   ├── DATABASE_SCHEMA.md  # データベース設計
│   ├── VOICE_INPUT_SPEC.md # 音声入力仕様
│   ├── TEST_REPORT.md      # テストレポート
│   └── CHANGELOG.md        # 変更履歴
├── .github/
│   └── workflows/
│       └── deploy.yml      # GitHub Actions CI/CD
└── firebase.json           # Firebase設定
```

## ドキュメント一覧

| ドキュメント | 説明 |
|-------------|------|
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | システム全体設計 |
| [API_REFERENCE.md](./docs/API_REFERENCE.md) | APIエンドポイント詳細 |
| [DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md) | Firestoreスキーマ |
| [VOICE_INPUT_SPEC.md](./docs/VOICE_INPUT_SPEC.md) | 音声入力仕様・制限事項 |
| [AI_PARSING_IMPROVEMENT.md](./docs/AI_PARSING_IMPROVEMENT.md) | AI解析改善計画 |
| [CHANGELOG.md](./docs/CHANGELOG.md) | バージョン履歴 |

## Phase 2 検討事項

- [ ] Firebase Authentication (認証機能)
- [ ] レート制限の実装
- [ ] 音声入力の代替技術検討 (Whisper API等)
- [ ] エラーログ詳細化 (Cloud Logging)

## ライセンス

MIT License
