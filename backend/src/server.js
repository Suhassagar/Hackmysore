require('dotenv').config();
const app = require('./app');
const { initDb } = require('./config/db');
const { initFirebase } = require('./config/firebase');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    console.log('====================================================');
    console.log(' CIVICFLOW API — HACKMYSURU 1.0 (PHASE 1: AUTH & RBAC)');
    console.log('====================================================');

    // Initialize Database
    await initDb();

    // Initialize Firebase
    initFirebase();

    app.listen(PORT, () => {
      console.log(`[Server] CivicFlow API running on http://localhost:${PORT}`);
      console.log(`[Server] Health check: http://localhost:${PORT}/api/health`);
      console.log(`[Server] Current user: http://localhost:${PORT}/api/users/me`);
      console.log('====================================================');
    });
  } catch (err) {
    console.error('[Server] Failed to initialize server:', err);
    process.exit(1);
  }
}

startServer();
