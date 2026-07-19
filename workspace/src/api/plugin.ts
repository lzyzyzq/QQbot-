import { Router, Request, Response } from 'express';
import { getPluginEngine } from './index';
import * as fs from 'fs';
import * as path from 'path';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

const upload = multer({ dest: '/tmp/qqbot-uploads/', limits: { fileSize: 100 * 1024 * 1024 } });

function exportPluginToFile(pluginId: string, name: string, code: string) {
  try {
    const pluginsDir = path.resolve(process.cwd(), 'plugins');
    if (!fs.existsSync(pluginsDir)) fs.mkdirSync(pluginsDir, { recursive: true });
    const safeName = name.replace(/[^a-zA-Z0-9_\-\u4e00-\u9fff]/g, '_');
    const fileName = safeName + '.js';
    const filePath = path.join(pluginsDir, fileName);
    fs.writeFileSync(filePath, code, 'utf-8');
    console.log(`Plugin exported to ${filePath}`);
    return filePath;
  } catch (e: any) {
    console.error('Plugin export failed:', e.message);
    return null;
  }
}

const router = Router();

router.get('/plugins', (req: Request, res: Response) => {
  try {
    const engine = getPluginEngine();
    const plugins = engine.list();
    res.json(plugins);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/plugins', async (req: Request, res: Response) => {
  const { name, code, description } = req.body;

  if (!name || !code) {
    res.status(400).json({ error: 'name and code are required' });
    return;
  }

  try {
    const engine = getPluginEngine();
    const id = uuidv4();
    const plugin = await engine.loadFromCode(id, name, code, description || '');
    res.status(201).json(plugin);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/plugins/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, code, description } = req.body;

  if (!code) {
    res.status(400).json({ error: 'code is required' });
    return;
  }

  try {
    const engine = getPluginEngine();
    const plugin = await engine.loadFromCode(id, name || id, code, description || '');
    exportPluginToFile(id, name || id, code);
    res.json(plugin);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/plugins/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const engine = getPluginEngine();
    await engine.deletePlugin(id);
    res.json({ message: 'Plugin deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/plugins/:id/toggle', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const engine = getPluginEngine();
    const enabled = await engine.toggleEnabled(id);
    res.json({ id, enabled, message: enabled ? 'Plugin enabled' : 'Plugin disabled' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/plugins/:id/reload', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const engine = getPluginEngine();
    const plugin = await engine.reload(id);
    res.json(plugin);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/plugins/:id/code', (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const engine = getPluginEngine();
    const code = engine.getPluginCode(id);
    if (code === null) {
      res.status(404).json({ error: 'Plugin not found' });
      return;
    }
    res.json({ id, code });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/plugins/lookup/:name', (req: Request, res: Response) => {
  const { name } = req.params;
  try {
    const engine = getPluginEngine();
    const id = engine.findPluginByName(name);
    if (!id) {
      res.status(404).json({ error: 'Plugin not found' });
      return;
    }
    const config = engine.getPluginConfig(id);
    res.json({ id, name, config });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/plugins/:id/config', (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const engine = getPluginEngine();
    const config = engine.getPluginConfig(id);
    res.json(config);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/plugins/:id/config', (req: Request, res: Response) => {
  const { id } = req.params;
  const { key, value } = req.body;
  if (!key) {
    res.status(400).json({ error: 'key is required' });
    return;
  }
  try {
    const engine = getPluginEngine();
    engine.setPluginConfig(id, key, value);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/plugins/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }
    if (!file.originalname.toLowerCase().endsWith('.zip')) {
      res.status(400).json({ error: 'Only ZIP files are supported' });
      return;
    }

    const engine = getPluginEngine();
    const id = uuidv4();
    const plugin = await engine.createFromZip(id, file.path);

    try { fs.unlinkSync(file.path); } catch {}

    res.status(201).json(plugin);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/plugins/:id/webui', (req: Request, res: Response) => {
  const engine = getPluginEngine();
  const sourcePath = engine.getPluginSourcePath(req.params.id);
  if (!sourcePath) {
    res.status(404).json({ error: 'Plugin webui not found' });
    return;
  }
  const indexPath = path.join(sourcePath, 'webui', 'index.html');
  if (!fs.existsSync(indexPath)) {
    res.status(404).json({ error: 'WebUI index not found' });
    return;
  }
  res.sendFile(indexPath);
});

router.get('/plugins/:id/webui/*', (req: Request, res: Response) => {
  const engine = getPluginEngine();
  const sourcePath = engine.getPluginSourcePath(req.params.id);
  if (!sourcePath) {
    res.status(404).json({ error: 'Plugin webui not found' });
    return;
  }
  const subPath = req.params[0] || '';
  const filePath = path.join(sourcePath, 'webui', subPath);
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(sourcePath, 'webui'))) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }
  if (!fs.existsSync(resolved)) {
    res.status(404).json({ error: 'File not found' });
    return;
  }
  res.sendFile(resolved);
});

export default router;
