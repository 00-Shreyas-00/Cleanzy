import express from 'express';
import authRoutes from './routes/auth.routes';
import profileRoutes from './routes/profile.routes';
import discoveryRoutes from './routes/discovery.routes';
import bookingRoutes from './routes/booking.routes';
import { errorHandler } from './middleware/error.middleware';

const app = express();

app.use(express.json());

// Mount routers
app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/discovery', discoveryRoutes);
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
