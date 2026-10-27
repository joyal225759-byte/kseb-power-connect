
const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
    if (!process.env.JWT_SECRET) {
        return res.status(500).json({
            message: 'Authentication is not configured.'
        });
    }

    const authorization = req.headers.authorization || '';

    if (!authorization.startsWith('Bearer ')) {
        return res.status(401).json({
            message: 'Please log in as an admin.'
        });
    }

    const token = authorization.slice(7);

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.role !== 'admin') {
            return res.status(403).json({
                message: 'Admin access required.'
            });
        }

        req.user = decoded;
        next();
    } catch {
        return res.status(401).json({
            message: 'Invalid or expired login token. Please log in again.'
        });
    }
}

module.exports = { requireAuth };
