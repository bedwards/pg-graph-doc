import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config({ path: ".env.example", quiet: true });
const [collectionArg, queryArg = "{}", projArg = "{}"] = process.argv.slice(2);

if (!collectionArg) {
  console.error("Usage: node run-mongo.js <collection> '<JSON query>' [projectionJSON]");
  process.exit(1);
}

const client = new MongoClient(process.env.MONGODB_URL);
await client.connect();

try {
  const col = client.db().collection(collectionArg);
  const query = JSON.parse(queryArg);
  const projection = JSON.parse(projArg);

  if (Object.keys(query).length === 0) {
    await col.createIndex({ created_at: -1 }).catch(e => raise(e));
  }

  const cursor = col.find(query, { projection }).limit(50);
  const docs = await cursor.toArray();
  console.log(JSON.stringify(docs, null, 2));
} finally {
  await client.close();
}
