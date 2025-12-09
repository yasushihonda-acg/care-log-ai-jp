
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

    // デフォルトのキーを追加
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

      【思考プロセス (Chain of Thought)】
      回答を出力する前に、以下の手順で思考を行ってください。
      1. 入力テキストに含まれる主要な要素（名詞、数値、単位）を特定する。
      2. 複合的なデータ（例：「お茶200」）がある場合、種類と量に分離する。
      3. 文脈から最適な記録種類（record_type）を決定する。
      4. ユーザー定義フィールド（${fieldsHint}）と照らし合わせ、最も適切なキーに割り当てる。

      【Ambiguity Resolution (曖昧性解消ルール)】
      - 「お茶200」「水分200」のような入力は、必ず「種類(fluid_type)」と「量(fluid_ml)」に分割してください。
      - 「8割」「半分」などの割合は、そのまま「摂取率(amount_percent)」として扱ってください。
      - 「熱36.8」は「体温(temperature)」に、「血圧120」は「血圧(systolic_bp)」にマッピングしてください。

      【抽出の具体例 (Few-Shot)】

      例1: 食事記録（水分分離）
      入力: "お昼は全粥を8割食べて、お茶を200ml飲みました"
      出力: {
        "thought": "食事の記録。主食は全粥、摂取率は8割。水分摂取もあり、種類はお茶、量は200mlと明言されている。",
        "record_type": "meal",
        "details": {
          "main_dish": "全粥",
          "amount_percent": "8割",
          "fluid_type": "お茶",
          "fluid_ml": "200ml"
        }
      }

      例2: 曖昧なバイタル記録
      入力: "熱は36.8、血圧124の78、SpO2は98です"
      出力: {
        "thought": "バイタル記録。'熱'は体温(temperature)で36.8。'血圧'は上が124(systolic_bp)、下が78(diastolic_bp)。SpO2は98。",
        "record_type": "vital",
        "details": {
          "temperature": "36.8度",
          "systolic_bp": "124",
          "diastolic_bp": "78",
          "spo2": "98"
        }
      }

      例3: 単純な排泄記録
      入力: "多量の排尿がありました"
      出力: {
        "thought": "排泄記録。種類は尿、量は多量。",
        "record_type": "excretion",
        "details": {
          "type": "尿",
          "amount": "多量"
        }
      }

      【重要なルール】
      - 値は無理に加工せず、ユーザーが言った内容をそのまま抽出してください。
      - 未知の単語があっても、文脈から最も適切なフィールドに割り当ててください。
    `;

    const geminiResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            thought: { type: Type.STRING, description: "抽出に至る思考プロセス" }, // CoT用フィールド
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
          required: ['thought', 'record_type', 'details']
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
