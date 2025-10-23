import dotenv from 'dotenv';
import pg from "pg";

dotenv.config({ path: '.env.example' });
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

// const searchPath = process.env.SEARCH_PATH || "app, public";

// await client.query(`CREATE SCHEMA IF NOT EXISTS ${searchPath.split(",")[0].trim()};`);
// await client.query(`SET search_path TO ${searchPath};`);

