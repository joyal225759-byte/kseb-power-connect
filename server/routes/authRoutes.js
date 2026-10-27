
const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

router.post('/login', (req, res) => {
    const { username, password } = req.body || {};

    // Ensure the server's admin credentials are configured
    if (
        !process.env.ADMIN_USERNAME ||
        !process.env.ADMIN_PASSWORD ||
        !process.env.JWT_SECRET
    ) {
        return res.status(500).json({
            message: 'Admin authentication is not configured.'
        });
    }

    if (typeof username !== 'string' || typeof password !== 'string') {
        return res.status(400).json({
            message: 'Username and password are required.'
        });
    }

    // Verify the submitted credentials
    if (
        username !== process.env.ADMIN_USERNAME ||
        password !== process.env.ADMIN_PASSWORD
    ) {
        return res.status(401).json({
            message: 'Invalid username or password.'
        });
    }

    // Issue a token that expires after two hours
    const token = jwt.sign(
        {
            username: process.env.ADMIN_USERNAME,
            role: 'admin'
        },
        process.env.JWT_SECRET,
        { expiresIn: '2h' }
    );

    res.json({
        message: 'Login successful.',
        token,
        username: process.env.ADMIN_USERNAME
    });
});

module.exports = router;
