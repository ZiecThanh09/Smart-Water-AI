const express = require('express');
const router = express.Router();

const deviceController = require('../app/controllers/DeviceController');

router.get('/create', deviceController.create);
router.post('/store', deviceController.store);
router.get('/:id/edit', deviceController.edit);
router.post('/handle-form-actions', deviceController.handleFormActions);
router.put('/:id', deviceController.update);
router.patch('/:id/restore', deviceController.restore);
router.delete('/:id', deviceController.delete);
router.delete('/:id/force', deviceController.forceDelete);
router.get('/:slug', deviceController.show);

module.exports = router;
