import dotenv from 'dotenv';
import pg from "pg";

dotenv.config({ path: '.env.example', quiet: true });
const { Client } = pg;
const client = new Client({ connectionString: process.env.POSTGRES_URL });
const sql = process.argv.slice(2).join(" ");

try {
    await client.connect();
    const res = await client.query(sql);
    if (res.rows?.length) console.table(res.rows);
}
finally {
    await client.end();
}
