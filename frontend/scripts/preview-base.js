const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// PREVIEW_BASE is the H5 static mount path, for example /guantou-preview/.
// H5_DEV_SERVER_PORT overrides h5.devServer.port for an isolated local run.
// Neither setting selects the backend API. Use VITE_BACKEND_URL for API requests.
const manifestPath = path.join(__dirname, '..', 'src', 'manifest.json');
const backupPath = path.join(
  __dirname,
  '..',
  'src',
  'manifest.preview-base.backup.json',
);
const mode = process.argv[2];

function normalizeBase(value) {
  const rawBase = (value || '/').trim().replace(/\\/g, '/');
  if (!rawBase) return '/';
  const leadingSlashBase = rawBase.startsWith('/') ? rawBase : `/${rawBase}`;
  return leadingSlashBase.endsWith('/') ? leadingSlashBase : `${leadingSlashBase}/`;
}

function withH5Base(manifest, base) {
  const parsedManifest = JSON.parse(manifest);
  if (!parsedManifest.h5 || !parsedManifest.h5.router) {
    throw new Error(
      'Could not find h5.router.base and h5.publicPath in manifest.json',
    );
  }

  parsedManifest.h5.router.base = base;
  parsedManifest.h5.publicPath = base;
  return `${JSON.stringify(parsedManifest, null, 4)}\n`;
}

function withH5DevServerPort(manifest, value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid H5_DEV_SERVER_PORT: ${value}`);
  }

  const parsedManifest = JSON.parse(manifest);
  parsedManifest.h5 = parsedManifest.h5 || {};
  parsedManifest.h5.devServer = parsedManifest.h5.devServer || {};
  parsedManifest.h5.devServer.port = port;
  return `${JSON.stringify(parsedManifest, null, 4)}\n`;
}

function replaceBase() {
  if (!process.env.PREVIEW_BASE && !process.env.H5_DEV_SERVER_PORT) return;

  const manifest = fs.readFileSync(manifestPath, 'utf8');
  if (!fs.existsSync(backupPath)) {
    fs.writeFileSync(backupPath, manifest);
  }
  let nextManifest = manifest;
  if (process.env.PREVIEW_BASE) {
    nextManifest = withH5Base(
      nextManifest,
      normalizeBase(process.env.PREVIEW_BASE),
    );
  }
  if (process.env.H5_DEV_SERVER_PORT) {
    nextManifest = withH5DevServerPort(
      nextManifest,
      process.env.H5_DEV_SERVER_PORT,
    );
  }
  fs.writeFileSync(manifestPath, nextManifest);
}

function restoreBase() {
  if (!fs.existsSync(backupPath)) return;
  fs.copyFileSync(backupPath, manifestPath);
  fs.unlinkSync(backupPath);
}

function runWithPreviewBase() {
  const separatorIndex = process.argv.indexOf('--');
  const commandArgs = separatorIndex === -1
    ? []
    : process.argv.slice(separatorIndex + 1);
  if (commandArgs.length === 0) {
    throw new Error(
      'Usage: node scripts/preview-base.js run -- <command> [args...]',
    );
  }

  let [command, ...args] = commandArgs;
  if (process.platform === 'win32' && command === 'uni') {
    command = process.execPath;
    args = [
      path.join(
        __dirname,
        '..',
        'node_modules',
        '@dcloudio',
        'vite-plugin-uni',
        'bin',
        'uni.js',
      ),
      ...args,
    ];
  }

  let child;
  try {
    replaceBase();
    child = spawn(command, args, {
      stdio: 'inherit',
    });
  } catch (error) {
    restoreBase();
    throw error;
  }

  const signalHandlers = new Map();
  const cleanup = () => {
    signalHandlers.forEach((handler, signal) => {
      process.off(signal, handler);
    });
    restoreBase();
  };

  ['SIGINT', 'SIGTERM', 'SIGHUP'].forEach((signal) => {
    const handler = () => {
      if (!child.killed) child.kill(signal);
    };
    signalHandlers.set(signal, handler);
    process.on(signal, handler);
  });

  child.once('error', (error) => {
    cleanup();
    process.stderr.write(`${error.stack || error.message || error}\n`);
    process.exitCode = 1;
  });
  child.once('exit', (code, signal) => {
    cleanup();
    if (code !== null) {
      process.exitCode = code;
    } else if (signal === 'SIGINT') {
      process.exitCode = 130;
    } else if (signal === 'SIGTERM') {
      process.exitCode = 143;
    } else {
      process.exitCode = 1;
    }
  });
}

if (mode === 'replace') {
  replaceBase();
} else if (mode === 'restore') {
  restoreBase();
} else if (mode === 'run') {
  runWithPreviewBase();
} else {
  throw new Error('Usage: node scripts/preview-base.js replace|restore|run');
}
