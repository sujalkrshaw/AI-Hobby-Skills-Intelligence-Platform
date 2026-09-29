from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=2, max_length=120)
    username: str = Field(min_length=3, max_length=80, pattern=r"^[A-Za-z0-9_]+$")

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class ProfileUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    bio: str = Field(default="", max_length=500)

class SkillCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    category: str = Field(default="Other", max_length=80)
    current_level: str = "BEGINNER"
    target_level: str = "INTERMEDIATE"
    description: str = Field(default="", max_length=1000)

class GoalCreate(BaseModel):
    skill_id: int
    title: str = Field(min_length=2, max_length=200)
    target_minutes: int = Field(gt=0, le=100000)
    deadline: datetime | None = None

class PracticeCreate(BaseModel):
    skill_id: int
    duration_minutes: int = Field(gt=0, le=1440)
    activity: str = Field(min_length=2, max_length=255)
    notes: str = Field(default="", max_length=2000)
    practiced_at: datetime | None = None

class PostCreate(BaseModel):
    content: str = Field(min_length=2, max_length=2000)

class CommentCreate(BaseModel):
    content: str = Field(min_length=1, max_length=1000)

class SkillOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int; name: str; category: str; current_level: str; target_level: str; status: str; description: str

class GoalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int; skill_id: int; title: str; target_minutes: int; deadline: datetime | None; status: str
