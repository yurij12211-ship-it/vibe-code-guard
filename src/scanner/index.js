const { rules } = require('./rules');

const SKIP_DIRS = /(^|\/)(node_modules|dist|build|\.next|\.git|coverage|vendor)\//;
const MAX_FILE_BYTES = 200 * 1024;

function wantFile(path, size) {
  if (SKIP_DIRS.test(path)) return false;
  if (size && size > MAX_FILE_BYTES) return false;
  return /\.(js|jsx|ts|tsx|mjs|cjs|vue|svelte|sql|toml|json|ya?ml)$/i.test(path) ||
    /(^|\/)\.env(\.[a-z]+)?$/i.test(path);
}

function scanFiles(files) {
  const findings = [];
  for (const { path, content } of files) {
    for (const rule of rules) {
      for (const hit of rule.check(path, content)) {
        findings.push({
          ruleId: rule.id,
          title: rule.title,
          severity: rule.severity,
          path,
          line: hit.line,
          detail: hit.detail,
          fix: rule.fix,
        });
      }
    }
  }
  const order = { Critical: 0, High: 1, Medium: 2 };
  findings.sort((a, b) => order[a.severity] - order[b.severity] || a.path.localeCompare(b.path) || a.line - b.line);
  return findings;
}

function summarize(findings) {
  const counts = { Critical: 0, High: 0, Medium: 0 };
  findings.forEach((f) => { counts[f.severity] += 1; });
  const score = Math.max(0, 100 - counts.Critical * 30 - counts.High * 12 - counts.Medium * 4);
  return { counts, score, total: findings.length };
}

module.exports = { scanFiles, summarize, wantFile };
