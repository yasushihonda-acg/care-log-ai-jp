# Changelog

このドキュメントはプロジェクトの重要な変更履歴を記録します。

---

## [Unreleased] - 2025-12-10

### Fixed
- **AI解析の500エラー修正**: Few-Shot例で使用するキーが `responseSchema` に含まれていないことによるGemini APIエラーを修正
- **排泄フィールドの予約語衝突**: `type` キーを `excretion_type` にリネームし、JavaScript予約語との衝突を回避
- **履歴表示のフォールバック**: `HistoryTab.tsx` で既存データ（`type`）と新規データ（`excretion_type`）の両方に対応

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
