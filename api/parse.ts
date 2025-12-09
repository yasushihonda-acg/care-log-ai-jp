
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
    ['main_dish', 'side_dish', 'amount_percent', 'fluid_type', 'fluid_ml', 'type', 'amount', 'characteristics', 'incontinence', 'temperature', 'systolic_bp', 'diastolic_bp', 'pulse', 'spo2', 'bath_type', 'skin_condition', 'notes', 'title', 'detail'].forEach(k => allKeys.add(k));

    if (fieldSettings) {
      fieldsHint += "【使用すべきフィールド定義】\n";
      Object.entries(fieldSettings).forEach(([type, fields]: [string, any]) => {
        const fieldDescriptions = fields.map((f: any) => `"${f.key}"(${f.label})`).join(", ");
        fieldsHint += `- ${type}の場合: ${fieldDescriptions}\n`;
        fields.forEach((f: any) => allKeys.add(f.key));
      });
    }

    // スキーマのプロパティを動的に構築
    // 全て STRING 型で受け取ることでエラーを防ぐ
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
      テキストから情報を抜き出し、以下のフィールド定義に基づいて適切なキーに割り当ててください。
      値はユーザーが言った内容をそのまま抽出してください。
      
      ${fieldsHint}

      【抽出の重要なヒント】
      - 該当する情報がない項目は含めないでください。
      - ユーザーの表現を尊重してください（例: "全粥8割" → "全粥", "8割" そのままでOK）。
      - **水分摂取について**: 「何を」「どれくらい」飲んだかを可能な限り分けてください。
        (例: "お茶を200ml" → fluid_type:"お茶", fluid_ml:"200ml")
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
