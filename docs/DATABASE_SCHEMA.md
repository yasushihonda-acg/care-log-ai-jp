# データベース設計書

## 1. 概要

| 項目 | 値 |
|------|-----|
| **Database** | Cloud Firestore |
| **プロジェクト** | `care-log-ai-jp` |
| **リージョン** | `asia-northeast1` (東京) |
| **SDK** | `firebase-admin/firestore` |

## 2. コレクション構造

### `care_records` コレクション

介護記録のメインコレクション。ドキュメント形式で記録タイプごとに異なる項目を柔軟に保存します。

```
care_records/                    # コレクション
  └── {documentId}/              # ドキュメント (auto-generated)
        ├── record_type: string  # "meal", "vital", "excretion", etc.
        ├── details: map         # 構造化データ
        └── created_at: timestamp
```

### フィールド定義

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `record_type` | `string` | 記録の種類 (`meal`, `vital`, `excretion`, `hygiene`, `other`) |
| `details` | `map` | 構造化された詳細データ（下記参照） |
| `created_at` | `timestamp` | 作成日時（サーバータイムスタンプ） |

## 3. details フィールドの構造

`details` フィールドに格納されるマップの構造は、`record_type` およびユーザーのカスタム設定によって可変です。

> **Note:** AI解析の成功率を高めるため、値は基本的にすべて `String` 型として保存されます（数値も文字列として格納）。

### 食事 (`meal`)
```json
{
  "main_dish": "全粥",
  "side_dish": "魚のムニエル",
  "amount_percent": "80",
  "fluid_ml": "200",
  "fluid_type": "お茶"
}
```

### 排泄 (`excretion`)
```json
{
  "excretion_type": "尿",
  "amount": "多量",
  "characteristics": "混濁なし",
  "incontinence": "あり"
}
```

### バイタル (`vital`)
```json
{
  "temperature": "36.8",
  "systolic_bp": "124",
  "diastolic_bp": "78",
  "pulse": "72",
  "spo2": "98"
}
```

### 衛生 (`hygiene`)
```json
{
  "bath_type": "清拭",
  "skin_condition": "臀部に発赤あり"
}
```

### その他 (`other`)
```json
{
  "detail": "特記事項の内容"
}
```

## 4. インデックス

### 推奨インデックス (`firestore.indexes.json`)

```json
{
  "indexes": [
    {
      "collectionGroup": "care_records",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "created_at", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "care_records",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "record_type", "order": "ASCENDING" },
        { "fieldPath": "created_at", "order": "DESCENDING" }
      ]
    }
  ]
}
```

## 5. クエリパターン

### 一覧取得（最新100件）
```typescript
const snapshot = await firestore
  .collection('care_records')
  .orderBy('created_at', 'desc')
  .limit(100)
  .get();
```

### 記録タイプでフィルタ
```typescript
const snapshot = await firestore
  .collection('care_records')
  .where('record_type', '==', 'meal')
  .orderBy('created_at', 'desc')
  .limit(50)
  .get();
```

## 6. Vercel Postgres からの移行

| 項目 | Vercel Postgres | Firestore |
|------|-----------------|-----------|
| データ構造 | JSONB (SQL) | Document (NoSQL) |
| ID | SERIAL (integer) | Auto-generated string |
| クエリ | SQL + JSONBオペレータ | フィールドベースクエリ |
| インデックス | 手動 (GIN) | **自動** + カスタム |

### 移行時の注意点
- Vercel Postgres の `id` (integer) → Firestore の `documentId` (string)
- `recorded_at` → `created_at` (命名統一)
- 既存データがある場合は移行スクリプトが必要

## 7. セキュリティルール

現在はCloud Functions経由のアクセスのみを想定しているため、Firestoreセキュリティルールは以下の通り：

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /care_records/{document} {
      // Cloud Functions (Admin SDK) からのアクセスのみ
      // クライアント直接アクセスは拒否
      allow read, write: if false;
    }
  }
}
```

---

*最終更新: 2025-12-10*
