import arxiv
from pydantic import BaseModel, Field
from datetime import datetime, timedelta
from typing import List, Optional
from functools import lru_cache

class Paper(BaseModel):
    """
    Data model representing a research paper.
    """
    id: str
    title: str
    authors: List[str]
    published_date: datetime
    abstract: str
    pdf_url: str
    summary: Optional[dict] = None # To be filled by Gemini later

class ArxivFetcher:
    """
    Service to interact with arXiv API.
    """
    
    @staticmethod
    @lru_cache(maxsize=100) # Cache last 100 search results
    def search_papers(query: str, max_results: int = 5, days_back: int = 1) -> List[Paper]:
        """
        Searches for papers on arXiv based on a query.
        """
        try:
            # Constructing a client
            client = arxiv.Client()

            # Search configuration
            # If days_back is 0 (Any time), sort by Relevance to get the best matches.
            # If days_back > 0 (Specific range), sort by SubmittedDate to get the latest within that range.
            sort_criterion = arxiv.SortCriterion.Relevance if days_back == 0 else arxiv.SortCriterion.SubmittedDate
            
            # Increase fetch limit for "Any time" searches to find seminal papers that might be buried
            fetch_limit = max_results * 5 if days_back == 0 else max_results * 2

            print(f"Searching arXiv: query='{query}', days_back={days_back}, sort={sort_criterion}, limit={fetch_limit}")

            search = arxiv.Search(
                query=query,
                max_results=fetch_limit, 
                sort_by=sort_criterion,
                sort_order=arxiv.SortOrder.Descending
            )

            results = []
            
            # Execute search
            # Fix: Handle timezone awareness correctly by using UTC or the timezone from the first result if available
            from datetime import timezone
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_back) if days_back > 0 else None

            for result in client.results(search):
                # Filter by date if days_back is set (>0)
                if cutoff_date and result.published < cutoff_date:
                     continue

                # Basic data extraction
                paper = Paper(
                    id=result.entry_id,
                    title=result.title,
                    authors=[author.name for author in result.authors],
                    published_date=result.published,
                    abstract=result.summary.replace("\n", " "),
                    pdf_url=result.pdf_url
                )
                results.append(paper)
                
                if len(results) >= max_results:
                    break
            
            return results

        except Exception as e:
            print(f"Error fetching data from arXiv: {e}")
            return []

if __name__ == "__main__":
    # Simple test
    papers = ArxivFetcher.search_papers("Generative AI")
    for p in papers:
        print(f"[{p.published_date}] {p.title}")
