import jwt from "jsonwebtoken";
import { Request, Response } from "express";
import { nanoid } from "nanoid";
import User from "../models/users.js";

export const signup = async (req: Request, res: Response) => {
  const { username, password } = req.body;
  try {
    const user = new User({ username, password });
    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET!, {
      expiresIn: "3h",
    });

    res.json({
      status: "success",
      token,
    });
    return;
  } catch (error: any) {
    if (error.code === 11000) {
      // MongoDB duplicate key error
      res.status(400).json({
        status: "Failed",
        message: "Username already exists",
      });
      return;
    }

    res.status(500).json({
      status: "Failed",
      message: "Internal Server Error",
    });
    return;
  }
};

export const login = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username });
  if (!user || !(await user?.comparePassword(password))) {
    res.status(401).json({
      status: "Failed",
      message: "Invalid Credentials",
    });
    return;
  }

  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET!, {
    expiresIn: "3h",
  });

  res.json({
    status: "success",
    token,
  });
  return;
};

export const guest = async (req: Request, res: Response) => {
  const guestId = "Guest_" + nanoid(6);
  const token = jwt.sign({ guest: true, guestId }, process.env.JWT_SECRET!, {
    expiresIn: "1h",
  });

  res.json({
    status: "success",
    token,
    guestId,
  });
  return;
};
