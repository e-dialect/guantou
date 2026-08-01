#!/usr/bin/env node

const { execFileSync } = require('node:child_process');

const allowedTypes = [
  'feat',
  'fix',
  'docs',
  'test',
  'refactor',
  'build',
  'ci',
  'chore',
  'revert',
];

const pattern = new RegExp(
  `^(${allowedTypes.join('|')})(?:\\([A-Za-z0-9][A-Za-z0-9-]*\\))?!?: .+(?: \\(#\\d+\\))?$`
);
const noisyPrefixes = [/^fixup!/i, /^squash!/i, /^wip[: ]/i, /^merge /i];

function usage() {
  console.error('Usage: node scripts/check-commit-messages.js <base> <head>');
  console.error('Example: node scripts/check-commit-messages.js origin/main HEAD');
}

const [, , base, head] = process.argv;

if (!base || !head) {
  usage();
  process.exit(2);
}

let output = '';

try {
  output = execFileSync(
    'git',
    ['log', '--format=%H%x00%s', `${base}..${head}`],
    { encoding: 'utf8' }
  ).trim();
} catch (error) {
  console.error(`Failed to read commits for range ${base}..${head}.`);
  if (error.stderr) console.error(String(error.stderr));
  process.exit(2);
}

if (!output) {
  console.log(`No commits found in ${base}..${head}.`);
  process.exit(0);
}

const invalid = output
  .split('\n')
  .map((line) => {
    const [sha, subject] = line.split('\0');
    return { sha, subject };
  })
  .filter(({ subject }) => {
    if (!subject) return true;
    if (noisyPrefixes.some((prefix) => prefix.test(subject))) return true;
    return !pattern.test(subject);
  });

if (invalid.length === 0) {
  console.log(`Commit messages in ${base}..${head} are clean.`);
  process.exit(0);
}

console.error('Commit messages must use Conventional Commits style: type: summary or type(scope): summary');
console.error(`Allowed types: ${allowedTypes.join(', ')}`);
console.error('Examples: ci: cache workflow dependencies; feat(frontend): add can detail page');
console.error('');
console.error('Invalid commits:');
invalid.forEach(({ sha, subject }) => {
  console.error(`- ${sha.slice(0, 12)} ${subject}`);
});
console.error('');
console.error('Please rebase/squash the PR branch so commits describe only this change.');
process.exit(1);
