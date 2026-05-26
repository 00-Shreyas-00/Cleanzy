import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, phone, password, address, role } = req.body;

    if (!name || !email || !phone || !password || !address) {
      return res.status(400).json({
        success: false,
        error: 'Missing required registration fields',
      });
    }

    // Worker registrations must go through the dedicated register-worker endpoint
    const finalRole = role && role === 'Worker' ? 'User' : (role || 'User');

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'A user with this email already exists',
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        password_hash: passwordHash,
        address,
        role: finalRole,
      },
    });

    res.status(201).json({
      success: true,
      message: `${finalRole} successfully registered`,
      data: {
        user_id: newUser.user_id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const registerWorker = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, phone, password, address, skill_type, location_coords } = req.body;

    if (!name || !email || !phone || !password || !address || !skill_type || !location_coords) {
      return res.status(400).json({
        success: false,
        error: 'Missing required worker registration fields',
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'A user with this email already exists',
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Execute atomic transaction for User and Staff profile creation
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          phone,
          password_hash: passwordHash,
          address,
          role: 'Worker',
        },
      });

      const staff = await tx.staff.create({
        data: {
          user_id: user.user_id,
          skill_type,
          location_coords,
          availability: true,
          rating: 5.0,
        },
      });

      return { user, staff };
    });

    res.status(201).json({
      success: true,
      message: 'Worker and Staff profile successfully registered',
      data: {
        user_id: result.user.user_id,
        staff_id: result.staff.staff_id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
        skill_type: result.staff.skill_type,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
      });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    // Sign JWT
    const secret = process.env.JWT_SECRET || 'super-secret-key-change-in-production';
    const token = jwt.sign(
      {
        user_id: user.user_id,
        email: user.email,
        role: user.role,
      },
      secret,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      data: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};
