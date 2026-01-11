import type { Metadata } from "next";
import { Inter, Merriweather } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/layout/Sidebar";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const merriweather = Merriweather({ 
  weight: ["300", "400", "700", "900"], 
  subsets: ["latin"], 
  variable: "--font-serif" 
});

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
      <body className={cn(inter.variable, merriweather.variable, "bg-white text-slate-900 antialiased font-sans")}>
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
