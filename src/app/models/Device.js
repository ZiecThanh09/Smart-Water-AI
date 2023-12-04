const mongoose = require('mongoose');
const slug = require('mongoose-slug-generator');
const mongooseDelete = require('mongoose-delete');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const Schema = mongoose.Schema;

const Device = new Schema(
	{
		_id: { type: Number },
		name: { type: String, required: true },
		location: { type: String, required: true },
		battery: { type: String, default: '' },
		pH: { type: String, default: '' },
		temperature: { type: String, default: '' },
		conductivity: { type: String, default: '' },
		do: { type: String, default: '' },
		orp: { type: String, default: '' },
		slug: { type: String, slug: 'name', unique: true },
	},
	{
		_id: false,
		timestamps: true,
	},
);

// Add plugins
mongoose.plugin(slug);

Device.plugin(AutoIncrement);

Device.plugin(mongooseDelete, {
	deletedAt: true,
	overrideMethods: 'all',
});

module.exports = mongoose.model('Device', Device);
