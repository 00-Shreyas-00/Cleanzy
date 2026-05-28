import { Response, NextFunction } from 'express';
import prisma from '../config/prisma';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

type Coordinates = {
  lat: number;
  lng: number;
};

const parseCoordinates = (value?: unknown): Coordinates | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const [latValue, lngValue] = value.split(',').map((part) => Number(part.trim()));

  if (!Number.isFinite(latValue) || !Number.isFinite(lngValue)) {
    return null;
  }

  return { lat: latValue, lng: lngValue };
};

const distanceInKm = (origin: Coordinates, destination: Coordinates): number => {
  const earthRadiusKm = 6371;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latDelta = toRadians(destination.lat - origin.lat);
  const lngDelta = toRadians(destination.lng - origin.lng);

  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(toRadians(origin.lat)) *
      Math.cos(toRadians(destination.lat)) *
      Math.sin(lngDelta / 2) ** 2;

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const searchServiceOptions = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { service_id, scheduled_time, location, client_location_coords } = req.body;

    if (!service_id || !scheduled_time || !location) {
      return res.status(400).json({
        success: false,
        error: 'service_id, scheduled_time, and location are required',
      });
    }

    const scheduledAt = new Date(scheduled_time);
    if (Number.isNaN(scheduledAt.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'scheduled_time must be a valid datetime',
      });
    }

    const service = await prisma.service.findUnique({
      where: { service_id },
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        error: 'Service not found',
      });
    }

    const clientCoords = parseCoordinates(client_location_coords);

    const staff = await prisma.staff.findMany({
      where: {
        availability: true,
        skill_type: service.service_name,
        bookings: {
          none: {
            scheduled_time: scheduledAt,
            status: {
              not: 'Cancelled',
            },
          },
        },
      },
      include: {
        user: {
          select: {
            user_id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    const choices = staff
      .map((worker) => {
        const workerCoords = parseCoordinates(worker.location_coords);
        const distance_km =
          clientCoords && workerCoords
            ? Number(distanceInKm(clientCoords, workerCoords).toFixed(2))
            : null;

        return {
          staff_id: worker.staff_id,
          worker: {
            user_id: worker.user.user_id,
            name: worker.user.name,
            email: worker.user.email,
            phone: worker.user.phone,
            rating: worker.rating,
            skill_type: worker.skill_type,
            availability: worker.availability,
            location_coords: worker.location_coords,
          },
          service: {
            service_id: service.service_id,
            service_name: service.service_name,
            description: service.description,
            base_price: service.base_price,
            duration_mins: service.duration_mins,
          },
          schedule: {
            scheduled_time: scheduledAt.toISOString(),
            duration_mins: service.duration_mins,
          },
          location,
          estimated_price: service.base_price,
          distance_km,
        };
      })
      .sort((left, right) => {
        if (left.distance_km !== null && right.distance_km !== null) {
          return left.distance_km - right.distance_km || right.worker.rating - left.worker.rating;
        }

        return right.worker.rating - left.worker.rating;
      });

    res.status(200).json({
      success: true,
      message: 'Booking choices generated successfully',
      data: {
        service,
        requested_schedule: scheduledAt.toISOString(),
        requested_location: location,
        choice_count: choices.length,
        choices,
      },
    });
  } catch (error) {
    next(error);
  }
};

