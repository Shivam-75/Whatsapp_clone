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
    throw err;
  }
};

export default Db;
