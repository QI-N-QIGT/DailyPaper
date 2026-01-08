"use client";

import { useEffect, useState } from "react";
import { Newspaper } from "lucide-react";
import Link from "next/link";

export function DailyDigestSidebar() {
  const [hasDigest, setHasDigest] = useState(false);

  useEffect(() => {
    fetch("/api/daily-digest")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.image_url) {
          setHasDigest(true);
        }
      })
      .catch((err) => console.error("Failed to check daily digest", err));
  }, []);

  if (!hasDigest) return null;

  return (
    <Link
      href="/digest"
      className="flex items-center gap-2 w-full text-left rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors group"
    >
      <Newspaper className="h-4 w-4 text-blue-600 group-hover:text-blue-700" />
      <span>Daily Digest</span>
      <span className="ml-auto flex h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
    </Link>
  );
}
