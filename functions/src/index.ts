/**
 * Cloud Functions for AI Care Log
 * Using Firebase Functions v2 with Vertex AI + Firestore
 */

import { onRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import express from 'express';
import cors from 'cors';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase-admin/app';
import { GoogleGenAI } from '@google/genai';

// Initialize Firebase Admin
initializeApp();
const firestore = getFirestore();
const COLLECTION_NAME = 'care_records';

// Set global options for all functions
setGlobalOptions({
  region: 'asia-northeast1',
  memory: '256MiB',
  timeoutSeconds: 60,
});

// Initialize Google Gen AI with Vertex AI
const PROJECT_ID = process.env.GCP_PROJECT_ID || 'care-log-ai-jp';
const LOCATION = 'asia-northeast1';

const ai = new GoogleGenAI({
  vertexai: true,
  project: PROJECT_ID,
  location: LOCATION,
});

// FieldSetting type
interface FieldSetting {
  key: string;
  label: string;
  description?: string;
}

// Default field settings
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

// Superset Schema - all known keys (excluding generic fields that confuse the model)
const ALL_KNOWN_KEYS = [
  'main_dish', 'side_dish', 'amount_percent', 'fluid_type', 'fluid_ml',
  'excretion_type', 'amount', 'characteristics', 'incontinence',
  'temperature', 'systolic_bp', 'diastolic_bp', 'pulse', 'spo2',
  'bath_type', 'skin_condition',
  'detail'
];

// Fields to exclude from AI response (these tend to be misused)
const EXCLUDED_FIELDS = ['notes', 'title'];


// Default descriptions map
const DEFAULT_DESCRIPTIONS: Record<string, Record<string, string>> = {};
Object.entries(DEFAULT_FIELD_SETTINGS).forEach(([type, fields]) => {
  DEFAULT_DESCRIPTIONS[type] = {};
  fields.forEach(f => {
    if (f.description) {
      DEFAULT_DESCRIPTIONS[type][f.key] = f.description;
    }
  });
});

// ============================================================
// Parse API - AI解析
// ============================================================
const parseApp = express();
parseApp.use(cors({ origin: true }));
parseApp.use(express.json());

parseApp.post('/', async (req, res) => {
  try {
    const { text, fieldSettings: clientFieldSettings } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'テキスト入力が必要です' });
    }

    // Apply default descriptions if missing
    let fieldSettings = clientFieldSettings;
    if (fieldSettings) {
      Object.keys(fieldSettings).forEach(type => {
        if (DEFAULT_DESCRIPTIONS[type]) {
          fieldSettings[type] = fieldSettings[type].map((f: FieldSetting) => {
            if (!f.description && DEFAULT_DESCRIPTIONS[type][f.key]) {
              return { ...f, description: DEFAULT_DESCRIPTIONS[type][f.key] };
            }
            return f;
          });
        }
      });
    }

    // Build field definitions for prompt
    let fieldsDef = '【抽出対象フィールド一覧】\n';
    const allKeys = new Set<string>(['record_type', 'suggested_date']);

    if (fieldSettings) {
      Object.entries(fieldSettings).forEach(([type, fields]: [string, any]) => {
        fieldsDef += `\n### 記録タイプ: ${type}\n`;
        fields.forEach((f: FieldSetting) => {
          allKeys.add(f.key);
          const desc = f.description ? ` (抽出ルール: ${f.description})` : '';
          fieldsDef += `- キー: "${f.key}", ラベル: "${f.label}"${desc}\n`;
        });
      });
    }

    // Build schema properties
    const detailsProperties: Record<string, { type: string }> = {};
    const schemaKeys = new Set([...allKeys, ...ALL_KNOWN_KEYS]);
    schemaKeys.forEach(key => {
      if (key !== 'record_type' && key !== 'suggested_date') {
        detailsProperties[key] = { type: 'string' };
      }
    });

    // Build prompt with few-shot examples and strict extraction rules
    const prompt = `
あなたは介護記録の情報抽出専門AIです。入力テキストから【必ず】以下のルールに従って情報を抽出してください。

【入力テキスト】
"${text}"

${fieldsDef}

【絶対に守るべき抽出ルール】
1. 数値変換ルール:
   - 「8割」→ "80" (割は10倍して数値のみ)
   - 「200ml」→ "200" (単位を除去)
   - 「36.5度」→ "36.5" (単位を除去)
   - 「120/80」または「120の80」→ systolic_bp: "120", diastolic_bp: "80"

2. 食事(meal)の場合、以下を【必ず】抽出:
   - main_dish: 主食の名前（全粥、ご飯、パン等）
   - amount_percent: 摂取率（数値のみ、割は10倍）
   - fluid_type: 水分の名前（お茶、水、牛乳等）
   - fluid_ml: 水分量（数値のみ）

3. 禁止事項:
   - notes フィールドは使わないでください
   - title フィールドは使わないでください
   - 入力テキストをそのまま値にしないでください

【抽出例】

入力: "お昼ご飯は全粥を8割、お茶を200ml飲みました"
出力:
{
  "record_type": "meal",
  "details": {
    "main_dish": "全粥",
    "amount_percent": "80",
    "fluid_type": "お茶",
    "fluid_ml": "200"
  }
}

入力: "朝食パン1枚と牛乳150cc、主食5割"
出力:
{
  "record_type": "meal",
  "details": {
    "main_dish": "パン",
    "amount_percent": "50",
    "fluid_type": "牛乳",
    "fluid_ml": "150"
  }
}

入力: "体温36.8、血圧124の78、脈72"
出力:
{
  "record_type": "vital",
  "details": {
    "temperature": "36.8",
    "systolic_bp": "124",
    "diastolic_bp": "78",
    "pulse": "72"
  }
}

入力: "14時に排尿多量、失禁あり"
出力:
{
  "record_type": "excretion",
  "details": {
    "excretion_type": "尿",
    "amount": "多量",
    "incontinence": "あり"
  }
}

上記のルールと例に従って、入力テキストから情報を抽出してください。
`;

    // Call Gemini via Vertex AI
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            record_type: { type: 'string' },
            details: { type: 'object', properties: detailsProperties },
            suggested_date: { type: 'string' }
          },
          required: ['record_type', 'details']
        }
      }
    });

    const responseText = response.text;

    if (!responseText) {
      throw new Error('AIからの応答がありません');
    }

    const parsed = JSON.parse(responseText);

    // Post-processing: Remove excluded fields
    if (parsed.details) {
      EXCLUDED_FIELDS.forEach(field => {
        delete parsed.details[field];
      });

      // Remove empty, null, or "null" string values
      Object.keys(parsed.details).forEach(key => {
        const value = parsed.details[key];
        if (value === '' || value === null || value === 'null' || value === undefined) {
          delete parsed.details[key];
        }
      });
    }

    // Fallback extraction for meal records
    if (parsed.record_type === 'meal' && parsed.details) {
      // Fallback: Extract amount_percent from text (e.g., "8割" -> "80")
      if (!parsed.details.amount_percent) {
        const wariMatch = text.match(/(\d+)\s*割/);
        if (wariMatch) {
          parsed.details.amount_percent = String(parseInt(wariMatch[1]) * 10);
        }
      }

      // Fallback: Extract fluid_ml from text (e.g., "200ml" or "200cc")
      if (!parsed.details.fluid_ml) {
        const mlMatch = text.match(/(\d+)\s*(ml|cc|ミリ)/i);
        if (mlMatch) {
          parsed.details.fluid_ml = mlMatch[1];
        }
      }

      // Fallback: Extract fluid_type (common beverages)
      if (!parsed.details.fluid_type && parsed.details.fluid_ml) {
        const fluidMatch = text.match(/(お茶|水|牛乳|ジュース|コーヒー|紅茶|味噌汁|スープ)/);
        if (fluidMatch) {
          parsed.details.fluid_type = fluidMatch[1];
        }
      }
    }

    // Fallback extraction for vital records
    if (parsed.record_type === 'vital' && parsed.details) {
      // Fallback: Extract temperature
      if (!parsed.details.temperature) {
        const tempMatch = text.match(/(\d+\.?\d*)\s*度/);
        if (tempMatch) {
          parsed.details.temperature = tempMatch[1];
        }
      }

      // Fallback: Extract blood pressure (120/80 or 120の80)
      if (!parsed.details.systolic_bp || !parsed.details.diastolic_bp) {
        const bpMatch = text.match(/(\d+)\s*[/の]\s*(\d+)/);
        if (bpMatch) {
          parsed.details.systolic_bp = parsed.details.systolic_bp || bpMatch[1];
          parsed.details.diastolic_bp = parsed.details.diastolic_bp || bpMatch[2];
        }
      }
    }

    // Clean up top-level null values
    if (parsed.suggested_date === 'null' || parsed.suggested_date === null) {
      delete parsed.suggested_date;
    }

    return res.status(200).json(parsed);
  } catch (error: any) {
    console.error('Parse Error:', error);
    return res.status(500).json({
      error: '解析に失敗しました',
      details: error.message
    });
  }
});

