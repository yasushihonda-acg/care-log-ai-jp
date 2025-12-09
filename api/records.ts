import { db } from '@vercel/postgres';

export default async function handler(request: Request) {
  const client = await db.connect();

  try {
    if (request.method === 'GET') {
      const { rows } = await client.sql`
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

      // Ensure details is stringified for JSONB if needed, though pg usually handles objects
      const { rows } = await client.sql`
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
  } finally {
    // Vercel Edge/Serverless usually handles connection pooling, 
    // but explicit release is good practice in some contexts.
    // client.release(); 
  }
}