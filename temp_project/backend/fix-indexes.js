const mongoose = require('mongoose');
require('dotenv').config();

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/skillnix-pchr';

const fixIndexes = async () => {
  try {
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    const collections = ['positions', 'sources', 'clients', 'companies'];

    for (const collectionName of collections) {
      try {
        const collection = mongoose.connection.collection(collectionName);
        const indexes = await collection.getIndexes();

        console.log(`\n${collectionName} - Current indexes:`, Object.keys(indexes));

        // Drop all indexes except the default _id index
        for (const indexName of Object.keys(indexes)) {
          if (indexName !== '_id_') {
            try {
              await collection.dropIndex(indexName);
              console.log(`✓ Dropped index: ${indexName}`);
            } catch (err) {
              console.log(`⚠ Could not drop index ${indexName}:`, err.message);
            }
          }
        }
      } catch (err) {
        console.log(`⚠ Error processing ${collectionName}:`, err.message);
      }
    }

    console.log('\n✓ All indexes cleared. Run your server to recreate correct indexes automatically.');

    await mongoose.connection.close();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error fixing indexes:', error);
    process.exit(1);
  }
};

fixIndexes();
