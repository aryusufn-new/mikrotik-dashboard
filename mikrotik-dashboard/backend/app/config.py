"""Manage Mikrotik connection config. Per-user from DB, fallback to config.json / .env."""
from __future__ import annotations

import json
import os
from pathlib import Path
from threading import Lock

from . import database as db

CONFIG_PATH = Path(__file__).resolve().parent.parent / "config.json"
_lock = Lock()

# Current active user_id (set on login / request)
_active_user_id: int | None = None
_active_router_id: int | None = None


def set_active_user(user_id: int | None, router_id: int | None = None):
    global _active_user_id, _active_router_id
    _active_user_id = user_id
    _active_router_id = router_id


def _defaults() -> dict:
    return {
        "host": os.getenv("MIKROTIK_HOST", "192.168.88.1"),
        "username": os.getenv("MIKROTIK_USER", "admin"),
        "password": os.getenv("MIKROTIK_PASSWORD", ""),
        "port": int(os.getenv("MIKROTIK_PORT", "8728")),
    }


def _load_json() -> dict | None:
    with _lock:
        if CONFIG_PATH.exists():
            try:
                data = json.loads(CONFIG_PATH.read_text())
                return {
                    "host": data.get("host") or _defaults()["host"],
                    "username": data.get("username") or _defaults()["username"],
                    "password": data.get("password", _defaults()["password"]),
                    "port": int(data.get("port") or _defaults()["port"]),
                }
            except Exception:
                pass
    return None


def load(user_id: int | None = None, router_id: int | None = None) -> dict:
    uid = user_id or _active_user_id
    rid = router_id or _active_router_id

    # If a specific router_id is given, load that router's config
    if rid is not None:
        cfg = db.get_router_config_by_id(rid)
        if cfg is not None:
            return cfg

    if uid is not None:
        cfg = db.get_router_config(uid)
        if cfg is not None:
            return cfg
        # First time: try migrate from config.json
        json_cfg = _load_json()
        if json_cfg:
            db.upsert_router_config(uid, json_cfg["host"], json_cfg["username"], json_cfg["password"], json_cfg["port"])
            return json_cfg
    # Fallback to config.json or env defaults
    return _load_json() or _defaults()


def save(data: dict, user_id: int | None = None) -> dict:
    uid = user_id or _active_user_id
    cfg = load(uid)
    if "host" in data:
        cfg["host"] = str(data["host"]).strip()
    if "username" in data:
        cfg["username"] = str(data["username"]).strip()
    if "password" in data:
        cfg["password"] = str(data["password"])
    if "port" in data:
        cfg["port"] = int(data["port"])
    if uid is not None:
        db.upsert_router_config(uid, cfg["host"], cfg["username"], cfg["password"], cfg["port"])
    else:
        with _lock:
            CONFIG_PATH.write_text(json.dumps(cfg, indent=2))
    return cfg


def safe_view(user_id: int | None = None) -> dict:
    """Return config with password masked."""
    cfg = load(user_id)
    pwd = cfg.get("password", "")
    cfg["password_set"] = bool(pwd)
    cfg["password"] = "••••••••" if pwd else ""
    return cfg
