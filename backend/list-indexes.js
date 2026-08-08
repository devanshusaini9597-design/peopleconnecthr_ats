const mongoose = require('mongoose');
require('dotenv').config();

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/skillnix-pchr';

const listCollectionsAndIndexes = async () => {
  try {
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');
    console.log('Database:', mongoose.connection.db.name);

    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\nCollections in database:', collections.map(c => c.name));

    for (const collectionInfo of collections) {
      if (collectionInfo.name.startsWith('system')) continue;
      
      const collection = mongoose.connection.collection(collectionInfo.name);
      try {
        const indexes = await collection.getIndexes();
        console.log(`\n${collectionInfo.name} indexes:`, indexes);
      } catch (err) {
        console.log(`Error getting indexes for ${collectionInfo.name}:`, err.message);
      }
    }

    await mongoose.connection.close();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

listCollectionsAndIndexes();
