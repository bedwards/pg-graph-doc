import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config({ path: ".env.example", quiet: true });

const argv = process.argv.slice(2);

const flags = Object.fromEntries(
  argv
    .filter(a => a.startsWith("--") || a.startsWith("-"))
    .map(a => {
      const [k, ...rest] = a.split("=");
      const key = k.replace(/^--?/, "");
      const val = rest.length ? rest.join("=") : "true";
      return [key, val];
    })
);

const positionals = argv.filter(a => !a.startsWith("--") && !a.startsWith("-"));
const [collectionArg, queryArg = "{}", projArg = "{}"] = positionals;

if (!collectionArg && !flags.insert) {
  console.error("Usage: node run-mongo.js <collection> '<JSON query>' [projectionJSON] [--project='{}' --limit=50 --sort='{}' --insert='{}']");
  process.exit(1);
}

const client = new MongoClient(process.env.MONGODB_URL);
await client.connect();

try {
  const db = client.db("postgres");
  const col = db.collection(collectionArg || (flags.insert ? flags.collection : undefined));

  const projection = flags.project || flags.p ? JSON.parse(flags.project || flags.p) : JSON.parse(projArg);
  const sort = flags.sort || flags.s ? JSON.parse(flags.sort || flags.s) : undefined;
  const limit = flags.limit || flags.l ? Number(flags.limit || flags.l) : 50;

  if (flags.insert) {
    const doc = JSON.parse(flags.insert);
    const result = await col.insertOne({
      ...doc,
      created_at: doc.created_at ?? new Date().toISOString(),
    });
    console.log(JSON.stringify({ insertedId: result.insertedId }, null, 2));
  } else {
    const query = JSON.parse(queryArg);
    const cursor = col.find(query, { projection, sort }).limit(limit);
    const docs = await cursor.toArray();
    console.log(JSON.stringify(docs, null, 2));
  }
} finally {
  await client.close();
}
