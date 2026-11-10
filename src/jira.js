import api, { route } from '@forge/api';

const text = (t, marks) => ({ type: 'text', text: t, ...(marks ? { marks } : {}) });
const para = (...content) => ({ type: 'paragraph', content });

export function findingToAdf(f, repo) {
  const fileUrl = `${repo.htmlUrl}/blob/${repo.branch}/${f.path}#L${f.line}`;
  return {
    type: 'doc',
    version: 1,
    content: [
      para(text('Severity: ', [{ type: 'strong' }]), text(f.severity)),
      para(text('Where: ', [{ type: 'strong' }]), text(`${f.path}:${f.line}`, [{ type: 'link', attrs: { href: fileUrl } }])),
      para(text('Problem: ', [{ type: 'strong' }]), text(f.detail)),
      para(text('How to fix: ', [{ type: 'strong' }]), text(f.fix)),
      para(text(`Rule ${f.ruleId} · found by Vibe-Code Guard`, [{ type: 'em' }])),
    ],
  };
}

async function jira(path, opts = {}) {
  const res = await api.asApp().requestJira(path, {
    ...opts,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Jira ${res.status}: ${JSON.stringify(body && (body.errors || body.errorMessages) || body)}`);
  return body;
}

async function pickIssueType(projectKey) {
  const project = await jira(route`/rest/api/3/project/${projectKey}`);
  const types = (project.issueTypes || []).filter((t) => !t.subtask);
  const preferred = ['Bug', 'Task', 'Story'];
  for (const name of preferred) {
    const t = types.find((x) => x.name === name);
    if (t) return t.id;
  }
  if (!types.length) throw new Error(`Project ${projectKey} has no usable issue types`);
  return types[0].id;
}

// Creates one Jira work item per finding, skipping ones that already exist (same rule + file + line).
export async function createIssuesForFindings({ projectKey, findings, repo, parentIssueKey }) {
  const issueTypeId = await pickIssueType(projectKey);
  const created = [];
  const skipped = [];
  for (const f of findings) {
    const fingerprint = `vcg-${f.ruleId}-${f.path}-${f.line}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 250);
    const jql = `project = "${projectKey}" AND labels = "${fingerprint}"`;
    const existing = await jira(route`/rest/api/3/search/jql?jql=${jql}&maxResults=1&fields=key`);
    if (existing.issues && existing.issues.length) {
      skipped.push(existing.issues[0].key);
      continue;
    }
    const issue = await jira(route`/rest/api/3/issue`, {
      method: 'POST',
      body: JSON.stringify({
        fields: {
          project: { key: projectKey },
          issuetype: { id: issueTypeId },
          summary: `[${f.severity}] ${f.title} — ${f.path}:${f.line}`.slice(0, 250),
          description: findingToAdf(f, repo),
          labels: ['vibe-code-guard', `severity-${f.severity.toLowerCase()}`, fingerprint],
        },
      }),
    });
    created.push(issue.key);
    if (parentIssueKey) {
      await jira(route`/rest/api/3/issueLink`, {
        method: 'POST',
        body: JSON.stringify({
          type: { name: 'Relates' },
          inwardIssue: { key: parentIssueKey },
          outwardIssue: { key: issue.key },
        }),
      }).catch(() => {});
    }
  }
  return { created, skipped };
}
