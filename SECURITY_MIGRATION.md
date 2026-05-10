# Supabase SQL Migration — Self-Hosted (Idempotent)

העתק את כל הבלוק הבא, הדבק ב־**Supabase Studio → SQL Editor** והרץ פעם אחת. 
הסקריפט בטוח להרצה חוזרת — לא יזרוק שגיאות אם משהו כבר קיים.

```sql
-- =========================================================================
-- ATELIER STORE — full schema, RLS and storage policies (idempotent)
-- Tested on Supabase self-hosted (PostgreSQL 15+)
-- =========================================================================

-- 0. EXTENSIONS -----------------------------------------------------------
create extension if not exists pgcrypto;

-- 1. ENUM TYPES (safe creation) -------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin', 'customer');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type public.order_status as enum
      ('pending','paid','processing','shipped','delivered','cancelled');
  end if;
end $$;

-- 2. TABLES ---------------------------------------------------------------

-- profiles
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  phone       text,
  address     jsonb,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.profiles add column if not exists email      text;
alter table public.profiles add column if not exists full_name  text;
alter table public.profiles add column if not exists phone      text;
alter table public.profiles add column if not exists address    jsonb;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

-- user_roles (separate table — never store roles on profiles)
create table if not exists public.user_roles (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role    public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

-- categories
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  image_url  text,
  created_at timestamptz not null default now()
);

-- products
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique,
  description text,
  price       numeric(10,2) not null default 0,
  sale_price  numeric(10,2),
  images      text[] not null default '{}',
  category_id uuid references public.categories(id) on delete set null,
  featured    boolean not null default false,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.products add column if not exists images     text[] not null default '{}';
alter table public.products add column if not exists sale_price numeric(10,2);
alter table public.products add column if not exists featured   boolean not null default false;
alter table public.products add column if not exists active     boolean not null default true;

-- product_variants
create table if not exists public.product_variants (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  size       text,
  color      text,
  stock      integer not null default 0,
  sku        text,
  created_at timestamptz not null default now()
);

-- orders
create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete set null,
  total            numeric(10,2) not null default 0,
  status           public.order_status not null default 'pending',
  shipping_address jsonb,
  payment_method   text,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- order_items
create table if not exists public.order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  name       text,
  quantity   integer not null default 1,
  price      numeric(10,2) not null default 0
);

-- conversations
create table if not exists public.conversations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  subject         text,
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

-- messages
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid references auth.users(id) on delete set null,
  is_admin        boolean not null default false,
  body            text not null,
  read_by_user    boolean not null default false,
  read_by_admin   boolean not null default false,
  created_at      timestamptz not null default now()
);

-- store_settings (single row, id=1)
create table if not exists public.store_settings (
  id                       integer primary key default 1,
  shipping_methods         jsonb not null default '[]',
  payment_methods          jsonb not null default '[]',
  free_shipping_threshold  numeric(10,2),
  currency                 text not null default 'USD',
  updated_at               timestamptz not null default now(),
  constraint store_settings_singleton check (id = 1)
);
insert into public.store_settings (id) values (1) on conflict (id) do nothing;

-- Add hero/carousel columns for homepage management (idempotent)
alter table public.store_settings add column if not exists hero jsonb;
alter table public.store_settings add column if not exists carousel_images jsonb not null default '[]';

-- 3. SECURITY DEFINER FUNCTION (avoids recursive RLS) ---------------------
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

-- 4. AUTO-CREATE PROFILE ON SIGNUP ----------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do nothing;

  -- default role: customer
  insert into public.user_roles (user_id, role)
  values (new.id, 'customer')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 5. updated_at trigger ---------------------------------------------------
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists set_updated_at_profiles on public.profiles;
create trigger set_updated_at_profiles before update on public.profiles
for each row execute function public.tg_set_updated_at();

drop trigger if exists set_updated_at_products on public.products;
create trigger set_updated_at_products before update on public.products
for each row execute function public.tg_set_updated_at();

drop trigger if exists set_updated_at_orders on public.orders;
create trigger set_updated_at_orders before update on public.orders
for each row execute function public.tg_set_updated_at();

-- 6. ENABLE RLS -----------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.user_roles       enable row level security;
alter table public.categories       enable row level security;
alter table public.products         enable row level security;
alter table public.product_variants enable row level security;
alter table public.orders           enable row level security;
alter table public.order_items      enable row level security;
alter table public.conversations    enable row level security;
alter table public.messages         enable row level security;
alter table public.store_settings   enable row level security;

-- 6b. ENABLE REALTIME -----------------------------------------------------
-- Add tables to the supabase_realtime publication so the browser receives
-- INSERT / UPDATE / DELETE events. Idempotent: skip if already a member.
do $$
declare t text;
begin
  for t in select unnest(array[
    'products','product_variants','categories','store_settings',
    'orders','order_items','conversations','messages','profiles'
  ]) loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Ensure full row payload on UPDATE/DELETE so filters work correctly
alter table public.products         replica identity full;
alter table public.product_variants replica identity full;
alter table public.categories       replica identity full;
alter table public.store_settings   replica identity full;
alter table public.orders           replica identity full;
alter table public.messages         replica identity full;
alter table public.conversations    replica identity full;
alter table public.profiles         replica identity full;

-- 7. RLS POLICIES ---------------------------------------------------------
-- profiles
drop policy if exists "profiles self select" on public.profiles;
create policy "profiles self select" on public.profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists "profiles self upsert" on public.profiles;
create policy "profiles self upsert" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "profiles admin all" on public.profiles;
create policy "profiles admin all" on public.profiles
  for all to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- user_roles
drop policy if exists "user_roles self select" on public.user_roles;
create policy "user_roles self select" on public.user_roles
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "user_roles admin all" on public.user_roles;
create policy "user_roles admin all" on public.user_roles
  for all to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- categories: public read, admin write
drop policy if exists "categories public read" on public.categories;
create policy "categories public read" on public.categories
  for select to anon, authenticated using (true);

drop policy if exists "categories admin write" on public.categories;
create policy "categories admin write" on public.categories
  for all to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- products: public read active, admin all
drop policy if exists "products public read" on public.products;
create policy "products public read" on public.products
  for select to anon, authenticated using (active = true or public.has_role(auth.uid(),'admin'));

drop policy if exists "products admin write" on public.products;
create policy "products admin write" on public.products
  for all to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- product_variants
drop policy if exists "variants public read" on public.product_variants;
create policy "variants public read" on public.product_variants
  for select to anon, authenticated using (true);

drop policy if exists "variants admin write" on public.product_variants;
create policy "variants admin write" on public.product_variants
  for all to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- orders: user reads/inserts own, admin all
drop policy if exists "orders self select" on public.orders;
create policy "orders self select" on public.orders
  for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));

drop policy if exists "orders self insert" on public.orders;
create policy "orders self insert" on public.orders
  for insert to authenticated
  with check (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));

drop policy if exists "orders admin write" on public.orders;
create policy "orders admin write" on public.orders
  for all to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- order_items: via parent order
drop policy if exists "order_items self select" on public.order_items;
create policy "order_items self select" on public.order_items
  for select to authenticated using (
    exists (select 1 from public.orders o
            where o.id = order_items.order_id
              and (o.user_id = auth.uid() or public.has_role(auth.uid(),'admin')))
  );

drop policy if exists "order_items self insert" on public.order_items;
create policy "order_items self insert" on public.order_items
  for insert to authenticated with check (
    exists (select 1 from public.orders o
            where o.id = order_items.order_id
              and (o.user_id = auth.uid() or public.has_role(auth.uid(),'admin')))
  );

drop policy if exists "order_items admin write" on public.order_items;
create policy "order_items admin write" on public.order_items
  for all to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- conversations: user owns own, admin all
drop policy if exists "conversations self select" on public.conversations;
create policy "conversations self select" on public.conversations
  for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));

drop policy if exists "conversations self insert" on public.conversations;
create policy "conversations self insert" on public.conversations
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "conversations admin update" on public.conversations;
create policy "conversations admin update" on public.conversations
  for update to authenticated
  using (public.has_role(auth.uid(),'admin') or auth.uid() = user_id)
  with check (public.has_role(auth.uid(),'admin') or auth.uid() = user_id);

-- messages
drop policy if exists "messages select" on public.messages;
create policy "messages select" on public.messages
  for select to authenticated using (
    exists (select 1 from public.conversations c
            where c.id = messages.conversation_id
              and (c.user_id = auth.uid() or public.has_role(auth.uid(),'admin')))
  );

drop policy if exists "messages insert" on public.messages;
create policy "messages insert" on public.messages
  for insert to authenticated with check (
    sender_id = auth.uid() and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.user_id = auth.uid() or public.has_role(auth.uid(),'admin'))
    )
  );

drop policy if exists "messages update" on public.messages;
create policy "messages update" on public.messages
  for update to authenticated using (
    exists (select 1 from public.conversations c
            where c.id = messages.conversation_id
              and (c.user_id = auth.uid() or public.has_role(auth.uid(),'admin')))
  );

-- store_settings: public read, admin write
drop policy if exists "settings public read" on public.store_settings;
create policy "settings public read" on public.store_settings
  for select to anon, authenticated using (true);

drop policy if exists "settings admin write" on public.store_settings;
create policy "settings admin write" on public.store_settings
  for all to authenticated
  using (public.has_role(auth.uid(),'admin'))
  with check (public.has_role(auth.uid(),'admin'));

-- 8. STORAGE BUCKET + POLICIES -------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('upload', 'upload', true, 5242880, array['image/png','image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "upload public read" on storage.objects;
create policy "upload public read" on storage.objects
  for select to public using (bucket_id = 'upload');

drop policy if exists "upload auth insert" on storage.objects;
create policy "upload auth insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'upload');

drop policy if exists "upload auth delete" on storage.objects;
create policy "upload auth delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'upload' and (
      owner = auth.uid()
      or public.has_role(auth.uid(),'admin')
    )
  );

-- 9. SEED 4 DEMO PRODUCTS (only if products table is empty) ---------------
do $$
declare
  cat_men   uuid;
  cat_women uuid;
begin
  if not exists (select 1 from public.products limit 1) then
    insert into public.categories (name, slug, image_url) values
      ('Men',   'men',   'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800'),
      ('Women', 'women', 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800'),
      ('Sale',  'sale',  'https://images.unsplash.com/photo-1542060748-10c28b62716f?w=800')
    on conflict (slug) do nothing;

    select id into cat_men   from public.categories where slug = 'men';
    select id into cat_women from public.categories where slug = 'women';

    insert into public.products (name, slug, description, price, sale_price, images, category_id, featured, active) values
      ('Classic White Shirt', 'classic-white-shirt', 'Crisp cotton shirt for any occasion.',
       89, null, array['https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=800'], cat_men, true, true),
      ('Wool Overcoat', 'wool-overcoat', 'Warm wool blend overcoat.',
       249, 199, array['https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=800'], cat_men, true, true),
      ('Linen Summer Dress', 'linen-summer-dress', 'Lightweight linen dress.',
       139, null, array['https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800'], cat_women, true, true),
      ('Cashmere Sweater', 'cashmere-sweater', 'Soft 100% cashmere knit.',
       179, 149, array['https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=800'], cat_women, true, true);
  end if;
end $$;
```

## After signup — make `admin@gmail.com` an admin

קודם הרשם דרך `/register` עם המייל `admin@gmail.com` והסיסמה `456456`.
ואז הרץ ב־SQL Editor את השורה הבאה (פעם אחת):

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'admin@gmail.com'
on conflict (user_id, role) do nothing;
```

## Frontend

עברתי על קוד הצד־לקוח — הקריאות כבר משתמשות ב־`maybeSingle()` וב־`data ?? []`, כך שטבלאות ריקות לא קורסות. ה־`Application error` שראית מקורו כמעט בוודאות בכך שהטבלאות לא היו קיימות (ה־RLS החזיר שגיאה במקום מערך ריק). אחרי הרצת המיגרציה לעיל זה ייעלם.

האזהרות `bis_status` ב־console הן מהרחבת דפדפן (Bitdefender / סוכן אבטחה) — לא קוד שלנו, ניתן להתעלם.
