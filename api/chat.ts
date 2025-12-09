
import { GoogleGenAI } from "@google/genai";
import { sql } from '@vercel/postgres';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // 1. コンテキストとして使用するデータを取得 (直近50件)
    // 本格的なRAGではここでベクトル検索を行いますが、Geminiのコンテキストウィンドウが広いため
    // 直近のデータをJSONとしてそのまま渡す"Context Injection"手法で十分実用的です。
    const { rows } = await sql`
      SELECT record_type, details, recorded_at 
      FROM care_records 
      ORDER BY recorded_at DESC 
      LIMIT 50;
    `;

    // データの軽量化（AIに渡すトークン節約のため）
    const contextData = rows.map(r => ({
      type: r.record_type,
      time: r.recorded_at, // ISO string
      data: r.details
    }));

    const systemPrompt = `
      あなたは介護施設のケア記録データベースにアクセスできるAIアシスタントです。
      以下のJSONデータは、直近の利用者様のケア記録（食事、排泄、バイタル、入浴など）です。
      このデータを「事実」として参照し、ユーザーからの質問に日本語で答えてください。

      【参照データ (直近50件)】
      ${JSON.stringify(contextData, null, 2)}

      【回答のルール】
      1. 質問に関連するデータが上記にある場合は、その具体的な日時や数値を引用して答えてください。
      2. 「昨日の熱は？」「最近ご飯食べてる？」のような曖昧な質問には、データから推測される傾向や具体的な直近の値を答えてください。
      3. データに記載されていないことについては「直近の記録には見当たりませんでした」と正直に答えてください。勝手に捏造しないでください。
      4. 医療的な診断や助言は避け、「記録によると〜です」という客観的な報告スタイルを維持してください。
      5. 回答は簡潔に、読みやすくまとめてください。
    `;

    // 2. Geminiに問い合わせ
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [{ text: systemPrompt + "\n\nユーザーの質問: " + message }] }
      ]
    });

    const reply = response.text;

    return res.status(200).json({ reply });

  } catch (error: any) {
    console.error('Chat API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
