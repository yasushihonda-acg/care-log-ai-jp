
import { sql } from '@vercel/postgres';

export default async function handler(request: any, response: any) {
  try {
    if (request.method === 'GET') {
      const { rows } = await sql`
        SELECT * FROM care_records 
        ORDER BY recorded_at DESC 
        LIMIT 100;
      `;
      return response.status(200).json(rows);
    }

    if (request.method === 'POST') {
      // Vercel (Node.js) では request.body は自動的にパースされています
      const { record_type, details } = request.body;

      if (!record_type || !details) {
        return response.status(400).json({ error: 'Missing required fields' });
      }

      const { rows } = await sql`
        INSERT INTO care_records (record_type, details, recorded_at)
        VALUES (${record_type}, ${details}, NOW())
        RETURNING *;
      `;

      return response.status(201).json(rows[0]);
    }

    return response.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Database Error:', error);
    return response.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
