import express from "express";
import { guest, login, signup } from "../controllers/auth.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/guest", guest);

export default router;
