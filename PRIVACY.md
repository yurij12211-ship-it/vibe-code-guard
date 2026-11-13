# Vibe-Code Guard privacy policy

Last updated: 13 November 2026

Vibe-Code Guard is a Forge app for Jira. This page describes what data the app handles.

## What the app processes
- The public GitHub repository URL you enter in the panel, and the contents of that public repository, which the app reads through the GitHub API (`api.github.com`, `raw.githubusercontent.com`) to run its security rules.
- The result of the last scan for each Jira work item (repository name, findings with file, line and rule), stored in Forge hosted storage inside Atlassian's infrastructure so the panel can show it again.
- When you ask it to, the app creates Jira work items in your site for Critical and High findings.

## What the app does not do
- It does not collect or store personal data, account IDs or user profiles.
- It does not send your Jira data to any third party. The only external services it calls are the GitHub endpoints above, and only with the repository you entered.
- It has no analytics or tracking.

## Data retention and removal
Scan results stay in Forge storage until the next scan of the same work item replaces them. Uninstalling the app removes its stored data according to Atlassian Forge's data lifecycle.

## Contact
Questions or requests: open an issue at https://github.com/yurij12211-ship-it/vibe-code-guard/issues
