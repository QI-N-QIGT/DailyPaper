"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { Search, Loader2, FileText, Sparkles, Download, X, Image as ImageIcon } from "lucide-react";
import html2canvas from "html2canvas";
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
  html_content: string;
  summary_json: any;
}

function HomeContent() {
  const searchParams = useSearchParams();
  // State
  const [query, setQuery] = useState(searchParams.get("q") || "LLM Agents");
  const [daysBack, setDaysBack] = useState("0"); // Default to "Any time"
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analyzingStatus, setAnalyzingStatus] = useState<string>(""); 
  const [posterHtml, setPosterHtml] = useState<string | null>(null);
  const [savedPosters, setSavedPosters] = useState<Record<string, string>>({});
  
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Initial Fetch & Load Cache
  useEffect(() => {
    // Check for query param on mount to trigger search
    const paramQuery = searchParams.get("q");
    if (paramQuery) {
        setQuery(paramQuery);
        // We need to fetch if the query comes from URL, even if we have a default "LLM Agents"
        // But handleSearch uses the current state 'query'. 
        // Inside useEffect, 'query' might still be the initial value if we don't be careful.
        // However, we just called setQuery. React batches updates.
        // Better to pass the value explicitly to a fetch function or rely on a separate effect.
        // Actually, let's just call handleSearch with the param value explicitly if needed,
        // or let the effect depend on something.
        
        // Let's modify handleSearch to accept a query string override.
        doSearch(paramQuery, daysBack);
    } else {
        // Default behavior
        doSearch(query, daysBack);
    }
    
    // Load cache from localStorage
    const cached = localStorage.getItem("daily_scholar_posters");
    if (cached) {
      setSavedPosters(JSON.parse(cached));
    }
  }, [searchParams]); // Add searchParams dependency to re-run if URL changes

  const doSearch = async (searchQuery: string, timeRange: string) => {
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

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    doSearch(query, daysBack);
  };
  
  const savePosterToCache = (paper: Paper, html: string) => {
    // 1. Save HTML content
    const newCache = { ...savedPosters, [paper.id]: html };
    setSavedPosters(newCache);
    localStorage.setItem("daily_scholar_posters", JSON.stringify(newCache));
    
    // 2. Save Paper Metadata for Library
    const savedMetadataStr = localStorage.getItem("daily_scholar_saved_papers");
    let savedMetadata: Record<string, Paper> = savedMetadataStr ? JSON.parse(savedMetadataStr) : {};
    savedMetadata[paper.id] = paper;
    localStorage.setItem("daily_scholar_saved_papers", JSON.stringify(savedMetadata));
  };

  const handleDownloadPoster = async () => {
    if (!iframeRef.current || !iframeRef.current.contentDocument) return;

    try {
      const iframeBody = iframeRef.current.contentDocument.body;
      const posterElement = iframeBody.querySelector('.poster') as HTMLElement;
      
      if (!posterElement) {
        alert("Could not find poster element");
        return;
      }

      // Use html2canvas on the element inside the iframe
      // Note: We need to ensure styles are computed. 
      // html2canvas works best if we temporarily render it in the main DOM, 
      // but rendering from iframe body often works if same-origin (srcDoc is same-origin).
      
      const canvas = await html2canvas(posterElement, {
        scale: 2, // Higher resolution
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff"
      });

      const image = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = image;
      link.download = "research-poster.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Export failed", err);
      alert("Failed to export as image. Please try again.");
    }
  };

  const handleAnalyze = async (paper: Paper) => {
    // Check cache first
    if (savedPosters[paper.id]) {
      setPosterHtml(savedPosters[paper.id]);
      return;
    }

    setAnalyzingId(paper.id);
    setAnalyzingStatus("Starting analysis...");
    
    // Use EventSource for SSE streaming
    // Direct connection to backend to bypass Next.js proxy buffering issues
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
          setPosterHtml(data.result.html_content);
          savePosterToCache(paper, data.result.html_content); // Updated to pass full paper object
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
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Latest Research</h1>
          <p className="text-muted-foreground">
            Discover and visualize papers from arXiv.
          </p>
        </div>
        
        <form onSubmit={handleSearch} className="relative w-full md:w-auto flex gap-2">
          <div className="relative flex-1 md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input 
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search topics (e.g. 'Transformer')..."
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <select
            value={daysBack}
            onChange={(e) => {
              setDaysBack(e.target.value);
              // Optional: trigger search immediately on change
              // handleSearch(); 
            }}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="1">Past 24h</option>
            <option value="7">Past Week</option>
            <option value="30">Past Month</option>
            <option value="365">Past Year</option>
            <option value="0">Any time</option>
          </select>
          <button type="submit" className="h-10 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md text-sm font-medium transition-colors">
            Search
          </button>
        </form>
      </div>

      {/* Content Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
          {papers.map((paper) => (
            <div key={paper.id} className="group flex flex-col rounded-xl border bg-card text-card-foreground shadow-sm transition-all hover:shadow-md h-full">
              <div className="p-6 flex-1 flex flex-col space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                     <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-secondary text-secondary-foreground">
                        {new Date(paper.published_date).getFullYear()}
                     </span>
                     <a href={paper.pdf_url} target="_blank" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                       <FileText className="h-3 w-3" /> PDF
                     </a>
                  </div>
                  
                  <h3 className="font-semibold leading-tight tracking-tight line-clamp-2 group-hover:text-primary transition-colors">
                    {paper.title}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {paper.authors.slice(0, 3).join(", ")} {paper.authors.length > 3 && "et al."}
                  </p>
                </div>
                
                <p className="text-sm text-muted-foreground line-clamp-4 flex-1">
                  {paper.abstract}
                </p>
                
                <div className="pt-4 mt-auto">
                   <button 
                     onClick={() => handleAnalyze(paper)}
                     disabled={!!analyzingId}
                     className={`inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border h-9 px-4 py-2 w-full gap-2 relative overflow-hidden ${savedPosters[paper.id] ? "bg-green-50 border-green-200 text-green-700 hover:bg-green-100" : "border-input bg-background hover:bg-accent hover:text-accent-foreground"}`}
                   >
                    {analyzingId === paper.id ? (
                      <>
                        <div className="absolute inset-0 bg-secondary/50 animate-pulse" style={{ width: '100%' }}></div>
                        <div className="relative z-10 flex items-center gap-2">
                           <Loader2 className="h-4 w-4 animate-spin" /> 
                           <span className="truncate max-w-[150px]">{analyzingStatus || "Analyzing..."}</span>
                        </div>
                      </>
                    ) : savedPosters[paper.id] ? (
                      <>
                        <FileText className="h-4 w-4" /> View Saved Poster
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 text-yellow-500" /> Generate Poster
                      </>
                    )}
                   </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Poster Modal Overlay */}
      {posterHtml && (
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
                 <button onClick={() => setPosterHtml(null)} className="p-2 hover:bg-muted rounded-full">
                    <X className="h-5 w-5" />
                 </button>
              </div>
            </div>
            
            {/* Modal Content (Iframe for style isolation) */}
            <div className="flex-1 overflow-auto bg-gray-50 flex items-start justify-center p-8">
               <div className="relative w-full max-w-[800px] shadow-2xl">
                 <iframe 
                   ref={iframeRef}
                   srcDoc={posterHtml} 
                   className="w-full border-0 bg-white"
                   title="Poster Preview"
                   style={{ 
                     height: '1200px', // Fixed height long enough for the poster content
                     display: 'block'
                   }}
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
