import "dotenv/config";
import { connectDB } from "../config/db.js";
import { auth } from "../config/auth.js";
import mongoose from "mongoose";

// Creates (or confirms) the fixed demo account used by the "Demo Login" button.
async function seed() {
  await connectDB();

  const email = process.env.DEMO_USER_EMAIL!;
  const password = process.env.DEMO_USER_PASSWORD!;

  try {
    await auth.api.signUpEmail({
      body: { email, password, name: "Demo User" },
    });
    console.log(`✅ Demo user created: ${email}`);
  } catch (err: any) {
    console.log(`ℹ️ Demo user likely already exists (${email}) — skipping.`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

seed();
