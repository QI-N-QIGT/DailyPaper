import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

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
            <div className="flex items-center gap-2 font-bold text-xl text-primary">
              <span className="text-2xl">🎓</span> Daily Scholar
            </div>
          </header>
          
          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 border-r bg-muted/30 p-4 hidden md:block shrink-0 overflow-y-auto">
              <nav className="space-y-2">
                <div className="px-3 py-2 text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                  Discover
                </div>
                <button className="w-full text-left rounded-md bg-secondary/80 px-3 py-2 text-sm font-medium text-primary hover:bg-secondary transition-colors">
                  Latest Papers
                </button>
                <button className="w-full text-left rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
                  Trending
                </button>
                
                <div className="mt-6 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                  Library
                </div>
                <button className="w-full text-left rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
                  Saved
                </button>
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
