const jwt = require('jsonwebtoken');
const { requireAuthorizedSiteId, getAllowedSiteIdsForUser, isMasterAdmin } = require('./tenant');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

const adminMiddleware = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

// ---------- Multi-tenant: require site_id ----------
// Checks query params (GET) and request body (POST/PUT) for a non-empty site_id.
// Returns 400 if missing so downstream handlers can safely rely on it.
const requireSiteId = (req, res, next) => {
    const siteId = req.query.site_id || req.body?.site_id;
    if (!siteId || typeof siteId !== 'string' || siteId.trim() === '') {
        return res.status(400).json({ error: 'site_id is required' });
    }
    // Normalise and attach for easy access in route handlers
    req.siteId = siteId.trim();
    next();
};

module.exports = {
    authMiddleware,
    adminMiddleware,
    requireSiteId,
    requireAuthorizedSiteId,
    getAllowedSiteIdsForUser,
    isMasterAdmin,
    JWT_SECRET
};
