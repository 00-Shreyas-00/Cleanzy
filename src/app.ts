import express from 'express';
import path from 'path';
import jwt from 'jsonwebtoken';
import authRoutes from './routes/auth.routes';
import profileRoutes from './routes/profile.routes';
import discoveryRoutes from './routes/discovery.routes';
import bookingRoutes from './routes/booking.routes';
import serviceRoutes from './routes/service.routes';
import portalRoutes from './routes/portal.routes';
import { errorHandler } from './middleware/error.middleware';
import { pageGuard } from './middleware/auth.middleware';

const app = express();

app.use(express.json());

// Helper to check token from cookies
const getCookieToken = (req: any): string | null => {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map((c: any) => {
      const parts = c.trim().split('=');
      return [parts[0], parts.slice(1).join('=')];
    })
  );
  return cookies['cleanzy_token'] || null;
};

// Root route logic - intercept logged in users
app.get('/', (req, res, next) => {
  const token = getCookieToken(req);
  if (token) {
    const secret = process.env.JWT_SECRET || 'super-secret-key-change-in-production';
    try {
      const decoded = jwt.verify(token, secret) as { role: string };
      if (decoded.role === 'User') {
        return res.redirect('/customer/dashboard');
      } else if (decoded.role === 'Worker') {
        return res.redirect('/worker/dashboard');
      } else if (decoded.role === 'Administrator') {
        return res.redirect('/admin/dashboard');
      }
    } catch (err) {
      res.clearCookie('cleanzy_token');
    }
  }
  next();
});

// Guarded dashboard views
app.get('/customer/dashboard', pageGuard(['User']), (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'pages', 'customer', 'dashboard.html'));
});

app.get('/worker/dashboard', pageGuard(['Worker']), (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'pages', 'worker', 'dashboard.html'));
});

app.get('/admin/dashboard', pageGuard(['Administrator']), (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'pages', 'admin', 'dashboard.html'));
});

// Wildcards / redirects
app.get('/customer', pageGuard(['User']), (req, res) => res.redirect('/customer/dashboard'));
app.get('/worker', pageGuard(['Worker']), (req, res) => res.redirect('/worker/dashboard'));
app.get('/admin', pageGuard(['Administrator']), (req, res) => res.redirect('/admin/dashboard'));

app.get('/customer/*', pageGuard(['User']), (req, res) => res.redirect('/customer/dashboard'));
app.get('/worker/*', pageGuard(['Worker']), (req, res) => res.redirect('/worker/dashboard'));
app.get('/admin/*', pageGuard(['Administrator']), (req, res) => res.redirect('/admin/dashboard'));

// Protect and serve assets under pages
app.use('/pages/customer', pageGuard(['User']), express.static(path.join(__dirname, '..', 'pages', 'customer')));
app.use('/pages/worker', pageGuard(['Worker']), express.static(path.join(__dirname, '..', 'pages', 'worker')));
app.use('/pages/admin', pageGuard(['Administrator']), express.static(path.join(__dirname, '..', 'pages', 'admin')));

app.use(express.static(path.join(__dirname, '..', 'public')));

// Mount routers
app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/discovery', discoveryRoutes);
app.use('/api', portalRoutes);
app.use('/api', bookingRoutes);

// General health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'UP',
  });
});

// Global error handler (must be registered last)
app.use(errorHandler);

export default app;
