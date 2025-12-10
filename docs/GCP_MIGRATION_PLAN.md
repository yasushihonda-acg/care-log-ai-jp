# GCP/Firebase 移行計画書

## 1. 概要

### 1.1 移行理由
- Vercel無料枠のデプロイ制限（レート制限）
- Gemini APIとGCPの統合によるシームレスな連携
- Workload Identityによるセキュアな認証（APIキー不要）

### 1.2 移行先アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                    Google Cloud Platform                     │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    Firebase Project                      ││
│  │  ┌───────────────┐  ┌───────────────┐  ┌─────────────┐ ││
│  │  │   Hosting     │  │  Firestore    │  │   Auth      │ ││
│  │  │  (React App)  │  │  (NoSQL DB)   │  │ (Optional)  │ ││
│  │  └───────┬───────┘  └───────┬───────┘  └─────────────┘ ││
│  └──────────┼──────────────────┼────────────────────────────┘│
│             │                  │                             │
│  ┌──────────▼──────────────────▼────────────────────────────┐│
│  │              Cloud Functions (2nd Gen)                   ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      ││
│  │  │  /parse     │  │  /records   │  │  /chat      │      ││
│  │  └──────┬──────┘  └─────────────┘  └──────┬──────┘      ││
│  └─────────┼─────────────────────────────────┼──────────────┘│
│            │                                 │               │
│  ┌─────────▼─────────────────────────────────▼──────────────┐│
│  │                    Vertex AI                              ││
│  │              Gemini 2.5 Flash (gemini-2.5-flash)         ││
│  │         ※ Workload Identity で認証（APIキー不要）         ││
│  └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## 2. 技術スタック比較

| コンポーネント | 現在 (Vercel) | 移行後 (GCP/Firebase) |
|---------------|---------------|----------------------|
| Frontend Hosting | Vercel | Firebase Hosting |
| API/Functions | Vercel Functions | Cloud Functions 2nd Gen |
| Database | Vercel Postgres (JSONB) | Firestore (Document DB) |
| AI Model | Gemini API (APIキー認証) | Vertex AI Gemini (Workload Identity) |
| CI/CD | Vercel Git Integration | GitHub Actions + Workload Identity Federation |

## 3. Workload Identity 設計

### 3.1 概要
APIキーを使用せず、GCPサービスアカウントの権限でVertex AIを呼び出す。

### 3.2 認証フロー

```
Cloud Functions (Service Account)
        │
        ▼ Workload Identity
   Vertex AI API
        │
        ▼
   Gemini 2.5 Flash
```

### 3.3 必要なIAMロール
```
roles/aiplatform.user          # Vertex AI へのアクセス
roles/datastore.user           # Firestore へのアクセス
```

## 4. Firestore スキーマ設計

### 4.1 コレクション構造

```
care_records/                    # コレクション
  └── {documentId}/              # ドキュメント (auto-generated)
        ├── record_type: string  # "meal", "vital", "excretion", etc.
        ├── details: map         # 構造化データ（現在のJSONBと同等）
        ├── recorded_at: timestamp
        └── created_at: timestamp
```

### 4.2 データ移行
Vercel Postgres → Firestore へのデータ移行スクリプトが必要（既存データがある場合）

## 5. 移行フェーズ

### Phase 1: GCPプロジェクト初期化
- [x] GCPプロジェクト作成 (`care-log-ai-jp`)
- [x] 請求先アカウント紐付け
- [x] 必要なAPIの有効化
- [x] Firebaseプロジェクトの紐付け

### Phase 2: 基盤構築
- [x] Firestore データベース作成 (asia-northeast1)
- [x] Workload Identity Federation 設定
- [x] GitHub Actions用 Service Account 作成

### Phase 3: CI/CD設定
- [x] Workload Identity Pool/Provider 作成
- [x] GitHub Actions ワークフロー作成
- [x] Firebase Hosting 設定ファイル作成

### Phase 4: アプリケーション移行
- [x] Cloud Functions ソースコード作成
- [ ] Cloud Functions デプロイ
- [ ] フロントエンドのAPI endpoint 変更
- [ ] Firebase Hosting へデプロイ

### Phase 5: 検証
- [ ] E2Eテスト
- [ ] ドキュメント更新

## 6. 作成済みリソース

### 6.1 GCPプロジェクト
- **プロジェクトID:** `care-log-ai-jp`
- **プロジェクト番号:** `71778021308`
- **表示名:** `TEST CareLogAI TempUse` (テスト用一時利用)

### 6.2 有効化済みAPI
- cloudfunctions.googleapis.com
- firestore.googleapis.com
- aiplatform.googleapis.com
- cloudbuild.googleapis.com
- run.googleapis.com
- firebase.googleapis.com
- firebasehosting.googleapis.com
- artifactregistry.googleapis.com
- iamcredentials.googleapis.com

