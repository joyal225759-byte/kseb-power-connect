
const mongoose = require('mongoose');

const outageSchema = new mongoose.Schema({
    area: {
        type: String,
        required: true,
        trim: true
    },

    status: {
        type: String,
        required: true,
        enum: ['Power Cut', 'Maintenance', 'Available']
    },

    description: {
        type: String,
        default: ''
    },

    scheduledTime: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Outage', outageSchema);
