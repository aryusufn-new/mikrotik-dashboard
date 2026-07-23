"""SQLite database for users and per-user router configs."""
from __future__ import annotations

import os
import sqlite3
import threading
from pathlib import Path

from passlib.context import CryptContext

_pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

DB_PATH = Path("/app/data/data.db") if Path("/app/data").exists() else Path(__file__).resolve().parent.parent / "data.db"

_local = threading.local()


def _conn() -> sqlite3.Connection:
    """Return a thread-local SQLite connection."""
    conn = getattr(_local, "conn", None)
    if conn is None:
        conn = sqlite3.connect(str(DB_PATH))
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        _local.conn = conn
    return conn


def init_db():
    """Create tables and seed default admin if not exists."""
    conn = _conn()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            hashed_password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS router_configs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL DEFAULT 'Router 1',
            host TEXT NOT NULL DEFAULT '192.168.88.1',
            username TEXT NOT NULL DEFAULT 'admin',
            password TEXT NOT NULL DEFAULT '',
            port INTEGER NOT NULL DEFAULT 8728,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
    """)
    conn.commit()

    # Migration: Add 'role' column if it doesn't exist
    cols = [r["name"] for r in conn.execute("PRAGMA table_info(users)")]
    if "role" not in cols:
        conn.execute("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'")
        conn.commit()

    # Migration: Remove legacy UNIQUE constraint on user_id if it exists
    schema_row = conn.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='router_configs'").fetchone()
    if schema_row and "user_id INTEGER UNIQUE" in schema_row["sql"]:
        # Find which columns exist in the current table
        cols = [r["name"] for r in conn.execute("PRAGMA table_info(router_configs)")]
        
        # Rename old table
        conn.execute("ALTER TABLE router_configs RENAME TO router_configs_old")
        
        # Create new table without UNIQUE constraint
        conn.execute("""
            CREATE TABLE router_configs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL DEFAULT 'Router 1',
                host TEXT NOT NULL DEFAULT '192.168.88.1',
                username TEXT NOT NULL DEFAULT 'admin',
                password TEXT NOT NULL DEFAULT '',
                port INTEGER NOT NULL DEFAULT 8728,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
        """)
        
        # Safely copy only the columns that exist in the old table
        cols_to_copy = [c for c in cols if c in {"id", "user_id", "name", "host", "username", "password", "port"}]
        cols_str = ", ".join(cols_to_copy)
        conn.execute(f"INSERT INTO router_configs ({cols_str}) SELECT {cols_str} FROM router_configs_old")
        conn.execute("DROP TABLE router_configs_old")
        conn.commit()

    # Migration: if 'name' column doesn't exist yet, add it (for standard installations that don't need constraint removal)
    cols = [r["name"] for r in conn.execute("PRAGMA table_info(router_configs)")]
    if "name" not in cols:
        conn.execute("ALTER TABLE router_configs ADD COLUMN name TEXT NOT NULL DEFAULT 'Router 1'")
        conn.commit()

    # Remove old UNIQUE index on user_id if exists (migration from single-router)
    indexes = conn.execute("PRAGMA index_list(router_configs)").fetchall()
    for idx in indexes:
        idx_info = conn.execute(f"PRAGMA index_info({idx['name']})").fetchall()
        col_names = [i["name"] for i in idx_info]
        if col_names == ["user_id"] and idx["unique"]:
            try:
                conn.execute(f"DROP INDEX {idx['name']}")
                conn.commit()
            except Exception:
                pass

    row = conn.execute("SELECT id FROM users WHERE username = ?", ("admin",)).fetchone()
    if row is None:
        hashed = _pwd_ctx.hash("admin")
        conn.execute("INSERT INTO users (username, hashed_password, role) VALUES (?, ?, ?)", ("admin", hashed, "admin"))
        conn.commit()
    else:
        # Migration: Update existing admin to have admin role
        conn.execute("UPDATE users SET role = 'admin' WHERE username = 'admin' AND role != 'admin'")
        conn.commit()


# ── User queries ────────────────────────────────────────────

def get_user_by_username(username: str) -> dict | None:
    row = _conn().execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    return dict(row) if row else None


def get_user_by_id(user_id: int) -> dict | None:
    row = _conn().execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return dict(row) if row else None


def create_user(username: str, password: str, role: str = "user") -> int:
    """Create a new user. Returns the new user id. Raises exception if username exists."""
    conn = _conn()
    hashed = _pwd_ctx.hash(password)
    try:
        cur = conn.execute(
            "INSERT INTO users (username, hashed_password, role) VALUES (?, ?, ?)",
            (username, hashed, role),
        )
        conn.commit()
        return cur.lastrowid
    except sqlite3.IntegrityError as e:
        raise ValueError("Username sudah digunakan") from e


def update_user_password(user_id: int, new_password: str) -> bool:
    """Update user password. Returns True if successful."""
    conn = _conn()
    hashed = _pwd_ctx.hash(new_password)
    cur = conn.execute(
        "UPDATE users SET hashed_password = ? WHERE id = ?",
        (hashed, user_id),
    )
    conn.commit()
    return cur.rowcount > 0


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_ctx.verify(plain, hashed)


# ── Router config queries (multi-router) ────────────────────

def list_routers(user_id: int) -> list[dict]:
    """List all routers for a user."""
    rows = _conn().execute(
        "SELECT id, name, host, username, port FROM router_configs WHERE user_id = ? ORDER BY id",
        (user_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def get_router_by_id(router_id: int, user_id: int) -> dict | None:
    """Get a specific router config, ensuring it belongs to the user."""
    row = _conn().execute(
        "SELECT id, name, host, username, password, port FROM router_configs WHERE id = ? AND user_id = ?",
        (router_id, user_id),
    ).fetchone()
    return dict(row) if row else None


def get_router_config(user_id: int) -> dict | None:
    """Legacy: get the first router config for a user (backward compat)."""
    row = _conn().execute(
        "SELECT host, username, password, port FROM router_configs WHERE user_id = ? ORDER BY id LIMIT 1",
        (user_id,),
    ).fetchone()
    return dict(row) if row else None


def get_router_config_by_id(router_id: int) -> dict | None:
    """Get connection config (host, username, password, port) by router id."""
    row = _conn().execute(
        "SELECT host, username, password, port FROM router_configs WHERE id = ?",
        (router_id,),
    ).fetchone()
    return dict(row) if row else None


def add_router(user_id: int, name: str, host: str, username: str, password: str, port: int) -> int:
    """Add a new router config. Returns the new router id."""
    conn = _conn()
    cur = conn.execute(
        "INSERT INTO router_configs (user_id, name, host, username, password, port) VALUES (?, ?, ?, ?, ?, ?)",
        (user_id, name, host, username, password, port),
    )
    conn.commit()
    return cur.lastrowid


def update_router(router_id: int, user_id: int, **kwargs) -> bool:
    """Update a router config. Only updates provided fields."""
    conn = _conn()
    # Verify ownership
    existing = conn.execute(
        "SELECT id FROM router_configs WHERE id = ? AND user_id = ?",
        (router_id, user_id),
    ).fetchone()
    if not existing:
        return False

    allowed = {"name", "host", "username", "password", "port"}
    updates = {k: v for k, v in kwargs.items() if k in allowed and v is not None}
    if not updates:
        return True

    set_clause = ", ".join(f"{k}=?" for k in updates)
    values = list(updates.values()) + [router_id, user_id]
    conn.execute(
        f"UPDATE router_configs SET {set_clause} WHERE id=? AND user_id=?",
        values,
    )
    conn.commit()
    return True


def delete_router(router_id: int, user_id: int) -> bool:
    """Delete a router config."""
    conn = _conn()
    cur = conn.execute(
        "DELETE FROM router_configs WHERE id = ? AND user_id = ?",
        (router_id, user_id),
    )
    conn.commit()
    return cur.rowcount > 0


def upsert_router_config(user_id: int, host: str, username: str, password: str, port: int):
    """Legacy: upsert the first router config for backward compat."""
    conn = _conn()
    existing = conn.execute(
        "SELECT id FROM router_configs WHERE user_id = ? ORDER BY id LIMIT 1",
        (user_id,),
    ).fetchone()
    if existing:
        conn.execute(
            "UPDATE router_configs SET host=?, username=?, password=?, port=? WHERE id=?",
            (host, username, password, port, existing["id"]),
        )
    else:
        conn.execute(
            "INSERT INTO router_configs (user_id, name, host, username, password, port) VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, "Router 1", host, username, password, port),
        )
    conn.commit()


def safe_router_config(user_id: int) -> dict:
    """Return config with password masked."""
    cfg = get_router_config(user_id)
    if cfg is None:
        return {"host": "", "username": "", "password": "", "port": 8728}
    return {**cfg, "password": "••••••••" if cfg["password"] else ""}
