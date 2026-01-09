import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/layout/Sidebar";

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
      <body className={cn(inter.className, "bg-white text-slate-900 antialiased")}>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          
          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto pl-64 bg-white">
             {/* Wrapper to ensure content centers correctly in the remaining space */}
             <div className="w-full h-full">
                {children}
             </div>
          </main>
        </div>
      </body>
    </html>
  );
}
