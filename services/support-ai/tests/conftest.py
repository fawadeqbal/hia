"""Tests call the service directly (no NestJS proxy), so the service key is off unless a test turns it on."""
import pytest

from app.core import config


@pytest.fixture(autouse=True)
def _no_service_key(monkeypatch):
    monkeypatch.setattr(config, "SERVICE_KEY", "")
