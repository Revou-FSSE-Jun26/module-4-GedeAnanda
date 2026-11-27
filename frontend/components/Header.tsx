"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { NotificationBell } from "@/components/notifications/NotificationBell";
import { BaseButton } from "@/components/shared/BaseButton";
import { useAuth } from "@/context/AuthContext";
import { clearToken } from "@/lib/auth";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/my-tasks", label: "My tasks" },
  { href: "/profile", label: "Profile" },
];

function isCurrent(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/" || pathname.startsWith("/boards");
  return pathname.startsWith(href);
}

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { clearAuth } = useAuth();

  // REQ-4.3 and 4.4: logout happens entirely in the browser.
  function logout() {
    clearToken();
    clearAuth();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-card">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2">
        <Link href="/" className="font-display text-xl font-semibold text-action">
          RevoTask
        </Link>

        <div className="ml-auto flex items-center gap-2 sm:order-last">
          <NotificationBell />
          <BaseButton variant="secondary" onClick={logout}>
            Log out
          </BaseButton>
        </div>

        <nav aria-label="Main" className="-mx-2 flex w-full gap-1 sm:mx-0 sm:w-auto">
          {LINKS.map((link) => {
            const current = isCurrent(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={current ? "page" : undefined}
                className={
                  "inline-flex min-h-[44px] items-center rounded-lg px-3 text-sm font-semibold " +
                  (current ? "bg-board text-ink" : "text-ink-soft hover:text-ink")
                }
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
