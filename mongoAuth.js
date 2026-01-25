// mongoAuth.js
import { MongoClient } from 'mongodb';
import { initAuthCreds, BufferJSON } from '@whiskeysockets/baileys';

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);
const dbName = 'baileys_sessions';
const collectionName = 'auth';

let db, collection;

async function connectMongo() {
  if (!db) {
    await client.connect();
    db = client.db(dbName);
    collection = db.collection(collectionName);
  }
  return { db, collection };
}

export async function useMongoAuthState() {
  const { collection } = await connectMongo();

  const writeData = async (data) => {
    for (const key in data) {
      await collection.updateOne(
        { _id: key },
        { $set: { value: JSON.stringify(data[key], BufferJSON.replacer) } },
        { upsert: true }
      );
    }
  };

  const readData = async () => {
    const docs = await collection.find({}).toArray();
    const data = {};
    for (const doc of docs) {
      data[doc._id] = JSON.parse(doc.value, BufferJSON.reviver);
    }
    return data;
  };

  const clearData = async () => {
    await collection.deleteMany({});
    console.log('🧹 MongoDB session cleared');
  };

  const creds = (await readData()).creds || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          for (const id of ids) {
            const key = `${type}-${id}`;
            const doc = await collection.findOne({ _id: key });
            data[id] = doc ? JSON.parse(doc.value, BufferJSON.reviver) : undefined;
          }
          return data;
        },
        set: async (data) => {
          for (const type in data) {
            for (const id in data[type]) {
              const key = `${type}-${id}`;
              await collection.updateOne(
                { _id: key },
                { $set: { value: JSON.stringify(data[type][id], BufferJSON.replacer) } },
                { upsert: true }
              );
            }
          }
        }
      }
    },
    saveCreds: async () => {
      await writeData({ creds });
    },
    clearData
  };
}