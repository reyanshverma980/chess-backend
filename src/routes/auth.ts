import express from "express";
import { guest, login, signup, verifyToken } from "../controllers/auth.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/verify", verifyToken);
router.post("/guest", guest);

export default router;
