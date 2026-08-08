/**
 * Database connection helper (extracted from server.js God-file refactor).
 */
const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDatabase = async () => {
  const mongoUrl =
    process.env.MONGODB_URL ||
    process.env.MONGODB_URI ||
    process.env.DATABASE_URL ||
    'mongodb://localhost:27017/allinone';

  logger.info(
    { url: mongoUrl.replace(/^(mongodb\+srv:\/\/[^:]+):[^@]+@/, '$1:****@') },
    'Connecting to MongoDB'
  );

  await mongoose.connect(mongoUrl, {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    minPoolSize: 2,
    retryWrites: true,
    retryReads: true,
    bufferCommands: false,
  });

  logger.info('MongoDB Connected');
  return mongoose.connection;
};

module.exports = { connectDatabase };
