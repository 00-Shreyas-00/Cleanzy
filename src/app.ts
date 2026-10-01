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
import { getCookieValue } from './utils/cookie';
import { UserRole } from './constants/enums';

const app = express();

app.use(express.json());

// Root route logic - intercept logged in users
app.get('/', (req, res, next) => {
  const token = getCookieValue(req, 'cleanzy_token');
  if (token) {
    const secret = process.env.JWT_SECRET || 'super-secret-key-change-in-production';
    try {
      const decoded = jwt.verify(token, secret) as { role: string };
      if (decoded.role === UserRole.USER) {
        return res.redirect('/customer/dashboard');
      } else if (decoded.role === UserRole.WORKER) {
        return res.redirect('/worker/dashboard');
      } else if (decoded.role === UserRole.ADMINISTRATOR) {
        return res.redirect('/admin/dashboard');
      }
    } catch (err) {
      res.clearCookie('cleanzy_token');
    }
  }
  next();
});

// Guarded dashboard views
app.get('/customer/dashboard', pageGuard([UserRole.USER]), (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'pages', 'customer', 'dashboard.html'));
});

app.get('/worker/dashboard', pageGuard([UserRole.WORKER]), (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'pages', 'worker', 'dashboard.html'));
});

app.get('/admin/dashboard', pageGuard([UserRole.ADMINISTRATOR]), (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'pages', 'admin', 'dashboard.html'));
});

// Wildcards / redirects
app.get('/customer', pageGuard([UserRole.USER]), (req, res) => res.redirect('/customer/dashboard'));
app.get('/worker', pageGuard([UserRole.WORKER]), (req, res) => res.redirect('/worker/dashboard'));
app.get('/admin', pageGuard([UserRole.ADMINISTRATOR]), (req, res) => res.redirect('/admin/dashboard'));

app.get('/customer/*', pageGuard([UserRole.USER]), (req, res) => res.redirect('/customer/dashboard'));
app.get('/worker/*', pageGuard([UserRole.WORKER]), (req, res) => res.redirect('/worker/dashboard'));
app.get('/admin/*', pageGuard([UserRole.ADMINISTRATOR]), (req, res) => res.redirect('/admin/dashboard'));

// Protect and serve assets under pages
app.use('/pages/customer', pageGuard([UserRole.USER]), express.static(path.join(__dirname, '..', 'pages', 'customer')));
app.use('/pages/worker', pageGuard([UserRole.WORKER]), express.static(path.join(__dirname, '..', 'pages', 'worker')));
app.use('/pages/admin', pageGuard([UserRole.ADMINISTRATOR]), express.static(path.join(__dirname, '..', 'pages', 'admin')));

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
