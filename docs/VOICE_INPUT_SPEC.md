# 音声入力仕様書

## 1. 概要

| 項目 | 値 |
|------|-----|
| **機能** | Web Speech APIによる音声入力 |
| **対象ブラウザ** | Chrome, Edge, Safari (webkit対応) |
| **言語** | 日本語 (`ja-JP`) |

## 2. 要件変更 (2025-12-10)

### 2.1 変更前の動作
- ボタン押下で音声認識開始
- 音声が途切れると**自動的に停止**
- `continuous: false` (単発認識モード)

### 2.2 変更後の動作
- ボタン押下で音声認識**開始**
- 再度ボタン押下で音声認識**停止**
- ユーザーが明示的に停止するまで継続
- `continuous: true` (連続認識モード)

## 3. 技術仕様

### 3.1 Web Speech API設定

```typescript
const recognition = new SpeechRecognition();
recognition.lang = 'ja-JP';
recognition.continuous = true;        // 連続認識モード
recognition.interimResults = true;    // 中間結果も取得（リアルタイム表示用）
```

### 3.2 イベントハンドリング

| イベント | 処理 |
|---------|------|
| `onstart` | `isListening = true` |
| `onend` | 停止ボタン押下時のみ `isListening = false`、それ以外は自動再開 |
| `onresult` | テキストエリアにトランスクリプトを追加 |
| `onerror` | エラーログ出力、状態リセット |

### 3.3 状態管理

```typescript
// Recognition インスタンスを保持（停止時にアクセスするため）
const recognitionRef = useRef<SpeechRecognition | null>(null);

// 明示的な停止フラグ
const [isListening, setIsListening] = useState(false);
```

### 3.4 開始/停止ロジック

```typescript
const toggleListening = () => {
  if (isListening) {
    // 停止
    recognitionRef.current?.stop();
    setIsListening(false);
  } else {
    // 開始
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
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
- 中間結果をリアルタイムでテキストエリアに表示（オプション）

## 5. エッジケース

| ケース | 対応 |
|--------|------|
| ブラウザ非対応 | コンソール警告、ボタンは表示（押しても何も起きない） |
| マイク権限拒否 | `onerror` でハンドリング、エラーメッセージ表示 |
| ネットワーク切断 | `onerror (network)` でハンドリング |
| 長時間無音 | `onend` で自動再開（continuous mode） |

## 6. テストケース

1. **基本動作**
   - [ ] ボタン押下で録音開始
   - [ ] 再度ボタン押下で録音停止
   - [ ] 音声がテキストエリアに反映される

2. **連続認識**
   - [ ] 話し続けても途中で止まらない
   - [ ] 複数の文章を続けて入力できる

3. **状態表示**
   - [ ] 録音中はアイコンが `MicOff` に変わる
   - [ ] 録音中はボタンがパルスする

---

*最終更新: 2025-12-10*
