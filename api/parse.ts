
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
    const fieldSettings = body.fieldSettings; // フロントエンドから設定（メタデータ含む）を受け取る

    if (!text) {
      return res.status(400).json({ error: 'テキスト入力が必要です' });
    }

    // 1. 動的にプロンプトの「フィールド定義書」を作成
    // ここで key, label だけでなく description (メタデータ) を含めるのが重要
    let fieldsDef = "【フィールド定義（このルールを厳守してください）】\n";
    const allKeys = new Set<string>();

    // デフォルトキーの確保（万が一設定が空の場合用）
    ['thought', 'record_type', 'suggested_date'].forEach(k => allKeys.add(k));

    if (fieldSettings) {
      Object.entries(fieldSettings).forEach(([type, fields]: [string, any]) => {
        fieldsDef += `\n### 記録タイプ: ${type}\n`;
        fields.forEach((f: any) => {
          allKeys.add(f.key);
          // AIへの強力な指示となるメタデータ行
          const desc = f.description ? ` (ルール: ${f.description})` : "";
          fieldsDef += `- キー: "${f.key}", 表示名: "${f.label}"${desc}\n`;
        });
      });
    }

    // 2. スキーマ構築 (Loose Schema)
    const detailsProperties: Record<string, Schema> = {};
    allKeys.forEach(key => {
      // thoughtなどはルートレベルだが、念のため全部Stringで受ける準備
      if (key !== 'thought' && key !== 'record_type' && key !== 'suggested_date') {
        detailsProperties[key] = { type: Type.STRING };
      }
    });

    // 3. プロンプト構築 (Chain of Thought & Metadata Driven)
    const prompt = `
      あなたは介護記録の構造化を行うAIスペシャリストです。
      ユーザーの入力文から、適切な「記録タイプ(record_type)」を選択し、定義された「詳細データ(details)」を抽出してください。

      入力テキスト: "${text}"

      ${fieldsDef}

      【解析ステップ (Chain of Thought)】
      JSONを出力する前に、必ず 'thought' フィールドで以下の思考を行ってください。
      1. **要素分解**: 入力文を「名詞」「数値」「単位」などの要素に分解する。
      2. **ルール照合**: 上記の「フィールド定義（特にルール部分）」を厳密に確認する。
      3. **曖昧性解消**: 
         - 「お茶200ml」のように名称と数値が混ざっている場合、定義を見て「名称のみ」のフィールドと「数値のみ」のフィールドに正しく分離する。
         - 定義に「数値のみ」とある場合、単位(ml, %, ℃など)は削除する。

      【Few-Shot Examples (学習データ)】

      例1: 食事 (水分分離のケース)
      Input: "昼食は全粥8割、お茶200ml"
      Output:
      {
        "thought": "食事記録。主食は全粥、摂取率は8割。水分は『種類』と『量』に分離する必要がある。定義『fluid_type』は名称のみ、『fluid_ml』は数値のみ。したがって、種類『お茶』は fluid_type、量『200』は fluid_ml に割り当てる。",
        "record_type": "meal",
        "details": {
          "main_dish": "全粥",
          "amount_percent": "80",
          "fluid_type": "お茶",
          "fluid_ml": "200"
        }
      }

      例2: バイタル
      Input: "熱36.8、血圧124の78"
      Output:
      {
        "thought": "バイタル記録。熱(体温)は36.8。血圧は上124、下78。定義に従い temperature, systolic_bp, diastolic_bp にマッピング。",
        "record_type": "vital",
        "details": {
          "temperature": "36.8",
          "systolic_bp": "124",
          "diastolic_bp": "78"
        }
      }

      【制約】
      - 定義されていないキーは勝手に作らないでください。
      - 該当するデータがないフィールドは出力に含めないでください。
      - 値は基本的に文字列として出力してください。
    `;

    const geminiResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            thought: { type: Type.STRING, description: "抽出に至る思考プロセス" },
            record_type: { type: Type.STRING },
            details: { type: Type.OBJECT, properties: detailsProperties },
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