### 6.3 Workload Identity Federation
- **Pool:** `github-pool`
- **Provider:** `github-provider`
- **条件:** `assertion.repository_owner == 'yasushihonda-acg'`

### 6.4 Service Account
- **名前:** `github-actions@care-log-ai-jp.iam.gserviceaccount.com`
- **ロール:**
  - roles/cloudfunctions.developer
  - roles/firebasehosting.admin
  - roles/run.developer
  - roles/iam.serviceAccountUser
  - roles/artifactregistry.writer

## 7. ファイル構成

```
.github/
  └── workflows/
        └── deploy.yml          # GitHub Actions CI/CD
firebase.json                   # Firebase Hosting 設定
functions/                      # Cloud Functions
  ├── package.json
  ├── tsconfig.json
  └── src/
        └── index.ts            # API実装 (parse, records, chat)
docs/
  ├── GCP_MIGRATION_PLAN.md    # 本ドキュメント
  └── CICD_DESIGN.md           # CI/CD設計書
```

## 8. APIルーティング移行戦略

### 8.1 問題の背景

Firebase Hostingは静的ファイルホスティングのため、`/api/*`へのリクエストがHTMLを返してしまう。
フロントエンドからのAPIコールがJSONではなくHTMLを受け取り、パースエラーが発生。

```
エラー: SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
原因: /api/parse → index.html (SPA fallback) を返却
```

### 8.2 選択肢の比較

| 方式 | 説明 | メリット | デメリット |
|------|------|----------|------------|
| **A. Cloud Run + Rewrite** | Firebase HostingからCloud Runへrewrite | 同一ドメイン、CORS不要 | Cloud Run URLが事前に必要 |
| **B. Cloud Functions URL直接** | フロントエンドでCloud Functions URLを直接指定 | シンプル、即座に実装可能 | CORS設定必要、URL管理 |
| **C. Firebase Functions** | Firebase CLIでFunctions管理 | Hosting連携が容易 | functions/ → functions/ の構成変更 |

### 8.3 採用方式: B. Cloud Functions URL直接

**理由:**
1. Cloud Functionsは既に`functions/src/index.ts`で実装済み
2. 環境変数でURLを管理すれば、本番/開発の切り替えが容易
3. 段階的移行が可能（Vercel環境を維持しながらテスト）

### 8.4 実装計画

#### Step 1: Cloud Functionsのデプロイ
```bash
# gcloud CLIでデプロイ
gcloud functions deploy parse \
  --gen2 \
  --runtime=nodejs20 \
  --region=asia-northeast1 \
  --source=functions \
  --entry-point=parseApp \
  --trigger-http \
  --allow-unauthenticated
```

#### Step 2: 環境変数の導入
```typescript
// src/config.ts (新規作成)
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
```

#### Step 3: フロントエンドのAPI呼び出し修正
```typescript
// 変更前
fetch('/api/parse', { ... })

// 変更後
import { API_BASE_URL } from './config';
fetch(`${API_BASE_URL}/parse`, { ... })
```

#### Step 4: 環境変数設定
```bash
# .env.local (開発用)
VITE_API_BASE_URL=/api

# .env.production (本番用)
VITE_API_BASE_URL=https://asia-northeast1-care-log-ai-jp.cloudfunctions.net
```

### 8.5 移行後のアーキテクチャ

```
┌─────────────────────────────────────────────────────────────────┐
│                        ユーザー                                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
        ▼                                       ▼
┌───────────────────┐               ┌───────────────────────────┐
│  Firebase Hosting │               │     Cloud Functions       │
│  care-log-ai-jp   │               │  asia-northeast1          │
│  .web.app         │               │  care-log-ai-jp           │
│                   │               │  .cloudfunctions.net      │
│  - index.html     │  HTTPS API    │                           │
│  - assets/*.js    │ ────────────▶ │  /parse  (AI解析)         │
│  - assets/*.css   │               │  /records (CRUD)          │
│                   │               │  /chat    (RAG)           │
└───────────────────┘               └─────────────┬─────────────┘
                                                  │
                                    ┌─────────────┴─────────────┐
                                    │                           │
                                    ▼                           ▼
                          ┌─────────────────┐       ┌─────────────────┐
                          │    Firestore    │       │   Vertex AI     │
                          │   (データ保存)   │       │   Gemini 2.5    │
                          └─────────────────┘       └─────────────────┘
```

## 9. コスト見積もり（無料枠）

| サービス | 無料枠 |
|----------|--------|
| Firebase Hosting | 10GB/月 転送量 |
| Firestore | 1GiB ストレージ、50K 読取/日 |
| Cloud Functions | 200万回呼出/月 |
| Vertex AI (Gemini) | 要確認 |

---

*最終更新: 2025-12-10*
