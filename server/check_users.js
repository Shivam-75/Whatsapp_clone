import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./src/models/User.js";

dotenv.config();

const checkUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGO_DB_URL);
    const users = await User.find({});
    console.log("Database Users Count:", users.length);
    users.forEach(u => console.log(`- ${u.username} (${u._id})`));
    process.exit();
  } catch (error) {
    console.error("Check users error:", error);
    process.exit(1);
  }
};

checkUsers();
