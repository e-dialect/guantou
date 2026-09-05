const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// PREVIEW_BASE is the H5 static mount path, for example /guantou-preview/.
// It does not select the backend API. Use VITE_BACKEND_URL for API requests.
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

function replaceBase() {
  if (!process.env.PREVIEW_BASE) return;

  const manifest = fs.readFileSync(manifestPath, 'utf8');
  if (!fs.existsSync(backupPath)) {
    fs.writeFileSync(backupPath, manifest);
  }
  fs.writeFileSync(
    manifestPath,
    withH5Base(manifest, normalizeBase(process.env.PREVIEW_BASE)),
  );
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

  try {
    replaceBase();
    const result = spawnSync(command, args, {
      stdio: 'inherit',
    });
    if (result.error) throw result.error;
    process.exitCode = result.status === null ? 1 : result.status;
  } finally {
    restoreBase();
  }
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
