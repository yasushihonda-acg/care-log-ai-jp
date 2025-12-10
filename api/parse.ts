
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { DEFAULT_FIELD_SETTINGS } from "../types"; // デフォルト定義をインポート

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

    // スキーマ構築 (All String)
    const detailsProperties: Record<string, Schema> = {};
    allKeys.forEach(key => {
      if (key !== 'record_type' && key !== 'suggested_date') {
        detailsProperties[key] = { type: Type.STRING };
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
          "type": "尿",
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
          type: Type.OBJECT,
          properties: {
            record_type: { type: Type.STRING },
            details: { type: Type.OBJECT, properties: detailsProperties },
            suggested_date: { type: Type.STRING }
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
    return res.status(500).json({ error: '解析に失敗しました', details: error.message });
  }
}
