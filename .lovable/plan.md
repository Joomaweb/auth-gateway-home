## E-Commerce Clothing Store - Full Build Plan

A complete clothing store with customer storefront and admin panel, English-first with Hebrew/RTL toggle, fully responsive, connected to your self-hosted Supabase.

### Scope

**Storefront (Customer)**
- Home: hero, product carousel, categories, sales/promotions section
- Shop page with category & filter (size, color, price)
- Product detail page (images, sizes, colors, add to cart)
- Shopping cart (drawer + full page)
- Checkout flow (shipping address, payment method selection)
- User profile: edit details, shipping address, avatar
- Order history with order details & status
- Inbox (envelope icon) for admin replies + unread badge
- Contact form → creates conversation with admin
- About page
- Footer with About / Contact / links
- Language toggle (EN ↔ HE with RTL)

**Admin Panel** (`/admin`, role-protected)
- Dashboard: live orders, revenue, low-stock alerts
- Products CRUD: add/edit/delete, prices, images, category
- Sizes & colors management per product (variants with stock)
- Inventory: real-time stock per variant
- Orders: view live (realtime), filter by status, edit status, delete, manually add new order
- Customers: list profiles, view detail
- Messages: inbox of customer contact submissions, threaded reply
- Settings: shipping methods/rates, payment methods toggle (COD, card, bank transfer)

### Tech / Architecture

```
src/
  i18n/                       # EN + HE translations, RTL switcher
  lib/
    supabase.ts               # existing client
    cart.ts                   # zustand cart store (localStorage)
    i18n.tsx                  # context provider, useT()
  hooks/
    use-auth.tsx              # existing
    use-role.tsx              # has_role check
    use-unread-messages.tsx
  components/
    layout/Header.tsx         # nav, cart icon, inbox icon, lang toggle, profile
    layout/Footer.tsx
    layout/PublicLayout.tsx
    product/ProductCard.tsx
    product/ProductCarousel.tsx
    cart/CartDrawer.tsx
    admin/AdminLayout.tsx (sidebar)
  routes/
    __root.tsx                # wraps with I18nProvider, layouts
    index.tsx                 # home
    shop.tsx                  # listing + filters
    product.$id.tsx
    cart.tsx
    checkout.tsx
    about.tsx
    contact.tsx
    _authenticated.tsx        # auth guard
    _authenticated/profile.tsx
    _authenticated/orders.tsx
    _authenticated/orders.$id.tsx
    _authenticated/inbox.tsx
    _admin.tsx                # admin guard (has_role admin)
    _admin/dashboard.tsx
    _admin/products.tsx
    _admin/products.$id.tsx
    _admin/orders.tsx
    _admin/orders.$id.tsx
    _admin/orders.new.tsx
    _admin/customers.tsx
    _admin/messages.tsx
    _admin/settings.tsx
```

### Database Schema (SQL migration)

```sql
-- Roles (separate table to avoid privilege escalation)
create type app_role as enum ('admin','customer');
create table user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  role app_role not null,
  unique(user_id, role)
);
create function has_role(_uid uuid, _role app_role) returns boolean
  language sql stable security definer set search_path=public as $$
  select exists(select 1 from user_roles where user_id=_uid and role=_role) $$;

-- Profiles extension
alter table profiles add column phone text, add column address jsonb,
  add column avatar_url text;

-- Catalog
create table categories (id uuid pk, name text, slug text unique, image_url text);
create table products (
  id uuid pk, name text, slug text unique, description text,
  price numeric, sale_price numeric, category_id uuid,
  images text[], featured bool, active bool, created_at timestamptz
);
create table product_variants (
  id uuid pk, product_id uuid, size text, color text,
  stock int default 0, sku text
);

-- Orders
create type order_status as enum ('pending','paid','shipped','delivered','cancelled');
create table orders (
  id uuid pk, user_id uuid, status order_status default 'pending',
  subtotal numeric, shipping numeric, total numeric,
  shipping_address jsonb, payment_method text, notes text,
  created_at timestamptz
);
create table order_items (
  id uuid pk, order_id uuid, product_id uuid, variant_id uuid,
  name text, size text, color text, qty int, price numeric
);

-- Messaging (contact form → threaded conversations)
create table conversations (
  id uuid pk, user_id uuid, subject text,
  last_message_at timestamptz, created_at timestamptz
);
create table messages (
  id uuid pk, conversation_id uuid, sender_id uuid,
  is_admin bool, body text, read_by_user bool default false,
  read_by_admin bool default false, created_at timestamptz
);

-- Settings (single-row config)
create table store_settings (
  id int pk default 1, shipping_methods jsonb, payment_methods jsonb,
  free_shipping_threshold numeric
);

-- RLS: customers see own data; admins see all (via has_role)
-- Realtime enabled on orders, messages
```

### Admin User Setup

After SQL migration, you'll register `admin@gmail.com` / `456456` through the normal `/register` flow, then run a one-line SQL insert (provided in migration output) to grant admin role:
```sql
insert into user_roles (user_id, role)
  select id, 'admin' from auth.users where email='admin@gmail.com';
```

### Initial Seed
4 starter products (T-Shirt, Jeans, Hoodie, Sneakers) with variants, plus 3 categories (Men, Women, Accessories), inserted by migration.

### Design
- Clean classic minimal e-commerce aesthetic (think Everlane / COS)
- Neutral palette with single accent (semantic tokens in styles.css)
- Tailwind shadcn/ui components, Card-based layouts
- Mobile-first; sidebar drawer for admin on mobile
- Smooth carousel (existing carousel.tsx)
- RTL handled via `dir` attribute switching from i18n provider

### Notes / Limits
- Payment is **method selection only** (COD / Bank Transfer / Card-on-delivery placeholder). Real payment provider (Stripe/Paddle) is not included — say the word and we add it after.
- Image uploads use existing `upload` bucket.
- Build delivered iteratively in this single response: migration → schema types → cart/i18n stores → public layout & pages → auth pages tweaks → admin panel → messaging.

This is a large build (~25-30 files). I'll execute it end-to-end in one go after you approve.