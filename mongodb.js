const { MongoClient } = require("mongodb");

const mongoUrl =
  process.env.MONGO_URI;
;

module.exports = async function connectDB() {
  try {
    const client = new MongoClient(mongoUrl);

    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db("test");
    const collection = db.collection("projectsummaries");

    const today = new Date();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const data = await collection.find({
      report_date: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    }).toArray();

    return data;
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    return [];
  }
}