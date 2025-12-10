# テストレポート

## 概要

| 項目 | 状態 |
|------|------|
| **テスト日** | 2025-12-10 |
| **環境** | 本番 (Firebase) |
| **Base URL** | `https://asia-northeast1-care-log-ai-jp.cloudfunctions.net` |

## 1. Parse API テスト

### 1.1 食事記録の解析

**入力:**
```
お昼ご飯は全粥を8割、お茶を200ml飲みました
```

**期待される出力:**
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

**結果:** ✅ PASS

**改善点 (v1.1.0):**
- 無効値フィルタリング: `null`, `"null"`, `"なし"` を自動除去
- 記録タイプ別フィールドフィルタリング
- フォールバック正規表現抽出

### 1.2 バイタル記録の解析

**入力:**
```
体温36.8度、血圧124/78、脈拍72、SpO2 98%
```

**期待される出力:**
```json
{
  "record_type": "vital",
  "details": {
    "temperature": "36.8",
    "systolic_bp": "124",
    "diastolic_bp": "78",
    "pulse": "72",
    "spo2": "98"
  }
}
```

**結果:** ✅ PASS

## 2. Records API テスト

### 2.1 一覧取得 (GET)

**エンドポイント:** `GET /records`

**結果:** ✅ PASS
- 4件のシードデータが正常に返却
- `created_at` の降順でソート済み

### 2.2 新規作成 (POST)

**エンドポイント:** `POST /records`

**リクエスト:**
```json
{
  "record_type": "meal",
  "details": {
    "main_dish": "全粥",
    "amount_percent": "80"
  }
}
```

**結果:** ✅ PASS
- ドキュメントIDが自動生成
- `created_at` がサーバータイムスタンプで設定

### 2.3 更新 (PUT)

**エンドポイント:** `PUT /records`

**結果:** ✅ PASS

### 2.4 削除 (DELETE)

**エンドポイント:** `DELETE /records?id={documentId}`

**結果:** ✅ PASS

## 3. Chat API テスト (RAG)

### 3.1 記録に基づく質問応答

**入力:**
```json
{
  "message": "最近の食事量はどうですか？"
}
```

**出力例:**
```
介護記録データに基づくと、最近の食事記録は以下の通りです...
（Firestoreの記録データを参照した回答）
```

**結果:** ✅ PASS
- 直近50件の記録を取得してコンテキストに注入
- 記録データに基づいた適切な回答を生成

## 4. フロントエンド連携テスト

### 4.1 本番URL動作確認

**URL:** https://care-log-ai-jp.web.app

**確認項目:**
- [x] ページ読み込み
- [x] API接続 (Parse, Records, Chat)
- [x] 音声入力機能
- [x] 記録保存・履歴表示

**結果:** ✅ PASS

## 5. CI/CD テスト

### 5.1 GitHub Actions ワークフロー

**確認項目:**
- [x] `push to main` → 本番デプロイ
- [x] Workload Identity Federation 認証
- [x] Cloud Functions デプロイ
- [x] Firebase Hosting デプロイ

**結果:** ✅ PASS

## 6. 既知の問題と改善計画

### 6.1 解決済み
- ~~AI解析で `null` 文字列が返される~~ → 後処理で除去
- ~~`notes`, `title` などの不要フィールド~~ → EXCLUDED_FIELDS で除外
- ~~記録タイプに合わないフィールド~~ → VALID_FIELDS でフィルタリング

### 6.2 今後の改善候補
- [ ] 認証機能の追加（現在は公開API）
- [ ] レート制限の実装
- [ ] エラーログの詳細化

## 7. テストデータ（シードデータ）

以下のシードデータがFirestoreに登録済み：

| record_type | details | 備考 |
|-------------|---------|------|
| meal | main_dish: 全粥, amount_percent: 80 | 朝食記録 |
| meal | main_dish: ご飯, side_dish: 煮魚 | 昼食記録 |
| vital | temperature: 36.5, systolic_bp: 120 | バイタル記録 |
| excretion | excretion_type: 尿, amount: 普通 | 排泄記録 |

---

*最終更新: 2025-12-10*
