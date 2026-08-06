"""PostgreSQL database for users and per-user router configs."""
from __future__ import annotations

import os
import threading

import psycopg2
import psycopg2.extras
import psycopg2.pool
from passlib.context import CryptContext

_pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://mikrotik:mikrotik_secret@localhost:5432/mikrotik",
)

_pool: psycopg2.pool.ThreadedConnectionPool | None = None
_pool_lock = threading.Lock()


def _get_pool() -> psycopg2.pool.ThreadedConnectionPool:
    global _pool
    if _pool is None or _pool.closed:
        with _pool_lock:
            if _pool is None or _pool.closed:
                _pool = psycopg2.pool.ThreadedConnectionPool(
                    minconn=2,
                    maxconn=10,
                    dsn=DATABASE_URL,
                )
    return _pool


def _conn():
    conn = _get_pool().getconn()
    conn.autocommit = False
    return conn


def _put(conn):
    _get_pool().putconn(conn)


def init_db():
    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    hashed_password TEXT NOT NULL,
                    role TEXT NOT NULL DEFAULT 'user',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS router_configs (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    name TEXT NOT NULL DEFAULT 'Router 1',
                    host TEXT NOT NULL DEFAULT '192.168.88.1',
                    username TEXT NOT NULL DEFAULT 'admin',
                    password TEXT NOT NULL DEFAULT '',
                    port INTEGER NOT NULL DEFAULT 8728
                );
            """)
            conn.commit()

            cur.execute(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'users' AND column_name = 'role'"
            )
            if cur.fetchone() is None:
                cur.execute("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'")
                conn.commit()

            cur.execute(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'router_configs' AND column_name = 'name'"
            )
            if cur.fetchone() is None:
                cur.execute("ALTER TABLE router_configs ADD COLUMN name TEXT NOT NULL DEFAULT 'Router 1'")
                conn.commit()

            cur.execute("SELECT id FROM users WHERE username = %s", ("admin",))
            row = cur.fetchone()
            if row is None:
                hashed = _pwd_ctx.hash("admin")
                cur.execute(
                    "INSERT INTO users (username, hashed_password, role) VALUES (%s, %s, %s)",
                    ("admin", hashed, "admin"),
                )
                conn.commit()
            else:
                cur.execute(
                    "UPDATE users SET role = 'admin' WHERE username = 'admin' AND role != 'admin'"
                )
                conn.commit()
    finally:
        _put(conn)


def get_user_by_username(username: str) -> dict | None:
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM users WHERE username = %s", (username,))
            row = cur.fetchone()
            return dict(row) if row else None
    finally:
        _put(conn)


def get_user_by_id(user_id: int) -> dict | None:
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))
            row = cur.fetchone()
            return dict(row) if row else None
    finally:
        _put(conn)


def create_user(username: str, password: str, role: str = "user") -> int:
    conn = _conn()
    try:
        with conn.cursor() as cur:
            hashed = _pwd_ctx.hash(password)
            try:
                cur.execute(
                    "INSERT INTO users (username, hashed_password, role) VALUES (%s, %s, %s) RETURNING id",
                    (username, hashed, role),
                )
                new_id = cur.fetchone()[0]
                conn.commit()
                return new_id
            except psycopg2.IntegrityError:
                conn.rollback()
                raise ValueError("Username sudah digunakan")
    finally:
        _put(conn)


def update_user_password(user_id: int, new_password: str) -> bool:
    conn = _conn()
    try:
        with conn.cursor() as cur:
            hashed = _pwd_ctx.hash(new_password)
            cur.execute(
                "UPDATE users SET hashed_password = %s WHERE id = %s",
                (hashed, user_id),
            )
            conn.commit()
            return cur.rowcount > 0
    finally:
        _put(conn)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_ctx.verify(plain, hashed)


def list_routers(user_id: int) -> list[dict]:
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT id, name, host, username, port FROM router_configs WHERE user_id = %s ORDER BY id",
                (user_id,),
            )
            return [dict(r) for r in cur.fetchall()]
    finally:
        _put(conn)


def get_router_by_id(router_id: int, user_id: int) -> dict | None:
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT id, name, host, username, password, port FROM router_configs WHERE id = %s AND user_id = %s",
                (router_id, user_id),
            )
            row = cur.fetchone()
            return dict(row) if row else None
    finally:
        _put(conn)


def get_router_config(user_id: int) -> dict | None:
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT host, username, password, port FROM router_configs WHERE user_id = %s ORDER BY id LIMIT 1",
                (user_id,),
            )
            row = cur.fetchone()
            return dict(row) if row else None
    finally:
        _put(conn)


def get_router_config_by_id(router_id: int) -> dict | None:
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT host, username, password, port FROM router_configs WHERE id = %s",
                (router_id,),
            )
            row = cur.fetchone()
            return dict(row) if row else None
    finally:
        _put(conn)


def add_router(user_id: int, name: str, host: str, username: str, password: str, port: int) -> int:
    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO router_configs (user_id, name, host, username, password, port) VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
                (user_id, name, host, username, password, port),
            )
            new_id = cur.fetchone()[0]
            conn.commit()
            return new_id
    finally:
        _put(conn)


def update_router(router_id: int, user_id: int, **kwargs) -> bool:
    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM router_configs WHERE id = %s AND user_id = %s",
                (router_id, user_id),
            )
            if cur.fetchone() is None:
                return False

            allowed = {"name", "host", "username", "password", "port"}
            updates = {k: v for k, v in kwargs.items() if k in allowed and v is not None}
            if not updates:
                return True

            set_clause = ", ".join(f"{k}=%s" for k in updates)
            values = list(updates.values()) + [router_id, user_id]
            cur.execute(
                f"UPDATE router_configs SET {set_clause} WHERE id=%s AND user_id=%s",
                values,
            )
            conn.commit()
            return True
    finally:
        _put(conn)


def delete_router(router_id: int, user_id: int) -> bool:
    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM router_configs WHERE id = %s AND user_id = %s",
                (router_id, user_id),
            )
            conn.commit()
            return cur.rowcount > 0
    finally:
        _put(conn)


def upsert_router_config(user_id: int, host: str, username: str, password: str, port: int):
    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM router_configs WHERE user_id = %s ORDER BY id LIMIT 1",
                (user_id,),
            )
            existing = cur.fetchone()
            if existing:
                cur.execute(
                    "UPDATE router_configs SET host=%s, username=%s, password=%s, port=%s WHERE id=%s",
                    (host, username, password, port, existing[0]),
                )
            else:
                cur.execute(
                    "INSERT INTO router_configs (user_id, name, host, username, password, port) VALUES (%s, %s, %s, %s, %s, %s)",
                    (user_id, "Router 1", host, username, password, port),
                )
            conn.commit()
    finally:
        _put(conn)


def safe_router_config(user_id: int) -> dict:
    cfg = get_router_config(user_id)
    if cfg is None:
        return {"host": "", "username": "", "password": "", "port": 8728}
    return {**cfg, "password": "••••••••" if cfg["password"] else ""}
