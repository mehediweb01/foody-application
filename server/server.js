import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { connectDB } from "./config/connectDB.js";

const app = express();

await connectDB();

app.use(express.json());

app.get("/", (_req, res) => {
  res.send("Server running on port 5000");
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});
