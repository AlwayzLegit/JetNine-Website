# RBAC

Roles live on `public.users.role` (Postgres enum `user_role`). The default
for a newly-signed-up auth user is `member`. Promotion is by SQL or by an
existing admin via `/admin/member`.

```
member  ──►  dispatcher  ──►  admin  ──►  superadmin
                                  └─►  operator_contact (parallel track)
```

## Roles

| Role | Source of truth | Who gets it |
|---|---|---|
| `member` | default on `auth.users` signup | Anyone who signs in via magic link |
| `dispatcher` | manual promotion | Ops staff who triage quotes + assign aircraft |
| `admin` | manual promotion | Ops leads who manage reference data (operators, aircraft, airports) |
| `superadmin` | manual promotion | Owners — role changes, irreversible operations |
| `operator_contact` | invited via operators flow | External operator-side contacts; no portal access yet |

## Gates

Three helpers in [`src/lib/auth.ts`](./src/lib/auth.ts) wrap the contract:

| Helper | Allows |
|---|---|
| `requireUser()` | any authenticated user |
| `requireStaff()` | `dispatcher`, `admin`, `superadmin` |
| `requireAdmin()` | `admin`, `superadmin` (excludes dispatcher) |

[`src/middleware.ts`](./src/middleware.ts) mirrors the staff check at the
edge: any path under `/admin` requires staff; `/account` requires only an
authenticated user. RLS policies in the database (`is_admin()`,
`is_staff()` SQL helpers) enforce the same rules at the data layer, so a
direct REST call to PostgREST is gated the same way.

## Permission matrix

| Surface | member | dispatcher | admin | superadmin |
|---|:-:|:-:|:-:|:-:|
| Public marketing + `/quote` wizard | ✓ | ✓ | ✓ | ✓ |
| `/account` (own trips, invoices, prefs) | ✓ | ✓ | ✓ | ✓ |
| `/admin/dispatch` (quote desk) | — | ✓ | ✓ | ✓ |
| `/admin/quote/[id]` (work a quote, hold aircraft) | — | ✓ | ✓ | ✓ |
| `/admin/trip` + trip workbench | — | ✓ | ✓ | ✓ |
| `/admin/ops` (14-day planner) | — | ✓ | ✓ | ✓ |
| `/admin/member` (read) | — | ✓ | ✓ | ✓ |
| `/admin/audit` (audit log) | — | ✓ | ✓ | ✓ |
| `/admin/operators` mutate | — | — | ✓ | ✓ |
| `/admin/aircraft` mutate | — | — | ✓ | ✓ |
| `/admin/airports` mutate | — | — | ✓ | ✓ |
| `/admin/member` invite + role changes | — | — | ✓ | ✓ |
| Promote/demote `admin` ↔ `superadmin` | — | — | — | ✓ (SQL) |
| Bypass RLS via `service_role` key | — | — | — | server-only |

Read access on most `/admin/*` index pages is open to dispatchers; mutation
of reference data (operators, aircraft, airports) is admin-only. The RLS
policy migrations are the canonical source — see
[`src/db/migrations/0001_rls_and_auth_triggers.sql`](./src/db/migrations/0001_rls_and_auth_triggers.sql)
for the `is_staff()` / `is_admin()` definitions and each table-specific
RLS migration for which helper it calls.

## Bootstrapping the first admin

Magic-link signup creates a `public.users` row at `role='member'`. To self-
promote the first admin, set a Postgres GUC before signing in for the
first time:

```sql
alter database postgres
  set jn.admin_bootstrap_email = 'you@example.com';
```

The `handle_new_auth_user` trigger reads that GUC on insert and assigns
`role='admin'` if the email matches. After the first admin exists,
subsequent promotions are by hand:

```sql
update public.users set role = 'admin' where email = 'them@example.com';
```

`superadmin` is intentionally not assignable via the admin UI — promotion
to that tier should be deliberate and traceable, done in the SQL editor.
