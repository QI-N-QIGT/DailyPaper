from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Any
import json
import asyncio
from services.arxiv_fetcher import ArxivFetcher, Paper
from services.gemini_agent import GeminiAgent
from config import Config

app = FastAPI(title="Daily Scholar API")

# Configure CORS to allow requests from the frontend
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Data Models ---
class AnalyzeRequest(BaseModel):
    pdf_url: str

class PosterResponse(BaseModel):
    html_content: str
    summary_json: Any

# --- Services ---
gemini_agent = None

@app.on_event("startup")
def startup_event():
    global gemini_agent
    try:
        Config.validate()
        gemini_agent = GeminiAgent()
        print("Gemini Agent initialized successfully.")
    except Exception as e:
        print(f"Warning: Failed to initialize Gemini Agent: {e}")

# --- Endpoints ---

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "message": "Backend is running smoothly"}

@app.get("/api/search", response_model=List[Paper])
async def search_papers(query: str = Query(..., min_length=1), max_results: int = 10, days_back: int = 30):
    """
    Search for papers on arXiv.
    """
    try:
        papers = ArxivFetcher.search_papers(query, max_results=max_results, days_back=days_back)
        return papers
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/analyze-stream")
async def analyze_paper_stream(pdf_url: str = Query(..., min_length=1)):
    """
    Analyze a paper PDF and generate a poster with Server-Sent Events (SSE) for progress updates.
    """
    if not gemini_agent:
        raise HTTPException(status_code=503, detail="Gemini Agent not initialized")
    
    async def event_generator():
        try:
            # Helper to send progress updates
            def progress_callback(status_message):
                # We can't await in a synchronous callback, but we can assume this generator is iterated
                # For simplicity in this synchronous-wrapped-in-async architecture:
                pass
            
            # Since GeminiAgent is synchronous, we'll manually yield updates before/after blocking calls
            # Ideally, we would refactor GeminiAgent to be async, but for now we simulate steps
            
            yield f"data: {json.dumps({'type': 'progress', 'message': 'Downloading PDF from arXiv...'})}\n\n"
            await asyncio.sleep(0.1) 
            
            # We run the heavy lifting in a thread pool to not block the event loop
            # However, to stream *real* progress from inside the agent, we need a queue or callback
            # For this MVP, we will run it in chunks or just notify major steps if we can't easily hook in
            
            # Better approach for MVP: Use a simple queue or just yield statuses
            # Because run_in_executor won't let us yield from within the function easily without complex setup
            
            # Let's try to run it directly but with manual yields if possible? 
            # No, that blocks.
            # We will use a queue-based callback wrapper
            
            from queue import Queue
            q = Queue()
            
            def callback(msg):
                q.put(msg)
                
            # Run in separate thread
            import threading
            result_container = {}
            
            def worker():
                try:
                    summary = gemini_agent.summarize_paper(pdf_url, progress_callback=callback)
                    html = gemini_agent.generate_poster_html(summary)
                    result_container['data'] = {'html_content': html, 'summary_json': summary}
                except Exception as e:
                    result_container['error'] = str(e)
                finally:
                    q.put("DONE")

            t = threading.Thread(target=worker)
            t.start()
            
            while True:
                # Check for messages
                while not q.empty():
                    msg = q.get()
                    if msg == "DONE":
                        break
                    yield f"data: {json.dumps({'type': 'progress', 'message': msg})}\n\n"
                    await asyncio.sleep(0.1) # Yield control
                
                if not t.is_alive():
                    break
                
                await asyncio.sleep(0.5)
            
            if 'error' in result_container:
                 yield f"data: {json.dumps({'type': 'error', 'message': result_container['error']})}\n\n"
            else:
                 yield f"data: {json.dumps({'type': 'complete', 'result': result_container['data']})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.post("/api/analyze", response_model=PosterResponse)
async def analyze_paper(request: AnalyzeRequest):
    """
    Analyze a paper PDF and generate a poster.
    """
    if not gemini_agent:
        raise HTTPException(status_code=503, detail="Gemini Agent not initialized")
    
    try:
        # 1. Summarize
        summary_json = gemini_agent.summarize_paper(request.pdf_url)
        
        # 2. Generate HTML
        html_content = gemini_agent.generate_poster_html(summary_json)
        
        return PosterResponse(html_content=html_content, summary_json=summary_json)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def root():
    return {"message": "Welcome to Daily Scholar API"}
