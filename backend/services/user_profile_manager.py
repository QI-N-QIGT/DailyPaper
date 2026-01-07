import json
import os
from typing import List, Dict, Any, Optional

class UserProfileManager:
    def __init__(self, storage_file: str = "data/user_profile.json"):
        self.storage_file = storage_file
        self.ensure_storage_exists()
        
    def ensure_storage_exists(self):
        os.makedirs(os.path.dirname(self.storage_file), exist_ok=True)
        if not os.path.exists(self.storage_file):
            with open(self.storage_file, "w") as f:
                json.dump({"suggested_queries": [], "research_directions": []}, f)

    def save_profile(self, suggested_queries: List[str], research_directions: List[str]):
        """Saves user research interests to JSON file."""
        data = {
            "suggested_queries": suggested_queries,
            "research_directions": research_directions,
            "updated_at": os.path.getmtime(self.storage_file) if os.path.exists(self.storage_file) else 0
        }
        with open(self.storage_file, "w") as f:
            json.dump(data, f, indent=4)
        print(f"User profile saved to {self.storage_file}")

    def get_profile(self) -> Dict[str, Any]:
        """Loads user research interests."""
        try:
            with open(self.storage_file, "r") as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading profile: {e}")
            return {"suggested_queries": [], "research_directions": []}
