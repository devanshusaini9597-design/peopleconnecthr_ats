/**
 * Jest setup — prefer in-memory MongoDB when available so isolation/auth tests can hit DB.
 * Set SKIP_MEMORY_MONGO=1 to disable. Set RUN_INTEGRATION_TESTS=1 for forced enable (legacy).
 */
const mongoose = require('mongoose');

let mongod;

beforeAll(async () => {
  if (process.env.SKIP_MEMORY_MONGO === '1') return;
  if (mongoose.connection.readyState === 1) return;

  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
  } catch (err) {
    console.warn('[tests/setup] mongodb-memory-server unavailable:', err.message);
  }
}, 120000);

afterAll(async () => {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongod) await mongod.stop();
  } catch (err) {
    console.warn('[tests/setup] cleanup error:', err.message);
  }
});

afterEach(async () => {
  if (mongoose.connection.readyState !== 1) return;
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});
