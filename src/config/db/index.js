const mongoose = require('mongoose');

async function connect() {
	try {
		await mongoose.connect('mongodb+srv://ziecthanh:ayern741563@smart-water.k1zqdip.mongodb.net/smart-water?retryWrites=true&w=majority', {
			useNewUrlParser: true,
			useUnifiedTopology: true,
		});
		console.log('Connect successfully!');
	} catch (error) {
		console.log('Connect failed!');
	}
}

module.exports = { connect };
