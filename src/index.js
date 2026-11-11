import Resolver from '@forge/resolver';
import { kvs } from '@forge/kvs';
import { fetchRepoFiles } from './github';
import { createIssuesForFindings } from './jira';
import { scanFiles, summarize } from './scanner';

async function runScan(repoUrl) {
  const repo = await fetchRepoFiles(repoUrl);
  const findings = scanFiles(repo.files);
  const summary = summarize(findings);
  const { files, ...repoInfo } = repo;
  return { repo: repoInfo, findings, summary, scannedAt: new Date().toISOString() };
}

const storageKey = (issueKey) => `scan:${issueKey}`;

// ---------- Issue panel (UI Kit) ----------
const resolver = new Resolver();

resolver.define('getLastScan', async ({ context }) => {
  const issueKey = context.extension.issue.key;
  return (await kvs.get(storageKey(issueKey))) || null;
});

resolver.define('scan', async ({ payload, context }) => {
  const issueKey = context.extension.issue.key;
  const result = await runScan(payload.repoUrl);
  await kvs.set(storageKey(issueKey), result);
  return result;
});

resolver.define('createIssues', async ({ payload, context }) => {
  const issueKey = context.extension.issue.key;
  const projectKey = context.extension.project.key;
  const last = await kvs.get(storageKey(issueKey));
  if (!last) throw new Error('Run a scan first.');
  const severities = payload.severities || ['Critical', 'High'];
  const findings = last.findings.filter((f) => severities.includes(f.severity));
  return createIssuesForFindings({ projectKey, findings, repo: last.repo, parentIssueKey: issueKey });
});

export const handler = resolver.getDefinitions();

// ---------- Rovo agent actions ----------
function formatReport(result, limit = 15) {
  const { repo, summary, findings } = result;
  const lines = [
    `Repository: ${repo.owner}/${repo.repo} (branch ${repo.branch}), ${repo.scannedFiles} files scanned${repo.truncated ? ' (large repo: riskiest 80 files)' : ''}.`,
    `Security score: ${summary.score}/100. Critical: ${summary.counts.Critical}, High: ${summary.counts.High}, Medium: ${summary.counts.Medium}.`,
  ];
  findings.slice(0, limit).forEach((f, i) => {
    lines.push(`${i + 1}. [${f.severity}] ${f.title} — ${f.path}:${f.line}. ${f.detail} Fix: ${f.fix}`);
  });
  if (findings.length > limit) lines.push(`…and ${findings.length - limit} more.`);
  if (!findings.length) lines.push('No known vibe-coding security issues found by the rule set.');
  return lines.join('\n');
}

export async function scanRepositoryAction(payload) {
  try {
    const result = await runScan(payload.repoUrl);
    return formatReport(result);
  } catch (e) {
    return `Scan failed: ${e.message}`;
  }
}

export async function createSecurityIssuesAction(payload) {
  try {
    const result = await runScan(payload.repoUrl);
    const minSeverity = (payload.minSeverity || 'High').toLowerCase();
    const allowed = minSeverity === 'medium' ? ['Critical', 'High', 'Medium'] : minSeverity === 'critical' ? ['Critical'] : ['Critical', 'High'];
    const findings = result.findings.filter((f) => allowed.includes(f.severity));
    if (!findings.length) return `No ${allowed.join('/')} findings in ${result.repo.owner}/${result.repo.repo}; nothing to create.`;
    const { created, skipped } = await createIssuesForFindings({ projectKey: payload.projectKey, findings, repo: result.repo });
    return `Created ${created.length} work item(s) in ${payload.projectKey}: ${created.join(', ') || 'none'}.` +
      (skipped.length ? ` Skipped ${skipped.length} already tracked: ${skipped.join(', ')}.` : '');
  } catch (e) {
    return `Could not create issues: ${e.message}`;
  }
}
