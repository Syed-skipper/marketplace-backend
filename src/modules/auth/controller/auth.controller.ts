import { Request, Response } from 'express';
import { AuthService } from '../service/auth.service';
import { sendSuccess } from '../../../common/utils/response.util';
import { env } from '../../../config/env';

export class AuthController {
  constructor(private readonly service = new AuthService()) {}

  register = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.register(req.body);
    sendSuccess(res, result, 'Registration successful', 201);
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const { email, password, device } = req.body;
    const result = await this.service.login(email, password, {
      device,
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });

    res.cookie('refreshToken', result.tokens.refreshToken, {
      httpOnly: true,
      secure: env.COOKIE_SECURE,
      sameSite: env.COOKIE_SAME_SITE,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    sendSuccess(res, { user: result.user, accessToken: result.tokens.accessToken, expiresIn: result.tokens.expiresIn });
  };

  refresh = async (req: Request, res: Response): Promise<void> => {
    const token = req.body.refreshToken ?? req.cookies?.refreshToken;
    const tokens = await this.service.refresh(token, {
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: env.COOKIE_SECURE,
      sameSite: env.COOKIE_SAME_SITE,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    sendSuccess(res, { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn });
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    await this.service.logout(req.cookies?.refreshToken, req.user?.sub);
    res.clearCookie('refreshToken');
    sendSuccess(res, null, 'Logged out successfully');
  };

  logoutAll = async (req: Request, res: Response): Promise<void> => {
    await this.service.logoutAllDevices(req.user!.sub);
    res.clearCookie('refreshToken');
    sendSuccess(res, null, 'Logged out from all devices');
  };

  forgotPassword = async (req: Request, res: Response): Promise<void> => {
    await this.service.forgotPassword(req.body.email);
    sendSuccess(res, null, 'If the email exists, a reset link has been sent');
  };

  resetPassword = async (req: Request, res: Response): Promise<void> => {
    await this.service.resetPassword(req.body.token, req.body.password);
    sendSuccess(res, null, 'Password reset successful');
  };

  verifyEmail = async (req: Request, res: Response): Promise<void> => {
    await this.service.verifyEmail(req.params.token);
    sendSuccess(res, null, 'Email verified successfully');
  };

  changePassword = async (req: Request, res: Response): Promise<void> => {
    await this.service.changePassword(req.user!.sub, req.body.currentPassword, req.body.newPassword);
    sendSuccess(res, null, 'Password changed successfully');
  };

  assignRole = async (req: Request, res: Response): Promise<void> => {
    await this.service.assignRole(req.body.userId, req.body.roleName);
    sendSuccess(res, null, 'Role assigned successfully');
  };
}
