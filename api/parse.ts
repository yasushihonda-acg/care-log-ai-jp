
import { GoogleGenAI } from "@google/genai";

// FieldSetting型定義
interface FieldSetting {
  key: string;
  label: string;
  description?: string;
}

// デフォルトのフィールド設定（API内に直接定義 - Vercelサーバーレス環境での相対パス問題回避）
const DEFAULT_FIELD_SETTINGS: Record<string, FieldSetting[]> = {
  meal: [
    { key: 'main_dish', label: '主食内容', description: '食べた主食の種類（例：全粥、ご飯、パン）。量は含めない。' },
    { key: 'side_dish', label: '副食内容', description: '食べたおかずの内容。' },
    { key: 'amount_percent', label: '摂取率(%)', description: '食事全体の摂取割合。数値のみ（例：80）。' },
    { key: 'fluid_type', label: '水分種類', description: '摂取した水分の名称のみ（例：お茶、水）。量はここには入れない。' },
    { key: 'fluid_ml', label: '水分摂取量(ml)', description: '摂取した水分の量。数値のみ（例：200）。' },
  ],
  excretion: [
    { key: 'excretion_type', label: '種類(尿/便)', description: '排泄物の種類（尿、便）。' },
    { key: 'amount', label: '量', description: '排泄量（多量、普通、少量など）。' },
    { key: 'characteristics', label: '性状・状態', description: '便や尿の状態（泥状、普通、血尿など）。' },
    { key: 'incontinence', label: '失禁有無', description: '失禁があったかどうか。' },
  ],
  vital: [
    { key: 'temperature', label: '体温(℃)', description: '体温の数値（例：36.5）。' },
    { key: 'systolic_bp', label: '血圧(上)', description: '収縮期血圧の数値（高い方）。' },
    { key: 'diastolic_bp', label: '血圧(下)', description: '拡張期血圧の数値（低い方）。' },
    { key: 'pulse', label: '脈拍(回/分)', description: '脈拍数。' },
    { key: 'spo2', label: 'SpO2(%)', description: '酸素飽和度。' },
  ],
  hygiene: [
    { key: 'bath_type', label: '入浴形態', description: '入浴の方法（全身浴、シャワー浴、清拭など）。' },
    { key: 'skin_condition', label: '皮膚状態', description: '皮膚の異常や状態（発赤、剥離など）。' },
    { key: 'notes', label: '特記事項', description: '処置内容や特記事項。' },
  ],
  other: [
    { key: 'title', label: '件名', description: '記録のタイトル。' },
    { key: 'detail', label: '詳細', description: '記録の詳細内容。' },
  ],
};

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// 型定義のヘルパー
// デフォルト設定の description をサーバーサイドで強制的に適用するためのマップを作成
const DEFAULT_DESCRIPTIONS: Record<string, Record<string, string>> = {};
Object.entries(DEFAULT_FIELD_SETTINGS).forEach(([type, fields]) => {
  DEFAULT_DESCRIPTIONS[type] = {};
  fields.forEach(f => {
    if (f.description) {
      DEFAULT_DESCRIPTIONS[type][f.key] = f.description;
    }
  });
});

