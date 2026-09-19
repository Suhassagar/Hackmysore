/**
 * Role-Based Access Control Middleware Factory
 * Enforces that req.user.role (determined on server) is in allowedRoles.
 *
 * Must be mounted AFTER requireAuth.
 *
 * @param  {...string} allowedRoles - e.g. 'CITIZEN', 'STAFF', 'ADMIN'
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    // 1. Guard against mounting without requireAuth
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required before role verification',
      });
    }

    const userRole = req.user.role;

    // 2. Enforce role match
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Access denied. Endpoint requires one of roles [${allowedRoles.join(', ')}], but current user role is '${userRole}'.`,
        requiredRoles: allowedRoles,
        userRole,
      });
    }

    next();
  };
}

module.exports = { requireRole };
