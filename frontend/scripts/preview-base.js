const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, '..', 'src', 'manifest.json');
const mode = process.argv[2];
const originalBase = '/__REPLACE_PREVIEW_BASE__/';
const nextBase = process.env.PREVIEW_BASE || '/';

const manifest = fs.readFileSync(manifestPath, 'utf8');

if (mode === 'replace') {
  fs.writeFileSync(
    manifestPath,
    manifest.replaceAll(originalBase, nextBase),
  );
} else if (mode === 'restore') {
  fs.writeFileSync(
    manifestPath,
    manifest
      .replace(/"base"\s*:\s*"[^"]*"/, '"base" : "/__REPLACE_PREVIEW_BASE__/"')
      .replace(
        /"publicPath"\s*:\s*"[^"]*"/,
        '"publicPath" : "/__REPLACE_PREVIEW_BASE__/"',
      ),
  );
} else {
  throw new Error('Usage: node scripts/preview-base.js replace|restore');
}
