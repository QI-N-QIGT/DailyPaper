import json
import os
from jinja2 import Environment, FileSystemLoader


def render_from_latest(digest_json_path: str, output_html_path: str):
    if not os.path.exists(digest_json_path):
        raise FileNotFoundError(digest_json_path)
    with open(digest_json_path, "r", encoding="utf-8") as f:
        meta = json.load(f)

    date = meta.get("date", "")
    hero = meta.get("image_url", "")
    items = meta.get("items", [])

    featured = {
        "title": items[0]["title"] if items else "Daily Research Digest",
        "authors": items[0].get("authors", "") if items else "",
        "abstract": items[0].get("summary", "") if items else "",
        "key_insight": items[0].get("summary", "") if items else "Today’s highlights",
        "image_url": hero,
    }

    papers = []
    for it in items[1:]:
        papers.append({
            "title": it.get("title", "Untitled"),
            "authors": it.get("authors", ""),
            "abstract": it.get("summary", ""),
            "image_url": it.get("image_url", hero),
        })

    env = Environment(loader=FileSystemLoader("templates"))
    tpl = env.get_template("digest_newspaper.html")
    html = tpl.render(date=date, featured=featured, papers=papers)

    os.makedirs(os.path.dirname(output_html_path), exist_ok=True)
    with open(output_html_path, "w", encoding="utf-8") as f:
        f.write(html)

