from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import Base, engine, get_db, SessionLocal
from app.models import User, Skill, Goal, PracticeSession, Post, Like, Comment, SkillTrend
from app.schemas import *
from app.api.deps import current_user
from app.services.analytics import dashboard, activity, gamification
from app.services.ai import AIService
from app.services.storage import Storage
from app.services.real_data import import_skill_trends


def seed():
    db = SessionLocal()
    try:
        existing = db.scalar(select(User).where(User.email == "demo@example.com"))
        if existing: return
        demo = User(email="demo@example.com", password_hash=hash_password("Demo@12345"), name="Alex Morgan", username="alex_morgan", bio="Demo engineering learner for product evaluation.")
        teammate = User(email="sam@example.com", password_hash=hash_password("Demo@12345"), name="Sam Rivera", username="sam_rivera", bio="Cloud and data learner.")
        db.add_all([demo, teammate]); db.flush()

        python = Skill(user_id=demo.id, name="Python", category="Coding", current_level="INTERMEDIATE", target_level="ADVANCED", description="Backend engineering, automation and applied machine learning")
        fastapi = Skill(user_id=demo.id, name="FastAPI", category="Cloud", current_level="BEGINNER", target_level="INTERMEDIATE", description="Production-style REST APIs and service integration")
        docker = Skill(user_id=demo.id, name="Docker", category="DevOps", current_level="BEGINNER", target_level="INTERMEDIATE", description="Containerized development and deployment workflows")
        db.add_all([python, fastapi, docker]); db.flush()

        db.add_all([
            Goal(skill_id=python.id, title="Complete 10 hours of Python engineering practice", target_minutes=600),
            Goal(skill_id=fastapi.id, title="Build and test a FastAPI service", target_minutes=420),
            Goal(skill_id=docker.id, title="Complete a Dockerized deployment workflow", target_minutes=360),
        ])

        sessions = [
            (7, 45, python, "Python service design", "Refined service-layer structure and validation."),
            (6, 60, fastapi, "FastAPI endpoint design", "Implemented authenticated REST endpoints."),
            (5, 55, docker, "Docker Compose workflow", "Configured application services and health checks."),
            (4, 70, python, "SQLAlchemy integration", "Worked on relational models and persistence."),
            (3, 50, fastapi, "API testing", "Added request-level tests and error handling."),
            (2, 80, docker, "Container debugging", "Diagnosed service startup and storage integration."),
            (1, 65, python, "ML analytics", "Evaluated practice forecasting and explainable recommendations."),
        ]
        for days_ago, mins, skill, activity_name, notes in sessions:
            practiced = datetime.now(timezone.utc).replace(hour=18, minute=0, second=0, microsecond=0) - timedelta(days=days_ago)
            db.add(PracticeSession(user_id=demo.id, skill_id=skill.id, duration_minutes=mins, activity=activity_name, notes=notes, practiced_at=practiced))

        db.add(Post(user_id=demo.id, content="Completed a focused engineering cycle across FastAPI, PostgreSQL, Docker and explainable ML analytics."))
        db.add(Post(user_id=teammate.id, content="Built a cloud deployment checklist covering API health checks, database persistence and object storage."))
        db.commit()
    finally:
        db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    seed()
    yield

app = FastAPI(title="AI Hobby & Skills Intelligence API", version="1.0.0", lifespan=lifespan)
origins = [x.strip() for x in settings.cors_origins.split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.get("/")
def root(): return {"service":"AI Hobby & Skills Intelligence API","status":"running","docs":"/docs"}

@app.get("/health")
def health(db: Session = Depends(get_db)):
    db.execute(select(func.count(User.id))).scalar_one()
    return {"status":"healthy","database":"ok","timestamp":datetime.now(timezone.utc)}

@app.post("/api/auth/register", response_model=Token, status_code=201)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    if db.scalar(select(User).where(User.email == payload.email)) or db.scalar(select(User).where(User.username == payload.username)):
        raise HTTPException(409, "Email or username already exists")
    user = User(email=payload.email, password_hash=hash_password(payload.password), name=payload.name, username=payload.username)
    db.add(user); db.commit(); db.refresh(user)
    return Token(access_token=create_access_token(user.id))

@app.post("/api/auth/login", response_model=Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email))
    if not user or not verify_password(payload.password, user.password_hash): raise HTTPException(401, "Invalid email or password")
    return Token(access_token=create_access_token(user.id))

@app.get("/api/profile")
def profile(user: User = Depends(current_user)):
    return {"id":user.id,"email":user.email,"name":user.name,"username":user.username,"bio":user.bio,"created_at":user.created_at}

