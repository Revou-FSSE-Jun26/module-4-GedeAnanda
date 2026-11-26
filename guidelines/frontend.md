# Frontend Guidelines (Next.js App Router)

Scope: everything under `frontend/`. API behavior is in [`backend.md`](backend.md); models and queries are in [`database.md`](database.md).

Every guideline has an ID (`FE-xx`) so reviews and the violation report can cite it. Each one has three parts: **Rule**, **Rationale**, **Example**.

---

## FE-01 — Server Components by default; `"use client"` only where interactivity needs it

**Rule.** A file is a Server Component unless it uses state, effects, event handlers, context or browser APIs. The Dashboard (`app/(app)/page.tsx`) and Board Detail (`app/(app)/boards/[id]/page.tsx`) pages are Server Components that fetch their data on the server and pass it to small client islands (`KanbanBoard`, `CreateBoardModal`). `"use client"` is never added to a page just to make an error go away.

**Rationale.** Server-side fetching sends ready HTML with no loading flash and no client-side waterfall. Marking a whole page as client moves all of its children to the browser bundle and loses that.

**Example.**

```tsx
// frontend/app/(app)/page.tsx — Server Component
export default async function DashboardPage() {
  const token = (await cookies()).get("revotask_token")?.value;
  const boards = await apiClient.get<Board[]>("/api/boards", { token });
  return <BoardList boards={boards} />;   // CreateBoardModal inside is the client island
}
```

```tsx
// Wrong: client page that fetches in an effect
"use client";
export default function DashboardPage() {
  const [boards, setBoards] = useState([]);
  useEffect(() => { fetch("/api/boards").then(...) }, []);
}
```

---

## FE-02 — All HTTP calls go through `lib/apiClient`

**Rule.** Components, hooks and pages never call `fetch` directly. They call `apiClient.get/post/patch/delete`, which chooses the base URL (`NEXT_PUBLIC_API_BASE_URL` in the browser, `API_BASE_URL` on the server), attaches `Authorization: Bearer <token>`, unwraps `{ "data": ... }` and throws `ApiError` on any non-2xx response. `process.env` is read only inside `lib/apiClient.ts`.

**Rationale.** A raw `fetch` skips the token, the base URL and the error conversion, so that one call fails differently from every other call in the app.

**Example.**

```ts
// frontend/hooks/useNotifications.ts
const page = await apiClient.get<NotificationPage>("/api/notifications", { token });
```

```ts
// Wrong
const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/notifications`);
const json = await res.json();
```

---

## FE-03 — API errors are handled by `useErrorHandler`; toasts go through `lib/toast`

**Rule.** A client component that calls the API catches the error and passes it to `handleError` from `useErrorHandler`. It does not inspect status codes itself, call `alert`, or only `console.error`. `react-hot-toast` is imported in exactly two places: `lib/toast.ts` and the root layout (for `<Toaster />`). Everything else uses `toast.success/error/loading` from `lib/toast`.

**Rationale.** Status-to-message mapping in one hook means a `401` always clears the session and redirects, wherever it happens. Scattered `if (status === 401)` checks miss cases.

**Example.**

```tsx
// frontend/app/(app)/profile/page.tsx
const { handleError } = useErrorHandler();

