import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { Toaster } from "react-hot-toast";

import { AuthProvider } from "@/context/AuthContext";
import { TOKEN_COOKIE } from "@/lib/auth";

import "./globals.css";

const heading = Bricolage_Grotesque({ variable: "--font-heading", subsets: ["latin"] });
const body = Instrument_Sans({ variable: "--font-body", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RevoTask",
  description: "Boards, columns and cards for a team's work.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value ?? null;

  return (
    <html lang="en" className={`${heading.variable} ${body.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <AuthProvider initialToken={token}>{children}</AuthProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
