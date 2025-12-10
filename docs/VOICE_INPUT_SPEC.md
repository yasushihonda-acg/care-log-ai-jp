# 音声入力仕様書

## 1. 概要

| 項目 | 値 |
|------|-----|
| **機能** | Web Speech APIによる音声入力 |
| **対象ブラウザ** | Chrome, Edge, Safari (webkit対応) |
| **言語** | 日本語 (`ja-JP`) |

## 2. 要件 (2025-12-10 更新)

### 2.1 基本動作
- **開始:** マイクボタン押下で音声認識開始
- **停止:** 再度マイクボタン押下で音声認識停止
- **継続:** ユーザーが明示的に停止するまで**永続的に**継続

### 2.2 無音時の挙動
Web Speech APIはブラウザ仕様により無音が数秒続くと自動的に `onend` イベントを発火します。
この仕様に対応するため、以下の戦略を採用：

| 戦略 | 説明 |
|------|------|
| **自動再開** | `onend` 発火時、明示的停止でなければ即座に `start()` を再呼び出し |
| **エラーリカバリ** | `no-speech` エラー時も再開を継続 |
| **遅延再開** | 再開失敗時は100ms後にリトライ |

## 3. 技術仕様

### 3.1 Web Speech API設定

```typescript
const recognition = new SpeechRecognition();
recognition.lang = 'ja-JP';
recognition.continuous = true;        // 連続認識モード
recognition.interimResults = false;   // 確定結果のみ（安定性重視）
```

### 3.2 状態管理

```typescript
// Recognition インスタンスを保持
const recognitionRef = useRef<SpeechRecognition | null>(null);

// 明示的な停止フラグ（useRefで同期的に管理）
const isStoppingRef = useRef(false);

// UI表示用の状態
const [isListening, setIsListening] = useState(false);
```

### 3.3 イベントハンドリング

| イベント | 処理 |
|---------|------|
| `onstart` | `isListening = true`, `isStoppingRef = false` |
| `onend` | `isStoppingRef === false` なら即座に再開 |
| `onresult` | テキストエリアにトランスクリプトを追加 |
| `onerror` | `no-speech`, `aborted` は無視して継続、`not-allowed` は停止 |

### 3.4 再開ロジック（重要）

```typescript
// 再開関数
const restartRecognition = () => {
  if (isStoppingRef.current) return;

  setTimeout(() => {
    if (isStoppingRef.current) return;
    try {
      recognitionRef.current?.start();
    } catch (e) {
      // 既に開始済みの場合などは無視
      console.warn('Recognition restart:', e);
    }
  }, 100); // 100ms遅延で安定性向上
};

recognition.onend = () => {
  if (!isStoppingRef.current) {
    restartRecognition();
  } else {
    setIsListening(false);
  }
};

recognition.onerror = (event) => {
  // 致命的でないエラーは無視して継続
  if (['no-speech', 'aborted'].includes(event.error)) {
    return; // onendで再開される
  }
  if (event.error === 'not-allowed') {
    isStoppingRef.current = true;
    setIsListening(false);
    alert('マイクへのアクセスが許可されていません。');
  }
};
```

## 4. UI仕様

### 4.1 マイクボタン状態

| 状態 | アイコン | スタイル |
|------|---------|----------|
| 停止中 | `<Mic />` | `bg-gray-100 text-gray-600` |
| 録音中 | `<MicOff />` | `bg-red-100 text-red-600 animate-pulse` |

### 4.2 視覚的フィードバック
- 録音中はボタンがパルスアニメーション
- 録音中状態はブラウザが自動再開しても維持される

## 5. エッジケース対応

| ケース | 対応 |
|--------|------|
| ブラウザ非対応 | アラート表示 |
| マイク権限拒否 | アラート表示、録音停止 |
| ネットワーク切断 | 自動再開を試行 |
| **長時間無音** | **自動再開により継続** |
| `no-speech` エラー | 無視して継続 |
| `aborted` エラー | 無視して継続 |

## 6. テストケース

1. **基本動作**
   - [x] ボタン押下で録音開始
   - [x] 再度ボタン押下で録音停止
   - [x] 音声がテキストエリアに反映される

2. **連続認識（重要）**
   - [ ] **10秒以上無音でも録音状態が維持される**
   - [ ] 無音後に話し始めても正常に認識される
   - [ ] 複数の文章を間を空けて入力できる

3. **状態表示**
   - [x] 録音中はアイコンが `MicOff` に変わる
   - [x] 録音中はボタンがパルスする
   - [ ] 無音による内部再開でもUIは録音中を維持

## 7. ブラウザ仕様の制限

Web Speech APIは以下の制限があります：

1. **無音タイムアウト**: ブラウザ実装により3-10秒程度の無音で `onend` が発火
2. **continuous=true の限界**: 設定しても無音タイムアウトは回避できない
3. **対応策**: `onend` での自動再開が唯一の解決策

## 8. 既知の問題: 長時間使用時のもたつき

### 8.1 現象
長時間（数分以上）音声入力を続けると、認識にもたつき（遅延）が発生する。

### 8.2 原因分析

| 原因 | 説明 | 影響度 |
|------|------|--------|
| **ブラウザのリソース制限** | Web Speech APIはGoogleのサーバーに音声を送信して認識。長時間接続でレイテンシ増加 | 高 |
| **インスタンス再利用** | 同じrecognitionインスタンスを再利用すると内部状態が蓄積 | 中 |
| **メモリリーク** | イベントリスナーの重複登録やクロージャによるメモリ増加 | 低 |
| **ネットワーク状態** | 長時間接続による接続品質の低下 | 中 |

### 8.3 Web Speech API の仕組み

```
[ユーザー音声] → [ブラウザ] → [Google Speech Server] → [認識結果]
                    ↑
              ネットワーク遅延が蓄積
```

Web Speech APIは**クラウドベース**の音声認識であり、以下の特性があります：
- 音声データはGoogleのサーバーに送信される
- サーバー側で処理されて結果が返される
- 長時間接続で接続品質が劣化する可能性がある

### 8.4 対応策（実装済み/検討中）

| 対応策 | 説明 | 状態 |
|--------|------|------|
| **新規インスタンス作成** | 再開時に新しいrecognitionインスタンスを作成、古いインスタンスは破棄 | ✅ 実装済み |
| **イベントリスナー解除** | 停止時に `onend`, `onerror`, `onresult` を null に設定してメモリリーク防止 | ✅ 実装済み |
| **定期リフレッシュ** | N回再開ごとに完全リセット | 📋 検討中 |
| **タイムアウト警告** | 長時間使用時にユーザーに再起動を促す | 📋 検討中 |

### 8.5 結論

**これはWeb Speech APIの根本的な制限であり、完全な解決は困難です。**

改善策として新規インスタンス作成を実装しますが、以下の点は変わりません：
- クラウドベースのため、ネットワーク依存
- ブラウザ/OS側のリソース管理に依存
- 長時間使用では定期的な手動停止→再開を推奨

### 8.6 代替技術（将来検討）

| 技術 | メリット | デメリット |
|------|----------|------------|
| **Whisper API** | 高精度、オフライン対応（ローカル版） | サーバー実装必要、コスト |
| **Azure Speech** | 企業向け安定性 | 有料、設定複雑 |
| **ブラウザ内蔵音声認識** | 低遅延 | 精度がブラウザ依存 |

---

*最終更新: 2025-12-10*
