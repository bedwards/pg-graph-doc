import { MongoClient } from "mongodb";

// Accept: node run-mongo.js <collection> '<JSON query>' [projectionJSON]
const [collectionArg, queryArg = "{}", projArg = "{}"] = process.argv.slice(2);
if (!collectionArg) {
  console.error("Usage: node run-mongo.js <collection> '<JSON query>' [projectionJSON]");
  process.exit(1);
}

const uri =
  process.env.MONGODB_URL ||
  "mongodb://127.0.0.1:27017/app"; // FerretDB on localhost:27017, db "app" from your compose

const client = new MongoClient(uri);
await client.connect();

try {
  const db = client.db();                    // "app" from URI
  const col = db.collection(collectionArg);

  // Example: if query is {}, we’ll insert a sample doc on first run so you see output
  const query = JSON.parse(queryArg);
  const projection = JSON.parse(projArg);

  if (Object.keys(query).length === 0) {
    await col.createIndex({ created_at: -1 }).catch(() => {});
    await col.insertOne({ hello: "world", created_at: new Date() });
  }

  const cursor = col.find(query, { projection }).limit(50);
  const docs = await cursor.toArray();
  console.log(JSON.stringify(docs, null, 2));
} finally {
  await client.close();
}
