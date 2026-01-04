import os
import json
import hashlib
from typing import List, Optional, Dict, Any
from pathlib import Path

class CacheManager:
    def __init__(self, cache_dir: str = "data/cache"):
        self.cache_dir = Path(cache_dir)
        self.posters_dir = self.cache_dir / "posters"
        self.library_dir = self.cache_dir / "library"
        
        # Create directories
        self.posters_dir.mkdir(parents=True, exist_ok=True)
        self.library_dir.mkdir(parents=True, exist_ok=True)

    def _get_hash(self, key: str) -> str:
        return hashlib.md5(key.encode('utf-8')).hexdigest()

    def _get_list_hash(self, items: List[str]) -> str:
        # Sort to ensure order doesn't matter
        sorted_items = sorted(items)
        joined = "|".join(sorted_items)
        return self._get_hash(joined)

    # --- Poster Cache ---
    
    def get_poster(self, pdf_url: str) -> Optional[Dict[str, Any]]:
        key = self._get_hash(pdf_url)
        file_path = self.posters_dir / f"{key}.json"
        
        if file_path.exists():
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                print(f"Error reading poster cache: {e}")
                return None
        return None

    def save_poster(self, pdf_url: str, data: Dict[str, Any]):
        key = self._get_hash(pdf_url)
        file_path = self.posters_dir / f"{key}.json"
        
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"Error saving poster cache: {e}")

    # --- Library Analysis Cache ---

    def get_library_analysis(self, file_paths: List[str]) -> Optional[Dict[str, Any]]:
        key = self._get_list_hash(file_paths)
        file_path = self.library_dir / f"{key}.json"
        
        if file_path.exists():
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                print(f"Error reading library cache: {e}")
                return None
        return None

    def save_library_analysis(self, file_paths: List[str], data: Dict[str, Any]):
        key = self._get_list_hash(file_paths)
        file_path = self.library_dir / f"{key}.json"
        
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"Error saving library cache: {e}")
