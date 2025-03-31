import dotenv from "dotenv";
import express from "express";
import http from "http";
import cors from "cors";
import mongoose from "mongoose";
import jwt, { JwtPayload } from "jsonwebtoken";
import authRouter from "./routes/auth.js";
import { WebSocketServer } from "ws";
import { GameManager } from "./GameManager.js";

interface AuthPayload extends JwtPayload {
  userId?: string;
  guest?: boolean;
  guestId?: string;
}

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI!);
    console.log("🔥 MongoDB Connected");
  } catch (error: any) {
    console.error("MongoDB Connection Error:", error.message);
    process.exit(1); // Exit process if connection fails
  }
};

const PORT = process.env.PORT || 5001;
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

dotenv.config();
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
const wss = new WebSocketServer({ server });

const gameManager = new GameManager();

wss.on("connection", (ws) => {
  ws.once("message", (data) => {
    try {
      const message = JSON.parse(data.toString());
      if (message.type === "auth") {
        const payload = jwt.verify(
          message.token,
          process.env.JWT_SECRET!
        ) as AuthPayload;

        if (payload.guest) {
          const guestId = payload.guestId;
          if (!guestId) {
            ws.close();
            return;
          }
          gameManager.addGuest(guestId, ws);
        } else {
          const id = payload.userId;
          if (!id) {
            ws.close();
            return;
          }
          gameManager.addUser(id, ws);
        }

        ws.send(JSON.stringify({ type: "auth_success" }));
      } else {
        ws.send(JSON.stringify({ type: "auth_required" }));
        ws.close();
      }
    } catch (error) {
      ws.send(JSON.stringify({ type: "auth_failed" }));
      ws.close();
    }
  });

  ws.on("error", (err) => {
    console.error("error: " + err.message);
  });

  ws.on("close", () => {
    gameManager.removeUser(ws);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
