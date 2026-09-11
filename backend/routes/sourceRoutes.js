const express = require('express');
const router = express.Router();
const { getSources, getAllSources, createSource, updateSource, deleteSource, seedSources } = require('../controller/sourceController');
const { verifyToken } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(verifyToken);

// Routes — /all must be before /:id
router.get('/all', getAllSources);
router.get('/', getSources);
router.post('/seed', seedSources);
router.post('/', createSource);
router.put('/:id', updateSource);
router.delete('/:id', deleteSource);

module.exports = router;
