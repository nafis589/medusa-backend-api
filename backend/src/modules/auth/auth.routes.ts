import { Router } from 'express';
import type { z } from 'zod';
import { AuthService } from './auth.service';
import { UserRepository } from './user.repository';
import { authenticate } from '@shared/middlewares/authenticate';
import { validate } from '@shared/middlewares/validate';
import { AppError } from '@shared/errors/app-error';
import {
  RegisterSchema,
  LoginSchema,
  RefreshSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
} from './auth.schema';

const router = Router();
const userRepository = new UserRepository();
const authService = new AuthService(userRepository);

/**
 * POST /api/store/auth/register
 */
router.post('/register', validate(RegisterSchema), async (req, res, next) => {
  try {
    const { email, password, first_name, last_name } = req.body as z.infer<typeof RegisterSchema>;
    const result = await authService.register({
      email,
      password,
      first_name,
      last_name,
      role: 'BUYER',
    });
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/store/auth/login
 */
router.post('/login', validate(LoginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body as z.infer<typeof LoginSchema>;
    const result = await authService.login(email, password);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/store/auth/refresh
 */
router.post('/refresh', validate(RefreshSchema), async (req, res, next) => {
  try {
    const { refreshToken } = req.body as z.infer<typeof RefreshSchema>;
    const result = await authService.refreshToken(refreshToken);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/store/auth/logout
 */
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      next(new AppError(401, 'UNAUTHORIZED', 'No token provided'));
      return;
    }
    const token = authHeader.slice(7);
    await authService.logout(token);
    res.json({ data: { message: 'Déconnecté avec succès' } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/store/auth/forgot-password
 * Always returns 200 to protect privacy.
 */
router.post('/forgot-password', validate(ForgotPasswordSchema), async (req, res, next) => {
  try {
    const { email } = req.body as z.infer<typeof ForgotPasswordSchema>;
    try {
      await authService.forgotPassword(email);
    } catch (err) {
      // Hide USER_NOT_FOUND status/errors to prevent email enumeration
      if (err instanceof AppError && err.code === 'USER_NOT_FOUND') {
        // Suppress and continue
      } else {
        throw err;
      }
    }
    res.json({
      data: { message: "Si l'adresse e-mail existe, un e-mail de réinitialisation a été envoyé." },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/store/auth/reset-password
 */
router.post('/reset-password', validate(ResetPasswordSchema), async (req, res, next) => {
  try {
    const { token, password } = req.body as z.infer<typeof ResetPasswordSchema>;
    await authService.resetPassword(token, password);
    res.json({ data: { message: 'Mot de passe réinitialisé avec succès' } });
  } catch (err) {
    next(err);
  }
});

export default router;
