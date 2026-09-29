from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from sqlalchemy.orm import Session
from sklearn.linear_model import LinearRegression
import numpy as np
from app.models import PracticeSession, Goal, Skill
from app.services.analytics import dashboard

class AIService:
    @staticmethod
    def coach(db: Session, user_id: int):
        data = dashboard(db, user_id)
        recommendations = []
        for g in data["goals"]:
            remaining = max(0, g["target_minutes"] - g["current_minutes"])
            if remaining == 0:
                recommendations.append({"type": "goal", "message": f'Goal "{g["title"]}" is complete. Set a harder follow-up target.', "priority": "low"})
            else:
                recommendations.append({"type": "goal", "message": f'You need {remaining} more minutes for "{g["title"]}". A 30-minute session is a practical next step.', "priority": "medium"})
        if data["current_streak"] == 0:
            recommendations.append({"type": "streak", "message": "No active streak is detected. Schedule a short session today to restart consistency.", "priority": "high"})
        elif data["current_streak"] < 7:
            recommendations.append({"type": "streak", "message": f'Your current streak is {data["current_streak"]} day(s). Keep the next session short and consistent.', "priority": "medium"})
        else:
            recommendations.append({"type": "streak", "message": f'Excellent consistency: {data["current_streak"]} days. Protect the streak with a realistic minimum session.', "priority": "low"})
        return {"engine": "local-ai", "summary": f'You have {data["total_hours"]} total practice hours across {data["active_skills"]} skill(s).', "recommendations": recommendations}

    @staticmethod
    def predict_next_week_minutes(db: Session, user_id: int):
        rows = list(db.scalars(select(PracticeSession).where(PracticeSession.user_id == user_id).order_by(PracticeSession.practiced_at)).all())
        if len(rows) < 3:
            return {"engine": "local-ml", "prediction_minutes": round(sum(r.duration_minutes for r in rows) / max(1, len(rows)) * 7, 1), "confidence": "low", "reason": "At least three practice records are recommended for a meaningful trend model."}
        daily = {}
        for r in rows:
            d = r.practiced_at.date().toordinal()
            daily[d] = daily.get(d, 0) + r.duration_minutes
        x = np.array(sorted(daily)).reshape(-1, 1)
        y = np.array([daily[d] for d in sorted(daily)])
        model = LinearRegression().fit(x, y)
        future = np.arange(max(daily) + 1, max(daily) + 8).reshape(-1, 1)
        pred = np.clip(model.predict(future), 0, 480).sum()
        return {"engine": "scikit-learn", "prediction_minutes": round(float(pred), 1), "confidence": "medium" if len(daily) >= 7 else "low", "reason": "Linear trend over observed daily practice minutes; prediction is directional, not a guarantee."}
