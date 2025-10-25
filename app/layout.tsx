import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { PostHogProvider } from "./components/PosthogProvider";
import { ToastProvider } from "./contexts/ToastContext";
import { ClerkProvider } from '@clerk/nextjs';
import { clerkDarkTheme } from './lib/clerk-theme';
import NotificationListener from "./components/NotificationListener";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const ppNeue = localFont({
  src: "../fonts/PPNeueMontreal-Medium.otf",
  variable: "--font-pp-neue",
});

// const ppSupply = localFont({
//   src: "../fonts/PPSupplySans-Regular.otf",
//   variable: "--font-pp-supply",
// });

export const metadata: Metadata = {
  title: "Salesman.sh - Autonomous Sales Agent Platform",
  description: "Build intelligent autonomous agents for sales automation, lead generation, and outreach campaigns",
  openGraph: {
    images: ["/og.png"],
    title: "Salesman.sh - Autonomous Sales Agent Platform",
    description: "Build intelligent autonomous agents for sales automation, lead generation, and outreach campaigns",
    url: "https://salesman.sh",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hasClerkKey = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY
  );
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body
        className={`${inter.variable} ${ppNeue.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        {hasClerkKey ? (
          <ClerkProvider appearance={clerkDarkTheme} afterSignOutUrl='/'>
            <PostHogProvider>
              <ToastProvider>
                <NotificationListener />
                {children}
              </ToastProvider>
            </PostHogProvider>
          </ClerkProvider>
        ) : (
          <PostHogProvider>
            <ToastProvider>
              <NotificationListener />
              {children}
            </ToastProvider>
          </PostHogProvider>
        )}
        <Analytics />
      </body>
    </html>
  );
}
