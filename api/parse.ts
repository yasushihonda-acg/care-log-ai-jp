
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
    let fieldsDef = "【フィールド定義（抽出ルール）】\n";
    const allKeys = new Set<string>();

    // デフォルトキーの確保
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

    // 3. プロンプト構築
    // Gemini 2.5 Proの推論能力を活かすため、Chain of Thoughtを促す指示を含める
    const prompt = `
      あなたは高度な介護記録AIアシスタントです。
      ユーザーの自然言語入力を分析し、定義されたフィールドへ正確にマッピングしてください。

      入力テキスト: "${text}"

      ${fieldsDef}

      【タスク実行プロセス】
      1. **分析 (Analyze)**: 入力文に含まれる具体的な事実（品目、数値、状態など）をリストアップします。
      2. **照合 (Check Definition)**: 各事実をフィールド定義（ルール）と照らし合わせます。
          - 「お茶200ml」のように複合している情報は、ルールの違い（名称のみ vs 数値のみ）に基づいて分離します。
          - 「8割」のように変換が必要なものは、ルール（数値のみ）に従い変換します。
      3. **生成 (Generate)**: JSONデータを生成します。

      【Few-Shot Examples (学習データ)】

      例1: 食事記録 (複合データの分離)
      Input: "お昼ご飯は全粥を8割、お茶を200ml飲みました。"
      Output:
      {
        "thought": "食事記録として認識。主食『全粥』。摂取率『8割』→ルールに従い80に変換。水分『お茶200ml』は複合データ。fluid_typeは名称のみなので『お茶』、fluid_mlは数値のみなので『200』に分離して抽出。",
        "record_type": "meal",
        "details": {
          "main_dish": "全粥",
          "amount_percent": "80",
          "fluid_type": "お茶",
          "fluid_ml": "200"
        }
      }

      【制約】
      - 定義されていないキーは出力しないでください。
      - 該当するデータがないフィールドは省略してください。
      - 値は文字列として出力してください。
    `;

    // モデルを 'gemini-2.5-pro' に変更
    // Proモデルは推論能力が高いため、Thinking Configなしでも十分な精度が出せます。
    const geminiResponse = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            thought: { type: Type.STRING, description: "抽出プロセスの思考" },
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
