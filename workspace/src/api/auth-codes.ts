import { Router } from 'express';
import { getDb } from '../db/index';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.get('/auth-codes', (_req, res) => {
  const db = getDb();
  const rows = db.prepare(
    'SELECT id, code, created_by, expires_at, is_permanent, used_by, used_at, created_at FROM auth_codes ORDER BY created_at DESC'
  ).all();
  res.json({ codes: rows });
});

router.post('/auth-codes', (req, res) => {
  const { expires_in_minutes } = req.body;
  const db = getDb();

  const id = uuidv4();
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();

  let expiresAt: string | null = null;
  let isPermanent = 1;

  if (expires_in_minutes && expires_in_minutes > 0) {
    isPermanent = 0;
    const d = new Date();
    d.setMinutes(d.getMinutes() + expires_in_minutes);
    expiresAt = d.toISOString();
  }

  db.prepare(
    'INSERT INTO auth_codes (id, code, created_by, expires_at, is_permanent, created_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\'))'
  ).run(id, code, 'admin', expiresAt, isPermanent);

  res.json({
    id,
    code,
    expires_at: expiresAt,
    is_permanent: !!isPermanent,
    expires_label: isPermanent ? '永久有效' : (expires_in_minutes + ' 分钟'),
  });
});

router.delete('/auth-codes/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM auth_codes WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
