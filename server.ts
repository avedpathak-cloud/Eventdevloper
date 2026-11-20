import express from 'express';
import {spawn, ChildProcess} from 'child_process';
import http from 'http';
import path from 'path';
import fs from 'fs';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PYTHON_PORT = Number(process.env.PYTHON_BACKEND_PORT || 8000);
const PORT = Number(process.env.PORT || 3000);

let pythonProc: ChildProcess | null = null;

function startPythonBackend() {
  const scriptPath = path.join(__dirname, 'backend', 'app.py');
  pythonProc = spawn('python3', [scriptPath], {
    env: {...process.env, PYTHON_BACKEND_PORT: String(PYTHON_PORT)},
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  pythonProc.stdout?.on('data', (d) => process.stdout.write(`[python] ${d}`));
  pythonProc.stderr?.on('data', (d) => process.stderr.write(`[python-err] ${d}`));
  pythonProc.on('exit', (code) => {
    console.error(`[python] exited with code ${code}`);
  });
}

function waitForPython(retries = 25): Promise<void> {
  return new Promise((resolve) => {
    const attempt = (n: number) => {
      const req = http.get(`http://127.0.0.1:${PYTHON_PORT}/api/health`, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (n <= 0) {
          resolve();
        } else {
          setTimeout(() => attempt(n - 1), 150);
        }
      });
    };
    attempt(retries);
  });
}

async function main() {
  startPythonBackend();
  await waitForPython();

  const app = express();

  // Proxy all /api/* requests directly to the Python 3.11 backend
  app.use('/api', (req, res) => {
    const targetUrl = `/api${req.url}`;
    const proxyReq = http.request(
      {
        hostname: '127.0.0.1',
        port: PYTHON_PORT,
        path: targetUrl,
        method: req.method,
        headers: req.headers,
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
        proxyRes.pipe(res, {end: true});
      }
    );
    proxyReq.on('error', (err) => {
      res.status(502).json({error: `Python backend unreachable: ${err.message}`});
    });
    req.pipe(proxyReq, {end: true});
  });

  if (process.env.NODE_ENV !== 'production') {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build not found');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT} (Python API on :${PYTHON_PORT})`);
  });
}

process.on('SIGTERM', () => {
  pythonProc?.kill();
  process.exit(0);
});
process.on('SIGINT', () => {
  pythonProc?.kill();
  process.exit(0);
});

main();
