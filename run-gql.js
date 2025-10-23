import dotenv from "dotenv";
import fetch from 'node-fetch';

dotenv.config({ path: ".env.example", quiet: true });
const gql = process.argv.slice(2).join(" ").trim();

const res = await fetch(process.env.GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: gql })
});

const value = await res.json();
console.log(JSON.stringify(value));
