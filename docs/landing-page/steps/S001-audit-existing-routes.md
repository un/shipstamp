# S001 Audit Existing Routes

This step inventories how the current Next.js routes behave and where auth is enforced.

## Routes

### `/` (Home)

- File: `code/apps/web/app/page.tsx`
- Component type: server component (no `"use client"`)
- Current content: placeholder Card with links to `/sign-in` and `/dashboard`, plus a `ConvexHealth` panel.
- Auth: none on this page.

### `/sign-in`

- File: `code/apps/web/app/sign-in/page.tsx`
- Component type: client component (`"use client"`)
- Behavior:
  - Button runs `authClient.signIn.social({ provider: "github", callbackURL: "/dashboard" })`.
  - Back link to `/`.
- Auth: none enforced; page is usable while logged out.

### `/dashboard`

- File: `code/apps/web/app/dashboard/page.tsx`
- Component type: server component (async)
- Behavior:
  - Calls `await isAuthenticated()`; redirects to `/sign-in` when false.
  - Calls `fetchAuthQuery(api.orgs.listMine, {})`; if no orgs, redirects to `/onboarding`.
  - Renders `DashboardClient` (client).

### `/device`

- File: `code/apps/web/app/device/page.tsx`
- Component type: client component (`"use client"`)
- Behavior:
  - Uses Better Auth session (`authClient.useSession()`) plus Convex auth (`useConvexAuth()`).
  - If not signed in, shows GitHub sign-in button with `callbackURL: "/device"`.
  - If signed in, loads orgs/invites and enables approving a CLI code.
- Auth: enforced by the UI state; there is no server-side redirect.

## Root Layout + Auth Helpers

### Root layout

- File: `code/apps/web/app/layout.tsx`
- Component type: server component (async)
- Behavior:
  - Calls `await getToken()` from `@/lib/auth-server`.
  - Passes `initialToken` into `ConvexClientProvider`, enabling Convex React hooks.

### Auth helpers

- File: `code/apps/web/lib/auth-server.ts`
- Exports from `convexBetterAuthNextJs(...)`:
  - `isAuthenticated()` used by server pages + route handlers.
  - `getToken()` used by root layout.
  - `fetchAuthQuery(...)` used by server pages + route handlers.

## Other Notable Auth Uses

- Additional server-side `isAuthenticated()` checks exist in:
  - `code/apps/web/app/onboarding/page.tsx`
  - `code/apps/web/app/dashboard/repos/page.tsx`
  - `code/apps/web/app/dashboard/repos/[repoId]/page.tsx`
  - `code/apps/web/app/dashboard/runs/[runId]/page.tsx`
  - `code/apps/web/app/api/v1/orgs/invite/route.ts`
  - `code/apps/web/app/api/v1/emails/welcome/route.ts`

## Implications For The Landing Page Work

- Marketing pages can be moved into a route group without changing URLs.
- Auth-aware marketing CTA should use server-side `isAuthenticated()` (like dashboard pages) to avoid client flicker.
- `/sign-in` is currently client-side; adding a server redirect for authenticated users will require a server wrapper or a server page.
