import os

os.environ["DATABASE_URL"] = "sqlite:///./test.db"
os.environ["SECRET_KEY"] = "test-secret"

from fastapi.testclient import TestClient
from app.main import app


def login(client):
    r = client.post(
        "/api/auth/login",
        json={
            "email": "demo@example.com",
            "password": "Demo@12345",
        },
    )
    assert r.status_code == 200
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_health():
    with TestClient(app) as client:
        r = client.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] == "healthy"


def test_login_and_dashboard():
    with TestClient(app) as client:
        h = login(client)
        r = client.get("/api/analytics/dashboard", headers=h)
        assert r.status_code == 200
        assert "total_hours" in r.json()


def test_ai_endpoints():
    with TestClient(app) as client:
        h = login(client)
        assert client.get("/api/ai/coach", headers=h).status_code == 200
        assert client.get("/api/ai/predict", headers=h).status_code == 200


def test_unauthenticated_blocked():
    with TestClient(app) as client:
        assert client.get("/api/profile").status_code == 401
