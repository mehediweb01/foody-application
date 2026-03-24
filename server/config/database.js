import mongoose from "mongoose";

const db = null;
const client = null;

export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB Connected ✅");
  } catch (err) {
    console.log("MongoDB Not Connected ❌");
    if (err instanceof Error) throw new Error(err.message);
  }
};

export const getDB = () => {
  if (!db) {
    throw new Error("Database not initialized. Call connectDB() first!");
  }
  return db;
};

/**
 * Get collection
 */
export const getCollection = (collectionName) => {
  return getDB().collection(collectionName);
};

/**
 * Close database connection
 */
export const closeDB = async () => {
  if (client) {
    await client.close();
    console.log("🔒 MongoDB connection closed");
  }
};