// ============================================================
// Records API - CRUD操作
// ============================================================
const recordsApp = express();
recordsApp.use(cors({ origin: true }));
recordsApp.use(express.json());

// GET - 一覧取得
recordsApp.get('/', async (req, res) => {
  try {
    const snapshot = await firestore
      .collection(COLLECTION_NAME)
      .orderBy('created_at', 'desc')
      .limit(100)
      .get();

    const records = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return res.status(200).json(records);
  } catch (error: any) {
    console.error('GET Error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// POST - 新規作成
recordsApp.post('/', async (req, res) => {
  try {
    const { record_type, details, recorded_at } = req.body;

    const docRef = await firestore.collection(COLLECTION_NAME).add({
      record_type,
      details,
      recorded_at: recorded_at || new Date().toISOString(),
      created_at: new Date().toISOString()
    });

    return res.status(201).json({
      id: docRef.id,
      message: 'Record created successfully'
    });
  } catch (error: any) {
    console.error('POST Error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// PUT - 更新
recordsApp.put('/', async (req, res) => {
  try {
    const { id, record_type, details, recorded_at } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'ID is required' });
    }

    await firestore.collection(COLLECTION_NAME).doc(id).update({
      record_type,
      details,
      recorded_at,
      updated_at: new Date().toISOString()
    });

    return res.status(200).json({ message: 'Record updated successfully' });
  } catch (error: any) {
    console.error('PUT Error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// DELETE - 削除
recordsApp.delete('/', async (req, res) => {
  try {
    const id = req.query.id as string;

    if (!id) {
      return res.status(400).json({ error: 'ID is required' });
    }

    await firestore.collection(COLLECTION_NAME).doc(id).delete();

    return res.status(200).json({ message: 'Deleted successfully' });
  } catch (error: any) {
    console.error('DELETE Error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// ============================================================
// Chat API - RAGチャット
// ============================================================
const chatApp = express();
chatApp.use(cors({ origin: true }));
chatApp.use(express.json());

chatApp.post('/', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'メッセージが必要です' });
    }

    // Fetch recent records for context
    const snapshot = await firestore
      .collection(COLLECTION_NAME)
      .orderBy('created_at', 'desc')
      .limit(50)
      .get();

    const records = snapshot.docs.map(doc => doc.data());
    const recordsContext = JSON.stringify(records, null, 2);

    const prompt = `
あなたは介護記録に関する相談に答えるAIアシスタントです。
以下の記録データを参照して、ユーザーの質問に日本語で回答してください。

【記録データ】
${recordsContext}

【ユーザーの質問】
${message}

【回答ルール】
- 記録データに基づいて具体的に回答してください
- 推測の場合は「推測ですが」と前置きしてください
- 記録にない情報は「記録がありません」と回答してください
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const reply = response.text;

    return res.status(200).json({ reply: reply || '回答を生成できませんでした' });
  } catch (error: any) {
    console.error('Chat Error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Export Firebase Functions v2
export const parse = onRequest(parseApp);
export const records = onRequest(recordsApp);
export const chat = onRequest(chatApp);
