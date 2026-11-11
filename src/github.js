import api from '@forge/api';
import { wantFile } from './scanner';

const MAX_FILES = 80;

export function parseRepoUrl(input) {
  const s = String(input || '').trim().replace(/\.git$/, '').replace(/\/$/, '');
  const m = s.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)(?:\/tree\/([^\s]+))?/i) ||
    s.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (!m) throw new Error('Use a public GitHub repository URL, e.g. https://github.com/owner/repo');
  return { owner: m[1], repo: m[2], ref: m[3] || null };
}

async function getJson(url) {
  const res = await api.fetch(url, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'vibe-code-guard' } });
  if (res.status === 404) throw new Error('Repository not found or private. Only public GitHub repositories are supported.');
  if (res.status === 403) throw new Error('GitHub rate limit reached. Try again in a few minutes.');
  if (!res.ok) throw new Error(`GitHub API error ${res.status}`);
  return res.json();
}

export async function fetchRepoFiles(repoUrl) {
  const { owner, repo, ref } = parseRepoUrl(repoUrl);
  const meta = await getJson(`https://api.github.com/repos/${owner}/${repo}`);
  const branch = ref || meta.default_branch;
  const tree = await getJson(`https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
  const candidates = (tree.tree || [])
    .filter((n) => n.type === 'blob' && wantFile(n.path, n.size))
    .sort((a, b) => priority(a.path) - priority(b.path))
    .slice(0, MAX_FILES);

  const files = [];
  const batchSize = 20;
  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(async (n) => {
      const url = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${n.path.split('/').map(encodeURIComponent).join('/')}`;
      const res = await api.fetch(url, { headers: { 'User-Agent': 'vibe-code-guard' } });
      return res.ok ? { path: n.path, content: await res.text() } : null;
    }));
    results.forEach((r) => r && files.push(r));
  }
  return {
    owner, repo, branch,
    htmlUrl: meta.html_url,
    scannedFiles: files.length,
    truncated: candidates.length >= MAX_FILES,
    files,
  };
}

// Scan the riskiest places first so large repos still get the important files.
function priority(path) {
  if (/\.sql$/i.test(path)) return 0;
  if (/(^|\/)\.env/i.test(path)) return 0;
  if (/webhook|stripe|supabase|auth|admin/i.test(path)) return 1;
  if (/(^|\/)(src|app|pages|server|api|functions)\//.test(path)) return 2;
  return 3;
}
