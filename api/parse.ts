
import { GoogleGenAI, Type, Schema } from "@google/genai";

// Initialize Gemini with the API Key from environment variables
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = request.body;
    const text = body.text;
    const fieldSettings = body.fieldSettings; // フロントエンドから設定を受け取る

    if (!text) {
      return response.status(400).json({ error: 'テキスト入力が必要です' });
    }

    // 動的にプロンプトのヒントを作成
    let fieldsHint = "";
    const allKeys = new Set<string>();

    // デフォルトのキーを追加（フォールバック用）
    ['main_dish', 'side_dish', 'amount_percent', 'fluid_ml', 'type', 'amount', 'characteristics', 'incontinence', 'temperature', 'systolic_bp', 'diastolic_bp', 'pulse', 'spo2', 'bath_type', 'skin_condition', 'notes', 'title', 'detail'].forEach(k => allKeys.add(k));

    if (fieldSettings) {
      fieldsHint += "【使用すべきフィールド定義】\n";
      Object.entries(fieldSettings).forEach(([type, fields]: [string, any]) => {
        const fieldDescriptions = fields.map((f: any) => `"${f.key}"(${f.label})`).join(", ");
        fieldsHint += `- ${type}の場合: ${fieldDescriptions}\n`;
        fields.forEach((f: any) => allKeys.add(f.key));
      });
    }

    // スキーマのプロパティを動的に構築
    // AIの解析成功率を高めるため、あえて全ての値を STRING として定義します。
    // 数値変換はフロントエンドまたはプロンプトの指示で緩やかに行います。
    const detailsProperties: Record<string, Schema> = {};
    allKeys.forEach(key => {
      detailsProperties[key] = { type: Type.STRING };
    });

    const prompt = `
      あなたは介護記録の入力補助AIです。
      ユーザーの自然言語テキストから、記録の種類(record_type)と詳細情報(details)を抽出してください。

      入力テキスト: "${text}"

      【ステップ1】record_typeの決定
      以下のいずれかを選択: 'meal'(食事), 'excretion'(排泄), 'vital'(バイタル), 'hygiene'(衛生), 'other'(その他)

      【ステップ2】detailsの抽出
      テキストから情報を抜き出し、適切なキーに割り当ててください。
      
      ${fieldsHint}

      【抽出のルールと例】
      - 単位（ml, %, ℃, 度など）は可能な限り削除し、数値のみにしてください。
      - 例1: "全粥8割" → { "main_dish": "全粥", "amount_percent": "80" } (※ "8"ではなく"80"にする)
      - 例2: "お茶200" → { "fluid_ml": "200" } (※ "200ml"ではなく"200"にする)
      - 例3: "熱36.5" → { "temperature": "36.5" }
      - 例4: "半分食べた" → { "amount_percent": "50" }
      - 不明な情報は空欄にするか、含めないでください。
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

    return response.status(200).json(JSON.parse(resultText));

  } catch (error: any) {
    console.error('Gemini Parse Error:', error);
    return response.status(500).json({ error: '解析に失敗しました', details: error.message });
  }
}
