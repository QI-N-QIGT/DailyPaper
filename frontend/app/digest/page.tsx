"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Printer, Share2, Calendar, Download, Maximize2, Lightbulb } from "lucide-react";
import { VisualAbstract } from "@/components/digest/VisualAbstract";

interface DigestMeta {
    date: string;
    image_url: string;
    papers: { id: string; title: string }[];
    items: {
        paper_id: string;
        title: string;
        summary: string;
        authors: string;
        image_url: string | null;
    }[];
}

export default function DigestPage() {
  const [meta, setMeta] = useState<DigestMeta | null>(null);
  const digestHtmlUrl = `http://127.0.0.1:8000/uploads/daily_digests/digest.html?t=${new Date().getTime()}`;
  
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  useEffect(() => {
    fetch("/api/daily-digest")
        .then(res => res.json())
        .then(data => setMeta(data))
        .catch(err => console.error("Failed to load digest meta", err));
  }, []);

  if (!meta) return <div className="p-12 text-center text-slate-500">Loading digest...</div>;

  return (
    <div className="min-h-screen bg-white text-slate-900 pb-32">
      {/* 1. Header Toolbar (Sticky) */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-8 py-4 bg-white/90 backdrop-blur-md border-b border-slate-100 transition-all">
        {/* Removed internal branding - Global Nav is sufficient */}
        <div className="flex items-center gap-4">
          {/* Date removed as requested */}
        </div>
        <div className="flex items-center gap-2">
            <a href={digestHtmlUrl} target="_blank" className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-colors" title="Raw HTML View">
                <ExternalLink className="w-5 h-5" />
            </a>
            <button onClick={() => window.print()} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-colors" title="Print">
                <Printer className="w-5 h-5" />
            </button>
        </div>
      </div>

      {/* 2. Marginalia Layout */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 px-8 py-12 pt-20">
        
        {/* Left Column: Reading Stream (Span 8) */}
        <div className="lg:col-span-8 space-y-12">
            <header>
                <h1 className="text-4xl md:text-5xl font-serif font-black text-slate-900 leading-tight mb-6">
                    Daily Research Digest
                </h1>
                <div className="flex items-center gap-4 text-slate-500 text-sm font-medium border-l-2 border-slate-200 pl-4">
                    <span>{meta.papers.length} Papers Analyzed</span>
                    <span>•</span>
                    <span>AI Curated</span>
                    <span>•</span>
                    <span>{meta.date}</span>
                </div>
            </header>

            {/* Introduction / Overview */}
            <div className="prose prose-slate prose-lg max-w-none font-serif text-slate-700 leading-loose">
                <p className="text-xl italic text-slate-500 border-l-4 border-indigo-500 pl-6 py-2 bg-indigo-50/30 rounded-r-lg">
                    "Today's research landscape features breakthroughs in 4D reconstruction, quantum neural fields, and reinforcement learning for low-light vision. Here is your curated summary."
                </p>
                <p>
                    The following digest synthesizes the most significant pre-prints from arXiv over the last 24 hours, selected based on your research interests.
                </p>
            </div>

            <hr className="border-slate-100" />

            {/* Articles Stream */}
            <div className="space-y-16">
                {meta.items.map((item, idx) => (
                    <article key={idx} className="group scroll-mt-24" id={`article-${idx}`}>
                        <h2 className="text-2xl font-serif font-bold text-slate-900 mb-2 group-hover:text-indigo-700 transition-colors">
                            {item.title}
                        </h2>
                        <div className="text-sm text-slate-500 font-sans mb-6">
                            {item.authors}
                        </div>
                        
                        <div className="font-serif text-lg text-slate-700 leading-loose space-y-4">
                            <p>{item.summary}</p>
                            
                            {/* Visual Abstract for this article (Desktop Inline) */}
                            {item.image_url && (
                                <div className="hidden lg:block my-8">
                                    <VisualAbstract 
                                        paperId={item.paper_id}
                                        posterUrl={item.image_url}
                                        isGenerating={false}
                                        onGenerate={() => {}}
                                    />
                                    <p className="text-center text-sm text-slate-500 italic mt-2">
                                        Figure: AI-Generated Visual Summary for "{item.title}"
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Mobile-only Context (hidden on LG) */}
                        {item.image_url && (
                             <div className="lg:hidden mt-6">
                                <img src={item.image_url} alt="Figure" className="rounded-lg shadow-md border border-slate-100 w-full" />
                             </div>
                        )}
                    </article>
                ))}
            </div>
        </div>

        {/* Right Column: Context Sidebar (Span 4) */}
        <div className="hidden lg:block lg:col-span-4 relative">
            <div className="sticky top-24 space-y-8">
                {/* 1. Visual Abstract Component (New!) */}
                <VisualAbstract 
                    paperId="digest-hero"
                    posterUrl={meta.image_url}
                    isGenerating={false}
                    onGenerate={() => {}}
                />

                {/* 2. Key Insights Module */}
                <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
                    <div className="flex items-center gap-2 mb-4 text-indigo-600">
                        <Lightbulb className="w-5 h-5" />
                        <h3 className="font-bold text-sm uppercase tracking-wider">Key Insights</h3>
                    </div>
                    <ul className="space-y-3">
                        <li className="flex gap-3 text-sm text-slate-600 leading-relaxed">
                            <span className="text-indigo-400 font-bold">•</span>
                            <span>Emerging trend in <strong>4D Reconstruction</strong> using diffusion priors.</span>
                        </li>
                        <li className="flex gap-3 text-sm text-slate-600 leading-relaxed">
                            <span className="text-indigo-400 font-bold">•</span>
                            <span>Hybrid <strong>Quantum-Classical</strong> architectures showing promise for NeRFs.</span>
                        </li>
                        <li className="flex gap-3 text-sm text-slate-600 leading-relaxed">
                            <span className="text-indigo-400 font-bold">•</span>
                            <span>Reinforcement Learning applied to low-level vision tasks like <strong>AWB</strong>.</span>
                        </li>
                    </ul>
                </div>

                {/* 3. Table of Contents (Mini) */}
                <div className="border-t border-slate-100 pt-6">
                    <h4 className="font-bold text-xs uppercase text-slate-400 tracking-wider mb-4">In this issue</h4>
                    <nav className="space-y-2">
                        {meta.items.map((item, idx) => (
                            <a 
                                key={idx} 
                                href={`#article-${idx}`}
                                className="block text-sm text-slate-600 hover:text-indigo-600 truncate transition-colors border-l-2 border-transparent hover:border-indigo-500 pl-3 -ml-3 py-1"
                            >
                                {item.title}
                            </a>
                        ))}
                    </nav>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
}
