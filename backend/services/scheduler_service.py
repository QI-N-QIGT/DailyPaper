import time
import os
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from services.arxiv_fetcher import ArxivFetcher
from services.gemini_agent import GeminiAgent
from services.user_profile_manager import UserProfileManager
from datetime import datetime

class SchedulerService:
    def __init__(self, gemini_agent: GeminiAgent, profile_manager: UserProfileManager):
        self.scheduler = BackgroundScheduler()
        self.gemini_agent = gemini_agent
        self.profile_manager = profile_manager
        self.output_dir = "uploads/daily_digests"
        os.makedirs(self.output_dir, exist_ok=True)

    def start(self):
        # Schedule daily task at 8:00 AM
        trigger = CronTrigger(hour=8, minute=0)
        self.scheduler.add_job(self.run_daily_digest, trigger)
        self.scheduler.start()
        print("Scheduler started. Daily Digest scheduled for 08:00.")

    def run_daily_digest(self):
        print(f"[{datetime.now()}] Starting Daily Digest generation...")
        try:
            # 1. Get User Interests
            profile = self.profile_manager.get_profile()
            queries = profile.get("suggested_queries", [])
            
            if not queries:
                print("No user interests found. Skipping Daily Digest.")
                return

            # 2. Search Papers (Last 24h)
            all_papers = []
            # Increase days_back to 30 to ensure we find something for testing purposes if today's yield is low
            days_search = 30 
            for query in queries[:3]: # Limit to top 3 queries to save API calls
                print(f"Searching for: {query} (past {days_search} days)")
                papers = ArxivFetcher.search_papers(query, max_results=2, days_back=days_search)
                all_papers.extend(papers)
            
            if not all_papers:
                print("No new papers found today.")
                return

            # Deduplicate by ID
            unique_papers = {p.id: p for p in all_papers}.values()
            top_papers = list(unique_papers)[:5] # Take top 5
            
            print(f"Found {len(top_papers)} relevant papers.")

            # 3. Summarize for Prompt
            # We construct a text summary for the prompt generator
            summary_text = ""
            for i, p in enumerate(top_papers):
                summary_text += f"{i+1}. {p.title}: {p.abstract[:200]}...\n"

            # 4. Generate Prompt
            prompt = self.gemini_agent.generate_daily_digest_prompt(summary_text)
            
            # 5. Generate Image
            filename = self.gemini_agent.generate_poster_image(prompt, output_dir=self.output_dir)
            
            # Save metadata about this digest
            digest_meta = {
                "date": datetime.now().strftime("%Y-%m-%d"),
                "image_url": f"http://127.0.0.1:8000/uploads/daily_digests/{filename}",
                "papers": [{"id": p.id, "title": p.title} for p in top_papers]
            }
            
            # Save latest digest info to a JSON file for frontend to fetch
            with open("data/latest_digest.json", "w") as f:
                import json
                json.dump(digest_meta, f)
                
            print(f"Daily Digest generated successfully: {filename}")

        except Exception as e:
            print(f"Error generating Daily Digest: {e}")

    def trigger_now(self):
        """Manually trigger for testing"""
        self.scheduler.add_job(self.run_daily_digest)
