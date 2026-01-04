"use client";

import { useEffect, useState, useRef } from "react";
import { FileText, Download, X, Image as ImageIcon, Trash2, Upload, Loader2, Sparkles, FolderUp, Bookmark, BrainCircuit, Search } from "lucide-react";
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
  const [posterHtml, setPosterHtml] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analyzingStatus, setAnalyzingStatus] = useState<string>("");
  const [analyzingInterests, setAnalyzingInterests] = useState(false);
  const [suggestedQueries, setSuggestedQueries] = useState<string[]>([]);
  const [researchDirections, setResearchDirections] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
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
          setPosterHtml(data.result.html_content);
          savePosterToCache(paper.id, data.result.html_content);
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
      setPosterHtml(savedPosters[paperId]);
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
    if (!iframeRef.current || !iframeRef.current.contentDocument) return;

    try {
      const iframeBody = iframeRef.current.contentDocument.body;
      const posterElement = iframeBody.querySelector('.poster') as HTMLElement;
      
      if (!posterElement) {
        alert("Could not find poster element");
        return;
      }
      
      const canvas = await html2canvas(posterElement, {
        scale: 2, 
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

  // Helper to render paper card
  const PaperCard = ({ paper }: { paper: Paper }) => (
    <div key={paper.id} className="group flex flex-col rounded-xl border bg-card text-card-foreground shadow-sm transition-all hover:shadow-md h-full">
      <div className="p-6 flex-1 flex flex-col space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
             <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-secondary text-secondary-foreground">
                {new Date(paper.published_date).getFullYear()}
             </span>
             <button onClick={() => handleRemove(paper.id)} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
               <Trash2 className="h-3 w-3" /> Remove
             </button>
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
           {savedPosters[paper.id] ? (
               <button 
                 onClick={() => handleViewPoster(paper.id)}
                 className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border h-9 px-4 py-2 w-full gap-2 bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
               >
                  <FileText className="h-4 w-4" /> View Saved Poster
               </button>
           ) : (
               <button 
                 onClick={() => handleAnalyze(paper)}
                 disabled={!!analyzingId}
                 className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 w-full gap-2 relative overflow-hidden"
               >
                {analyzingId === paper.id ? (
                  <>
                    <div className="absolute inset-0 bg-secondary/50 animate-pulse" style={{ width: '100%' }}></div>
                    <div className="relative z-10 flex items-center gap-2">
                       <Loader2 className="h-4 w-4 animate-spin" /> 
                       <span className="truncate max-w-[150px]">{analyzingStatus || "Analyzing..."}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 text-yellow-500" /> Generate Poster
                  </>
                )}
               </button>
           )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between border-b pb-6">
        <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">My Library</h1>
            <p className="text-muted-foreground">
            Manage your personal uploads and saved research.
            </p>
        </div>
        <div>
            <input 
                type="file" 
                accept=".pdf" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileUpload}
            />
            <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 shadow-sm"
            >
                {uploading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</>
                ) : (
                    <><Upload className="mr-2 h-4 w-4" /> Upload PDF</>
                )}
            </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left Column: Uploads */}
        <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-lg font-semibold text-primary">
                    <FolderUp className="h-5 w-5" />
                    <h2>Personal Uploads</h2>
                    <span className="ml-auto text-xs font-normal bg-muted px-2 py-1 rounded-full text-muted-foreground">{uploadedPapers.length}</span>
                </div>
                
                {uploadedPapers.length > 0 && (
                  <button 
                    onClick={handleAnalyzeInterests}
                    disabled={analyzingInterests}
                    className="text-xs flex items-center gap-1 text-primary hover:underline disabled:opacity-50"
                  >
                    {analyzingInterests ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <BrainCircuit className="h-3 w-3" />
                    )}
                    Analyze Interests
                  </button>
                )}
            </div>
            
            {uploadedPapers.length === 0 ? (
                <div className="text-center py-12 bg-muted/20 rounded-xl border border-dashed">
                  <p className="text-muted-foreground text-sm">No uploads yet.</p>
                </div>
            ) : (
                <div className="grid gap-4 grid-cols-1">
                    {uploadedPapers.map(paper => <PaperCard key={paper.id} paper={paper} />)}
                </div>
            )}
        </div>

        {/* Right Column: Saved from Search */}
        <div className="flex-1 space-y-6">
            <div className="flex items-center gap-2 text-lg font-semibold text-primary">
                <Bookmark className="h-5 w-5" />
                <h2>Saved from Search</h2>
                <span className="ml-auto text-xs font-normal bg-muted px-2 py-1 rounded-full text-muted-foreground">{savedFromSearchPapers.length}</span>
            </div>

            {savedFromSearchPapers.length === 0 ? (
                <div className="text-center py-12 bg-muted/20 rounded-xl border border-dashed">
                  <p className="text-muted-foreground text-sm">No saved papers yet.</p>
                </div>
            ) : (
                <div className="grid gap-4 grid-cols-1">
                    {savedFromSearchPapers.map(paper => <PaperCard key={paper.id} paper={paper} />)}
                </div>
            )}
        </div>
      </div>

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
