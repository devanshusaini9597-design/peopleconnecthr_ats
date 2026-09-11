/**
 * One-shot heal: force candidate string fields to BLOCK LETTERS (email stays lowercase).
 */
const Candidate = require('../models/Candidate');
const { BLOCK_LETTER_FIELDS } = require('../utils/textNormalize');
const logger = require('../utils/logger');

async function healCandidateBlockLetters(orgId) {
  if (!orgId) return { matched: 0, modified: 0 };

  const $set = {};
  for (const field of BLOCK_LETTER_FIELDS) {
    $set[field] = {
      $let: {
        vars: { v: `$${field}` },
        in: {
          $cond: [
            { $eq: [{ $type: '$$v' }, 'string'] },
            {
              $toUpper: {
                $trim: {
                  input: {
                    $reduce: {
                      input: { $split: ['$$v', ' '] },
                      initialValue: '',
                      in: {
                        $concat: [
                          '$$value',
                          {
                            $cond: [
                              { $eq: ['$$value', ''] },
                              '',
                              ' ',
                            ],
                          },
                          '$$this',
                        ],
                      },
                    },
                  },
                },
              },
            },
            '$$v',
          ],
        },
      },
    };
  }

  $set.pan = {
    $cond: [
      { $eq: [{ $type: '$pan' }, 'string'] },
      {
        $toUpper: {
          $replaceAll: { input: { $ifNull: ['$pan', ''] }, find: ' ', replacement: '' },
        },
      },
      '$pan',
    ],
  };

  $set.email = {
    $cond: [
      { $eq: [{ $type: '$email' }, 'string'] },
      { $toLower: { $trim: { input: '$email' } } },
      '$email',
    ],
  };

  try {
    const result = await Candidate.updateMany(
      { organizationId: orgId },
      [{ $set }]
    );
    const matched = result.matchedCount || result.n || 0;
    const modified = result.modifiedCount || result.nModified || 0;
    if (modified) {
      logger.info({ orgId: String(orgId), matched, modified }, '[CASING] healed block letters');
    }
    return { matched, modified };
  } catch (err) {
    logger.warn({ err }, '[CASING] heal failed');
    return { matched: 0, modified: 0, error: err.message };
  }
}

function healCandidateBlockLettersSafe(orgId) {
  if (!orgId) return Promise.resolve({ matched: 0, modified: 0 });
  return healCandidateBlockLetters(orgId).catch((err) => {
    logger.warn({ err }, '[CASING] heal failed');
    return { matched: 0, modified: 0 };
  });
}

module.exports = {
  healCandidateBlockLetters,
  healCandidateBlockLettersSafe,
};
