/**
 * Fix E11000 on atsSettings.careersCustomDomain: ""
 * - Unset empty careersCustomDomain on all orgs
 * - Drop legacy unique sparse index
 * - Ensure partial unique index exists
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGODB_URL);
  const col = mongoose.connection.db.collection('organizations');

  const unsetRes = await col.updateMany(
    {
      $or: [
        { 'atsSettings.careersCustomDomain': '' },
        { 'atsSettings.careersCustomDomain': null },
      ],
    },
    { $unset: { 'atsSettings.careersCustomDomain': '' } }
  );
  console.log('unset empty careersCustomDomain:', unsetRes.modifiedCount);

  const indexes = await col.indexes();
  const legacy = indexes.find((i) => i.name === 'atsSettings.careersCustomDomain_1');
  if (legacy) {
    await col.dropIndex('atsSettings.careersCustomDomain_1');
    console.log('dropped index atsSettings.careersCustomDomain_1');
  } else {
    console.log('legacy index not present');
  }

  const partialName = 'atsSettings.careersCustomDomain_partial';
  const hasPartial = indexes.some((i) => i.name === partialName);
  if (!hasPartial) {
    await col.createIndex(
      { 'atsSettings.careersCustomDomain': 1 },
      {
        unique: true,
        name: partialName,
        partialFilterExpression: {
          'atsSettings.careersCustomDomain': { $exists: true, $type: 'string', $gt: '' },
        },
      }
    );
    console.log('created partial unique index', partialName);
  } else {
    console.log('partial index already exists');
  }

  await mongoose.disconnect();
  console.log('done');
}

main().catch(async (e) => {
  console.error(e);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
