const Device = require('../models/Device');
const { multipleMongooseToObject } = require('../../util/mongoose');

class SiteController {
	// [GET] /home
	home(req, res, next) {
		if (req.session.userName) {
			Device.find({}).then((devices) =>
				res.render('home', {
					devices: multipleMongooseToObject(devices),
					showSignInButton: false,
					givenName: req.session.userName,
				}),
			);
			console.log('USERNAME: ' + req.session.userName);
		} else {
			Device.find({})
				.then((devices) =>
					res.render('home', {
						devices: multipleMongooseToObject(devices),
						showSignInButton: true,
					}),
				)
				.catch(next);
		}
	}

	// [GET] /search
	search(req, res) {
		res.render('search');
	}
}

module.exports = new SiteController();
