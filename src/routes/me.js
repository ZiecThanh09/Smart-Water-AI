const express = require('express');
const router = express.Router();

const meController = require('../app/controllers/MeController');

router.get('/stored/devices', meController.storedDevices);
router.get('/trash/devices', meController.trashDevices);

module.exports = router;
