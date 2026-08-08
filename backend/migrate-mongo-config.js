/**
 * migrate-mongo configuration.
 * Run: npx migrate-mongo up
 * Migrations are intentionally NOT run from server startup.
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const config = {
  mongodb: {
    url: process.env.MONGODB_URL || process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/allinone',
    options: {},
  },
  migrationsDir: 'migrations',
  changelogCollectionName: 'changelog',
  migrationFileExtension: '.js',
  useFileHash: false,
  moduleSystem: 'commonjs',
};

module.exports = config;
