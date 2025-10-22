import pkg from "pg";
const { Client } = pkg;

const gqlQuery = process.argv.slice(2).join(" ").trim() || "{ __typename }";
const conn = process.env.PGURL || "postgres://postgres:postgres@127.0.0.1:5432/app";

const client = new Client({ connectionString: conn });
await client.connect();

// optional: if you didn't bake search_path into PGURL
// await client.query("SET search_path TO app, public");

const res = await client.query("SELECT graphql.resolve($1) AS data", [gqlQuery]);

// pg returns JSON/JSONB as a JS object; no JSON.parse needed
console.log(JSON.stringify(res.rows[0].data, null, 2));

await client.end();
