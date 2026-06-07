const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const connUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/quiz_ai_platform';
    console.log(`Attempting to connect to MongoDB at: ${connUri.split('@').pop()}`);
    
    await mongoose.connect(connUri, {
      serverSelectionTimeoutMS: 5000,
    });
    
    console.log('MongoDB Connected successfully.');
  } catch (err) {
    console.error(`MongoDB connection error: ${err.message}`);
    // Do not crash the server in local development if DB is not active yet
    console.log('Proceeding with server startup. Ensure MongoDB is running for full functionality.');
  }
};

module.exports = connectDB;
