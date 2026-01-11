"use client";

import { useState } from "react";
import { Sparkles, Image as ImageIcon, Loader2, ZoomIn, Download, X } from "lucide-react";

interface VisualAbstractProps {
  paperId: string;
  posterUrl: string | null;
  onGenerate: () => void;
  isGenerating: boolean;
  statusText?: string;
}

export function VisualAbstract({ paperId, posterUrl, onGenerate, isGenerating, statusText }: VisualAbstractProps) {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // State A: Idle
  if (!posterUrl && !isGenerating) {
    return (
      <div 
        onClick={onGenerate}
        className="group relative w-full aspect-auto min-h-[300px] bg-slate-50 border border-slate-200 rounded-lg shadow-sm hover:bg-slate-100 hover:border-slate-300 hover:shadow-md transition-all duration-300 cursor-pointer flex flex-col items-center justify-center p-6 text-center"
      >
        <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform duration-300">
           <Sparkles className="h-8 w-8 text-indigo-400 group-hover:text-indigo-600 transition-colors" />
        </div>
        <h3 className="text-slate-900 font-semibold mb-1">Visual Abstract</h3>
        <p className="text-xs text-slate-500 mb-6 max-w-[200px]">
           Generate an AI-powered visual summary for this paper.
        </p>
        <button className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-full shadow-sm group-hover:border-indigo-200 group-hover:text-indigo-700 transition-colors">
           Generate Visual
        </button>
      </div>
    );
  }

  // State B: Loading
  if (isGenerating) {
    return (
      <div className="relative w-full aspect-auto min-h-[300px] bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
        {/* Skeleton Pulse */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-200 animate-pulse"></div>
        
        {/* Overlay Content */}
        <div className="absolute inset-0 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 text-center z-10">
           <div className="h-12 w-12 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin mb-4"></div>
           <p className="text-sm font-semibold text-slate-800 animate-pulse">
             {statusText || "Synthesizing Visuals..."}
           </p>
           <p className="text-xs text-slate-500 mt-2">
             Analyzing paper structure & key figures
           </p>
        </div>
      </div>
    );
  }

  // State C: Success
  return (
    <>
      <div className="group relative w-full aspect-video bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col">
        {/* Image Container - Use block to eliminate all spacing issues */}
        <div className="relative w-full h-full bg-slate-50 flex items-center justify-center overflow-hidden">
            <img 
              src={posterUrl!} 
              alt="Visual Abstract" 
              className="w-full h-full block object-cover object-center cursor-zoom-in"
              style={{ display: 'block' }}
              onClick={() => setIsLightboxOpen(true)}
            />
            
            {/* Hover Overlay */}
            <div 
                className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center cursor-zoom-in pointer-events-none"
            >
                <div className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 flex items-center gap-2">
                    <ZoomIn className="h-4 w-4 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">Click to Expand</span>
                </div>
            </div>
        </div>

        {/* Formal Caption (Overlay on bottom) */}
        <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-100 p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <p className="text-[10px] font-medium text-slate-500 text-center uppercase tracking-wider truncate">
                Figure 1: AI-Generated Visual Summary
            </p>
        </div>
      </div>

      {/* Lightbox Modal */}
      {isLightboxOpen && (
        <div 
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-200"
            onClick={() => setIsLightboxOpen(false)}
        >
            <div className="relative max-w-5xl w-full max-h-full flex flex-col items-center">
                 <button 
                    onClick={(e) => { e.stopPropagation(); setIsLightboxOpen(false); }}
                    className="absolute -top-12 right-0 p-2 text-white/70 hover:text-white transition-colors"
                 >
                    <X className="h-8 w-8" />
                 </button>
                 
                 <img 
                    src={posterUrl!} 
                    alt="Visual Abstract Full" 
                    className="max-w-full max-h-[85vh] object-contain rounded-md shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                 />
                 
                 <div className="mt-4 flex gap-4" onClick={(e) => e.stopPropagation()}>
                    <a 
                        href={posterUrl!} 
                        download="visual-abstract.png"
                        className="flex items-center gap-2 px-6 py-3 bg-white text-slate-900 rounded-full font-medium hover:bg-slate-200 transition-colors shadow-lg"
                    >
                        <Download className="h-4 w-4" /> Download High-Res
                    </a>
                 </div>
            </div>
        </div>
      )}
    </>
  );
}
