
# データベース設計書

## 1. 接続情報
*   **Database:** Vercel Postgres (Powered by Neon)
*   **Driver:** `@vercel/postgres`

## 2. テーブル定義

### `care_records` テーブル
介護記録のメインテーブル。`details` カラムにJSONBを採用することで、記録タイプごとに異なる項目を柔軟に保存する設計としている。

| カラム名 | データ型 | 制約 | 説明 |
| --- | --- | --- | --- |
| `id` | SERIAL | PRIMARY KEY | 一意のレコードID |
| `record_type` | VARCHAR(50) | NOT NULL | 記録の種類 (`meal`, `vital`, `excretion`, `hygiene`, `other`) |
| `details` | JSONB | NOT NULL | 構造化された詳細データ (後述) |
| `recorded_at` | TIMESTAMP | DEFAULT NOW() | 記録日時 |

```sql
CREATE TABLE care_records (
  id SERIAL PRIMARY KEY,
  record_type VARCHAR(50) NOT NULL,
  details JSONB NOT NULL,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 3. JSONBデータ構造 (`details`)

`details` カラムに格納されるJSONオブジェクトの構造は、`record_type` およびユーザーのカスタム設定によって可変ですが、基本パターンは以下の通りです。
**注意:** AI解析の成功率を高めるため、値は基本的にすべて `String` 型として保存されます（数値も文字列として格納）。

### 食事 (`meal`)
```json
{
  "main_dish": "全粥",
  "side_dish": "魚のムニエル",
  "amount_percent": "80",  // 文字列としての数値
  "fluid_ml": "200",       // 文字列としての数値
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
  "skin_condition": "臀部に発赤あり",
  "notes": "軟膏塗布"
}
```

### カスタムフィールドについて
ユーザーが設定画面でフィールドを追加した場合、自動生成されたキー（例: `f_k8s9d...`）またはユーザー指定のキーでJSONに追加保存されます。DBスキーマの変更は不要です。