async function onSubmit(e: React.FormEvent) {
  e.preventDefault();
  try {
    const user = await apiClient.patch<User>("/api/users/me", { name, email }, { token });
    setAuth(user, token);
    toast.success("Profile updated");
  } catch (err) {
    handleError(err);
  }
}
```

```tsx
// Wrong
} catch (err: any) {
  if (err.status === 401) router.push("/login");
  else alert("Something went wrong");
}
```

---

## FE-04 — Use the shared components; no one-off buttons, badges or modals

**Rule.** Every button is a `BaseButton` with `variant="primary" | "secondary" | "destructive"`. Every priority or status label is a `BaseBadge`. Every form that opens over the page (create board, add column, add card, card detail) is wrapped in `BaseModal`. Pages and feature components never contain a raw `<button>` or a hand-rolled overlay `<div>`.

**Rationale.** One-off buttons drift in size, color and focus style, and each hand-rolled modal has to re-implement Escape handling and focus return. Shared components fix these once.

**Example.**

```tsx
// frontend/app/(app)/my-tasks/page.tsx
<BaseBadge priority={card.priority} />
<BaseButton variant="secondary" onClick={() => openCard(card.id)}>Open</BaseButton>
```

```tsx
// Wrong
<button className="bg-blue-500 text-white px-3 py-1 rounded" onClick={...}>Open</button>
<span className="text-red-600">high</span>
```

---

## FE-05 — Strict TypeScript, no `any`, API types from `types/index.ts`

**Rule.** `tsconfig.json` has `"strict": true`. `any` is not used, including `as any` and `catch (err: any)`. The shapes returned by the API (`User`, `Board`, `Column`, `Card`, `Comment`, `Notification`, `PaginatedResponse<T>`) are defined once in `frontend/types/index.ts` and imported; they are not redeclared inside components. Unknown values are typed `unknown` and narrowed.

**Rationale.** `any` turns off the check exactly where the API contract meets the UI, so a renamed field (`board_name`) fails at runtime instead of at build time.

**Example.**

```ts
// frontend/types/index.ts
export interface Card {
  id: string;
  column_id: string;
  board_id: string;
  board_name: string;
  title: string;
  priority: "low" | "medium" | "high";
  order: number;
  assignee: { id: string; name: string } | null;
}

function groupByBoard(cards: Card[]): Record<string, Card[]> { ... }
```

```ts
function groupByBoard(cards: any[]) { ... }   // Wrong
```

---

## FE-06 — Forms use controlled inputs with labels and validate before submitting

**Rule.** Every input's value is held in React state (`value` + `onChange`). Every input has a visible `<label htmlFor>` tied to its `id`. The form validates on submit before any request is sent, shows an inline message next to each invalid field, and disables the submit button while the request is running.

**Rationale.** Controlled inputs make validation and pre-filling (Profile from `AuthContext`) straightforward. Labels are what screen readers and `getByLabel` tests use to find a field.

**Example.**

```tsx
// frontend/app/register/page.tsx
<label htmlFor="password">Password</label>
<input id="password" type="password" value={password}
       onChange={(e) => setPassword(e.target.value)}
       aria-invalid={!!errors.password} aria-describedby="password-error" />
{errors.password && <p id="password-error" role="alert">{errors.password}</p>}

function validate(): FormErrors {
  const next: FormErrors = {};
  if (!name.trim()) next.name = "Name is required";
  if (!/^\S+@\S+\.\S+$/.test(email)) next.email = "Enter a valid email";
  if (password.length < 8) next.password = "Password must be at least 8 characters";
  return next;
}
```

```tsx
<input placeholder="Password" ref={passwordRef} />   // Wrong: uncontrolled, no label
```

---

## FE-07 — Optimistic updates keep a snapshot and restore it on failure

**Rule.** When the UI changes before the API responds (moving a card), the code saves the previous state first, applies the change, sends the request, and on error restores the saved state and reports the error through `handleError`. On success it applies any server corrections (`column_orders` when `rebalanced` is true). The optimistic change is never left in place after a failed request.

**Rationale.** Without a snapshot, a failed move leaves the card in a column where the server does not have it, and the board is wrong until the next reload.

**Example.**

```ts
// frontend/hooks/useDragAndDrop.ts
const snapshot = columns;
setColumns(moveCard(columns, cardId, targetColumnId, order));   // optimistic
try {
  const res = await apiClient.patch<MoveResult>(
    `/api/cards/${cardId}/position`, { column_id: targetColumnId, order }, { token });
  if (res.rebalanced) setColumns((c) => applyOrders(c, res.column_orders));
} catch (err) {
  setColumns(snapshot);                                         // roll back
  handleError(err);
}
```

```ts
// Wrong: no rollback
setColumns(moveCard(columns, cardId, targetColumnId, order));
apiClient.patch(`/api/cards/${cardId}/position`, { ... });
```

---

## FE-08 — Tailwind utilities only, mobile-first, usable at 375 px

**Rule.** Styling uses Tailwind classes. No inline `style={{}}` for layout, and no component CSS files besides `globals.css`. Layouts are written for 375 px first and widened with `sm:` / `md:` / `lg:`. No fixed pixel widths on page containers. The Kanban board is the only place that scrolls horizontally (`overflow-x-auto`). Interactive elements are at least 44 × 44 px.

**Rationale.** Desktop-first layouts with fixed widths are what produce cut-off and overlapping content in device mode, which is a graded check.

**Example.**

```tsx
// Board: horizontal scroll on small screens, fixed-width columns inside
<div className="flex gap-4 overflow-x-auto p-4">
  <section className="w-72 shrink-0 rounded-lg bg-slate-100 p-3">...</section>
