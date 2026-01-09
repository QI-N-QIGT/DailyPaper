"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Home, 
  Library, 
  BookOpen, 
  Sparkles, 
  Clock, 
  Settings, 
  User, 
  Newspaper, 
  Lightbulb, 
  Palette 
} from "lucide-react";
import { useEffect, useState } from "react";

export function Sidebar() {
  const pathname = usePathname();
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    // Load recent searches from localStorage
    const saved = localStorage.getItem("daily_scholar_search_history");
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved).slice(0, 5));
      } catch (e) {
        console.error("Failed to parse search history", e);
      }
    }

    // Listen for storage events to update real-time if changed in another tab
    const handleStorageChange = () => {
       const saved = localStorage.getItem("daily_scholar_search_history");
       if (saved) {
         try {
           setRecentSearches(JSON.parse(saved).slice(0, 5));
         } catch (e) {}
       }
    };
    
    window.addEventListener("storage", handleStorageChange);
    // Custom event for same-tab updates
    window.addEventListener("search_history_updated", handleStorageChange);
    
    return () => {
        window.removeEventListener("storage", handleStorageChange);
        window.removeEventListener("search_history_updated", handleStorageChange);
    };
  }, []);

  const isActive = (path: string) => pathname === path;

  return (
    <aside className="w-64 h-screen fixed left-0 top-0 bg-slate-50 border-r border-slate-100 flex flex-col z-50">
      {/* 1. Branding Header */}
      <div className="p-6 flex items-center gap-3">
        <div className="h-8 w-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
          <BookOpen className="h-5 w-5 text-white" />
        </div>
        <div className="flex flex-col justify-center">
            <h1 className="text-lg leading-none text-slate-900">
                <span className="font-medium">Daily</span>{" "}
                <span className="font-serif font-bold">Scholar</span>
            </h1>
        </div>
      </div>

      {/* Scrollable Navigation Area */}
      <div className="flex-1 overflow-y-auto py-2 px-3 space-y-8">
        
        {/* Group 1: Primary */}
        <div className="space-y-1">
          <Link 
            href="/"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              isActive("/") 
                ? "bg-slate-200 text-slate-900 font-medium" 
                : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900"
            }`}
          >
            <Home className="h-5 w-5" />
            <span>Home</span>
          </Link>
          
          <Link 
            href="/library"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              isActive("/library") 
                ? "bg-slate-200 text-slate-900 font-medium" 
                : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900"
            }`}
          >
            <Library className="h-5 w-5" />
            <span>My Library</span>
          </Link>

          <Link 
            href="/digest"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              isActive("/digest") 
                ? "bg-slate-200 text-slate-900 font-medium" 
                : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900"
            }`}
          >
            <Newspaper className="h-5 w-5" />
            <span>Daily Digest</span>
          </Link>
        </div>

        {/* Group 2: Tools */}
        <div>
            <h3 className="px-3 text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                Workspace
            </h3>
            <div className="space-y-1">
                <Link 
                    href="#"
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-200/50 hover:text-slate-900 transition-colors opacity-70 cursor-not-allowed"
                    title="Coming soon"
                >
                    <Lightbulb className="h-4 w-4" />
                    <span className="text-sm">Idea Playground</span>
                </Link>
                <Link 
                    href="#"
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-200/50 hover:text-slate-900 transition-colors opacity-70 cursor-not-allowed"
                    title="Use 'Generate Poster' on search results"
                >
                    <Palette className="h-4 w-4" />
                    <span className="text-sm">Poster Generator</span>
                </Link>
            </div>
        </div>

        {/* Group 3: History */}
        <div>
            <h3 className="px-3 text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                Recent Research
            </h3>
            <div className="space-y-1">
                {recentSearches.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-slate-400 italic">
                        No recent searches
                    </div>
                ) : (
                    recentSearches.map((query, idx) => (
                        <Link 
                            key={idx}
                            href={`/?q=${encodeURIComponent(query)}`}
                            className="flex items-center gap-3 px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-200/50 hover:text-slate-900 transition-colors group"
                        >
                            <Clock className="h-3.5 w-3.5 shrink-0 group-hover:text-blue-500 transition-colors" />
                            <span className="text-sm truncate">{query}</span>
                        </Link>
                    ))
                )}
            </div>
        </div>
      </div>

      {/* 3. Sidebar Footer */}
      <div className="p-4 border-t border-slate-100">
        <button className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-200/50 transition-colors text-left">
            <div className="h-8 w-8 bg-slate-200 rounded-full flex items-center justify-center">
                <User className="h-4 w-4 text-slate-500" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">Researcher</p>
                <p className="text-xs text-slate-500 truncate">Pro Plan</p>
            </div>
            <Settings className="h-4 w-4 text-slate-400" />
        </button>
      </div>
    </aside>
  );
}
