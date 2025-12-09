
import { GoogleGenAI, Type, Schema } from "@google/genai";

// Initialize Gemini with the API Key from environment variables
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body;
    const text = body.text;
    const fieldSettings = body.fieldSettings; // フロントエンドから設定を受け取る

    if (!text) {
      return res.status(400).json({ error: 'テキスト入力が必要です' });
    }

    // 動的にプロンプトのヒントを作成
    let fieldsHint = "";
    const allKeys = new Set<string>();

    // デフォルトのキーを追加（フォールバック用）
    ['main_dish', 'side_dish', 'amount_percent', 'fluid_type', 'fluid_ml', 'type', 'amount', 'characteristics', 'incontinence', 'temperature', 'systolic_bp', 'diastolic_bp', 'pulse', 'spo2', 'bath_type', 'skin_condition', 'notes', 'title', 'detail'].forEach(k => allKeys.add(k));

    if (fieldSettings) {
      fieldsHint += "【現在のフィールド定義（ここにある項目にマッピングしてください）】\n";
      Object.entries(fieldSettings).forEach(([type, fields]: [string, any]) => {
        const fieldDescriptions = fields.map((f: any) => `"${f.key}"(${f.label})`).join(", ");
        fieldsHint += `- ${type}の場合: ${fieldDescriptions}\n`;
        fields.forEach((f: any) => allKeys.add(f.key));
      });
    }

    // スキーマのプロパティを動的に構築
    // 全て STRING 型で受け取ることでエラーを防ぐ (Loose Schema戦略)
    const detailsProperties: Record<string, Schema> = {};
    allKeys.forEach(key => {
      detailsProperties[key] = { type: Type.STRING };
    });

    const prompt = `
      あなたは介護施設の記録補助AIです。
      ユーザーの自然言語テキストから、記録の種類(record_type)と詳細情報(details)を抽出してください。

      入力テキスト: "${text}"

      【ステップ1】record_typeの決定
      以下のいずれかを選択: 'meal'(食事), 'excretion'(排泄), 'vital'(バイタル), 'hygiene'(衛生), 'other'(その他)

      【ステップ2】detailsの抽出
      テキストから情報を抜き出し、ユーザーが定義したフィールド定義に基づいて適切なキーに割り当ててください。
      値は無理に加工せず、ユーザーが言った内容をそのまま抽出してください。
      
      ${fieldsHint}

      【抽出の具体例 (Few-Shot)】
      以下のような入出力パターンを参考にしてください。

      例1: 食事記録（水分分離）
      入力: "お昼は全粥を8割食べて、お茶を200ml飲みました"
      出力: {
        "record_type": "meal",
        "details": {
          "main_dish": "全粥",
          "amount_percent": "8割",
          "fluid_type": "お茶",
          "fluid_ml": "200ml"
        }
      }

      例2: バイタル記録
      入力: "熱は36.8度、血圧124の78、SpO2は98です"
      出力: {
        "record_type": "vital",
        "details": {
          "temperature": "36.8度",
          "systolic_bp": "124",
          "diastolic_bp": "78",
          "spo2": "98"
        }
      }

      例3: 排泄記録
      入力: "多量の排尿がありました。色は普通です"
      出力: {
        "record_type": "excretion",
        "details": {
          "type": "尿",
          "amount": "多量",
          "characteristics": "普通"
        }
      }

      【重要なルール】
      - 該当する情報がない項目はJSONに含めないでください。
      - 未知の単語があっても、文脈から最も適切なフィールド（例: 「とろみ茶」→ fluid_type）に割り当ててください。
    `;

    const geminiResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            record_type: {
              type: Type.STRING,
              enum: ['meal', 'excretion', 'vital', 'hygiene', 'other']
            },
            details: {
              type: Type.OBJECT,
              properties: detailsProperties
            },
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
