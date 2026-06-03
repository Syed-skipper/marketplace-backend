import { Router } from 'express';
import { AuthController } from '../controller/auth.controller';
import { asyncHandler } from '../../../common/utils/async-handler';
import { validate } from '../../../common/middlewares/validate.middleware';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  assignRoleSchema,
} from '../validator/auth.validator';
import { authenticate, hasRole } from '../../../common/middlewares/auth.middleware';

const router = Router();
const controller = new AuthController();

/**
 * @openapi
 * /api/v1/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register new customer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, firstName, lastName]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               firstName: { type: string }
 *               lastName: { type: string }
 *     responses:
 *       201:
 *         description: User registered
 */
router.post('/register', validate(registerSchema), asyncHandler(controller.register));
router.post('/login', validate(loginSchema), asyncHandler(controller.login));
router.post('/refresh', validate(refreshSchema), asyncHandler(controller.refresh));
router.post('/logout', authenticate, asyncHandler(controller.logout));
router.post('/logout-all', authenticate, asyncHandler(controller.logoutAll));
router.post('/forgot-password', validate(forgotPasswordSchema), asyncHandler(controller.forgotPassword));
router.post('/reset-password', validate(resetPasswordSchema), asyncHandler(controller.resetPassword));
router.get('/verify-email/:token', asyncHandler(controller.verifyEmail));
router.post('/change-password', authenticate, validate(changePasswordSchema), asyncHandler(controller.changePassword));
router.post('/assign-role', authenticate, hasRole('admin'), validate(assignRoleSchema), asyncHandler(controller.assignRole));

export default router;
