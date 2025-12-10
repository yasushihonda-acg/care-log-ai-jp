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

---

*最終更新: 2025-12-10*
