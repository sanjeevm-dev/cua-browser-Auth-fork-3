"use client";

import dynamic from "next/dynamic";

const PostHogProviderClient = dynamic(
  () => import("./PosthogProviderClient").then((mod) => mod.PostHogProviderClient),
  {
    ssr: false,
  }
);

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return <PostHogProviderClient>{children}</PostHogProviderClient>;
}
