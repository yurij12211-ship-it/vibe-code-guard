# Vibe-Code Guard

A Forge app for Jira that reviews apps built with AI coding tools (Lovable, Bolt, Replit, Cursor) for the security holes they usually ship with, and turns the findings into Jira work items.

AI builders produce working apps in minutes, but the same mistakes repeat: secret keys committed to the repo, the Supabase `service_role` key in browser code, tables without Row Level Security, RLS policies that use `(true)`, Stripe webhooks that never verify the signature. Vibe-Code Guard checks a public GitHub repository for these patterns, scores it, and files the fixes where the team already works.

## What it includes

- **Rovo agent "Vibe-Code Security Guard"**: ask "scan github.com/acme/shop" in Rovo chat and get a scored report with file, line, risk and fix. Ask it to track the problems and it creates Jira work items.
- **Jira issue panel**: paste a repo URL on any work item, scan, and create linked work items for Critical and High findings in one click. Duplicate findings are detected by a fingerprint label, so rescans never create the same item twice.
- **Rovo MCP server**: the same two tools (`scan-repository`, `create-security-issues`) exposed through the `rovo:mcp` module.

## Rules

| ID | Severity | Check |
|---|---|---|
| VCG001 | Critical | Hard-coded secret keys (Stripe live, OpenAI, Anthropic, AWS, GitHub, Resend) |
| VCG002 | Critical | Supabase `service_role` JWT committed, or referenced from client code |
| VCG003 | High | `create table` in a migration without `enable row level security` |
| VCG004 | High | RLS policy with `using (true)` / `with check (true)` for writes |
| VCG005 | High | Stripe webhook handler without `stripe.webhooks.constructEvent` |
| VCG006 | High | `.env` file committed |
| VCG007 | Medium | Admin or role checks done only in browser code |

The rules are deterministic: the same repository always gets the same report, and every finding points to a file and line. The agent explains and prioritises; it never invents findings.

## Development

```
npm install
npm test          # scanner unit tests
forge deploy
forge install --product jira
```

Deployment from GitHub Actions needs the repository secrets `FORGE_EMAIL`, `FORGE_API_TOKEN` and `FORGE_SITE` (e.g. `your-site.atlassian.net`).

## License

MIT
