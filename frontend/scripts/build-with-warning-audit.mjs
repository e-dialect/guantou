import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const uniCli = path.join(
  frontendRoot,
  'node_modules',
  '@dcloudio',
  'vite-plugin-uni',
  'bin',
  'uni.js',
);

const knownThemeChunkModules = new Set([
  'themeApi.js',
  'themeCenter.js',
  'themeSchema.js',
]);

const ansiPattern = /\u001b\[[0-9;]*m/g;
const warningPattern = /(^|\W)(warning|warnings|deprecated|deprecation)(\W|$)/i;

export function auditBuildOutput(rawOutput, target) {
  const allowed = [];
  const violations = [];
  const seenThemeChunkModules = new Set();

  String(rawOutput || '')
    .replace(ansiPattern, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      if (line.includes('[plugin:vite:reporter]')) return;

      if (
        line.includes('is dynamically imported by')
        && line.includes('dynamic import will not move module into another chunk')
      ) {
        const match = line.match(/[\\/]src[\\/]services[\\/](theme(?:Api|Center|Schema)\.js)/);
        const moduleName = match?.[1] || '';
        if (
          target === 'h5'
          && knownThemeChunkModules.has(moduleName)
          && !seenThemeChunkModules.has(moduleName)
        ) {
          seenThemeChunkModules.add(moduleName);
          allowed.push({ issue: '#328', kind: 'theme-chunk', module: moduleName });
          return;
        }
        violations.push(line);
        return;
      }

      if (line.includes('uni-app 有新版本发布')) {
        allowed.push({ issue: '#353', kind: 'uni-app-update' });
        return;
      }

      if (line.includes('(!)') || line.includes('Browserslist:') || warningPattern.test(line)) {
        violations.push(line);
      }
    });

  return { allowed, violations };
}

function targetCommand(target) {
  if (target === 'h5') {
    return {
      args: [
        path.join(frontendRoot, 'scripts', 'preview-base.js'),
        'run',
        '--',
        process.execPath,
        uniCli,
        'build',
      ],
      command: process.execPath,
    };
  }
  if (target === 'mp-weixin') {
    return {
      args: [uniCli, 'build', '-p', 'mp-weixin'],
      command: process.execPath,
    };
  }
  throw new Error(`Unknown build target: ${target || '(missing)'}`);
}

export function runCheckedBuild(target) {
  const { command, args } = targetCommand(target);
  const result = spawnSync(command, args, {
    cwd: frontendRoot,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 16 * 1024 * 1024,
  });
  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  process.stdout.write(stdout);
  process.stderr.write(stderr);

  if (result.error) throw result.error;
  if (result.status !== 0) return result.status || 1;

  const audit = auditBuildOutput(`${stdout}\n${stderr}`, target);
  if (audit.violations.length) {
    process.stderr.write(
      `\n[build-warning-audit] ${target} introduced unexpected warnings:\n${audit.violations.map((line) => `- ${line}`).join('\n')}\n`,
    );
    return 1;
  }

  const allowedSummary = audit.allowed.length
    ? audit.allowed.map((item) => `${item.issue}:${item.kind}${item.module ? `:${item.module}` : ''}`).join(', ')
    : 'none';
  process.stdout.write(`\n[build-warning-audit] ${target} passed; tracked notices: ${allowedSummary}\n`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = runCheckedBuild(process.argv[2]);
  } catch (error) {
    process.stderr.write(`[build-warning-audit] ${error.message}\n`);
    process.exitCode = 1;
  }
}
