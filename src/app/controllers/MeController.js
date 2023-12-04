const Device = require('../models/Device');
const { multipleMongooseToObject } = require('../../util/mongoose');

class MeController {
	// [GET] /me/stored/devices
	storedDevices(req, res, next) {
		let deviceQuery = Device.find({});

		if (req.query.hasOwnProperty('_sort')) {
			deviceQuery = deviceQuery.sort({
				[req.query.column]: req.query.type,
			});
		}

		Promise.all([deviceQuery, Device.countDocumentsDeleted()])
			.then(([devices, deletedCount]) =>
				res.render('me/stored-devices', {
					deletedCount,
					devices: multipleMongooseToObject(devices),
				}),
			)
			.catch(next);
	}

	// [GET] /me/trash/devices
	trashDevices(req, res, next) {
		Device.findDeleted({})
			.then((devices) =>
				res.render('me/trash-devices', {
					devices: multipleMongooseToObject(devices),
				}),
			)
			.catch(next);
	}
}

module.exports = new MeController();
