"""Only the NestJS API (holding SUPPORT_AI_KEY) may call /api/*."""
import uuid

from app.core import config
from app.main import create_app
from tests.fakes import fake_deps


def test_requests_without_the_service_key_are_refused(monkeypatch):
    monkeypatch.setattr(config, "SERVICE_KEY", "secret")
    c = create_app(deps=fake_deps()).test_client()
    vid = {"X-Visitor-Id": str(uuid.uuid4())}
    assert c.get("/api/conversations", headers=vid).status_code == 401
    assert c.get("/api/conversations", headers={**vid, "X-Service-Key": "wrong"}).status_code == 401
    assert c.get("/api/conversations", headers={**vid, "X-Service-Key": "secret"}).status_code == 200
