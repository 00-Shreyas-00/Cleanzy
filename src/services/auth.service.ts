import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';
import { BadRequestError } from '../errors/AppError';
import { UserRole } from '../constants/enums';

export interface RegisterDTO {
  name: string;
  email: string;
  phone: string;
  password: string;
  address: string;
  role?: string;
}

export interface RegisterWorkerDTO extends RegisterDTO {
  skill_type: string;
  location_coords: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export class AuthService {
  private static getJwtSecret(): string {
    return process.env.JWT_SECRET || 'super-secret-key-change-in-production';
  }

  static async registerUser(dto: RegisterDTO) {
    const { name, email, phone, password, address, role } = dto;

    if (!name || !email || !phone || !password || !address) {
      throw new BadRequestError('Missing required registration fields');
    }

    const finalRole = role && role === UserRole.WORKER ? UserRole.USER : (role || UserRole.USER);

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new BadRequestError('A user with this email already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

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

    return {
      message: `${finalRole} successfully registered`,
      data: {
        user_id: newUser.user_id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    };
  }

  static async registerWorker(dto: RegisterWorkerDTO) {
    const { name, email, phone, password, address, skill_type, location_coords } = dto;

    if (!name || !email || !phone || !password || !address || !skill_type || !location_coords) {
      throw new BadRequestError('Missing required worker registration fields');
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new BadRequestError('A user with this email already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          phone,
          password_hash: passwordHash,
          address,
          role: UserRole.WORKER,
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

    return {
      message: 'Worker and Staff profile successfully registered',
      data: {
        user_id: result.user.user_id,
        staff_id: result.staff.staff_id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
        skill_type: result.staff.skill_type,
      },
    };
  }

  static async login(dto: LoginDTO) {
    const { email, password } = dto;

    if (!email || !password) {
      throw new BadRequestError('Email and password are required');
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new BadRequestError('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw new BadRequestError('Invalid credentials');
    }

    const secret = this.getJwtSecret();
    const token = jwt.sign(
      {
        user_id: user.user_id,
        email: user.email,
        role: user.role,
      },
      secret,
      { expiresIn: '24h' }
    );

    return {
      message: 'Login successful',
      token,
      data: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }
}
