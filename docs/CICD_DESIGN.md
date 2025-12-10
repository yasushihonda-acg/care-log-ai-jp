# CI/CD 設計書

## 1. 概要

GitHub ActionsとFirebase/GCPを統合したCI/CDパイプラインの設計書。
Workload Identity Federationを使用し、サービスアカウントキーなしでセキュアにデプロイを行う。

## 2. アーキテクチャ

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           GitHub Actions                                 │
│  ┌────────────────┐    ┌────────────────┐    ┌────────────────┐        │
│  │   Push/PR      │───▶│  Build & Test  │───▶│    Deploy      │        │
│  └────────────────┘    └────────────────┘    └───────┬────────┘        │
└──────────────────────────────────────────────────────┼──────────────────┘
                                                       │
                                                       │ Workload Identity
                                                       │ Federation (OIDC)
                                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       Google Cloud Platform                              │
│  ┌────────────────┐    ┌────────────────┐    ┌────────────────┐        │
│  │   Firebase     │    │    Cloud       │    │   Vertex AI    │        │
│  │   Hosting      │    │   Functions    │    │   (Gemini)     │        │
│  └────────────────┘    └────────────────┘    └────────────────┘        │
│                              │                                          │
│                              ▼                                          │
│                        ┌────────────────┐                               │
│                        │   Firestore    │                               │
│                        └────────────────┘                               │
└─────────────────────────────────────────────────────────────────────────┘
```

## 3. Workload Identity Federation

### 3.1 なぜWorkload Identity Federationを使うか

| 方式 | セキュリティ | 運用負荷 |
|------|------------|---------|
| サービスアカウントキー (JSON) | △ キー漏洩リスク | △ ローテーション必要 |
| **Workload Identity Federation** | ◎ キーレス認証 | ◎ 自動管理 |

### 3.2 仕組み

```
GitHub Actions                    GCP
    │                               │
    │ ① OIDCトークン発行             │
    │─────────────────────────────▶│
    │                               │ ② Workload Identity Pool で検証
    │                               │ ③ 短命アクセストークン発行
    │◀─────────────────────────────│
    │ ④ GCPリソースにアクセス        │
    │─────────────────────────────▶│
```

### 3.3 必要なGCPリソース

| リソース | 説明 |
|----------|------|
| Workload Identity Pool | GitHub OIDCプロバイダーの登録先 |
| Workload Identity Provider | GitHub ActionsのOIDCトークンを検証 |
| Service Account | GitHub Actionsが借用する権限 |

## 4. ワークフロー設計

### 4.1 トリガー条件

| イベント | アクション |
|----------|-----------|
| `push` to `main` | 本番デプロイ (Hosting + Functions) |
| `pull_request` to `main` | プレビューデプロイ + テスト |

### 4.2 ジョブ構成

```yaml
jobs:
  build:
    # ビルド・テスト
    - npm ci
    - npm run build
    - npm test (将来追加)

  deploy-functions:
    # Cloud Functions デプロイ
    needs: build
    - gcloud functions deploy

  deploy-hosting:
    # Firebase Hosting デプロイ
    needs: build
    - firebase deploy --only hosting
```

## 5. 必要な設定

### 5.1 GCP側の設定

```bash
# 1. Workload Identity Pool 作成
gcloud iam workload-identity-pools create "github-pool" \
  --location="global" \
  --description="GitHub Actions用"

# 2. Workload Identity Provider 作成
gcloud iam workload-identity-pools providers create-oidc "github-provider" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository"

# 3. Service Account 作成
gcloud iam service-accounts create "github-actions" \
  --display-name="GitHub Actions"

# 4. 必要なロール付与
gcloud projects add-iam-policy-binding care-log-ai-jp \
  --member="serviceAccount:github-actions@care-log-ai-jp.iam.gserviceaccount.com" \
  --role="roles/cloudfunctions.developer"

gcloud projects add-iam-policy-binding care-log-ai-jp \
  --member="serviceAccount:github-actions@care-log-ai-jp.iam.gserviceaccount.com" \
  --role="roles/firebasehosting.admin"

# 5. Workload Identity 紐付け
gcloud iam service-accounts add-iam-policy-binding \
  github-actions@care-log-ai-jp.iam.gserviceaccount.com \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/71778021308/locations/global/workloadIdentityPools/github-pool/attribute.repository/yasushihonda-acg/care-log-ai-jp"
```

### 5.2 GitHub側の設定

**必要なSecrets:**
- なし (Workload Identity Federationのため)

**必要なVariables:**
| 変数名 | 値 |
|--------|-----|
| `GCP_PROJECT_ID` | `care-log-ai-jp` |
| `GCP_PROJECT_NUMBER` | `71778021308` |
| `GCP_REGION` | `asia-northeast1` |

## 6. セキュリティ考慮事項

### 6.1 最小権限の原則

サービスアカウントに付与するロール:
- `roles/cloudfunctions.developer` - Functions デプロイ
- `roles/firebasehosting.admin` - Hosting デプロイ
- `roles/run.invoker` - Cloud Run 呼び出し
- `roles/iam.serviceAccountUser` - サービスアカウント偽装

### 6.2 リポジトリ制限

Workload Identity Providerで特定リポジトリのみ許可:
```
attribute.repository/yasushihonda-acg/care-log-ai-jp
```

## 7. ファイル構成

```
.github/
  └── workflows/
        └── deploy.yml    # メインデプロイワークフロー
firebase.json             # Firebase設定
functions/                # Cloud Functions ソース
  ├── package.json
  ├── tsconfig.json
  └── src/
        ├── index.ts      # エントリーポイント
        ├── parse.ts      # AI解析API
        ├── records.ts    # 記録CRUD
        └── chat.ts       # RAGチャット
```

## 8. 実装ステップ

1. [x] 設計ドキュメント作成 (本ドキュメント)
2. [x] Workload Identity Federation 設定
3. [x] Service Account 作成・権限設定
4. [x] GitHub Actions ワークフロー作成
5. [x] Cloud Functions 実装
6. [x] Firebase Hosting 設定
7. [ ] デプロイテスト

---

*最終更新: 2025-12-10*
