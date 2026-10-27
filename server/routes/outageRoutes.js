const { requireAuth } = require('../middleware/authMiddleware');
const express = require('express');
const mongoose = require('mongoose');
const Outage = require('../models/Outage');

const router = express.Router();

// GET: Retrieve all outages
router.get('/', async (req, res) => {
    try {
        const outages = await Outage.find().sort({ updatedAt: -1 });
        res.json(outages);
    } catch (err) {
        res.status(500).json({ message: 'Failed to retrieve outages.' });
    }
});

// GET: Retrieve one outage by ID
router.get('/:id', async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: 'Invalid outage ID.' });
        }

        const outage = await Outage.findById(req.params.id);

        if (!outage) {
            return res.status(404).json({ message: 'Outage not found.' });
        }

        res.json(outage);
    } catch (err) {
        res.status(500).json({ message: 'Failed to retrieve outage.' });
    }
});

// POST: Create a new outage
router.post('/', requireAuth, async (req, res) => {
    try {
        const { area, status, description, scheduledTime } = req.body;

        const outage = await Outage.create({
            area,
            status,
            description,
            scheduledTime
        });

        res.status(201).json(outage);
    } catch (err) {
        res.status(400).json({
            message: 'Could not create outage. Check the required fields and status.'
        });
    }
});

// PUT: Update an existing outage
router.put('/:id', requireAuth, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: 'Invalid outage ID.' });
        }

        const updates = {};
        const allowedFields = ['area', 'status', 'description', 'scheduledTime'];

        for (const field of allowedFields) {
            if (Object.prototype.hasOwnProperty.call(req.body, field)) {
                updates[field] = req.body[field];
            }
        }

        const outage = await Outage.findByIdAndUpdate(
            req.params.id,
            updates,
            { new: true, runValidators: true }
        );

        if (!outage) {
            return res.status(404).json({ message: 'Outage not found.' });
        }

        res.json(outage);
    } catch (err) {
        res.status(400).json({ message: 'Could not update outage.' });
    }
});

// DELETE: Delete an outage by ID
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: 'Invalid outage ID.' });
        }

        const outage = await Outage.findByIdAndDelete(req.params.id);

        if (!outage) {
            return res.status(404).json({ message: 'Outage not found.' });
        }

        res.json({ message: 'Outage deleted successfully.' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete outage.' });
    }
});

module.exports = router;
