import json
import os
import requests
import tempfile
import time
import pathlib
import uuid
from google import genai
from google.genai import types
from jinja2 import Template, Environment, FileSystemLoader
from typing import Dict, Any, Optional
from config import Config

class GeminiAgent:
    def __init__(self):
        # Configure Proxy if set
        if Config.HTTP_PROXY:
            os.environ["HTTP_PROXY"] = Config.HTTP_PROXY
        if Config.HTTPS_PROXY:
            os.environ["HTTPS_PROXY"] = Config.HTTPS_PROXY

        # Initialize Client
        # Note: google-genai Client picks up GOOGLE_API_KEY from env automatically if not passed,
        # but passing it explicitly is safer if Config handles loading.
        self.client = genai.Client(api_key=Config.GOOGLE_API_KEY)
        self.model_id = Config.GEMINI_MODEL_NAME
        self.template_env = Environment(loader=FileSystemLoader("templates"))

    def analyze_library(self, file_paths: list[str]) -> Dict[str, Any]:
        """
        Analyzes multiple PDF files to extract user research interests and suggested queries.
        """
        prompt = """
        You are a research mentor. I have provided you with a set of academic papers that represent my current research interests.
        
        Your task is to:
        1. Read these papers to understand the specific problems, methods, and domains I am interested in.
        2. Synthesize my core "Research Directions". These should be descriptive summaries of the fields (e.g., "Efficient Fine-tuning of LLMs", "Multimodal RAG Systems").
        3. Generate a list of "Suggested Search Queries" for arXiv. These should be keywords or short phrases likely to find *new* and *relevant* papers in these areas.

        Output strictly in valid JSON format with the following schema:
        {
            "research_directions": [
                "Direction 1: Brief description",
                "Direction 2: Brief description"
            ],
            "suggested_queries": [
                "Query 1",
                "Query 2",
                "Query 3",
                "Query 4",
                "Query 5"
            ]
        }
        """

        uploaded_files = []
        
        try:
            print(f"Analyzing library with {len(file_paths)} files...")
            
            # 1. Upload all files
            for path in file_paths:
                if not os.path.exists(path):
                    print(f"Warning: File not found {path}, skipping.")
                    continue
                    
                print(f"Uploading {path} to Gemini...")
                try:
                    upload_file = self.client.files.upload(file=pathlib.Path(path))
                    
                    # Wait for processing
                    while upload_file.state.name == "PROCESSING":
                        time.sleep(1)
                        upload_file = self.client.files.get(name=upload_file.name)
                        
                    if upload_file.state.name == "FAILED":
                        print(f"Failed to process {path}")
                        continue
                        
                    uploaded_files.append(upload_file)
                except Exception as e:
                    print(f"Error uploading {path}: {e}")

            if not uploaded_files:
                raise ValueError("No valid files could be processed for analysis.")

            # 2. Generate Content
            print("Generating library analysis...")
            
            # Combine files and prompt
            contents = uploaded_files + [prompt]
            
            response = self.client.models.generate_content(
                model=self.model_id,
                contents=contents,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )
            
            return json.loads(response.text)

        except Exception as e:
            print(f"Error in library analysis: {e}")
            return {
                "research_directions": ["Error analyzing files."],
                "suggested_queries": ["Deep Learning", "Artificial Intelligence"] # Fallbacks
            }

    def summarize_paper(self, pdf_url: str, progress_callback=None) -> Dict[str, Any]:
        """
        Downloads PDF, uploads to Gemini, and summarizes using Multimodal File API.
        """
        prompt = """
        You are an expert academic editor and researcher. 
        Your task is to read the attached academic paper (PDF) and extract key information into a structured JSON format.
        
        The audience is busy researchers who need to quickly decide if a paper is worth reading.
        
        Output strictly in valid JSON format with the following schema:
        {
            "title": "A simplified, punchy title (max 10 words)",
            "one_sentence_summary": "A single, powerful sentence capturing the core contribution.",
            "key_innovations": [
                {"emoji": "🚀", "title": "Innovation 1 Title", "description": "Short explanation"},
                {"emoji": "💡", "title": "Innovation 2 Title", "description": "Short explanation"},
                {"emoji": "⚙️", "title": "Innovation 3 Title", "description": "Short explanation"}
            ],
            "impact_statement": "Why this research matters for the field (1-2 sentences).",
            "tags": ["Tag1", "Tag2", "Tag3"],
            "design_theme": {
                "accent_color": "#HexColorCode (choose a color that fits the topic)",
                "highlight_bg": "#HexColorCode (a very light version of accent color)"
            }
        }
        """
        
        temp_file_path = None
        
        try:
            # 1. Download PDF
            if progress_callback: progress_callback("Downloading PDF from arXiv...")
            print(f"Downloading PDF from {pdf_url}...")
            # Use a browser-like User-Agent to avoid 403 Forbidden from arXiv
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
            try:
                # Use a short timeout for connection, longer for read
                response = requests.get(pdf_url, headers=headers, stream=True, timeout=(10, 60))
                response.raise_for_status()
            except requests.exceptions.RequestException as e:
                raise RuntimeError(f"Download failed: {str(e)}")
            
            # Create a temp file
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
                for chunk in response.iter_content(chunk_size=8192):
                    temp_file.write(chunk)
                temp_file_path = temp_file.name
            
            # 2. Upload to Gemini using Client
            if progress_callback: progress_callback("Uploading PDF to Gemini...")
            print("Uploading to Gemini File API...")
            try:
                # New SDK upload method - use 'file' keyword argument with pathlib.Path object
                upload_file = self.client.files.upload(file=pathlib.Path(temp_file_path))
                
                # Wait for processing
                while upload_file.state.name == "PROCESSING":
                    if progress_callback: progress_callback("Gemini is processing the file...")
                    time.sleep(2)
                    upload_file = self.client.files.get(name=upload_file.name)
                    
                if upload_file.state.name == "FAILED":
                    raise ValueError("Gemini failed to process the PDF file.")
            except Exception as e:
                raise RuntimeError(f"Gemini Upload failed: {str(e)}")

            # 3. Generate Content
            if progress_callback: progress_callback("Reading and summarizing paper...")
            print("Generating summary...")
            try:
                # New SDK generate_content method
                response = self.client.models.generate_content(
                    model=self.model_id,
                    contents=[upload_file, prompt],
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json"
                    )
                )
                if progress_callback: progress_callback("Summary generated. Rendering poster...")
                return json.loads(response.text)
            except Exception as e:
                raise RuntimeError(f"Gemini Generation failed: {str(e)}")

        except Exception as e:
            print(f"Error in multimodal summarization: {e}")
            return {
                "title": "Error Processing Paper",
                "one_sentence_summary": f"{str(e)}",
                "key_innovations": [],
                "impact_statement": "Please check your network connection and proxy settings.",
                "tags": ["Error"],
                "design_theme": {"accent_color": "#ff0000", "highlight_bg": "#ffe6e6"}
            }
        finally:
            # Cleanup
            if temp_file_path and os.path.exists(temp_file_path):
                os.remove(temp_file_path)

    def summarize_text(self, text: str) -> Dict[str, Any]:
        """
        Summarizes the text into a structured JSON format.
        """
        prompt = """
        You are an expert academic editor and researcher. 
        Your task is to read the following academic paper abstract and extract key information into a structured JSON format.
        
        The audience is busy researchers who need to quickly decide if a paper is worth reading.
        
        Output strictly in valid JSON format with the following schema:
        {
            "title": "A simplified, punchy title (max 10 words)",
            "one_sentence_summary": "A single, powerful sentence capturing the core contribution.",
            "key_innovations": [
                {"emoji": "🚀", "title": "Innovation 1 Title", "description": "Short explanation"},
                {"emoji": "💡", "title": "Innovation 2 Title", "description": "Short explanation"},
                {"emoji": "⚙️", "title": "Innovation 3 Title", "description": "Short explanation"}
            ],
            "impact_statement": "Why this research matters for the field (1-2 sentences).",
            "tags": ["Tag1", "Tag2", "Tag3"],
            "design_theme": {
                "accent_color": "#HexColorCode (choose a color that fits the topic)",
                "highlight_bg": "#HexColorCode (a very light version of accent color)"
            }
        }

        Abstract:
        """
        
        try:
            # New SDK generate_content method
            response = self.client.models.generate_content(
                model=self.model_id,
                contents=f"{prompt}\n{text}",
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )
            return json.loads(response.text)
        except Exception as e:
            print(f"Error in summarization: {e}")
            # Fallback structure
            return {
                "title": "Error Processing Summary",
                "one_sentence_summary": "Could not generate summary due to API error.",
                "key_innovations": [],
                "impact_statement": str(e),
                "tags": ["Error"],
                "design_theme": {"accent_color": "#ff0000", "highlight_bg": "#ffe6e6"}
            }

    def generate_poster_html(self, summary_json: Dict[str, Any]) -> str:
        """
        Generates HTML code for the poster using Jinja2 template.
        """
        try:
            template = self.template_env.get_template("poster_template.html")
            
            # Helper to safely get nested values
            def safe_get(data, keys, default=None):
                for key in keys:
                    if isinstance(data, dict):
                        data = data.get(key, {})
                    else:
                        return default
                return data if data else default

            # Check if summary_json is a list (sometimes Gemini returns a list of one object)
            if isinstance(summary_json, list):
                if len(summary_json) > 0:
                    summary_json = summary_json[0]
                else:
                    summary_json = {}

            # Map JSON data to template variables
            render_data = {
                "poster_title": summary_json.get("title", "Untitled"),
                "one_sentence_summary": summary_json.get("one_sentence_summary", ""),
                "key_innovations": summary_json.get("key_innovations", []),
                "impact_statement": summary_json.get("impact_statement", ""),
                "tags": summary_json.get("tags", []),
                "accent_color": summary_json.get("design_theme", {}).get("accent_color", "#3b82f6"),
                "highlight_bg": summary_json.get("design_theme", {}).get("highlight_bg", "#eff6ff"),
                "title": summary_json.get("title", "Paper Poster")
            }
            
            return template.render(**render_data)
        except Exception as e:
            print(f"Error generating poster HTML: {e}")
            return f"<div>Error generating poster: {str(e)}</div>"

    def generate_poster_prompt(self, pdf_url: str, progress_callback=None) -> str:
        """
        Generates a prompt for the image generator based on the paper content.
        Uses GEMINI_TEXT_MODEL.
        """
        prompt = "我现在要利用nanobanana画这个文章的主要内容，形成一个学术风格的海报。要求：1. 图像比例为16:9（横屏PPT尺寸）；2. 内容必须高度凝练、信息密度适中，避免大面积空白或无意义的装饰；3. 风格学术、简洁、专业。你帮我根据这个文章内容生成一个绘画prompt。"
        
        pdf_filename = os.path.basename(pdf_url)
        if not pdf_filename.lower().endswith('.pdf'):
            pdf_filename += '.pdf'
        
        # Ensure uploads directory exists
        uploads_dir = "uploads"
        os.makedirs(uploads_dir, exist_ok=True)
        
        saved_pdf_path = os.path.join(uploads_dir, pdf_filename)
        
        try:
            # 1. Download PDF (if not exists)
            if os.path.exists(saved_pdf_path) and os.path.getsize(saved_pdf_path) > 0:
                 print(f"PDF already exists at {saved_pdf_path}, skipping download.")
            else:
                if progress_callback: progress_callback("Downloading PDF from arXiv...")
                print(f"Downloading PDF from {pdf_url}...")
                headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
                }
                try:
                    response = requests.get(pdf_url, headers=headers, stream=True, timeout=(10, 60))
                    response.raise_for_status()
                except requests.exceptions.RequestException as e:
                    raise RuntimeError(f"Download failed: {str(e)}")
                
                with open(saved_pdf_path, "wb") as pdf_file:
                    for chunk in response.iter_content(chunk_size=8192):
                        pdf_file.write(chunk)
            
            # Check file size
            file_size = os.path.getsize(saved_pdf_path)
            print(f"PDF size: {file_size} bytes")
            if file_size == 0:
                raise ValueError("PDF is empty (0 bytes).")
            
            # 2. Upload to Gemini
            if progress_callback: progress_callback("Uploading PDF to Gemini...")
            print("Uploading to Gemini File API...")
            try:
                # Add retry logic for upload
                max_retries = 3
                for attempt in range(max_retries):
                    try:
                        upload_file = self.client.files.upload(file=pathlib.Path(saved_pdf_path))
                        break
                    except Exception as e:
                        if attempt == max_retries - 1:
                            raise e
                        print(f"Upload attempt {attempt+1} failed: {e}. Retrying...")
                        time.sleep(2)
                
                while upload_file.state.name == "PROCESSING":
                    if progress_callback: progress_callback("Gemini is processing the file...")
                    time.sleep(2)
                    upload_file = self.client.files.get(name=upload_file.name)
                
                if upload_file.state.name == "FAILED":
                    raise ValueError("Gemini failed to process the PDF file.")
            except Exception as e:
                raise RuntimeError(f"Gemini Upload failed: {str(e)}")

            # 3. Generate Prompt
            if progress_callback: progress_callback("Generating Image Prompt...")
            print("Generating prompt...")
            try:
                response = self.client.models.generate_content(
                    model=Config.GEMINI_TEXT_MODEL,
                    contents=[upload_file, prompt]
                )
                return response.text
            except Exception as e:
                raise RuntimeError(f"Gemini Prompt Generation failed: {str(e)}")

        except Exception as e:
            print(f"Error in prompt generation: {e}")
            raise e
        # Note: We do NOT delete the file in finally block anymore

    def generate_poster_image(self, prompt: str, output_dir: str = "uploads") -> str:
        """
        Generates an image based on the prompt and saves it.
        Uses GEMINI_IMAGE_MODEL.
        Returns the filename.
        """
        try:
            print(f"Generating image with prompt (len={len(prompt)})...")
            
            response = self.client.models.generate_content(
                model=Config.GEMINI_IMAGE_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_modalities=['Text', 'Image']
                )
            )
            
            for part in response.parts:
                if part.inline_data:
                    # Found image data
                    filename = f"{uuid.uuid4()}.png"
                    filepath = os.path.join(output_dir, filename)
                    
                    # Ensure directory exists
                    os.makedirs(output_dir, exist_ok=True)
                    
                    # Write bytes
                    with open(filepath, "wb") as f:
                        f.write(part.inline_data.data)
                        
                    print(f"Image saved to {filepath}")
                    return filename
            
            # If no image found, check text for error or refusal
            text_content = ""
            for part in response.parts:
                if part.text:
                    text_content += part.text
            
            raise ValueError(f"No image generated. Response text: {text_content[:200]}...")
            
        except Exception as e:
            print(f"Error generating image: {e}")
            raise e

    def generate_daily_digest_prompt(self, papers_summary: str) -> str:
        """
        Generates a prompt for the daily digest poster based on summarized papers.
        """
        prompt = f"""
        You are a design assistant. I need to create a "Daily Research Digest" poster for today.
        
        Here are the summaries of the top 5 papers found today:
        {papers_summary}
        
        Your task is to write a detailed image generation prompt for a single, comprehensive academic poster that visualizes these key updates.
        
        Requirements for the prompt:
        1. Format: 16:9 Landscape (PPT style).
        2. Style: Professional, clean, academic infographic style. Minimalist but informative.
        3. Content: The poster should abstractly represent the themes of these papers. It should look like a "Daily Briefing" slide.
        4. Text: It should ideally include a title "Daily Research Digest" and maybe 1-2 key themes as text elements if possible, but primarily focus on the visual composition.
        
        Please output ONLY the prompt string, nothing else.
        """
        
        try:
            print("Generating Daily Digest Prompt...")
            response = self.client.models.generate_content(
                model=Config.GEMINI_TEXT_MODEL,
                contents=prompt
            )
            return response.text
        except Exception as e:
            print(f"Error generating digest prompt: {e}")
            raise e
