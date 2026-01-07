from fastapi import FastAPI, HTTPException, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional, Any
import json
import asyncio
import os
import shutil
import uuid
from services.arxiv_fetcher import ArxivFetcher, Paper
from services.gemini_agent import GeminiAgent
from services.cache_manager import CacheManager
from services.user_profile_manager import UserProfileManager
from services.scheduler_service import SchedulerService
from config import Config

app = FastAPI(title="Daily Scholar API")

# Mount uploads directory to serve static files
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

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

class LibraryAnalyzeRequest(BaseModel):
    pdf_urls: List[str]

class PosterResponse(BaseModel):
    image_url: str
    summary_json: Optional[Any] = None

class UploadResponse(BaseModel):
    url: str
    filename: str

# --- Services ---
gemini_agent = None
cache_manager = None
user_profile_manager = None
scheduler_service = None

@app.on_event("startup")
def startup_event():
    global gemini_agent, cache_manager, user_profile_manager, scheduler_service
    try:
        Config.validate()
        gemini_agent = GeminiAgent()
        cache_manager = CacheManager()
        user_profile_manager = UserProfileManager()
        
        # Initialize and start scheduler
        scheduler_service = SchedulerService(gemini_agent, user_profile_manager)
        scheduler_service.start()
        
        print("Services initialized successfully.")
    except Exception as e:
        print(f"Warning: Failed to initialize services: {e}")

# --- Endpoints ---

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "message": "Backend is running smoothly"}

@app.post("/api/upload", response_model=UploadResponse)
async def upload_file(file: UploadFile = File(...)):
    """
    Upload a PDF file to the server.
    """
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    try:
        # Generate a unique filename to prevent collisions
        file_ext = os.path.splitext(file.filename)[1]
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        file_path = f"uploads/{unique_filename}"
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Return the URL to access the file
        # Assuming server runs on localhost:8000
        url = f"http://127.0.0.1:8000/uploads/{unique_filename}"
        
        return UploadResponse(url=url, filename=file.filename)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")

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
                    # New Pipeline: Prompt -> Image
                    prompt = gemini_agent.generate_poster_prompt(pdf_url, progress_callback=callback)
                    
                    callback("Generating Poster Image (this may take a moment)...")
                    image_filename = gemini_agent.generate_poster_image(prompt)
                    
                    # Assuming server runs on localhost:8000 - ideally use request.base_url but inside thread hard to access
                    image_url = f"http://127.0.0.1:8000/uploads/{image_filename}"
                    
                    result_container['data'] = {'image_url': image_url, 'summary_json': {}}
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
        # Check cache
        if cache_manager:
            cached_result = cache_manager.get_poster(request.pdf_url)
            if cached_result and 'image_url' in cached_result:
                print(f"Cache hit for poster: {request.pdf_url}")
                return PosterResponse(**cached_result)

        # 1. Generate Prompt
        prompt = gemini_agent.generate_poster_prompt(request.pdf_url)
        
        # 2. Generate Image
        image_filename = gemini_agent.generate_poster_image(prompt)
        image_url = f"http://127.0.0.1:8000/uploads/{image_filename}"
        
        response_data = {"image_url": image_url, "summary_json": {}}
        
        # Save cache
        if cache_manager:
            cache_manager.save_poster(request.pdf_url, response_data)

        return PosterResponse(**response_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze-library")
async def analyze_library(request: LibraryAnalyzeRequest):
    """
    Analyze multiple papers from the library to extract research directions and suggested queries.
    """
    if not gemini_agent:
        raise HTTPException(status_code=503, detail="Gemini Agent not initialized")
    
    try:
        # Convert URLs to local file paths
        file_paths = []
        for url in request.pdf_urls:
            # Assumes url format: http://.../uploads/filename.pdf
            filename = url.split("/")[-1]
            file_path = os.path.join("uploads", filename)
            if os.path.exists(file_path):
                file_paths.append(file_path)
            else:
                print(f"Warning: File not found for analysis: {file_path}")
        
        if not file_paths:
            raise HTTPException(status_code=400, detail="No valid local files found to analyze.")

        # Check cache (using file paths list)
        if cache_manager:
            cached_result = cache_manager.get_library_analysis(file_paths)
            if cached_result:
                print(f"Cache hit for library analysis of {len(file_paths)} files")
                return cached_result

        # Call Gemini Agent
        # Note: This is a synchronous call that might take time. 
        # For MVP, blocking is acceptable, but for production, use background tasks.
        result = await asyncio.to_thread(gemini_agent.analyze_library, file_paths)
        
        # Save cache
        if cache_manager:
            cache_manager.save_library_analysis(file_paths, result)

        # Save to User Profile for Scheduler
        if user_profile_manager:
            user_profile_manager.save_profile(
                suggested_queries=result.get("suggested_queries", []),
                research_directions=result.get("research_directions", [])
            )

        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/daily-digest")
async def get_daily_digest():
    """
    Returns the latest daily digest metadata.
    """
    try:
        digest_path = "data/latest_digest.json"
        if os.path.exists(digest_path):
            with open(digest_path, "r") as f:
                return json.load(f)
        return None
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/trigger-digest")
async def trigger_digest():
    """
    Manually triggers the daily digest generation (for testing).
    """
    if scheduler_service:
        scheduler_service.trigger_now()
        return {"message": "Daily Digest generation triggered."}
    raise HTTPException(status_code=503, detail="Scheduler service not initialized")

@app.get("/")
async def root():
    return {"message": "Welcome to Daily Scholar API"}
