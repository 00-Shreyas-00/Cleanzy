import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';

export const listServices = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const services = await prisma.service.findMany({
      orderBy: { service_name: 'asc' },
    });

    res.status(200).json({
      success: true,
      data: {
        services,
      },
    });
  } catch (error) {
    next(error);
  }
};

