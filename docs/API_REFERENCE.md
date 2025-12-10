
# API 仕様書

Base URL: `/api`

## 1. 解析 API (`/parse`)

自然言語テキストを解析し、構造化データへ変換します。

*   **Endpoint:** `POST /api/parse`
*   **Description:** Gemini 2.5 Flash を使用してテキストをパースします。フロントエンドのフィールド設定を受け取り、動的にプロンプトを構築します。

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
    ],
    "excretion": [
      { "key": "excretion_type", "label": "種類", "description": "排泄物の種類（尿、便）" }
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
  },
  "suggested_date": "2025-12-10" // (Optional) テキスト内に日付指定があった場合
}
```

---

## 2. 記録管理 API (`/records`)

記録のCRUD操作を行います。

### 2.1 一覧取得
*   **Endpoint:** `GET /api/records`
*   **Query Params:** なし (デフォルトで最新100件取得)
*   **Response:** `CareRecord[]`

### 2.2 新規作成
*   **Endpoint:** `POST /api/records`
*   **Body:**
    ```json
    {
      "record_type": "meal",
      "details": { "main_dish": "..." }
    }
    ```
*   **Response:** 作成されたレコードオブジェクト

### 2.3 更新
*   **Endpoint:** `PUT /api/records`
*   **Body:**
    ```json
    {
      "id": 123,
      "record_type": "meal",
      "details": { ... }
    }
    ```
*   **Response:** 更新されたレコードオブジェクト

### 2.4 削除
*   **Endpoint:** `DELETE /api/records`
*   **Query Params:** `?id=123`
*   **Response:** `{ "message": "Deleted successfully" }`

### 技術的注意: Superset Schema
Gemini APIの `responseSchema` 制約により、Few-Shot例で使用するすべてのキーがスキーマに含まれている必要があります。本APIでは `ALL_KNOWN_KEYS` を使用してすべての既知キーを常にスキーマに含める「Superset Schema」戦略を採用しています。

---

## 3. チャット API (`/chat`)

RAG (Retrieval-Augmented Generation) を利用したAI相談機能。

*   **Endpoint:** `POST /api/chat`
*   **Description:** ユーザーの質問に対し、DB内の直近記録を参照して回答を生成します。

### Request Body
```json
{
  "message": "最近、田中さんの食事量は減っていますか？"
}
```

### Response
```json
{
  "reply": "記録を確認しました。直近3日間の食事摂取率は平均80%前後で安定しており、特に減少傾向は見られません。"
}
```
