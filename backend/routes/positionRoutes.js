const express = require('express');
const router = express.Router();
const { getPositions, getAllPositions, createPosition, updatePosition, deletePosition, seedPositions } = require('../controller/positionController');
const { verifyToken } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(verifyToken);

// Routes — /all must be before /:id
router.get('/all', getAllPositions);
router.get('/', getPositions);
router.post('/seed', seedPositions);
router.post('/', createPosition);
router.put('/:id', updatePosition);
router.delete('/:id', deletePosition);

module.exports = router;
