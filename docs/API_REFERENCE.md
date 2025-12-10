# API 仕様書

## エンドポイント情報

| 環境 | Base URL |
|------|----------|
| **本番 (Firebase)** | `https://asia-northeast1-care-log-ai-jp.cloudfunctions.net` |
| **開発 (ローカル)** | `/api` (Vite proxy経由) |

## 1. 解析 API (`/parse`)

自然言語テキストを解析し、構造化データへ変換します。

*   **Endpoint:** `POST /parse`
*   **Description:** Vertex AI Gemini 2.5 Flash を使用してテキストをパースします。フロントエンドのフィールド設定を受け取り、動的にプロンプトを構築します。

### Request Body
```json
{
  "text": "昼食は全粥8割、お茶200mlでした。",
  "fieldSettings": {
    "meal": [
      { "key": "main_dish", "label": "主食", "description": "食べた主食の種類（例：全粥、ご飯）" },
      { "key": "amount_percent", "label": "摂取率", "description": "食事全体の摂取割合。数値のみ" },
      { "key": "fluid_type", "label": "水分種類", "description": "摂取した水分の名称のみ" },
      { "key": "fluid_ml", "label": "水分量(ml)", "description": "摂取した水分の量。数値のみ" }
    ]
  }
}
```

> **Note:** `description` フィールドはAIへの抽出ヒントとして機能します。省略された場合、サーバー側でデフォルト値が自動補完されます（Fail-Safe機構）。

### Response (200 OK)
```json
{
  "record_type": "meal",
  "details": {
    "main_dish": "全粥",
    "amount_percent": "80",
    "fluid_ml": "200",
    "fluid_type": "お茶"
  }
}
```

### 後処理機能 (v1.1.0+)
- 無効な値の自動除去: `null`, `"null"`, `""`, `"なし"` 等
- 記録タイプに応じたフィールドフィルタリング
- フォールバック正規表現抽出（AI抽出失敗時）

---

## 2. 記録管理 API (`/records`)

記録のCRUD操作を行います。データはFirestoreの `care_records` コレクションに保存されます。

### 2.1 一覧取得
*   **Endpoint:** `GET /records`
*   **Query Params:** なし (デフォルトで最新100件取得、`created_at` DESC)
*   **Response:** `CareRecord[]`

```json
[
  {
    "id": "abc123...",
    "record_type": "meal",
    "details": { "main_dish": "全粥", "amount_percent": "80" },
    "created_at": { "_seconds": 1733788800, "_nanoseconds": 0 }
  }
]
```

### 2.2 新規作成
*   **Endpoint:** `POST /records`
*   **Body:**
    ```json
    {
      "record_type": "meal",
      "details": { "main_dish": "全粥", "amount_percent": "80" }
    }
    ```
*   **Response:** 作成されたレコードオブジェクト（`id` 含む）

### 2.3 更新
*   **Endpoint:** `PUT /records`
*   **Body:**
    ```json
    {
      "id": "abc123...",
      "record_type": "meal",
      "details": { "main_dish": "全粥", "amount_percent": "90" }
    }
    ```
*   **Response:** 更新されたレコードオブジェクト

### 2.4 削除
*   **Endpoint:** `DELETE /records?id=abc123...`
*   **Response:** `{ "message": "Deleted successfully" }`

---

## 3. チャット API (`/chat`)

RAG (Retrieval-Augmented Generation) を利用したAI相談機能。

*   **Endpoint:** `POST /chat`
*   **Description:** ユーザーの質問に対し、Firestore内の直近記録を参照して回答を生成します。

### Request Body
```json
{
  "message": "最近の食事量はどうですか？"
}
```

### Response
```json
{
  "reply": "記録を確認しました。直近の食事記録では、主食の摂取率は80%前後で安定しています。"
}
```

---

## 4. 技術詳細

### 4.1 認証
- **本番環境:** Workload Identity (ADC) - APIキー不要
- **CORS:** すべてのオリジンを許可 (`cors({ origin: true })`)

### 4.2 Superset Schema戦略
Gemini APIの `responseSchema` 制約により、Few-Shot例で使用するすべてのキーがスキーマに含まれている必要があります。本APIでは `ALL_KNOWN_KEYS` を使用してすべての既知キーを常にスキーマに含める「Superset Schema」戦略を採用しています。

### 4.3 エラーレスポンス
```json
{
  "error": "エラーメッセージ",
  "details": "詳細情報（開発用）"
}
```

---

## 5. cURLサンプル

### Parse API
```bash
curl -X POST https://asia-northeast1-care-log-ai-jp.cloudfunctions.net/parse \
  -H "Content-Type: application/json" \
  -d '{"text": "お昼ご飯は全粥を8割、お茶を200ml飲みました"}'
```

### Records API (一覧取得)
```bash
curl https://asia-northeast1-care-log-ai-jp.cloudfunctions.net/records
```

### Chat API
```bash
curl -X POST https://asia-northeast1-care-log-ai-jp.cloudfunctions.net/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "最近の食事量はどうですか？"}'
```

---

*最終更新: 2025-12-10*
