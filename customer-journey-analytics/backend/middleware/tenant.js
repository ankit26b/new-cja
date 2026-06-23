const pool = require('../config/db');

const isMasterAdmin = (user) => user?.role === 'admin';

const getAllowedSiteIdsForUser = async (userId) => {
  const result = await pool.query(
    `SELECT site_id FROM user_sites WHERE user_id = $1`,
    [userId]
  );

  return result.rows.map((row) => row.site_id);
};

const requireAuthorizedSiteId = async (req, res, next) => {
  const siteId = req.query.site_id || req.body?.site_id;

  if (!siteId || typeof siteId !== 'string' || siteId.trim() === '') {
    return res.status(400).json({ error: 'site_id is required' });
  }

  const normalizedSiteId = siteId.trim();

  if (isMasterAdmin(req.user)) {
    req.siteId = normalizedSiteId;
    req.allowedSiteIds = null;
    return next();
  }

  try {
    const allowedSiteIds = await getAllowedSiteIdsForUser(req.user.id);

    if (!allowedSiteIds.includes(normalizedSiteId)) {
      return res.status(403).json({ error: 'Access denied for selected site' });
    }

    req.siteId = normalizedSiteId;
    req.allowedSiteIds = allowedSiteIds;
    return next();
  } catch (error) {
    console.error('Site authorization error:', error);
    return res.status(500).json({ error: 'Failed to validate site access' });
  }
};

module.exports = {
  isMasterAdmin,
  getAllowedSiteIdsForUser,
  requireAuthorizedSiteId,
};
