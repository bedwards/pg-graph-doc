import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.example", quiet: true });

const { Client } = pg;
const argv = process.argv.slice(2);

const flags = {};
const positionals = [];

for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];

  if (arg.startsWith("--") || arg.startsWith("-")) {
    if (arg.includes("=")) {
      const [k, ...rest] = arg.split("=");
      const key = k.replace(/^--?/, "");
      const val = rest.join("=");
      flags[key] = val;
    } else {
      const key = arg.replace(/^--?/, "");
      const nextArg = argv[i + 1];

      if (nextArg && !nextArg.startsWith("-")) {
        flags[key] = nextArg;
        i++;
      } else {
        flags[key] = "true";
      }
    }
  } else {
    positionals.push(arg);
  }
}

const collection = positionals[0];
const query = flags.query || flags.q || "{}";
const projection = flags.project || flags.p || "{}";
const sort = flags.sort || flags.s || "{}";
const limit = flags.limit || flags.l ? Number(flags.limit || flags.l) : 50;

if (!collection) {
  console.error("Usage: node run-docdb.js <collection> [--query='{}'] [--project='{}'] [--sort='{}'] [--limit=50] [--insert='{}']");
  console.error("Short: node run-docdb.js <collection> [-q '{}'] [-p '{}'] [-s '{}'] [-l 50] [-i '{}']");
  process.exit(1);
}

const client = new Client({ connectionString: process.env.POSTGRES_URL });
await client.connect();

try {
  if (flags.insert || flags.i) {
    const doc = flags.insert || flags.i;
    const sql = `SELECT documentdb_api.insert_one('postgres', $1, $2, FALSE)`;
    const res = await client.query(sql, [collection, doc]);
    console.log(JSON.stringify(res.rows[0], null, 2));
  } else {
    const sql = `SELECT documentdb_api.find('postgres', $1, $2, $3, $4, $5::bigint)`;
    const res = await client.query(sql, [collection, query, projection, sort, limit]);
    
    if (res.rows.length > 0 && res.rows[0].find) {
      const docs = JSON.parse(res.rows[0].find);
      console.log(JSON.stringify(docs, null, 2));
    } else {
      console.log("[]");
    }
  }
} finally {
  await client.end();
}