</div>

// Page container: full width on mobile, capped on desktop
<main className="mx-auto w-full max-w-3xl px-4 py-6">
```

```tsx
<main style={{ width: 1200, margin: "0 auto" }}>   // Wrong: overflows at 375 px
```

---

## FE-09 — The token is read and written only through `lib/auth` and `AuthContext`

**Rule.** Client code reads the token from `useAuth()` and changes it only with `setAuth` / `clearAuth` plus `lib/auth`'s `setToken` / `clearToken`. Server Components read the `revotask_token` cookie with `cookies()` from `next/headers` and pass the token to `apiClient`. `lib/auth.ts` is client-only and never imports `next/headers`. No component touches `document.cookie` or `localStorage` directly, and the token is never put in a URL.

**Rationale.** If the cookie and the context are written in different places, they go out of sync: the middleware still sees a token after logout, or a client call goes out with a stale one. Importing a server-only module into client code fails the build.

**Example.**

```tsx
// Logout in frontend/components/Header.tsx
function logout() {
  clearToken();        // cookie
  clearAuth();         // context
  router.push("/login");
}
```

```tsx
// Wrong
localStorage.setItem("token", res.access_token);
document.cookie = "revotask_token=; Max-Age=0";
```

---

## FE-10 — Effects that start timers or listeners clean them up

**Rule.** Every `useEffect` that creates an interval, timeout, event listener or pending request returns a cleanup function that removes it. Polling stops when the component unmounts or the user logs out. Debounced inputs (card search, 300 ms) clear the pending timeout on each keystroke and on unmount.

**Rationale.** A polling interval that survives logout keeps calling the API without a token, which produces `401` toasts and redirect loops on the login page.

**Example.**

```ts
// frontend/hooks/useNotifications.ts
useEffect(() => {
  if (!token) return;
  load();
  const id = setInterval(load, 30_000);
  return () => clearInterval(id);
}, [token, load]);
```

```ts
useEffect(() => { setInterval(load, 30000); }, []);   // Wrong: never cleared
```

---

## FE-11 — Tests find elements the way a user does, and never wait for fixed time

**Rule.** React Testing Library and Playwright tests select by role, label or text first, and by `data-testid` only when there is no accessible handle (for example a specific Kanban column). Tests never select by CSS class or DOM structure. Playwright uses web-first assertions (`await expect(locator).toBeVisible()`) and `page.waitForResponse(...)` for network-dependent steps. `page.waitForTimeout(...)` is never used.

**Rationale.** Class and structure selectors break on every restyle. Fixed sleeps are either too short, which makes tests flaky against the live URL, or too long, which makes the suite slow.

**Example.**

```ts
// frontend/e2e/kanban.spec.ts
const moved = page.waitForResponse(
  (r) => r.url().includes("/position") && r.request().method() === "PATCH" && r.ok());
await page.getByText(cardTitle).dragTo(page.getByTestId("column-Done"));
await moved;
await page.reload();
await expect(page.getByTestId("column-Done").getByText(cardTitle)).toBeVisible();
```

```ts
// Wrong
await page.locator(".card:nth-child(1)").dragTo(page.locator(".column >> nth=1"));
await page.waitForTimeout(2000);
```