// 【Superset Schema 戦略】
// Few-Shot例で使用するキーを含め、すべての既知キーをスキーマに含める
// これにより、AIがFew-Shot例のキーを出力しても500エラーにならない
const ALL_KNOWN_KEYS = [
  // meal
  'main_dish', 'side_dish', 'amount_percent', 'fluid_type', 'fluid_ml',
  // excretion
  'excretion_type', 'amount', 'characteristics', 'incontinence',
  // vital
  'temperature', 'systolic_bp', 'diastolic_bp', 'pulse', 'spo2',
  // hygiene
  'bath_type', 'skin_condition', 'notes',
  // other
  'title', 'detail'
];

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body;
    const text = body.text;
    let fieldSettings = body.fieldSettings; 

    if (!text) {
      return res.status(400).json({ error: 'テキスト入力が必要です' });
    }

    // 【Fail-Safe】
    // フロントエンドから送られてきた設定に description が欠けている場合、
    // サーバー側のマスターデータを使って補完する。
    // これにより、ユーザーのブラウザキャッシュが古くてもAIには正しい指示が飛ぶ。
    if (fieldSettings) {
      Object.keys(fieldSettings).forEach(type => {
        if (DEFAULT_DESCRIPTIONS[type]) {
          fieldSettings[type] = fieldSettings[type].map((f: any) => {
            // 既存のdescriptionがない、かつデフォルトに定義がある場合
            if (!f.description && DEFAULT_DESCRIPTIONS[type][f.key]) {
              return { ...f, description: DEFAULT_DESCRIPTIONS[type][f.key] };
            }
            return f;
          });
        }
      });
    }

    // プロンプト用フィールド定義生成
    let fieldsDef = "【抽出対象フィールド一覧】\n";
    const allKeys = new Set<string>();
    ['record_type', 'suggested_date'].forEach(k => allKeys.add(k));

    if (fieldSettings) {
      Object.entries(fieldSettings).forEach(([type, fields]: [string, any]) => {
        fieldsDef += `\n### 記録タイプ: ${type}\n`;
        fields.forEach((f: any) => {
          allKeys.add(f.key);
          const desc = f.description ? ` (抽出ルール: ${f.description})` : "";
          fieldsDef += `- キー: "${f.key}", ラベル: "${f.label}"${desc}\n`;
        });
      });
    }

    // スキーマ構築 (All String) - Superset Schema戦略
    // allKeys（ユーザー設定から収集）+ ALL_KNOWN_KEYS（Few-Shot例で使用）をマージ
    const detailsProperties: Record<string, any> = {};
    const schemaKeys = new Set([...allKeys, ...ALL_KNOWN_KEYS]);
    schemaKeys.forEach(key => {
      if (key !== 'record_type' && key !== 'suggested_date') {
        detailsProperties[key] = { type: "string" };
      }
    });

    // プロンプト構築 (Aggressive Few-Shot Strategy)
    // ルールの説明は最小限にし、「例」を大量に見せることでFlashモデルにパターンを認識させる
    const prompt = `
      あなたは介護記録入力支援AIです。
      入力テキストから情報を抽出し、JSON形式で出力してください。

      入力テキスト: "${text}"

      ${fieldsDef}

      【抽出パターン例 (これを真似してください)】

      例1: 食事 (水分分離のパターン)
      User: "お昼ご飯は全粥を8割、お茶を200ml飲みました。"
      JSON:
      {
        "record_type": "meal",
        "details": {
          "main_dish": "全粥",
          "amount_percent": "80",  // "8割" -> "80" (単位なし)
          "fluid_type": "お茶",    // 種類のみ
          "fluid_ml": "200"        // 量のみ (ml削除)
        }
      }

      例2: 食事 (別パターン)
      User: "夕食、ご飯全部食べた。味噌汁100。"
      JSON:
      {
        "record_type": "meal",
        "details": {
          "main_dish": "ご飯",
          "amount_percent": "100",
          "fluid_type": "味噌汁",
          "fluid_ml": "100"
        }
      }

      例3: バイタル
      User: "熱36.8度、血圧124の78、脈72"
      JSON:
      {
        "record_type": "vital",
        "details": {
          "temperature": "36.8",
          "systolic_bp": "124",
          "diastolic_bp": "78",
          "pulse": "72"
        }
      }

      例4: 排泄
      User: "14時に排尿多量、失禁あり"
      JSON:
      {
        "record_type": "excretion",
        "details": {
          "excretion_type": "尿",
          "amount": "多量",
          "incontinence": "あり"
        }
      }

      【重要ルール】
      - 値はすべて文字列型(String)にしてください。
      - 該当する情報がないフィールドはJSONに含めないでください。
      - 可能な限り単位(ml, %, 度)は取り除いて数値だけにしてください。
    `;

    // モデルを Flash に戻す
    const geminiResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            record_type: { type: "string" },
            details: { type: "object", properties: detailsProperties },
            suggested_date: { type: "string" }
          },
          required: ['record_type', 'details']
        }
      }
    });

    const resultText = geminiResponse.text;
    if (!resultText) {
        throw new Error("AIからの応答がありません");
    }

    return res.status(200).json(JSON.parse(resultText));

  } catch (error: any) {
    console.error('Gemini Parse Error:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ 
      error: '解析に失敗しました', 
      details: error.message,
      stack: error.stack,
      name: error.name
    });
  }
}
