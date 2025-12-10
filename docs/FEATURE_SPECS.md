
# 機能仕様詳細

## 1. プロジェクト背景と目的
**目的:** 介護現場における記録業務の負担軽減。
**課題:** 「お茶200ml」のような、種類と量が混在した自然言語データを、正確にデータベースのフィールド（`fluid_type`, `fluid_ml`）に分離・格納する必要がある。

## 2. AI解析ロジック (Pattern Recognition Strategy)

### 採用モデル: Gemini 2.5 Flash
*   **変更理由 (2025/12/10):** Proモデルによる論理的推論（Chain of Thought）を試みたが、応答速度の低下と、指示の複雑化による精度低下を招いたため。
*   **新方針:** 高速なFlashモデルを採用し、論理的な説明ではなく**「徹底的な具体例（Aggressive Few-Shot）」**によってパターン認識させる。

### 解析戦略: Aggressive Few-Shot
AIに対して「ルール」を言葉で説明するのではなく、理想的な「入力と出力のペア」を提示することで、挙動を模倣させます。

#### 分離ルールの例示（プロンプトに含める学習データ）
1.  **水分分離:**
    *   In: "お茶200ml" → Out: `fluid_type: "お茶"`, `fluid_ml: "200"`
    *   In: "トロミ水50" → Out: `fluid_type: "トロミ水"`, `fluid_ml: "50"`
2.  **数値変換:**
    *   In: "全粥8割" → Out: `amount_percent: "80"`
    *   In: "半分" → Out: `amount_percent: "50"`

### サーバーサイド・メタデータ補完 (Fail-Safe)
フロントエンドから送られてくるフィールド設定（`fieldSettings`）にメタデータ（`description`）が含まれていない場合（古いキャッシュ等の影響）、サーバー側で強制的にデフォルトのメタデータを適用し、AIへの指示漏れを防ぐ。

### Superset Schema 戦略 (2025/12/10追加)
Gemini APIの `responseSchema` は、Few-Shot例に含まれるキーがスキーマに定義されていないと500エラーを返す。この問題を回避するため、`ALL_KNOWN_KEYS` という定数ですべての既知キーを定義し、ユーザー設定に関わらず常にスキーマに含める「Superset Schema」戦略を採用。

```typescript
const ALL_KNOWN_KEYS = [
  // meal
  'main_dish', 'side_dish', 'amount_percent', 'fluid_type', 'fluid_ml',
  // excretion
  'excretion_type', 'amount', 'characteristics', 'incontinence',
  // vital
  'temperature', 'systolic_bp', 'diastolic_bp', 'pulse', 'spo2',
  // hygiene
  'bath_type', 'skin_condition', 'notes',
  // other
  'title', 'detail'
];
```

### キー命名規則
*   **予約語回避:** JavaScriptの予約語（`type`等）との衝突を避けるため、排泄種類は `excretion_type` を使用。
*   **後方互換性:** 既存データ（`type`キー）との互換性のため、`HistoryTab.tsx` ではフォールバック処理を実装。

## 3. 動的フィールド設定 (Settings)

*   **保存場所:** `localStorage`
*   **同期ロジック:** アプリ起動時にデフォルト設定とマージされるが、最終的な担保はサーバーサイドAPIが行う。

## 4. RAGチャット (Context Injection)

*   **参照範囲:** 直近50件の `care_records`。
*   **手法:** 取得したJSONをプロンプトのコンテキストに注入する簡易RAG。
