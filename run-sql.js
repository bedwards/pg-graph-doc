import pkg from "pg";
const { Client } = pkg;

const sql = process.argv.slice(2).join(" ");
const conn = process.env.PGURL || "postgres://postgres:postgres@127.0.0.1:5432/app";
const searchPath = process.env.SEARCH_PATH || "app, public";

const client = new Client({ connectionString: conn });
await client.connect();

await client.query(`CREATE SCHEMA IF NOT EXISTS ${searchPath.split(",")[0].trim()};`);
await client.query(`SET search_path TO ${searchPath};`);

const res = await client.query(sql);
if (res.rows?.length) console.table(res.rows);
await client.end();
