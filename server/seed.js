import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import User from "./src/models/User.js";

dotenv.config();

const dummyUsers = [
  { username: "Alice", password: "password123", about: "I love coding!" },
  { username: "Bob", password: "password123", about: "Coffee enthusiast ☕" },
  { username: "Charlie", password: "password123", about: "Design is everything." },
  { username: "David", password: "password123", about: "Available for chat." },
  { username: "Eve", password: "password123", about: "Using WhatsApp Clone!" },
];

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_DB_URL);
    console.log("Connected to MongoDB for seeding...");

    // Clear existing users to avoid duplicates (optional, based on preference)
    // For now, only add if not exists
    
    for (const user of dummyUsers) {
      const exists = await User.findOne({ username: user.username });
      if (!exists) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(user.password, salt);
        
        await User.create({
          username: user.username,
          password: hashedPassword,
          about: user.about,
          profilePic: `https://ui-avatars.com/api/?name=${user.username}&background=random&color=fff&size=128`
        });
        console.log(`User ${user.username} created.`);
      } else {
        // Update existing user if profile pic is missing OR from the broken service
        if (!exists.profilePic || exists.profilePic.includes("avatar.iran.liara.run")) {
           exists.profilePic = `https://ui-avatars.com/api/?name=${user.username}&background=random&color=fff&size=128`;
           await exists.save();
           console.log(`User ${user.username} profile pic updated.`);
        } else {
           console.log(`User ${user.username} already exists.`);
        }
      }
    }

    console.log("Seeding complete!");
    process.exit();
  } catch (error) {
    console.error("Seeding error:", error);
    process.exit(1);
  }
};

seedDB();
