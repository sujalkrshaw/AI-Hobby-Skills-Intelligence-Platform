from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models import PracticeSession, Goal, Skill


def dashboard(db: Session, user_id: int):
    sessions = list(db.scalars(select(PracticeSession).where(PracticeSession.user_id == user_id).order_by(PracticeSession.practiced_at.desc())).all())
    skills = list(db.scalars(select(Skill).where(Skill.user_id == user_id)).all())
    skill_map = {s.id: s.name for s in skills}
    now = datetime.now(timezone.utc)
    week_start = now - timedelta(days=7)
    month_start = now - timedelta(days=30)

    def aware(dt):
        return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt

    total = sum(s.duration_minutes for s in sessions)
    week = sum(s.duration_minutes for s in sessions if aware(s.practiced_at) >= week_start)
    month = sum(s.duration_minutes for s in sessions if aware(s.practiced_at) >= month_start)
    by_skill = {}
    for s in sessions:
        name = skill_map.get(s.skill_id, "Unknown")
        by_skill[name] = by_skill.get(name, 0) + s.duration_minutes
    most = max(by_skill.items(), key=lambda x: x[1])[0] if by_skill else None

    dates = sorted({aware(s.practiced_at).date() for s in sessions}, reverse=True)
    streak = 0
    cursor = now.date()
    for d in dates:
        if d == cursor:
            streak += 1
            cursor = d - timedelta(days=1)
        elif d == cursor - timedelta(days=1) and streak == 0:
            streak += 1
            cursor = d - timedelta(days=1)
        elif d < cursor:
            break

    goals = list(db.scalars(select(Goal).join(Skill).where(Skill.user_id == user_id)).all())
    goal_rows = []
    for g in goals:
        current = sum(s.duration_minutes for s in sessions if s.skill_id == g.skill_id)
        goal_rows.append({
            "id": g.id, "skill_id": g.skill_id, "title": g.title,
            "target_minutes": g.target_minutes, "current_minutes": current,
            "progress": min(100, round(current / g.target_minutes * 100, 1)),
            "deadline": g.deadline, "status": g.status,
        })

    return {
        "total_minutes": total, "total_hours": round(total / 60, 1),
        "week_minutes": week, "month_minutes": month,
        "most_practiced_skill": most, "current_streak": streak,
        "active_skills": len(skills), "goals": goal_rows, "by_skill": by_skill,
    }


def activity(db: Session, user_id: int, limit: int = 12):
    rows = list(db.scalars(
        select(PracticeSession).where(PracticeSession.user_id == user_id)
        .order_by(PracticeSession.practiced_at.desc()).limit(limit)
    ).all())
    return [
        {
            "id": r.id, "skill_id": r.skill_id, "skill": r.skill.name if r.skill else "Unknown",
            "duration_minutes": r.duration_minutes, "activity": r.activity,
            "notes": r.notes, "practiced_at": r.practiced_at,
        }
        for r in rows
    ]


def gamification(db: Session, user_id: int):
    data = dashboard(db, user_id)
    sessions = list(db.scalars(select(PracticeSession).where(PracticeSession.user_id == user_id)).all())
    total = data["total_minutes"]
    completed_goals = sum(1 for g in data["goals"] if g["progress"] >= 100)
    badges = [
        {"key": "first-session", "title": "First Session", "description": "Logged your first practice session", "icon": "◉", "unlocked": len(sessions) >= 1},
        {"key": "five-hours", "title": "5 Hour Builder", "description": "Reached 300 minutes of practice", "icon": "◆", "unlocked": total >= 300},
        {"key": "ten-hours", "title": "10 Hour Builder", "description": "Reached 600 minutes of practice", "icon": "✦", "unlocked": total >= 600},
        {"key": "seven-day", "title": "7 Day Streak", "description": "Maintained a seven-day streak", "icon": "♨", "unlocked": data["current_streak"] >= 7},
        {"key": "goal-finisher", "title": "Goal Finisher", "description": "Completed a learning goal", "icon": "✓", "unlocked": completed_goals >= 1},
        {"key": "multi-skill", "title": "Multi-Skill", "description": "Built a portfolio of three or more skills", "icon": "◇", "unlocked": data["active_skills"] >= 3},
    ]
    return {"badges": badges, "unlocked": sum(1 for b in badges if b["unlocked"]), "total": len(badges)}
