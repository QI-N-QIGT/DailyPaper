import os
from dotenv import load_dotenv

# Load environment variables from .env file if it exists
load_dotenv()

class Config:
    # API Configuration
    GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
    
    # Proxy Configuration (Optional)
    HTTP_PROXY = os.getenv("HTTP_PROXY")
    HTTPS_PROXY = os.getenv("HTTPS_PROXY")
    
    # Model Configuration
    # Using Flash for speed as requested for the MVP
    GEMINI_MODEL_NAME = "gemini-3-flash-preview" 
    
    # Search Configuration
    ARXIV_MAX_RESULTS = 5
    
    # App Configuration
    PAGE_TITLE = "Daily Paper Reader"
    PAGE_ICON = "📑"

    @staticmethod
    def validate():
        if not Config.GOOGLE_API_KEY:
            return False, "Google API Key is missing. Please set it in the sidebar or .env file."
        return True, ""
