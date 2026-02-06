import type { Metadata } from "next";
import { Roboto_Flex, IBM_Plex_Sans_Condensed, Geist_Mono } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { auth } from "@/lib/auth";
import { Header } from "@/components/layout/header";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const robotoFlex = Roboto_Flex({
  variable: "--font-heading",
  subsets: ["latin"],
});

const ibmPlexSansCondensed = IBM_Plex_Sans_Condensed({
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Noiseless",
  description: "An algorithmic RSS feed reader that feels like a social feed",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="en">
      <body
        className={`${robotoFlex.variable} ${ibmPlexSansCondensed.variable} ${geistMono.variable} antialiased`}
      >
        <SessionProvider session={session}>
          <Header
            user={
              session?.user
                ? {
                    name: session.user.name,
                    email: session.user.email,
                    image: session.user.image,
                  }
                : null
            }
          />
          <main className="min-h-[calc(100vh-3.5rem)]">{children}</main>
          <Toaster />
        </SessionProvider>
      </body>
    </html>
  );
}
