import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config({ path: ".env.example", quiet: true });

const [collectionArg, queryArg = "{}", projArg = "{}", insertArg] = process.argv.slice(2);

if (!collectionArg) {
  console.error("Usage: node run-mongo.js <collection> '<JSON query>' [projectionJSON] [insertJSON]");
  process.exit(1);
}

const client = new MongoClient(process.env.MONGODB_URL);
await client.connect();

try {
  const col = client.db("postgres").collection(collectionArg);

  if (insertArg) {
    const doc = JSON.parse(insertArg);
    const result = await col.insertOne(doc);
    console.log("Inserted:", result.insertedId);
  } else {
    const query = JSON.parse(queryArg);
    const projection = JSON.parse(projArg);
    const cursor = col.find(query, { projection }).limit(50);
    const docs = await cursor.toArray();
    console.log(JSON.stringify(docs, null, 2));
  }
} finally {
  await client.close();
}
