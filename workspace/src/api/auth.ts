import { Router, Request, Response } from 'express';
import { getConfig, setConfig } from '../db/index';
import { generateToken } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const router = Router();

function ensureAdminPassword(): string {
  let password = getConfig('admin.password');
  if (!password) {
    password = 'YZQ5201314..';
    setConfig('admin.password', password);
  }
  return password;
}

function getAdminPassword(): string {
  return getConfig('admin.password') || '';
}

router.post('/auth/login', (req: Request, res: Response) => {
  const { password } = req.body;

  if (!password) {
    res.status(400).json({ error: 'Password is required' });
    return;
  }

  const adminPassword = ensureAdminPassword();

  if (password !== adminPassword) {
    res.status(401).json({ error: 'Invalid password' });
    return;
  }

  const userId = 'admin';
  const token = generateToken(userId);

  res.json({
    token,
    userId,
    message: 'Login successful',
  });
});

router.put('/auth/password', (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'currentPassword and newPassword are required' });
    return;
  }

  const adminPassword = getAdminPassword();
  if (currentPassword !== adminPassword) {
    res.status(401).json({ error: '当前密码错误' });
    return;
  }

  setConfig('admin.password', newPassword);
  res.json({ success: true, message: '密码已修改' });
});

router.get('/auth/status', (req: Request, res: Response) => {
  res.json({
    authenticated: true,
    userId: (req as any).userId,
  });
});

router.post('/auth/qq-login', (req: Request, res: Response) => {
  const { code } = req.body;
  const clientId = getConfig('qq_oauth.client_id');
  const clientSecret = getConfig('qq_oauth.client_secret');
  const redirectUri = getConfig('qq_oauth.redirect_uri');

  if (!clientId || !clientSecret || !redirectUri) {
    res.status(400).json({ error: 'QQ OAuth not configured' });
    return;
  }

  // QQ互联OAuth在本地环境中需要配置回调域名
  // 此处为预留接口，实际实现需要对接QQ互联API
  if (!code) {
    res.status(400).json({ error: 'Authorization code required' });
    return;
  }

  res.json({
    message: 'QQ OAuth login interface reserved',
    configured: true,
  });
});

router.get('/auth/config', (req: Request, res: Response) => {
  res.json({
    hasAdminPassword: !!getAdminPassword(),
    qqOauthConfigured: !!getConfig('qq_oauth.client_id'),
  });
});

export default router;
