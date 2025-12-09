import { GoogleGenAI, Type, Schema } from "@google/genai";

// Initialize Gemini with the API Key from environment variables
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const body = await request.json();
    const text = body.text;
    const fieldSettings = body.fieldSettings; // フロントエンドから設定を受け取る

    if (!text) {
      return new Response(JSON.stringify({ error: 'テキスト入力が必要です' }), { status: 400 });
    }

    // 動的にプロンプトのヒントを作成
    let fieldsHint = "";
    const allKeys = new Set<string>();

    // デフォルトのキーを追加（フォールバック用）
    ['main_dish', 'side_dish', 'amount_percent', 'fluid_ml', 'type', 'amount', 'characteristics', 'incontinence', 'temperature', 'systolic_bp', 'diastolic_bp', 'pulse', 'spo2', 'bath_type', 'skin_condition', 'notes', 'title', 'detail'].forEach(k => allKeys.add(k));

    if (fieldSettings) {
      fieldsHint += "【フィールド定義（優先）】\n以下のrecord_typeごとのフィールド定義を最優先で使用してください:\n";
      Object.entries(fieldSettings).forEach(([type, fields]: [string, any]) => {
        const fieldDescriptions = fields.map((f: any) => `${f.key} (意味: ${f.label})`).join(", ");
        fieldsHint += `- ${type}: ${fieldDescriptions}\n`;
        
        // スキーマ生成用にキーを収集
        fields.forEach((f: any) => allKeys.add(f.key));
      });
    }

    // スキーマのプロパティを動的に構築
    const detailsProperties: Record<string, Schema> = {};
    allKeys.forEach(key => {
      // 数値であることが確実なフィールド以外はSTRINGにする（AIの柔軟性のため）
      if (['amount_percent', 'fluid_ml', 'temperature', 'systolic_bp', 'diastolic_bp', 'pulse', 'spo2'].includes(key)) {
        detailsProperties[key] = { type: Type.NUMBER };
      } else {
        detailsProperties[key] = { type: Type.STRING };
      }
    });

    const prompt = `
      あなたは日本の介護現場で働くプロフェッショナルな記録補助AIです。
      入力された自然言語のテキスト（音声認識結果を含む）を解析し、適切な「記録種別」と「詳細データ」を抽出してください。

      入力テキスト: "${text}"

      【指示】
      1. record_type は以下から1つ選択してください。
         - 'meal' (食事、水分、おやつ)
         - 'excretion' (排泄、トイレ誘導、オムツ交換)
         - 'vital' (体温、血圧、脈拍、SpO2などの測定)
         - 'hygiene' (入浴、清拭、洗面、口腔ケア)
         - 'other' (レク、リハビリ、転倒、その他申し送り)

      2. details には、情報を可能な限り構造化して抽出してください。
         - 文脈から明確な数値は number 型で出力してください。
         - 日付や時刻の指定がある場合は suggested_date に ISO形式で出力してください。

      ${fieldsHint}

      【抽出のヒント（デフォルト）】
      - 食事: main_dish(主食), side_dish(副食), amount_percent(数値0-100), fluid_ml(数値)
      - 排泄: type(尿/便/失禁), amount(多量/普通/少量/数値), characteristics(泥状/硬便など)
      - バイタル: temperature(36.5など), systolic_bp(上), diastolic_bp(下), pulse, spo2
    `;

    const response = await ai.models.generateContent({
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
              properties: detailsProperties // 動的に構築したプロパティを使用
            },
            suggested_date: { type: Type.STRING }
          },
          required: ['record_type', 'details']
        }
      }
    });

    const result = response.text;
    if (!result) {
        throw new Error("AIからの応答がありません");
    }

    return new Response(result, {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Gemini Parse Error:', error);
    return new Response(JSON.stringify({ error: '解析に失敗しました' }), { status: 500 });
  }
}