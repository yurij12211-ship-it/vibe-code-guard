-- Orders and customer profiles for the shop
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  total_cents integer not null,
  shipping_address text
);

create table public.profiles (
  id uuid primary key references auth.users,
  full_name text,
  phone text
);

alter table public.profiles enable row level security;
create policy "profiles are editable" on public.profiles for all using (true) with check (true);

insert into storage.buckets (id, name, public) values ('invoices', 'invoices', true);
