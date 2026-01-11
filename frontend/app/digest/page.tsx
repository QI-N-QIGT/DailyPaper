"use client";

import { ExternalLink, Printer, Share2, Calendar } from "lucide-react";

export default function DigestPage() {
  // Add timestamp to prevent browser caching
  const digestUrl = `http://127.0.0.1:8000/uploads/daily_digests/digest.html?t=${new Date().getTime()}`;
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="h-full flex flex-col -m-8">
      {/* Toolbar / Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-8 py-4 bg-white/80 backdrop-blur-md border-b border-stone-200">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 bg-stone-900 rounded-lg flex items-center justify-center shadow-sm">
             <span className="text-white font-serif font-bold text-xl">D</span>
          </div>
          <div>
            <h1 className="text-xl font-serif font-bold text-stone-900 leading-none">
              Daily Research Digest
            </h1>
            <div className="flex items-center gap-2 mt-1">
                <Calendar className="w-3 h-3 text-stone-500" />
                <p className="text-xs text-stone-500 font-medium uppercase tracking-wide">
                {today}
                </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={digestUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 hover:bg-stone-50 hover:text-stone-900 rounded-md transition-all shadow-sm"
          >
            <ExternalLink className="w-4 h-4" />
            <span className="hidden sm:inline">Raw View</span>
          </a>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-stone-900 hover:bg-black rounded-md transition-all shadow-md"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Print / PDF</span>
          </button>
        </div>
      </div>

      {/* Main Content - Newsstand View */}
      <div className="flex-1 overflow-auto bg-stone-100 p-8 flex justify-center">
        {/* Paper Container */}
        <div className="w-full max-w-[1200px] bg-[#F9F7F1] shadow-2xl ring-1 ring-black/5 rounded-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
          <iframe
            src={digestUrl}
            className="w-full h-[1500px] md:h-full min-h-[100vh] border-0 block"
            title="Daily Research Digest"
            style={{ 
                backgroundColor: '#F9F7F1',
                // Ensure iframe content scales or fits if needed, though usually fixed 1200px
            }} 
          />
        </div>
      </div>
    </div>
  );
}
