import httpx
from datetime import datetime, timezone
from urllib.parse import quote
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models import SkillTrend

async def import_skill_trends(db: Session, tags: list[str]):
    rows = []
    async with httpx.AsyncClient(timeout=15) as client:
        for tag in tags:
            safe = quote(tag, safe='')
            url = f"https://api.stackexchange.com/2.3/tags/{safe}/info"
            r = await client.get(url, params={"site": "stackoverflow"})
            r.raise_for_status()
            items = r.json().get("items", [])
            if not items:
                continue
            count = int(items[0].get("count", 0))
            row = SkillTrend(tag=tag, question_count=count, source="Stack Overflow tag API", captured_at=datetime.now(timezone.utc))
            db.add(row); rows.append(row)
    db.commit()
    return [{"tag": r.tag, "question_count": r.question_count, "source": r.source, "captured_at": r.captured_at} for r in rows]
