import time
import os
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from services.arxiv_fetcher import ArxivFetcher
from services.gemini_agent import GeminiAgent
from services.user_profile_manager import UserProfileManager
from services.newspaper_layout import NewspaperLayout
from services.html_digest_renderer import render_from_latest
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
        # Added misfire_grace_time=3600 (1 hour) to handle cases where the machine was sleeping
        trigger = CronTrigger(hour=8, minute=0)
        self.scheduler.add_job(self.run_daily_digest, trigger, misfire_grace_time=3600)
        self.scheduler.start()
        print("Scheduler started. Daily Digest scheduled for 08:00.")

        # Catch-up mechanism: Check if today's digest is missing and it's past 8 AM
        self._check_and_run_catchup()

    def _check_and_run_catchup(self):
        try:
            today_str = datetime.now().strftime("%Y-%m-%d")
            digest_path = "data/latest_digest.json"
            
            should_run = False
            
            # Check if digest file exists and matches today
            if not os.path.exists(digest_path):
                should_run = True
            else:
                try:
                    import json
                    with open(digest_path, "r") as f:
                        meta = json.load(f)
                        if meta.get("date") != today_str:
                            should_run = True
                except Exception:
                    should_run = True
            
            # Check if it's past 8:00 AM
            now = datetime.now()
            if should_run and now.hour >= 8:
                print(f"[{now}] Catch-up: Daily Digest for {today_str} is missing. Triggering now...")
                # Run immediately in background
                self.scheduler.add_job(self.run_daily_digest)
        except Exception as e:
            print(f"Error in catch-up check: {e}")

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
                # Enhance query to target Computer Science categories and avoid irrelevant fields
                # We wrap the original query in parentheses and AND it with the category filter
                enhanced_query = f"({query}) AND (cat:cs.CL OR cat:cs.AI OR cat:cs.LG OR cat:cs.CV OR cat:cs.SE)"
                
                print(f"Searching for: {enhanced_query} (past {days_search} days)")
                papers = ArxivFetcher.search_papers(enhanced_query, max_results=2, days_back=days_search)
                all_papers.extend(papers)
            
            if not all_papers:
                print("No new papers found today.")
                return

            # Deduplicate by ID
            unique_papers = {p.id: p for p in all_papers}.values()
            top_papers = list(unique_papers)[:5] # Take top 5
            
            print(f"Found {len(top_papers)} relevant papers.")

            # 3. Summarize for Prompt + Per-article summaries
            summary_text = ""
            article_cards = []
            for i, p in enumerate(top_papers):
                summary_text += f"{i+1}. {p.title}: {p.abstract[:200]}...\n"

                # Generate structured summary from abstract (fast path)
                try:
                    s = self.gemini_agent.summarize_text(p.abstract)
                except Exception as _:
                    s = {
                        "title": p.title,
                        "one_sentence_summary": p.abstract[:180] + "...",
                        "key_innovations": [],
                        "design_theme": {"accent_color": "#1f2937", "highlight_bg": "#f3f4f6"}
                    }
                article_cards.append({
                    "paper_id": p.id,
                    "title": s.get("title", p.title),
                    "summary": s.get("one_sentence_summary", p.abstract[:180] + "..."),
                    "authors": ", ".join(p.authors[:3]),
                    "design_theme": s.get("design_theme", {}),
                })

            # 4. Generate Prompt
            prompt = self.gemini_agent.generate_daily_digest_prompt(summary_text)
            
            # 5. Generate Hero Image
            hero_filename = self.gemini_agent.generate_poster_image(prompt, output_dir=self.output_dir)
            hero_path = os.path.join(self.output_dir, hero_filename)

            # 6. Generate per-article thumbnails
            items_dir = os.path.join(self.output_dir, "items")
            os.makedirs(items_dir, exist_ok=True)
            for card in article_cards:
                try:
                    article_prompt = self.gemini_agent.generate_article_prompt(card)
                    thumb_name = self.gemini_agent.generate_poster_image(article_prompt, output_dir=items_dir)
                    card["image_path"] = os.path.join(items_dir, thumb_name)
                except Exception as _:
                    card["image_path"] = None

            # 7. Compose newspaper-style layout
            composite_name = NewspaperLayout.render_digest(
                title="Daily Scholar Digest",
                date_text=datetime.now().strftime("%Y-%m-%d"),
                hero_image_path=hero_path,
                articles=article_cards,
                output_dir=self.output_dir
            )
            
            # Save metadata about this digest
            digest_meta = {
                "date": datetime.now().strftime("%Y-%m-%d"),
                "image_url": f"http://127.0.0.1:8000/uploads/daily_digests/{composite_name}",
                "papers": [{"id": p.id, "title": p.title} for p in top_papers],
                "items": [
                    {
                        "paper_id": c["paper_id"],
                        "title": c["title"],
                        "summary": c["summary"],
                        "authors": c["authors"],
                        "image_url": (
                            f"http://127.0.0.1:8000/uploads/daily_digests/items/{os.path.basename(c['image_path'])}"
                            if c.get("image_path") else None
                        )
                    } for c in article_cards
                ]
            }
            
            # Save latest digest info to a JSON file for frontend to fetch
            with open("data/latest_digest.json", "w") as f:
                import json
                json.dump(digest_meta, f)

            try:
                render_from_latest("data/latest_digest.json", os.path.join(self.output_dir, "digest.html"))
            except Exception as _:
                pass

            print(f"Daily Digest generated successfully: {composite_name}")

        except Exception as e:
            print(f"Error generating Daily Digest: {e}")

    def trigger_now(self):
        """Manually trigger for testing"""
        self.scheduler.add_job(self.run_daily_digest)
