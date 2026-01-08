import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { cn } from "@/lib/utils";
import { DailyDigestSidebar } from "@/components/DailyDigestSidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Daily Scholar",
  description: "AI-powered Research Assistant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={cn(inter.className, "bg-background text-foreground antialiased")}>
        <div className="flex h-screen flex-col">
          {/* Navbar */}
          <header className="flex h-16 items-center border-b px-6 bg-card shrink-0 z-50">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl text-primary hover:opacity-80 transition-opacity">
              <span className="text-2xl">🎓</span> Daily Scholar
            </Link>
          </header>
          
          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 border-r bg-muted/30 p-4 hidden md:block shrink-0 overflow-y-auto">
              <nav className="space-y-2">
                <div className="px-3 py-2 text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                  Discover
                </div>
                <DailyDigestSidebar />
                <Link 
                  href="/"
                  className="block w-full text-left rounded-md bg-secondary/80 px-3 py-2 text-sm font-medium text-primary hover:bg-secondary transition-colors"
                >
                  Latest Papers
                </Link>
                <button className="w-full text-left rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
                  Trending
                </button>
                
                <div className="mt-6">
                  <Link 
                    href="/library"
                    className="block w-full text-left rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors uppercase tracking-wider text-xs font-semibold"
                  >
                    Library
                  </Link>
                </div>
                <button className="w-full text-left rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
                  Tags
                </button>
              </nav>
            </aside>
            
            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-8">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
