import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await AuthService.registerUser(req.body);
    res.status(201).json({
      success: true,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    next(error);
  }
};

export const registerWorker = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await AuthService.registerWorker(req.body);
    res.status(201).json({
      success: true,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await AuthService.login(req.body);
    res.status(200).json({
      success: true,
      message: result.message,
      token: result.token,
      data: result.data,
    });
  } catch (error) {
    next(error);
  }
};
