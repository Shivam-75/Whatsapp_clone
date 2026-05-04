
import mongoose from "mongoose";

let cachedConn = null;

const Db = async () => {
  if (cachedConn) {
    return cachedConn;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGO_DB_URL);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    cachedConn = conn;
    return conn;
  } catch (err) {
    console.error(`MongoDB Error: ${err.message}`);
    // Do not use process.exit(1) in serverless environments as it crashes the function
    throw err;
  }
};

export default Db;
