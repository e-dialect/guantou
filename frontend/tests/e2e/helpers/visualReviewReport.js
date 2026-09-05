import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_OUTPUT = path.resolve(process.cwd(), '../output/playwright/v2-visual-review');

export const visualReviewOutput = path.resolve(
  process.env.VISUAL_REVIEW_OUTPUT || DEFAULT_OUTPUT,
);

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export async function prepareVisualReviewOutput() {
  await mkdir(visualReviewOutput, { recursive: true });
  await Promise.all(['routes', 'core', 'states'].map((group) => (
    mkdir(path.join(visualReviewOutput, group), { recursive: true })
  )));
}

export function visualScreenshotPath(group, filename) {
  return path.join(visualReviewOutput, group, `${filename}.png`);
}

export async function writeVisualReviewReport(artifacts, metadata = {}) {
  const ordered = [...artifacts].sort((left, right) => (
    left.group.localeCompare(right.group) || left.name.localeCompare(right.name)
  ));
  const manifest = {
    schemaVersion: 1,
    viewport: { width: 390, height: 844 },
    ...metadata,
    artifactCount: ordered.length,
    artifacts: ordered,
  };
  await writeFile(
    path.join(visualReviewOutput, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );

  const cards = ordered.map((artifact) => `
    <article class="card">
      <a href="${escapeHtml(artifact.screenshot)}">
        <img src="${escapeHtml(artifact.screenshot)}" alt="${escapeHtml(artifact.name)}">
      </a>
      <div class="copy">
        <strong>${escapeHtml(artifact.name)}</strong>
        <span>${escapeHtml(artifact.group)} · ${escapeHtml(artifact.theme)} · ${escapeHtml(artifact.persona)}</span>
        <code>${escapeHtml(artifact.actualPath || artifact.target)}</code>
        <span>责任：${escapeHtml(artifact.responsibility)}</span>
      </div>
    </article>`).join('');

  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>V2 全站视觉巡检</title>
  <style>
    :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
    body { margin: 0; padding: 24px; background: Canvas; color: CanvasText; }
    header { max-width: 960px; margin: 0 auto 24px; }
    h1 { margin: 0 0 8px; font-size: 24px; }
    p { margin: 0; color: GrayText; line-height: 1.6; }
    main { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; }
    .card { overflow: hidden; border: 1px solid color-mix(in srgb, CanvasText 18%, transparent); border-radius: 14px; background: Canvas; }
    img { display: block; width: 100%; aspect-ratio: 390 / 844; object-fit: cover; object-position: top; background: color-mix(in srgb, CanvasText 5%, Canvas); }
    .copy { display: grid; gap: 6px; padding: 12px; }
    .copy span, .copy code { color: GrayText; font-size: 12px; overflow-wrap: anywhere; }
  </style>
</head>
<body>
  <header>
    <h1>V2 全站视觉巡检</h1>
    <p>390×844；${ordered.length} 张截图。先按责任 Issue 看结构漂移，再核对明暗主题、身份和状态差异。</p>
  </header>
  <main>${cards}
  </main>
</body>
</html>
`;
  await writeFile(path.join(visualReviewOutput, 'index.html'), html, 'utf8');
}
