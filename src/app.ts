import dotenv from "dotenv";
// Load environment variables
dotenv.config();

import express from "express";
import http from "http";
import cors from "cors";
import authRouter from "./routes/auth.js";
import { Server } from "socket.io";
import { GameManager } from "./GameManager.js";
import { createAdapter } from "@socket.io/redis-adapter";
import helmet from "helmet";
import { initRedisClients, pubClient, subClient } from "./config/redis.js";
import { connectToDatabase } from "./config/db.js";

// Environment config
const PORT = process.env.PORT || 5001;
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

initRedisClients();

// Express app
const app = express();

app.use(
  cors({
    origin: frontendUrl, // Frontend URL
    credentials: true, // Allow cookies/auth headers
  })
);
app.use(helmet());
app.use(express.json());

// Routes
app.use("/api", authRouter);

// HTTP + Socket Server
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true,
  },
});

io.adapter(createAdapter(pubClient, subClient));

const gameManager = new GameManager(io);

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

(async () => {
  try {
    await connectToDatabase();
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to connect to DB:", err);
    process.exit(1);
  }
})();
