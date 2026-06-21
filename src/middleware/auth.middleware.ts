import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedRequest extends Request {
  user?: {
    user_id: string;
    email: string;
    role: string;
  };
}

export const authenticateJWT = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: No token provided',
    });
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET || 'super-secret-key-change-in-production';

  try {
    const decoded = jwt.verify(token, secret) as {
      user_id: string;
      email: string;
      role: string;
    };
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Invalid or expired token',
    });
  }
};

export const requireRoles = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Authentication required',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Access restricted to roles: [${roles.join(', ')}]`,
      });
    }

    next();
  };
};

export const pageGuard = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const cookieHeader = req.headers.cookie;
    let token: string | null = null;
    if (cookieHeader) {
      const cookies = Object.fromEntries(
        cookieHeader.split(';').map((c) => {
          const parts = c.trim().split('=');
          return [parts[0], parts.slice(1).join('=')];
        })
      );
      token = cookies['cleanzy_token'] || null;
    }

    if (!token) {
      return res.redirect('/');
    }

    const secret = process.env.JWT_SECRET || 'super-secret-key-change-in-production';
    try {
      const decoded = jwt.verify(token, secret) as {
        user_id: string;
        email: string;
        role: string;
      };

      if (!allowedRoles.includes(decoded.role)) {
        if (decoded.role === 'User') {
          return res.redirect('/customer/dashboard');
        } else if (decoded.role === 'Worker') {
          return res.redirect('/worker/dashboard');
        } else if (decoded.role === 'Administrator') {
          return res.redirect('/admin/dashboard');
        } else {
          return res.redirect('/');
        }
      }
      next();
    } catch (err) {
      res.clearCookie('cleanzy_token');
      return res.redirect('/');
    }
  };
};

