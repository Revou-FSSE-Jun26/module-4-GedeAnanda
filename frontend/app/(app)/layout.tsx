import type { ReactNode } from "react";

import { Header } from "@/components/Header";

/** Every signed-in page: `/`, `/boards/[id]`, `/my-tasks`, `/profile`. Never `/login` or `/register`. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      {children}
    </>
  );
}
