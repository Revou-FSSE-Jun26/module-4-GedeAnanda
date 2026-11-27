import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { Toaster } from "react-hot-toast";

import { AuthProvider } from "@/context/AuthContext";
import { TOKEN_COOKIE } from "@/lib/auth";
import { THEME_COOKIE, isTheme } from "@/lib/theme";

import "./globals.css";

const heading = Bricolage_Grotesque({ variable: "--font-heading", subsets: ["latin"] });
const body = Instrument_Sans({ variable: "--font-body", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RevoTask",
  description: "Boards, columns and cards for a team's work.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const jar = await cookies();
  const token = jar.get(TOKEN_COOKIE)?.value ?? null;
  // The chosen theme is applied on the server, so the page never flashes the other one (REQ-33.2).
  const chosenTheme = jar.get(THEME_COOKIE)?.value;

  return (
    <html
      lang="en"
      data-theme={isTheme(chosenTheme) ? chosenTheme : undefined}
      className={`${heading.variable} ${body.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <AuthProvider initialToken={token}>{children}</AuthProvider>
        <Toaster
          position="top-center"
          toastOptions={{ className: "!bg-card !text-ink !shadow-lift !rounded-xl !font-medium" }}
        />
      </body>
    </html>
  );
}
