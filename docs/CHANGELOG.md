# Changelog

このドキュメントはプロジェクトの重要な変更履歴を記録します。

---

## [Unreleased] - 2025-12-10

### Added - GCP/Firebase 移行
- **GCPプロジェクト作成**: `care-log-ai-jp` (Project Number: 71778021308)
- **Firebaseプロジェクト紐付け**: Firebase Hosting, Firestoreを統合
- **Firestoreデータベース作成**: `asia-northeast1` リージョンに作成
- **Workload Identity Federation設定**:
  - Pool: `github-pool`
  - Provider: `github-provider`
  - Service Account: `github-actions@care-log-ai-jp.iam.gserviceaccount.com`
- **GitHub Actions CI/CDワークフロー**: `.github/workflows/deploy.yml`
  - Workload Identity Federationによるキーレス認証
  - main push時に自動デプロイ
  - PR時にプレビューデプロイ
- **Cloud Functionsソースコード**: `functions/src/index.ts`
  - parse API (AI解析)
  - records API (CRUD)
  - chat API (RAGチャット)
- **Firebase Hosting設定**: `firebase.json`

### Documentation
- **GCP_MIGRATION_PLAN.md**: GCP移行計画書を新規作成
- **CICD_DESIGN.md**: CI/CD設計書を新規作成
- **docs/index.html**: GitHub Pages大幅更新
  - GCP/Firebase移行セクション追加
  - CI/CD設計セクション追加
  - Mermaid図更新
- **README.md**: GCP移行情報を追加
- **ARCHITECTURE.md**: GCP移行後アーキテクチャを追加

---

## [1.0.1] - 2025-12-10

### Fixed
- **AI解析の500エラー修正**: Few-Shot例で使用するキーが `responseSchema` に含まれていないことによるGemini APIエラーを修正
- **排泄フィールドの予約語衝突**: `type` キーを `excretion_type` にリネームし、JavaScript予約語との衝突を回避
- **履歴表示のフォールバック**: `HistoryTab.tsx` で既存データ（`type`）と新規データ（`excretion_type`）の両方に対応
- **Vercelモジュール解決エラー**: `DEFAULT_FIELD_SETTINGS` をインライン化
- **Gemini SDK型エラー**: `SchemaType` を文字列リテラルに変更

### Added
- **Superset Schema戦略**: `ALL_KNOWN_KEYS` 定数を追加し、すべての既知キーを常にスキーマに含める設計を実装
- **ドキュメント更新**: FEATURE_SPECS.md に Superset Schema 戦略とキー命名規則を追記

### Changed
- `types.ts`: 排泄フィールドを `key: 'type'` → `key: 'excretion_type'` に変更
- `api/parse.ts`: Few-Shot例の排泄を `excretion_type` に更新、Superset Schema構築ロジック追加
- `docs/DATABASE_SCHEMA.md`: 排泄JSONサンプルを `excretion_type` に更新
- `docs/index.html`: Superset Schema戦略の説明を追加

---

## [1.0.0] - 2025-12-10

### Initial Release
- AI介護記録アプリの初期リリース
- Gemini 2.5 Flash による自然言語解析（Aggressive Few-Shot戦略）
- Vercel Postgres (JSONB) によるデータ保存
- RAGチャット機能（Context Injection方式）
- 動的フィールド設定（localStorage + サーバーサイド補完）