@app.put("/api/profile")
def update_profile(payload: ProfileUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    user.name, user.bio = payload.name, payload.bio; db.commit(); return profile(user)

@app.get("/api/skills", response_model=list[SkillOut])
def skills(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return list(db.scalars(select(Skill).where(Skill.user_id == user.id).order_by(Skill.id.desc())).all())

@app.post("/api/skills", response_model=SkillOut, status_code=201)
def create_skill(payload: SkillCreate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    skill = Skill(user_id=user.id, **payload.model_dump()); db.add(skill); db.commit(); db.refresh(skill); return skill

@app.delete("/api/skills/{skill_id}", status_code=204)
def delete_skill(skill_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    skill = db.scalar(select(Skill).where(Skill.id == skill_id, Skill.user_id == user.id))
    if not skill: raise HTTPException(404, "Skill not found")
    db.delete(skill); db.commit()

@app.post("/api/goals", response_model=GoalOut, status_code=201)
def create_goal(payload: GoalCreate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    skill = db.scalar(select(Skill).where(Skill.id == payload.skill_id, Skill.user_id == user.id))
    if not skill: raise HTTPException(404, "Skill not found")
    goal = Goal(**payload.model_dump()); db.add(goal); db.commit(); db.refresh(goal); return goal

@app.get("/api/goals")
def goals(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return dashboard(db, user.id)["goals"]

@app.post("/api/practice", status_code=201)
def practice(payload: PracticeCreate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    skill = db.scalar(select(Skill).where(Skill.id == payload.skill_id, Skill.user_id == user.id))
    if not skill: raise HTTPException(404, "Skill not found")
    row = PracticeSession(user_id=user.id, practiced_at=payload.practiced_at or datetime.now(timezone.utc), **payload.model_dump(exclude={"practiced_at"}))
    db.add(row); db.commit(); db.refresh(row); return {"id":row.id,"message":"Practice session recorded","duration_minutes":row.duration_minutes}

@app.get("/api/analytics/dashboard")
def analytics(user: User = Depends(current_user), db: Session = Depends(get_db)): return dashboard(db, user.id)

@app.get("/api/analytics/activity")
def analytics_activity(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return activity(db, user.id)

@app.get("/api/analytics/gamification")
def analytics_gamification(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return gamification(db, user.id)

@app.get("/api/ai/coach")
def ai_coach(user: User = Depends(current_user), db: Session = Depends(get_db)): return AIService.coach(db, user.id)

@app.get("/api/ai/predict")
def ai_predict(user: User = Depends(current_user), db: Session = Depends(get_db)): return AIService.predict_next_week_minutes(db, user.id)

@app.get("/api/posts")
def feed(user: User = Depends(current_user), db: Session = Depends(get_db)):
    posts = list(db.scalars(select(Post).order_by(Post.created_at.desc()).limit(50)).all())
    result=[]
    for p in posts:
        likes = db.scalar(select(func.count(Like.id)).where(Like.post_id == p.id)) or 0
        comments = db.scalar(select(func.count(Comment.id)).where(Comment.post_id == p.id)) or 0
        viewer_like = db.scalar(select(Like).where(Like.post_id == p.id, Like.user_id == user.id)) if user else None
        result.append({"id":p.id,"username":p.user.username,"content":p.content,"created_at":p.created_at,"likes":likes,"comments":comments,"liked": bool(viewer_like)})
    return result

@app.post("/api/posts", status_code=201)
def create_post(payload: PostCreate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    p=Post(user_id=user.id, content=payload.content); db.add(p); db.commit(); db.refresh(p); return {"id":p.id,"message":"Post created"}

@app.post("/api/posts/{post_id}/like")
def like(post_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not db.get(Post, post_id): raise HTTPException(404,"Post not found")
    existing=db.scalar(select(Like).where(Like.post_id==post_id, Like.user_id==user.id))
    if not existing: db.add(Like(post_id=post_id,user_id=user.id)); db.commit()
    return {"message":"liked"}

@app.delete("/api/posts/{post_id}/like")
def unlike(post_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    existing=db.scalar(select(Like).where(Like.post_id==post_id, Like.user_id==user.id))
    if existing: db.delete(existing); db.commit()
    return {"message":"unliked"}

@app.post("/api/posts/{post_id}/comments", status_code=201)
def comment(post_id: int, payload: CommentCreate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not db.get(Post, post_id): raise HTTPException(404,"Post not found")
    c=Comment(post_id=post_id,user_id=user.id,content=payload.content); db.add(c); db.commit(); db.refresh(c); return {"id":c.id}

@app.get("/api/posts/{post_id}/comments")
def comments(post_id: int, db: Session = Depends(get_db)):
    rows=list(db.scalars(select(Comment).where(Comment.post_id==post_id).order_by(Comment.created_at)).all())
    return [{"id":r.id,"username":db.get(User,r.user_id).username,"content":r.content,"created_at":r.created_at} for r in rows]

@app.post("/api/files/upload")
async def upload_file(file: UploadFile = File(...), user: User = Depends(current_user)):
    allowed={"image/jpeg","image/png","image/webp","application/pdf"}
    if file.content_type not in allowed: raise HTTPException(400,"Allowed file types: JPG, PNG, WEBP, PDF")
    content=await file.read()
    if len(content)>5*1024*1024: raise HTTPException(413,"Maximum file size is 5 MB")
    try:
        key=f"users/{user.id}/{int(datetime.now(timezone.utc).timestamp())}_{file.filename.replace('..','_')}"
        storage=Storage(); storage.upload(key,content,file.content_type); url=storage.presigned(key)
        return {"key":key,"url":url}
    except Exception as exc:
        raise HTTPException(503,f"Object storage unavailable: {type(exc).__name__}")

@app.post("/api/real-data/import")
async def real_data_import(tags: str = "python,fastapi,reactjs,machine-learning,postgresql", user: User = Depends(current_user), db: Session = Depends(get_db)):
    selected=[t.strip() for t in tags.split(",") if t.strip()][:10]
    try:
        return {"items": await import_skill_trends(db, selected), "metric":"recent API sample size (pagesize=100), not total platform popularity"}
    except Exception as exc:
        raise HTTPException(502, f"External data provider unavailable: {type(exc).__name__}")

@app.get("/api/trends")
def trends(db: Session = Depends(get_db)):
    rows=list(db.scalars(select(SkillTrend).order_by(SkillTrend.captured_at.desc()).limit(30)).all())
    return [{"tag":r.tag,"question_count":r.question_count,"source":r.source,"captured_at":r.captured_at} for r in rows]
