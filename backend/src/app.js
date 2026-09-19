const express = require('express');
const cors = require('cors');
const path = require('path');
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const reportsRoutes = require('./routes/reports');
const jurisdictionsRoutes = require('./routes/jurisdictions');
const routingRoutes = require('./routes/routing');
const staffRoutes = require('./routes/staff');

const app = express();

// Enable CORS for frontend development
app.use(cors({
  origin: true,
  credentials: true,
}));

// Body parser with 10MB limit for media attachments
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static media files for uploaded civic evidence
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Request logging (sanitized, no credentials)
app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.originalUrl}`);
  next();
});

// Mount Routes
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/jurisdictions', jurisdictionsRoutes);
app.use('/api/routing', routingRoutes);
app.use('/api/staff', staffRoutes);

// Root Service Info & Frontend Link
app.get('/', (req, res) => {
  if (req.accepts('html')) {
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>CivicFlow API</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
            .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 2rem; max-width: 520px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
            h1 { font-size: 1.5rem; margin-bottom: 0.5rem; color: #60a5fa; }
            p { color: #94a3b8; font-size: 0.95rem; line-height: 1.5; }
            .btn { display: inline-block; background: #2563eb; color: #fff; padding: 0.75rem 1.5rem; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 1rem; transition: background 0.2s; }
            .btn:hover { background: #1d4ed8; }
            .badge { display: inline-block; background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid #10b981; padding: 0.2rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; margin-top: 0.5rem; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>CivicFlow API Server</h1>
            <div><span class="badge">Backend Running on Port 5000</span></div>
            <p style="margin-top: 1rem;">This is the REST API backend. The web user interface is running on <strong>http://localhost:3000</strong>.</p>
            <a href="http://localhost:3000" class="btn">Open CivicFlow Frontend &rarr;</a>
          </div>
        </body>
      </html>
    `);
  }

  res.json({
    service: 'CivicFlow — Unified Civic Incident & Accountability Platform API',
    status: 'online',
    version: '1.0.0',
    frontendUrl: 'http://localhost:3000',
    endpoints: {
      health: 'GET /api/health',
      currentUser: 'GET /api/users/me',
      devLogin: 'POST /api/auth/dev-login',
      reports: 'GET /api/reports/my | POST /api/reports | GET /api/reports/:id',
      aiAnalysis: 'POST /api/reports/:id/analyze | GET /api/reports/:id/analysis',
      jurisdictions: 'POST /api/jurisdictions/resolve | GET /api/reports/:id/jurisdiction',
      routing: 'POST /api/routing/resolve | GET /api/reports/:id/routing',
    },
  });
});

// 404 Not Found Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `The requested endpoint '${req.originalUrl}' does not exist on CivicFlow API.`,
  });
});

// Global Error Handler (Clean user-facing errors, no stack traces leaked)
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  const status = err.status || 500;
  res.status(status).json({
    error: status === 500 ? 'Internal Server Error' : 'Request Error',
    message: err.message || 'An unexpected error occurred.',
  });
});

module.exports = app;
