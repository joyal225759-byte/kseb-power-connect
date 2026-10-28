
require('dotenv').config({
    path: require('path').join(__dirname, '.env')
});

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const outageRoutes = require('./routes/outageRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  'http://localhost:5173',
  'https://kseb-power-connect-ktbv.vercel.app'
];

app.use(cors({
  origin: allowedOrigins
}));
app.use(express.json());

// Main API route
app.get('/', (req, res) => {
    res.json({
        message: 'KSEB Power Connect API is running!'
    });
});

// Database health check
app.get('/api/health', (req, res) => {
    res.json({
        server: 'running',
        database: mongoose.connection.readyState === 1
            ? 'connected'
            : 'disconnected'
    });
});

// Connect the outage API routes
app.use('/api/auth', authRoutes);
app.use('/api/outages', outageRoutes);

// Connect to MongoDB Atlas
if (process.env.MONGODB_URI) {
    console.log('Attempting to connect to MongoDB Atlas...');

    mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000
    })
        .then(() => {
            console.log('MongoDB Atlas connected successfully');
        })
        .catch(err => {
            console.error('MongoDB connection error:', err.message);
        });
} else {
    console.log('MongoDB URI not configured yet.');
}

// Start the server
app.listen(PORT, () => {
    console.log(`KSEB API running at http://localhost:${PORT}`);
});


