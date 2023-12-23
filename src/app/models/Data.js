const mongoose = require('mongoose');
const mongooseDelete = require('mongoose-delete');

const Schema = mongoose.Schema;

const Data = new Schema(
    {
        pH: { type: String, default: '' },
        temperature: { type: String, default: '' },
        conductivity: { type: String, default: '' },
        do: { type: String, default: '' },
        orp: { type: String, default: '' },
        tds: { type: String, default: '' },
    },
    {
        timestamps: true,
    },
);

// Add plugins
Data.plugin(mongooseDelete, {
    deletedAt: true,
    overrideMethods: 'all',
});

module.exports = mongoose.model('Data', Data);