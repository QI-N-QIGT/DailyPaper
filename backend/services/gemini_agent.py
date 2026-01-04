import json
import os
import requests
import tempfile
import time
import pathlib
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
