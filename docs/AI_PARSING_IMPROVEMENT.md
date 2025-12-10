# AI解析精度改善計画

## 1. 現状の問題

### 1.1 症状
入力テキスト「お昼ご飯は全粥を8割、お茶を200ml飲みました」に対して:

**期待される出力:**
```json
{
  "record_type": "meal",
  "details": {
    "main_dish": "全粥",
    "amount_percent": "80",
    "fluid_type": "お茶",
    "fluid_ml": "200"
  }
}
```

**実際の出力:**
```json
{
  "record_type": "meal",
  "details": {
    "main_dish": "全粥",
    "notes": "お昼ご飯",
    "title": "お昼ご飯に関する記録です。詳細を確認してください。"
  }
}
```

### 1.2 問題点
- `amount_percent` (8割→80) が抽出されない
- `fluid_type` (お茶) が抽出されない
- `fluid_ml` (200) が抽出されない
- 不要な `notes` と `title` が生成される

## 2. 根本原因分析

### 2.1 プロンプト構造の問題
現在のプロンプトは:
1. Few-shot例が提供されているが、モデルが従わない
2. `responseSchema` でスキーマを強制しているが、全フィールドがstringで曖昧
3. ALL_KNOWN_KEYS に `notes`, `title` 等の汎用フィールドが含まれ、モデルがそちらを優先

### 2.2 スキーマ設計の問題
```typescript
const detailsProperties: Record<string, { type: string }> = {};
schemaKeys.forEach(key => {
  detailsProperties[key] = { type: 'string' };
});
```
- すべてのフィールドが等価に扱われ、優先度がない
- モデルは任意のフィールドを選択可能

## 3. 改善案

### 3.1 案A: プロンプトエンジニアリング強化
**アプローチ:** プロンプトをより明示的に構造化

**変更点:**
```
【必須抽出ルール】
1. まず record_type を判定してください
2. 次に、以下のフィールドを【必ず】抽出してください:
   - meal の場合: main_dish, amount_percent, fluid_type, fluid_ml
   ...
3. 数値は単位を除去して数字のみにしてください（8割→80, 200ml→200）
4. 該当しない情報のみ空文字列にしてください
5. notes, title は使わないでください
```

**メリット:** デプロイ変更のみ
**デメリット:** モデルの解釈に依存

### 3.2 案B: スキーマ制約の厳格化
**アプローチ:** `responseSchema` でフィールドを限定

**変更点:**
```typescript
// record_type ごとに異なるスキーマを使用
const mealSchema = {
  type: 'object',
  properties: {
    record_type: { type: 'string', enum: ['meal'] },
    details: {
      type: 'object',
      properties: {
        main_dish: { type: 'string' },
        amount_percent: { type: 'string' },
        fluid_type: { type: 'string' },
        fluid_ml: { type: 'string' }
      },
      required: ['main_dish']
    }
  }
};
```

**メリット:** モデルに選択肢を与えない
**デメリット:** 2段階呼び出し（タイプ判定→詳細抽出）が必要

### 3.3 案C: ハイブリッドアプローチ（推奨）
**アプローチ:** プロンプト強化 + 後処理フィルタリング

**変更点:**
1. プロンプトで優先フィールドを明示
2. レスポンス後に不要フィールド（notes, title等）を除去
3. 抽出漏れの場合は正規表現でフォールバック抽出

```typescript
// 後処理
const cleanedDetails = { ...details };
delete cleanedDetails.notes;
delete cleanedDetails.title;

// フォールバック: 数値抽出
if (!cleanedDetails.amount_percent) {
  const match = text.match(/(\d+)[割%]/);
  if (match) cleanedDetails.amount_percent = String(parseInt(match[1]) * 10);
}
if (!cleanedDetails.fluid_ml) {
  const match = text.match(/(\d+)\s*ml/i);
  if (match) cleanedDetails.fluid_ml = match[1];
}
```

**メリット:** 堅牢性が高い、段階的改善可能
**デメリット:** コード複雑化

## 4. 推奨実装計画

### Phase 1: 即座に適用（案C-プロンプト強化）
1. プロンプトの改善
2. 不要フィールドの除去ロジック追加
3. デプロイ・テスト

### Phase 2: フォールバック抽出（必要に応じて）
1. 正規表現による補完抽出
2. 複数パターンのテストケース作成

### Phase 3: 継続的改善
1. ログ収集と分析
2. Few-shot例の追加・調整

## 5. テストケース

| 入力 | 期待される出力 |
|------|---------------|
| お昼ご飯は全粥を8割、お茶を200ml飲みました | main_dish: 全粥, amount_percent: 80, fluid_type: お茶, fluid_ml: 200 |
| 朝食パン1枚、牛乳150cc | main_dish: パン, fluid_type: 牛乳, fluid_ml: 150 |
| 体温36.5度、血圧120/80 | temperature: 36.5, systolic_bp: 120, diastolic_bp: 80 |
| 14時トイレで排尿、普通量 | excretion_type: 尿, amount: 普通 |

---

*作成日: 2025-12-10*
