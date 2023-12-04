const meRouter = require('./me');
const devicesRouter = require('./devices');
const siteRouter = require('./site');

function route(app) {
	app.use('/me', meRouter);
	app.use('/devices', devicesRouter);

	app.use('/', siteRouter);
}

module.exports = route;
