const assert = require('node:assert');
const test = require('node:test');
const { scanFiles, summarize, wantFile } = require('../src/scanner');

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const serviceJwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ iss: 'supabase', role: 'service_role' })}.abcdefghijklmnopqrstuvwxyz012345`;
const anonJwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ iss: 'supabase', role: 'anon' })}.abcdefghijklmnopqrstuvwxyz012345`;

const vulnerable = [
  { path: 'supabase/migrations/001_init.sql', content: `create table public.notes (id uuid primary key, user_id uuid, body text);\ncreate table public.profiles (id uuid primary key);\nalter table public.profiles enable row level security;\ncreate policy "all" on public.profiles for all using (true);\n` },
  { path: 'src/lib/supabase.ts', content: `export const supabase = createClient(url, "${serviceJwt}");\n` },
  { path: 'src/pages/Admin.tsx', content: `if (user.email === "boss@shop.com") { showAdmin() }\n` },
  { path: 'supabase/functions/stripe-webhook/index.ts', content: `import Stripe from "stripe";\nconst event = await req.json();\nif (event.type === "checkout.session.completed") { await markPaid(); }\n` },
  { path: 'server/pay.js', content: `const stripe = require('stripe')('sk_live_${'a'.repeat(24)}');\n` },
  { path: '.env', content: 'SUPABASE_URL=https://x.supabase.co\nOPENAI_API_KEY=abc\n' },
  { path: 'firestore.rules', content: 'service cloud.firestore {\n match /{doc=**} {\n  allow read, write: if true;\n }\n}\n' },
  { path: 'supabase/migrations/002_storage.sql', content: "insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);\n" },
];

const safe = [
  { path: 'supabase/migrations/001_init.sql', content: `create table public.notes (id uuid primary key, user_id uuid default auth.uid());\nalter table public.notes enable row level security;\ncreate policy "own" on public.notes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);\n` },
  { path: 'src/lib/supabase.ts', content: `export const supabase = createClient(url, "${anonJwt}");\n` },
  { path: 'supabase/functions/stripe-webhook/index.ts', content: `import Stripe from "stripe";\nconst event = await stripe.webhooks.constructEventAsync(body, sig, secret);\nif (event.type === "checkout.session.completed") {}\n` },
  { path: '.env.example', content: 'STRIPE_SECRET_KEY=\n' },
];

test('finds every planted issue', () => {
  const f = scanFiles(vulnerable);
  const ids = new Set(f.map((x) => x.ruleId));
  for (const id of ['VCG001', 'VCG002', 'VCG003', 'VCG004', 'VCG005', 'VCG006', 'VCG007', 'VCG008', 'VCG009']) {
    assert.ok(ids.has(id), `missing ${id}`);
  }
  assert.strictEqual(f[0].severity, 'Critical');
  const s = summarize(f);
  assert.ok(s.score < 50);
});

test('clean project has no findings', () => {
  const f = scanFiles(safe);
  assert.deepStrictEqual(f, []);
  assert.strictEqual(summarize(f).score, 100);
});

test('file filter', () => {
  assert.ok(wantFile('src/a.tsx', 100));
  assert.ok(wantFile('.env', 10));
  assert.ok(!wantFile('node_modules/x/a.js', 10));
  assert.ok(!wantFile('src/logo.png', 10));
  assert.ok(wantFile('firestore.rules', 10));
});
