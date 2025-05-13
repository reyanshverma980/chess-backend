import jwt from "jsonwebtoken";
import { Request, Response } from "express";
import { nanoid } from "nanoid";
import User from "../models/users.js";

export const signup = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    const user = new User({ username, password });
    await user.save();

    const token = jwt.sign(
      { userId: user._id, username },
      process.env.JWT_SECRET!,
      {
        expiresIn: "3h",
      }
    );

    res.status(201).json({
      status: "success",
      token,
    });
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
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user || !(await user.comparePassword(password))) {
      res.status(401).json({
        status: "Failed",
        message: "Invalid Credentials",
      });
      return;
    }

    const token = jwt.sign(
      { userId: user._id, username },
      process.env.JWT_SECRET!,
      {
        expiresIn: "3h",
      }
    );

    res.status(200).json({
      status: "success",
      token,
    });
    return;
  } catch (error) {
    console.log(error);
    res.status(500).json({
      status: "Failed",
      message: "Server Error",
    });
  }
};

export const verifyToken = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        message: "No token provided",
      });
      return;
    }

    const token = authHeader.split(" ")[1];

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET!);

    res.status(200).json({
      status: "success",
      user: {
        id: (decodedToken as any).userId,
        username: (decodedToken as any).username,
      },
    });
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      res.status(401).json({
        message: "Token Expired",
      });
      return;
    }

    res.status(401).json({
      message: "Inavlid Token",
    });
  }
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
