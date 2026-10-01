import { Response, NextFunction } from 'express';
import prisma from '../config/prisma';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { NotFoundError, UnauthorizedError } from '../errors/AppError';
import { UserRole } from '../constants/enums';

export const getProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.user_id;

    if (!userId) {
      throw new UnauthorizedError('Unauthorized: Access credentials missing');
    }

    const user = await prisma.user.findUnique({
      where: { user_id: userId },
      select: {
        user_id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        address: true,
        staff: true, // Includes staff profile if role = Worker
      },
    });

    if (!user) {
      throw new NotFoundError('User profile not found');
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.user_id;

    if (!userId) {
      throw new UnauthorizedError('Unauthorized: Access credentials missing');
    }

    const { name, phone, address, skill_type, availability, location_coords } = req.body;

    const user = await prisma.user.findUnique({
      where: { user_id: userId },
    });

    if (!user) {
      throw new NotFoundError('User profile not found');
    }

    // Atomic transaction to update both User and Staff (if Worker) profiles
    const updated = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { user_id: userId },
        data: {
          name: name || undefined,
          phone: phone || undefined,
          address: address || undefined,
        },
        select: {
          user_id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          address: true,
        },
      });

      let updatedStaff = null;
      if (user.role === UserRole.WORKER) {
        updatedStaff = await tx.staff.update({
          where: { user_id: userId },
          data: {
            skill_type: skill_type || undefined,
            availability: availability !== undefined ? availability : undefined,
            location_coords: location_coords || undefined,
          },
        });
      }

      return { user: updatedUser, staff: updatedStaff };
    });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        ...updated.user,
        staff: updated.staff,
      },
    });
  } catch (error) {
    next(error);
  }
};
