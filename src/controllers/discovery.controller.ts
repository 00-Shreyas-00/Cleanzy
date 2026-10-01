import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { DiscoveryService } from '../services/discovery.service';

export const searchServiceOptions = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { service_id, scheduled_time, location, client_location_coords } = req.body;

    const data = await DiscoveryService.searchServiceOptions({
      service_id,
      scheduled_time,
      location,
      client_location_coords,
    });

    res.status(200).json({
      success: true,
      message: 'Booking choices generated successfully',
      data,
    });
  } catch (error) {
    next(error);
  }
};
