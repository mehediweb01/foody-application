import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import { generateOrderId } from "../utils/helpers.js";
import { connectDB } from "./config/connectDB.js";
import { orderHandler } from "./socket/orderHandler.js";

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("User connected", socket.id);
  socket.emit("connected", `User connected: ${socket.id}`);

  //order id generator
  const orderId = generateOrderId();
  console.log(orderId);

  // handing the order
  orderHandler(io, socket);
});

app.use(express.json());
app.use(cors({ origin: "*", credentials: true }));
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => {
  res.send("Server running on port 5000");
});

connectDB().then(() => {
  server.listen(5000, () => {
    console.log("Server running on port 5000");
  });
});
