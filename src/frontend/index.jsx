import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Button, ButtonGroup, DynamicTable, Inline, Lozenge, SectionMessage, Spinner, Stack, Text, Textfield, Link,
} from '@forge/react';
import { invoke } from '@forge/bridge';

const appearance = { Critical: 'removed', High: 'moved', Medium: 'default' };

function Summary({ result }) {
  const { summary, repo } = result;
  const tone = summary.counts.Critical ? 'error' : summary.counts.High ? 'warning' : 'success';
  return (
    <SectionMessage appearance={tone} title={`Security score ${summary.score}/100`}>
      <Text>
        {repo.owner}/{repo.repo} · {repo.scannedFiles} files · Critical {summary.counts.Critical} · High {summary.counts.High} · Medium {summary.counts.Medium}
      </Text>
    </SectionMessage>
  );
}

function Findings({ findings, repo }) {
  if (!findings.length) return <Text>No known vibe-coding security issues found.</Text>;
  const rows = findings.map((f, i) => ({
    key: `${i}`,
    cells: [
      { key: 's', content: <Lozenge appearance={appearance[f.severity]}>{f.severity}</Lozenge> },
      { key: 't', content: <Text>{f.title}</Text> },
      { key: 'p', content: <Link href={`${repo.htmlUrl}/blob/${repo.branch}/${f.path}#L${f.line}`} openNewTab>{`${f.path}:${f.line}`}</Link> },
      { key: 'f', content: <Text>{f.fix}</Text> },
    ],
  }));
  return (
    <DynamicTable
      head={{ cells: [{ key: 's', content: 'Severity' }, { key: 't', content: 'Issue' }, { key: 'p', content: 'Location' }, { key: 'f', content: 'Fix' }] }}
      rows={rows}
      rowsPerPage={10}
    />
  );
}

const App = () => {
  const [repoUrl, setRepoUrl] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [created, setCreated] = useState(null);

  useEffect(() => {
    invoke('getLastScan').then((r) => { if (r) { setResult(r); setRepoUrl(r.repo.htmlUrl); } });
  }, []);

  const scan = async () => {
    setBusy(true); setError(null); setCreated(null);
    try { setResult(await invoke('scan', { repoUrl })); } catch (e) { setError(e.message); }
    setBusy(false);
  };

  const fileIssues = async () => {
    setBusy(true); setError(null);
    try { setCreated(await invoke('createIssues', { severities: ['Critical', 'High'] })); } catch (e) { setError(e.message); }
    setBusy(false);
  };

  return (
    <Stack space="space.200">
      <Text>Scan an app built with Lovable, Bolt, Replit or Cursor for the security holes AI builders leave behind.</Text>
      <Inline space="space.100" alignBlock="end">
        <Textfield name="repoUrl" placeholder="https://github.com/owner/repo" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} />
        <Button appearance="primary" onClick={scan} isDisabled={busy || !repoUrl}>Scan</Button>
      </Inline>
      {busy && <Spinner label="Scanning" />}
      {error && <SectionMessage appearance="error"><Text>{error}</Text></SectionMessage>}
      {result && (
        <Stack space="space.150">
          <Summary result={result} />
          <Findings findings={result.findings} repo={result.repo} />
          {result.findings.some((f) => f.severity !== 'Medium') && (
            <ButtonGroup>
              <Button onClick={fileIssues} isDisabled={busy}>Create Jira work items for Critical and High</Button>
            </ButtonGroup>
          )}
          {created && (
            <SectionMessage appearance="success">
              <Text>Created {created.created.length}: {created.created.join(', ') || '—'}{created.skipped.length ? `. Already tracked: ${created.skipped.join(', ')}` : ''}</Text>
            </SectionMessage>
          )}
        </Stack>
      )}
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
