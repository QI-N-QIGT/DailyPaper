"use client";

import { useEffect, useState, Suspense } from "react";
import { Search, Loader2, FileText, Sparkles, Download, X, Image as ImageIcon, LayoutGrid, List, Star, MoreHorizontal, ArrowRight } from "lucide-react";
import { useSearchParams } from "next/navigation";

interface Paper {
  id: string;
  title: string;
  authors: string[];
  published_date: string;
  abstract: string;
  pdf_url: string;
}

interface PosterResponse {
  image_url: string;
  summary_json: any;
}

function HomeContent() {
  const searchParams = useSearchParams();
  // State
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [daysBack, setDaysBack] = useState("0"); // Default to "Any time"
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [analyzingStatus, setAnalyzingStatus] = useState<string>(""); 
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [savedPosters, setSavedPosters] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Initial Load of Saved IDs
  useEffect(() => {
     const loadSaved = () => {
         const savedMetadataStr = localStorage.getItem("daily_scholar_saved_papers");
         if (savedMetadataStr) {
             const meta = JSON.parse(savedMetadataStr);
             setSavedIds(new Set(Object.keys(meta)));
         }
     };
     loadSaved();
     window.addEventListener("library_updated", loadSaved);
     return () => window.removeEventListener("library_updated", loadSaved);
  }, []);

  const toggleSave = (paper: Paper) => {
      if (savedIds.has(paper.id)) {
          // Remove
          const savedMetadataStr = localStorage.getItem("daily_scholar_saved_papers");
          if (savedMetadataStr) {
              const meta = JSON.parse(savedMetadataStr);
              delete meta[paper.id];
              localStorage.setItem("daily_scholar_saved_papers", JSON.stringify(meta));
              window.dispatchEvent(new Event("library_updated"));
          }
      } else {
          // Save
          savePaperToLibrary(paper);
      }
  };
  useEffect(() => {
    // ... existing search logic ...
    const paramQuery = searchParams.get("q");
    if (paramQuery) {
        setQuery(paramQuery);
        doSearch(paramQuery, daysBack);
    } else if (query) {
        doSearch(query, daysBack);
    }
    
    // Load cache from localStorage
    const cached = localStorage.getItem("daily_scholar_posters");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        // Filter out HTML values (naive check to migrate from HTML to Image URL)
        const cleanCache: Record<string, string> = {};
        let changed = false;
        Object.entries(parsed).forEach(([k, v]) => {
            if (typeof v === 'string' && !v.trim().startsWith('<') && !v.trim().startsWith('<!DOCTYPE')) {
                cleanCache[k] = v as string;
            } else {
                changed = true;
            }
        });
        setSavedPosters(cleanCache);
        if (changed) {
            localStorage.setItem("daily_scholar_posters", JSON.stringify(cleanCache));
        }
      } catch (e) {
        console.error("Error parsing cache", e);
      }
    }
  }, [searchParams]); 

  const doSearch = async (searchQuery: string, timeRange: string) => {
    if (!searchQuery || !searchQuery.trim()) {
        return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?query=${encodeURIComponent(searchQuery)}&days_back=${timeRange}`);
      
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server error: ${res.status} ${text}`);
      }

      const data = await res.json();
      setPapers(data);
    } catch (err) {
      console.error("Search failed", err);
      alert(`Search failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const saveSearchHistory = (searchQuery: string) => {
    try {
        const historyStr = localStorage.getItem("daily_scholar_search_history");
        let history: string[] = historyStr ? JSON.parse(historyStr) : [];
        // Remove duplicate if exists
        history = history.filter(q => q !== searchQuery);
        // Add to front
        history.unshift(searchQuery);
        // Limit to 10
        history = history.slice(0, 10);
        
        localStorage.setItem("daily_scholar_search_history", JSON.stringify(history));
        // Dispatch custom event to notify Sidebar
        window.dispatchEvent(new Event("search_history_updated"));
    } catch (e) {
        console.error("Failed to save search history", e);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = query.trim();
    if (!q) return;
    
    saveSearchHistory(q);
    doSearch(q, daysBack);
  };
  
  const savePosterToCache = (paper: Paper, url: string) => {
    // 1. Save Image URL
    const newCache = { ...savedPosters, [paper.id]: url };
    setSavedPosters(newCache);
    localStorage.setItem("daily_scholar_posters", JSON.stringify(newCache));
    
    // 2. Save Paper Metadata for Library (Also triggered by Star button)
    savePaperToLibrary(paper);
  };
  
  const savePaperToLibrary = (paper: Paper) => {
    const savedMetadataStr = localStorage.getItem("daily_scholar_saved_papers");
    let savedMetadata: Record<string, Paper> = savedMetadataStr ? JSON.parse(savedMetadataStr) : {};
    savedMetadata[paper.id] = paper;
    localStorage.setItem("daily_scholar_saved_papers", JSON.stringify(savedMetadata));
    // Force UI update if needed or dispatch event
    window.dispatchEvent(new Event("library_updated"));
  };
  
  const isPaperSaved = (id: string) => {
      // Check if in library metadata
      if (typeof window === 'undefined') return false;
      const savedMetadataStr = localStorage.getItem("daily_scholar_saved_papers");
      if (!savedMetadataStr) return false;
      const savedMetadata = JSON.parse(savedMetadataStr);
      return !!savedMetadata[id];
  };

  const handleDownloadPoster = async () => {
    if (!posterUrl) return;

    try {
      const response = await fetch(posterUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "research-poster.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed", err);
      alert("Failed to download image. Please try again.");
    }
  };

  const handleAnalyze = async (paper: Paper) => {
    // Check cache first
    if (savedPosters[paper.id]) {
      setPosterUrl(savedPosters[paper.id]);
      return;
    }

    setAnalyzingId(paper.id);
    setAnalyzingStatus("Starting analysis...");
    
    // Use EventSource for SSE streaming
    const eventSource = new EventSource(`http://localhost:8000/api/analyze-stream?pdf_url=${encodeURIComponent(paper.pdf_url)}`);
    
    eventSource.onopen = () => {
       console.log("SSE Connection Opened");
    };
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === "progress") {
          setAnalyzingStatus(data.message);
        } else if (data.type === "complete") {
          const imageUrl = data.result.image_url;
          setPosterUrl(imageUrl);
          savePosterToCache(paper, imageUrl); 
          eventSource.close();
          setAnalyzingId(null);
          setAnalyzingStatus("");
        } else if (data.type === "error") {
          console.error("Analysis Error:", data.message);
          alert(`Analysis failed: ${data.message}`);
          eventSource.close();
          setAnalyzingId(null);
          setAnalyzingStatus("");
        }
      } catch (e) {
        console.error("Error parsing SSE data", e);
      }
    };
    
    eventSource.onerror = (err) => {
      console.error("EventSource failed", err);
      eventSource.close();
      setAnalyzingId(null);
      setAnalyzingStatus("");
    };
  };

  return (
    <div className="max-w-6xl mx-auto pb-20">
      {/* Hero Section */}
      <div className={`flex flex-col items-center transition-all duration-500 ${papers.length > 0 ? 'py-8' : 'py-32'}`}>
        <h1 className={`font-bold tracking-tight text-foreground text-center mb-8 transition-all ${papers.length > 0 ? 'text-2xl' : 'text-4xl md:text-5xl'}`}>
            {papers.length > 0 ? "Latest Research" : "What are you researching today?"}
        </h1>

        <form onSubmit={handleSearch} className="w-full max-w-3xl relative px-4 md:px-0">
            <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search className={`text-muted-foreground group-focus-within:text-primary transition-colors ${papers.length > 0 ? 'h-5 w-5' : 'h-6 w-6'}`} />
                </div>
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search topics (e.g. 'Transformer', 'Quantum Computing')..."
                    className={`block w-full pl-12 pr-32 bg-white border border-gray-200 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-xl ${papers.length > 0 ? 'h-12 text-base rounded-xl' : 'h-16 text-xl rounded-2xl'}`}
                />
                <div className="absolute inset-y-0 right-2 flex items-center">
                     <select
                        value={daysBack}
                        onChange={(e) => setDaysBack(e.target.value)}
                        className="h-full bg-transparent border-none text-sm text-muted-foreground focus:ring-0 cursor-pointer mr-2 outline-none"
                      >
                        <option value="1">24h</option>
                        <option value="7">Week</option>
                        <option value="30">Month</option>
                        <option value="0">All</option>
                      </select>
                    <button 
                        type="submit"
                        className={`bg-primary text-primary-foreground font-medium transition-all hover:bg-primary/90 shadow-md ${papers.length > 0 ? 'h-8 px-4 text-sm rounded-lg' : 'h-10 px-6 text-base rounded-xl'}`}
                    >
                        Search
                    </button>
                </div>
            </div>
        </form>

        {/* Suggested Chips (only when no papers) */}
        {papers.length === 0 && !loading && (
            <div className="mt-8 flex flex-wrap justify-center gap-2 px-4">
                {["LLM Agents", "Computer Vision", "Reinforcement Learning", "Graph Neural Networks"].map(topic => (
                    <button
                        key={topic}
                        onClick={() => { setQuery(topic); doSearch(topic, daysBack); }}
                        className="px-4 py-2 rounded-full bg-secondary/50 hover:bg-secondary text-sm font-medium text-secondary-foreground transition-colors border border-transparent hover:border-border"
                    >
                        {topic}
                    </button>
                ))}
            </div>
        )}
      </div>

      {/* Control Bar (Only show when results exist) */}
      {papers.length > 0 && !loading && (
        <div className="flex items-center justify-between mb-6 px-1">
          <p className="text-sm text-muted-foreground font-medium">
            Found {papers.length} papers
          </p>
          <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              title="Grid View"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              title="List View"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Content Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className={viewMode === 'grid' 
          ? "grid gap-6 md:grid-cols-2 lg:grid-cols-3" 
          : "flex flex-col gap-0 divide-y divide-gray-100 border rounded-xl bg-white overflow-hidden shadow-sm"
        }>
          {papers.map((paper) => (
             viewMode === 'grid' ? (
                // GRID CARD (SaaS Style)
                <div key={paper.id} className="group flex flex-col bg-white rounded-xl border border-gray-100 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1 h-full overflow-hidden">
                  <div className="p-6 flex-1 flex flex-col">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-lg font-bold text-slate-800 leading-tight group-hover:text-blue-600 transition-colors line-clamp-2">
                          {paper.title}
                        </h3>
                        <button 
                            onClick={() => toggleSave(paper)}
                            className={`ml-4 p-1 rounded-full transition-colors ${savedIds.has(paper.id) ? "text-yellow-400 fill-yellow-400" : "text-gray-300 hover:text-yellow-400"}`}
                        >
                            <Star className={`h-5 w-5 ${savedIds.has(paper.id) ? "fill-yellow-400" : ""}`} />
                        </button>
                    </div>

                    {/* Metadata */}
                    <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
                        <span>{new Date(paper.published_date).getFullYear()}</span>
                        <span>•</span>
                        <span className="truncate max-w-[150px]">{paper.authors.slice(0, 2).join(", ")}</span>
                        <span>•</span>
                        <span>arXiv</span>
                    </div>
                    
                    {/* Abstract */}
                    <p className="text-sm text-slate-600 leading-relaxed line-clamp-3 mb-4 flex-1">
                      {paper.abstract}
                    </p>
                    
                    {/* Action Footer */}
                    <div className="flex justify-between items-center mt-auto pt-4 border-t border-slate-50">
                       <a 
                         href={paper.pdf_url} 
                         target="_blank" 
                         className="text-slate-400 hover:text-blue-600 text-sm flex items-center gap-1.5 font-medium transition-colors"
                       >
                         <FileText className="h-4 w-4" /> View PDF
                       </a>

                       <button 
                         onClick={() => handleAnalyze(paper)}
                         disabled={!!analyzingId}
                         className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${savedPosters[paper.id] ? "bg-green-50 text-green-700 hover:bg-green-100" : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"}`}
                       >
                        {analyzingId === paper.id ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Creating...</span>
                          </>
                        ) : savedPosters[paper.id] ? (
                          <>
                            <ImageIcon className="h-4 w-4" /> View Poster
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4" /> Generate Poster
                          </>
                        )}
                       </button>
                    </div>
                  </div>
                </div>
             ) : (
                // LIST ROW (SaaS Style)
                <div key={paper.id} className="group flex items-center justify-between py-4 px-6 hover:bg-gray-50 transition-colors bg-white border-b border-gray-50 last:border-0">
                    <div className="flex-1 min-w-0 pr-8">
                        <div className="flex items-center gap-3 mb-1">
                             <h3 className="text-base font-semibold text-slate-800 truncate group-hover:text-blue-600 transition-colors">
                                {paper.title}
                             </h3>
                             <span className="shrink-0 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                                {new Date(paper.published_date).getFullYear()}
                             </span>
                        </div>
                        <p className="text-sm text-slate-500 truncate flex items-center gap-2">
                            <span>{paper.authors.slice(0, 3).join(", ")}</span>
                            <span className="text-slate-300">•</span>
                            <span className="truncate max-w-md text-slate-400">{paper.abstract}</span>
                        </p>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                            onClick={() => toggleSave(paper)}
                            className={`p-2 rounded-md transition-colors ${savedIds.has(paper.id) ? "text-yellow-400" : "text-gray-300 hover:text-yellow-400 hover:bg-yellow-50"}`}
                        >
                            <Star className={`h-4 w-4 ${savedIds.has(paper.id) ? "fill-yellow-400" : ""}`} />
                        </button>

                        <a 
                            href={paper.pdf_url} 
                            target="_blank"
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="Open PDF"
                        >
                            <FileText className="h-4 w-4" />
                        </a>
                        
                        <button
                             onClick={() => handleAnalyze(paper)}
                             disabled={!!analyzingId}
                             className={`p-2 rounded-md transition-colors ${savedPosters[paper.id] ? "text-green-600 bg-green-50 hover:bg-green-100" : "text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50"}`}
                             title={savedPosters[paper.id] ? "View Poster" : "Generate Poster"}
                        >
                            {analyzingId === paper.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : savedPosters[paper.id] ? (
                                <ImageIcon className="h-4 w-4" />
                            ) : (
                                <Sparkles className="h-4 w-4" />
                            )}
                        </button>
                    </div>
                </div>
             )
          ))}
        </div>
      )}
      
      {/* Poster Modal Overlay */}
      {posterUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-5xl bg-white rounded-lg shadow-2xl overflow-hidden h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20 shrink-0">
              <h3 className="font-semibold">Research Poster</h3>
              <div className="flex items-center gap-2">
                 <button 
                   onClick={handleDownloadPoster}
                   className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
                 >
                    <ImageIcon className="h-4 w-4 mr-2" /> Save Image
                 </button>
                 <button onClick={() => setPosterUrl(null)} className="p-2 hover:bg-muted rounded-full">
                    <X className="h-5 w-5" />
                 </button>
              </div>
            </div>
            
            {/* Modal Content (Image) */}
            <div className="flex-1 overflow-auto bg-gray-50 flex items-start justify-center p-8">
               <div className="relative w-full max-w-[800px] shadow-2xl">
                 <img 
                   src={posterUrl} 
                   className="w-full h-auto bg-white"
                   alt="Research Poster"
                 />
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
