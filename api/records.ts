
import { sql } from '@vercel/postgres';

export default async function handler(request: Request) {
  try {
    if (request.method === 'GET') {
      const { rows } = await sql`
        SELECT * FROM care_records 
        ORDER BY recorded_at DESC 
        LIMIT 100;
      `;
      return new Response(JSON.stringify(rows), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (request.method === 'POST') {
      const body = await request.json();
      const { record_type, details } = body;

      if (!record_type || !details) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
      }

      const { rows } = await sql`
        INSERT INTO care_records (record_type, details, recorded_at)
        VALUES (${record_type}, ${details}, NOW())
        RETURNING *;
      `;

      return new Response(JSON.stringify(rows[0]), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  } catch (error) {
    console.error('Database Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}
