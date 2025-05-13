import dotenv from "dotenv";
import express from "express";
import http from "http";
import cors from "cors";
import mongoose from "mongoose";
import authRouter from "./routes/auth.js";
import { Server } from "socket.io";
import { GameManager } from "./GameManager.js";
import Redis from "ioredis";

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI!);
    console.log("🔥 MongoDB Connected");
  } catch (error: any) {
    console.error("MongoDB Connection Error:", error.message);
    process.exit(1); // Exit process if connection fails
  }
};

export const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD!,
});

const PORT = process.env.PORT || 5001;
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

const app = express();
app.use(
  cors({
    origin: frontendUrl, // Frontend URL
    credentials: true, // Allow cookies/auth headers
    methods: ["GET", "POST", "PUT", "DELETE"], // Allowed methods
    allowedHeaders: ["Content-Type", "Authorization"], // Allowed headers
  })
);

app.use(express.json());
app.use("/api", authRouter);
connectDB();

const server = http.createServer(app);
const io = new Server(server);

const gameManager = new GameManager();

io.on("connection", (socket) => {
  const id = socket.handshake.auth?.userId;
  if (!id) {
    socket.disconnect(true);
    return;
  }
  gameManager.addUser(id, socket);

  socket.on("disconnect", () => {
    gameManager.removeUser(socket);
  });

  socket.on("error", (err) => {
    console.error("Socket error:", err.message);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
