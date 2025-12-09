
import { sql } from '@vercel/postgres';

export default async function handler(request: any, response: any) {
  try {
    // GET: リスト取得
    if (request.method === 'GET') {
      const { rows } = await sql`
        SELECT * FROM care_records 
        ORDER BY recorded_at DESC 
        LIMIT 100;
      `;
      return response.status(200).json(rows);
    }

    // POST: 新規作成
    if (request.method === 'POST') {
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

    // PUT: 更新
    if (request.method === 'PUT') {
      const { id, record_type, details } = request.body;

      if (!id || !record_type || !details) {
        return response.status(400).json({ error: 'Missing required fields' });
      }

      // ID指定で更新
      const { rows } = await sql`
        UPDATE care_records
        SET record_type = ${record_type}, details = ${details}
        WHERE id = ${id}
        RETURNING *;
      `;

      if (rows.length === 0) {
        return response.status(404).json({ error: 'Record not found' });
      }

      return response.status(200).json(rows[0]);
    }

    // DELETE: 削除
    if (request.method === 'DELETE') {
      const { id } = request.query;

      if (!id) {
        return response.status(400).json({ error: 'Missing ID' });
      }

      const { rowCount } = await sql`DELETE FROM care_records WHERE id = ${id}`;

      if (rowCount === 0) {
        return response.status(404).json({ error: 'Record not found' });
      }

      return response.status(200).json({ message: 'Deleted successfully' });
    }

    return response.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Database Error:', error);
    return response.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
