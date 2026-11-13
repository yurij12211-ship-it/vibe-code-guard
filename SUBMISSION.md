# Codegeist 2026 submission draft: Vibe-Code Guard

**Video:** https://youtu.be/jumL6d8pv1s

**Category:** Apps for Software Teams
**Bonus prizes:** Best Rovo/Assignable agents (rovo:agent + actions), Best app with Atlassian MCP (rovo:mcp exposes the same tools)
**Repo:** https://github.com/yurij12211-ship-it/vibe-code-guard
**Installation link:** _(from developer console → Distribution, to be added)_

## Tagline
Security review for apps built with Lovable, Bolt, Replit and Cursor, inside Jira, with every hole turned into a tracked work item.

## Inspiration
AI app builders let anyone ship a Supabase + Stripe app in an afternoon. They also ship the same mistakes again and again: secret keys in the repo, the Supabase service_role key in browser code, tables without Row Level Security, RLS policies that say `(true)`, Stripe webhooks that never check the signature. Teams find out when the database leaks. These mistakes are predictable, so they can be caught before release, and the place where a team decides "ready to ship" is Jira.

## What it does
- **Jira issue panel:** paste a public GitHub URL, press Scan. The app reads the repository through the GitHub API, runs 9 deterministic rules and shows a score, severity, exact file:line links and a concrete fix for every finding.
- **One click to work items:** Critical and High findings become Jira work items linked to the parent issue, with labels `vibe-code-guard` and `severity-*`. A fingerprint label prevents duplicates on rescans ("Already tracked").
- **Rovo agent "Vibe-Code Security Guard":** ask in chat "Scan my Lovable app's repo" or "Create Jira work items for the critical findings". The agent calls the `scan-repository` and `create-security-issues` actions and explains each finding in plain language. It never invents findings: it only reports what the actions return.
- **MCP server:** the same two tools are exposed through `rovo:mcp`, so other agents can call the scanner.

Rules: hard-coded secrets (Stripe, OpenAI, Anthropic, AWS, GitHub, Resend), Supabase service_role JWT or env var in client code, tables without RLS, `(true)` policies, Stripe webhooks without `constructEvent`, committed `.env`, client-only admin checks, open Firebase rules, public storage buckets for user files.

## How we built it
Forge (nodejs22.x), UI Kit native issue panel (`@forge/react`), resolver functions, Forge KVS for the last scan per issue, `@forge/api` for Jira REST (create issue, issue link, JQL dedupe search), external fetch egress limited to `api.github.com` and `raw.githubusercontent.com`. Rules are deterministic regex/AST-free checks with unit tests, so the same repo always gives the same report. Deployed by GitHub Actions on every push (`forge deploy` + `forge install --upgrade`).

## Challenges
- Large repositories: we fetch the tree once and scan at most 80 files, riskiest first (SQL migrations, `.env`, webhook/auth/admin paths, then app code).
- False positives: `using (true)` is legitimate for public read-only data, so the RLS rule only flags write or all-operation policies.
- UI Kit runtime errors were invisible, so the panel is wrapped in an error boundary that shows the message instead of a blank panel.

## What we learned
Organizational context matters: a finding is only useful when it lands in the backlog of the team that owns the code, with an owner, severity and a link to the line.

## What's next
Private repositories through a GitHub app, Bitbucket support, a release gate that blocks a Jira version while Critical findings are open, and Marketplace listing.

---

## Demo video script (≤ 4:30)
1. **0:00–0:25 Problem.** Lovable/Bolt apps leak data through the same 5 mistakes. Show a news-style text slide, then the demo repo `examples/vulnerable-lovable-shop`.
2. **0:25–1:30 Issue panel.** Open KAN-1, paste the repo URL, Scan. Score, Critical/High/Medium, click a file:line link to GitHub.
3. **1:30–2:10 Work items.** Click "Create Jira work items". Show KAN-2..6 with labels and the "relates to" link. Rescan → "Already tracked".
4. **2:10–3:20 Rovo agent.** Open Rovo chat, pick Vibe-Code Security Guard, ask "Is my Supabase setup leaking data?" with the repo URL. Then "Create work items in KAN for critical findings".
5. **3:20–3:50 MCP.** Show the `rovo:mcp` module in the manifest and the tool list.
6. **3:50–4:20 Fix loop.** Fix one issue in the repo (enable RLS), rescan, score goes up.
7. **4:20–4:30 Close.** "Vibe-code fast. Ship safe."
