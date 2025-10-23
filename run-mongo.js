import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config({ path: ".env.example", quiet: true });

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

const [collectionArg, queryArg = "{}", projArg = "{}"] = positionals;

const collection = flags.collection || flags.c || collectionArg;
const query = flags.query || flags.q || queryArg;
const projection = flags.project || flags.p ? JSON.parse(flags.project || flags.p) : JSON.parse(projArg);
const sort = flags.sort || flags.s ? JSON.parse(flags.sort || flags.s) : undefined;
const limit = flags.limit || flags.l ? Number(flags.limit || flags.l) : 50;

if (!collection) {
  console.error("Usage: node run-mongo.js --collection=<name> [--query='{}'] [--project='{}'] [--sort='{}'] [--limit=50] [--insert='{}']");
  console.error("Short: -c <name> [-q '{}'] [-p '{}'] [-s '{}'] [-l 50] [-i '{}']");
  process.exit(1);
}

const client = new MongoClient(process.env.MONGODB_URL);
await client.connect();

try {
  const db = client.db("postgres");
  const col = db.collection(collection);

  if (flags.insert || flags.i) {
    const doc = JSON.parse(flags.insert || flags.i);
    const result = await col.insertOne({
      ...doc,
      created_at: doc.created_at ?? new Date().toISOString(),
    });
    console.log(JSON.stringify({ insertedId: result.insertedId }, null, 2));
  } else {
    const queryObj = JSON.parse(query);
    const cursor = col.find(queryObj, { projection, sort }).limit(limit);
    const docs = await cursor.toArray();
    console.log(JSON.stringify(docs, null, 2));
  }
} finally {
  await client.close();
}
