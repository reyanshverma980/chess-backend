import mongoose from "mongoose";

export const connectToDatabase = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error("MONGO_URI environment variable is not set");
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log("MongoDB Connected");
  } catch (error: any) {
    console.error("MongoDB Connection Error:", error?.message);
    process.exit(1); // Exit process if connection fails
  }
};
