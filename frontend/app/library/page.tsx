"use client";

import { useEffect, useState, useRef } from "react";
import { FileText, Download, X, Image as ImageIcon, Trash2, Upload, Loader2, Sparkles, FolderUp, Bookmark, BrainCircuit, Search, LayoutGrid, List, MoreHorizontal, Filter, ArrowUpDown } from "lucide-react";
import html2canvas from "html2canvas";
import Link from "next/link";

interface Paper {
  id: string;
  title: string;
  authors: string[];
  published_date: string;
  abstract: string;
  pdf_url: string;
  is_local?: boolean; // Flag for local uploads
}

export default function LibraryPage() {
  const [savedPapers, setSavedPapers] = useState<Paper[]>([]);
  const [savedPosters, setSavedPosters] = useState<Record<string, string>>({});
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analyzingStatus, setAnalyzingStatus] = useState<string>("");
  const [analyzingInterests, setAnalyzingInterests] = useState(false);
  const [suggestedQueries, setSuggestedQueries] = useState<string[]>([]);
  const [researchDirections, setResearchDirections] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Separate papers into two categories
  const uploadedPapers = savedPapers.filter(p => p.is_local);
  const savedFromSearchPapers = savedPapers.filter(p => !p.is_local);

  useEffect(() => {
    // Load metadata
    const metadataStr = localStorage.getItem("daily_scholar_saved_papers");
    if (metadataStr) {
      const metadataMap: Record<string, Paper> = JSON.parse(metadataStr);
      // Sort by date descending (newest uploaded/saved first)
      setSavedPapers(Object.values(metadataMap).reverse());
    }

    // Load posters content
    const postersStr = localStorage.getItem("daily_scholar_posters");
    if (postersStr) {
      setSavedPosters(JSON.parse(postersStr));
    }
    
    // Load user profile (interests)
    const profileStr = localStorage.getItem("daily_scholar_user_profile");
    if (profileStr) {
        const profile = JSON.parse(profileStr);
        setSuggestedQueries(profile.suggested_queries || []);
        setResearchDirections(profile.research_directions || []);
    }
  }, []);

  const savePaperToLibrary = (paper: Paper) => {
    const savedMetadataStr = localStorage.getItem("daily_scholar_saved_papers");
    let savedMetadata: Record<string, Paper> = savedMetadataStr ? JSON.parse(savedMetadataStr) : {};
    savedMetadata[paper.id] = paper;
    localStorage.setItem("daily_scholar_saved_papers", JSON.stringify(savedMetadata));
    setSavedPapers(Object.values(savedMetadata).reverse());
  };
  
  const savePosterToCache = (paperId: string, html: string) => {
    const newCache = { ...savedPosters, [paperId]: html };
    setSavedPosters(newCache);
    localStorage.setItem("daily_scholar_posters", JSON.stringify(newCache));
  };

  const handleAnalyzeInterests = async () => {
    if (uploadedPapers.length === 0) {
      alert("Please upload some papers first to analyze your interests.");
      return;
    }

    setAnalyzingInterests(true);
    
    try {
      // Collect PDF URLs from uploaded papers
      const pdfUrls = uploadedPapers.map(p => p.pdf_url);
      
      // Calculate simple hash of current papers to avoid re-fetching if unchanged
      const currentHash = uploadedPapers.map(p => p.id).sort().join('|');
      const savedProfileStr = localStorage.getItem("daily_scholar_user_profile");
      
      if (savedProfileStr) {
          const profile = JSON.parse(savedProfileStr);
          if (profile.paper_hash === currentHash && profile.suggested_queries && profile.suggested_queries.length > 0) {
              console.log("Using cached profile from localStorage");
              setSuggestedQueries(profile.suggested_queries);
              setResearchDirections(profile.research_directions || []);
              setShowSuggestions(true);
              setAnalyzingInterests(false);
              return;
          }
      }

      const res = await fetch("http://localhost:8000/api/analyze-library", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ pdf_urls: pdfUrls })
      });

      if (!res.ok) {
        throw new Error("Analysis failed");
      }

      const data = await res.json();
      
      const queries = data.suggested_queries || [];
      const directions = data.research_directions || [];
      
      setSuggestedQueries(queries);
      setResearchDirections(directions);
      
      // Save to local storage
      localStorage.setItem("daily_scholar_user_profile", JSON.stringify({
          suggested_queries: queries,
          research_directions: directions,
          paper_hash: currentHash, // Save hash
          updated_at: new Date().toISOString()
      }));

      // Force refresh of backend user profile if it wasn't saved automatically by the endpoint
      // The endpoint analyze-library already calls user_profile_manager.save_profile
      // But let's verify if the backend actually persisted it.
      
      console.log("Analysis saved to frontend and backend.");

      setShowSuggestions(true);
      
    } catch (e) {
      console.error(e);
      alert("Failed to analyze interests. Ensure backend is running and Gemini key is valid.");
    } finally {
      setAnalyzingInterests(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("http://localhost:8000/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Upload failed");
      }

      const data = await res.json();
      
      // Create a local paper object
      const newPaper: Paper = {
        id: `local-${Date.now()}`,
        title: data.filename.replace(".pdf", ""), // Use filename as initial title
        authors: ["Me"], // Placeholder
        published_date: new Date().toISOString(),
        abstract: "Uploaded personal paper.",
        pdf_url: data.url,
        is_local: true
      };
      
      savePaperToLibrary(newPaper);
      alert("Paper uploaded successfully!");
      
    } catch (err) {
      console.error(err);
      alert("Failed to upload paper.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAnalyze = async (paper: Paper) => {
    setAnalyzingId(paper.id);
    setAnalyzingStatus("Starting analysis...");
    
    const eventSource = new EventSource(`http://localhost:8000/api/analyze-stream?pdf_url=${encodeURIComponent(paper.pdf_url)}`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "progress") {
          setAnalyzingStatus(data.message);
        } else if (data.type === "complete") {
          setPosterUrl(data.result.image_url);
          savePosterToCache(paper.id, data.result.image_url);
          eventSource.close();
          setAnalyzingId(null);
          setAnalyzingStatus("");
        } else if (data.type === "error") {
          alert(`Analysis failed: ${data.message}`);
          eventSource.close();
          setAnalyzingId(null);
          setAnalyzingStatus("");
        }
      } catch (e) {
        console.error(e);
      }
    };
    
    eventSource.onerror = (err) => {
      eventSource.close();
      setAnalyzingId(null);
      setAnalyzingStatus("");
    };
  };

  const handleViewPoster = (paperId: string) => {
    if (savedPosters[paperId]) {
      setPosterUrl(savedPosters[paperId]);
    }
  };

  const handleRemove = (paperId: string) => {
    if (!confirm("Are you sure you want to remove this paper from your library?")) return;

    // Update state
    const newPapers = savedPapers.filter(p => p.id !== paperId);
    setSavedPapers(newPapers);

    const newPosters = { ...savedPosters };
    delete newPosters[paperId];
    setSavedPosters(newPosters);

    // Update localStorage
    const savedMetadataStr = localStorage.getItem("daily_scholar_saved_papers");
    if (savedMetadataStr) {
        const metadataMap: Record<string, Paper> = JSON.parse(savedMetadataStr);
        delete metadataMap[paperId];
        localStorage.setItem("daily_scholar_saved_papers", JSON.stringify(metadataMap));
    }
    localStorage.setItem("daily_scholar_posters", JSON.stringify(newPosters));
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

  // Helper to render paper card
  const PaperCard = ({ paper }: { paper: Paper }) => {
    if (viewMode === 'grid') {
      return (
        <div key={paper.id} className="group bg-white rounded-xl border border-gray-100 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-blue-100 flex flex-col h-full">
          <div className="p-5 flex-1 flex flex-col">
            {/* Top Row */}
            <div className="flex items-center justify-between mb-3">
                 <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600">
                    {paper.is_local ? "Uploaded" : "Saved"}
                 </span>
                 <button className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-50">
                    <MoreHorizontal className="h-4 w-4" />
                 </button>
            </div>
            
            {/* Content */}
            <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 leading-snug mb-1 line-clamp-2">
                    {paper.title}
                </h3>
                <p className="text-sm text-gray-500 truncate mb-2">
                    {paper.authors.slice(0, 3).join(", ")}
                </p>
                <div className="flex flex-wrap gap-2 mt-auto">
                    <span className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                        {new Date(paper.published_date).getFullYear()}
                    </span>
                    {paper.is_local && (
                        <span className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                            PDF
                        </span>
                    )}
                </div>
            </div>

            {/* Actions Separator */}
            <div className="border-t border-gray-50 my-3"></div>

            {/* Bottom Row Actions */}
            <div className="flex items-center justify-between gap-2">
               <a 
                 href={paper.pdf_url} 
                 target="_blank"
                 className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-blue-600 transition-colors px-2 py-1.5 rounded-md hover:bg-blue-50"
               >
                 <FileText className="h-3.5 w-3.5" /> Open PDF
               </a>
               
               <div className="flex items-center gap-1">
                   {paper.is_local && (
                       <button 
                           onClick={() => handleRemove(paper.id)}
                           className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                           title="Remove"
                       >
                           <Trash2 className="h-3.5 w-3.5" />
                       </button>
                   )}
                   
                   {savedPosters[paper.id] ? (
                       <button 
                         onClick={() => handleViewPoster(paper.id)}
                         className="flex items-center gap-1.5 text-xs font-medium text-green-600 hover:text-green-700 transition-colors px-2 py-1.5 rounded-md hover:bg-green-50"
                       >
                          <ImageIcon className="h-3.5 w-3.5" /> Poster
                       </button>
                   ) : (
                       <button 
                         onClick={() => handleAnalyze(paper)}
                         disabled={!!analyzingId}
                         className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-yellow-600 transition-colors px-2 py-1.5 rounded-md hover:bg-yellow-50"
                       >
                        {analyzingId === paper.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        Poster
                       </button>
                   )}
               </div>
            </div>
          </div>
        </div>
      );
    } else {
      // LIST MODE (Refined for SaaS look)
      return (
        <div key={paper.id} className="group flex items-center justify-between py-3 px-4 hover:bg-gray-50 transition-colors bg-white border-b border-gray-50 last:border-0">
            <div className="flex-1 min-w-0 pr-8 flex items-center gap-4">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${paper.is_local ? 'bg-blue-400' : 'bg-purple-400'}`} />
                <div>
                    <h3 className="text-sm font-medium text-gray-900 truncate max-w-md">
                        {paper.title}
                    </h3>
                    <p className="text-xs text-gray-500 truncate">
                        {paper.authors.slice(0, 2).join(", ")} • {new Date(paper.published_date).getFullYear()}
                    </p>
                </div>
            </div>
            
            <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <a 
                    href={paper.pdf_url} 
                    target="_blank"
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                    title="Open PDF"
                >
                    <FileText className="h-4 w-4" />
                </a>
                
                {savedPosters[paper.id] ? (
                    <button
                        onClick={() => handleViewPoster(paper.id)}
                        className="p-1.5 rounded-md transition-colors text-green-600 bg-green-50 hover:bg-green-100"
                        title="View Poster"
                    >
                        <ImageIcon className="h-4 w-4" />
                    </button>
                ) : (
                    <button
                         onClick={() => handleAnalyze(paper)}
                         disabled={!!analyzingId}
                         className="p-1.5 rounded-md transition-colors text-gray-400 hover:text-yellow-600 hover:bg-yellow-50"
                         title="Generate Poster"
                    >
                        {analyzingId === paper.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Sparkles className="h-4 w-4" />
                        )}
                    </button>
                )}

                {paper.is_local && (
                    <button 
                        onClick={() => handleRemove(paper.id)} 
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="Remove"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                )}
                
                <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md transition-colors">
                    <MoreHorizontal className="h-4 w-4" />
                </button>
            </div>
        </div>
      );
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto pb-20 px-8 pt-8">
      {/* 1. Header Area (The Toolbar) */}
      <div className="flex justify-between items-end mb-8">
        <div>
            <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-gray-800">My Library</h1>
                <span className="bg-gray-100 text-gray-500 text-xs px-2.5 py-0.5 rounded-full font-medium">
                    {savedPapers.length}
                </span>
            </div>
            <p className="text-sm text-gray-500">Manage and organize your research collection.</p>
        </div>
        
        <div className="flex items-center gap-3">
            <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input 
                    type="text" 
                    placeholder="Filter library..." 
                    className="h-9 w-64 pl-9 pr-4 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
            </div>
            
            <div className="flex items-center bg-white border border-gray-200 rounded-lg h-9 px-1">
                <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
                    title="Grid View"
                >
                    <LayoutGrid className="h-4 w-4" />
                </button>
                <div className="w-[1px] h-4 bg-gray-200 mx-1"></div>
                <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
                    title="List View"
                >
                    <List className="h-4 w-4" />
                </button>
            </div>
            
            <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="h-9 px-4 bg-stone-900 hover:bg-black text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 shadow-sm"
            >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                <span>Upload PDF</span>
            </button>
            <input 
                type="file" 
                accept=".pdf" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileUpload}
            />
        </div>
      </div>

      {/* 2. Content Area */}
      {savedPapers.length === 0 ? (
         <div className="flex flex-col items-center justify-center py-32 bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-100">
             <div className="h-16 w-16 bg-white rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-gray-100">
                <FolderUp className="h-8 w-8 text-gray-300" />
             </div>
             <h3 className="text-lg font-semibold text-gray-900 mb-1">Your library is empty</h3>
             <p className="text-gray-500 text-sm max-w-sm text-center mb-6">
                Upload PDF papers or save them from search results to build your personal knowledge base.
             </p>
             <button 
                onClick={() => fileInputRef.current?.click()}
                className="text-blue-600 text-sm font-medium hover:underline"
             >
                Upload your first paper
             </button>
         </div>
      ) : (
        <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "flex flex-col bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm"}>
             {savedPapers.map(paper => <PaperCard key={paper.id} paper={paper} />)}
        </div>
      )}

      {/* Floating Action for Analysis (if items exist) */}
      {savedPapers.length > 0 && (
         <div className="fixed bottom-8 right-8 z-20">
             <button 
                onClick={handleAnalyzeInterests}
                disabled={analyzingInterests}
                className="h-12 px-6 bg-white text-stone-900 border border-gray-200 hover:border-gray-300 shadow-xl rounded-full flex items-center gap-2 transition-all hover:-translate-y-1 font-medium"
             >
                {analyzingInterests ? (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                ) : (
                  <BrainCircuit className="h-4 w-4 text-blue-600" />
                )}
                <span>Analyze Library Interests</span>
             </button>
         </div>
      )}

      {/* Suggestions Modal */}
      {showSuggestions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/20">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <BrainCircuit className="h-5 w-5 text-primary" /> Analysis Results
              </h3>
              <button onClick={() => setShowSuggestions(false)} className="p-2 hover:bg-muted rounded-full">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-8 overflow-y-auto">
              
              {/* Research Directions */}
              {researchDirections.length > 0 && (
                <div className="space-y-3">
                    <h4 className="font-medium text-foreground flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-yellow-500" /> Identified Research Directions
                    </h4>
                    <div className="grid gap-3">
                        {researchDirections.map((direction, idx) => (
                            <div key={idx} className="bg-secondary/30 p-3 rounded-md text-sm border border-secondary">
                                {direction}
                            </div>
                        ))}
                    </div>
                </div>
              )}

              {/* Suggested Queries */}
              <div className="space-y-3">
                  <h4 className="font-medium text-foreground flex items-center gap-2">
                      <Search className="h-4 w-4 text-blue-500" /> Suggested Search Queries
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Click to search for new papers in these areas:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {suggestedQueries.map((query, idx) => (
                      <Link 
                        key={idx} 
                        href={`/?q=${encodeURIComponent(query)}`}
                        className="flex items-center justify-between p-3 rounded-md border hover:border-primary hover:bg-primary/5 transition-colors group bg-card"
                      >
                        <span className="text-sm font-medium truncate" title={query}>{query}</span>
                        <Search className="h-3 w-3 text-muted-foreground group-hover:text-primary shrink-0" />
                      </Link>
                    ))}
                  </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Poster Modal Overlay (Reused) */}
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
