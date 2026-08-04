const express = require('express');
const router = express.Router();
const {
  getItems,
  getAllItems,
  seedItems,
  createItem,
  updateItem,
  deleteItem,
} = require('../controller/orgListController');
const { verifyToken } = require('../middleware/authMiddleware');

router.use(verifyToken);

// /api/org-lists/:listKey/...
router.get('/:listKey/all', getAllItems);
router.post('/:listKey/seed', seedItems);
router.get('/:listKey', getItems);
router.post('/:listKey', createItem);
router.put('/:listKey/:id', updateItem);
router.delete('/:listKey/:id', deleteItem);

module.exports = router;
