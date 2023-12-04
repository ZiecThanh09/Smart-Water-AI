const Device = require('../models/Device');
const { multipleMongooseToObject } = require('../../util/mongoose');

class SiteController {
	// [GET] /home
	home(req, res, next) {
		Device.find({})
			.then((devices) =>
				res.render('home', {
					devices: multipleMongooseToObject(devices),
					showSignInButton: true,
				}),
			)
			.catch(next);
	}

	// [GET] /search
	search(req, res) {
		res.render('search');
	}
}

module.exports = new SiteController();
