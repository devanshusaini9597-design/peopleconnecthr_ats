const express = require('express');
const router = express.Router();
const { getClients, getAllClients, createClient, updateClient, deleteClient } = require('../controller/clientController');
const { verifyToken } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(verifyToken);

// Routes — /all must be before /:id
router.get('/all', getAllClients);
router.get('/', getClients);
router.post('/', createClient);
router.put('/:id', updateClient);
router.delete('/:id', deleteClient);

module.exports = router;
