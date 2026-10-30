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
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    action TEXT NOT NULL,
                    endpoint TEXT NOT NULL,
                    target TEXT,
                    details JSONB,
                    user_agent TEXT,
                    ip_address TEXT,
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
                CREATE TABLE IF NOT EXISTS olts (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    router_id INTEGER REFERENCES router_configs(id) ON DELETE SET NULL,
                    name TEXT NOT NULL,
                    brand TEXT NOT NULL DEFAULT 'vsol',
                    host TEXT NOT NULL,
                    snmp_port INTEGER NOT NULL DEFAULT 161,
                    snmp_community TEXT NOT NULL DEFAULT 'public',
                    telnet_port INTEGER NOT NULL DEFAULT 23,
                    telnet_user TEXT DEFAULT 'admin',
                    telnet_pass TEXT DEFAULT 'admin',
                    pon_ports_count INTEGER NOT NULL DEFAULT 8,
                    description TEXT DEFAULT '',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS customers (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    router_id INTEGER REFERENCES router_configs(id) ON DELETE SET NULL,
                    olt_id INTEGER REFERENCES olts(id) ON DELETE SET NULL,
                    name TEXT NOT NULL,
                    phone TEXT DEFAULT '',
                    address TEXT DEFAULT '',
                    odp_name TEXT DEFAULT '',
                    pppoe_username TEXT DEFAULT '',
                    pon_port TEXT DEFAULT 'PON 1',
                    onu_id INTEGER DEFAULT 1,
                    onu_sn TEXT DEFAULT '',
                    onu_model TEXT DEFAULT 'V2801SG',
                    package_name TEXT DEFAULT '20 Mbps',
                    status TEXT NOT NULL DEFAULT 'active',
                    last_rx_power NUMERIC(5,2) DEFAULT NULL,
                    last_tx_power NUMERIC(5,2) DEFAULT NULL,
                    last_olt_rx NUMERIC(5,2) DEFAULT NULL,
                    last_distance NUMERIC(6,2) DEFAULT NULL,
                    last_optical_status TEXT DEFAULT 'unknown',
                    last_checked_at TIMESTAMP DEFAULT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS router_backups (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    router_id INTEGER NOT NULL REFERENCES router_configs(id) ON DELETE CASCADE,
                    filename TEXT NOT NULL,
                    file_path TEXT NOT NULL,
                    file_size BIGINT NOT NULL DEFAULT 0,
                    backup_type TEXT NOT NULL DEFAULT 'both',
                    trigger_type TEXT NOT NULL DEFAULT 'manual',
                    status TEXT NOT NULL DEFAULT 'completed',
                    error_message TEXT DEFAULT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS backup_settings (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    enabled BOOLEAN NOT NULL DEFAULT TRUE,
                    schedule_day INTEGER NOT NULL DEFAULT 6,
                    schedule_hour INTEGER NOT NULL DEFAULT 2,
                    schedule_minute INTEGER NOT NULL DEFAULT 0,
                    backup_type TEXT NOT NULL DEFAULT 'both',
                    retention_count INTEGER NOT NULL DEFAULT 8,
                    last_run_at TIMESTAMP DEFAULT NULL,
                    next_run_at TIMESTAMP DEFAULT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS genieacs_settings (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    enabled BOOLEAN NOT NULL DEFAULT TRUE,
                    url TEXT NOT NULL DEFAULT 'http://192.168.1.10:7557',
                    auth_enabled BOOLEAN NOT NULL DEFAULT FALSE,
                    username TEXT DEFAULT '',
                    password TEXT DEFAULT '',
                    timeout_sec INTEGER NOT NULL DEFAULT 10,
                    last_synced_at TIMESTAMP DEFAULT NULL,
                    last_status TEXT DEFAULT 'unknown',
                    last_error TEXT DEFAULT NULL,
                    device_count INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
                "WHERE table_name = 'users' AND column_name = 'register_ip'"
            )
            if cur.fetchone() is None:
                cur.execute("ALTER TABLE users ADD COLUMN register_ip TEXT DEFAULT NULL")
                conn.commit()

            cur.execute(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'router_configs' AND column_name = 'name'"
            )
            if cur.fetchone() is None:
                cur.execute("ALTER TABLE router_configs ADD COLUMN name TEXT NOT NULL DEFAULT 'Router 1'")
                conn.commit()

            cur.execute(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'olts' AND column_name = 'router_id'"
            )
            if cur.fetchone() is None:
                cur.execute("ALTER TABLE olts ADD COLUMN router_id INTEGER REFERENCES router_configs(id) ON DELETE SET NULL")
                cur.execute("""
                    UPDATE olts SET router_id = (
                        SELECT id FROM router_configs 
                        WHERE router_configs.user_id = olts.user_id 
                        ORDER BY id ASC LIMIT 1
                    ) WHERE router_id IS NULL
                """)
                cur.execute("""
                    UPDATE customers SET router_id = (
                        SELECT router_id FROM olts WHERE olts.id = customers.olt_id
                    ) WHERE router_id IS NULL AND olt_id IS NOT NULL
                """)
                conn.commit()
            cur.execute("SELECT id FROM users WHERE username = %s", ("admin",))
            row = cur.fetchone()
            if row is None:
                hashed = _pwd_ctx.hash("admin")
                cur.execute(
                    "INSERT INTO users (username, hashed_password, role) VALUES (%s, %s, %s) RETURNING id",
                    ("admin", hashed, "admin"),
                )
                admin_id = cur.fetchone()[0]
                conn.commit()
            else:
                admin_id = row[0]
                cur.execute(
                    "UPDATE users SET role = 'admin' WHERE username = 'admin' AND role != 'admin'"
                )
                conn.commit()

            # Seed sample OLT and customers for admin if none exist
            cur.execute("SELECT COUNT(*) FROM olts WHERE user_id = %s", (admin_id,))
            if cur.fetchone()[0] == 0:
                cur.execute("""
                    INSERT INTO olts (user_id, name, brand, host, snmp_port, snmp_community, telnet_port, telnet_user, telnet_pass, pon_ports_count, description)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
                """, (admin_id, 'OLT VSOL Sentral V1600G', 'vsol', '192.168.10.1', 161, 'public', 23, 'admin', 'admin', 8, 'OLT Utama Distribusi Fiber Optik FTTH'))
                sample_olt_id = cur.fetchone()[0]
                conn.commit()
            else:
                cur.execute("SELECT id FROM olts WHERE user_id = %s ORDER BY id ASC LIMIT 1", (admin_id,))
                sample_olt_id = cur.fetchone()[0]

            cur.execute("SELECT COUNT(*) FROM customers WHERE user_id = %s", (admin_id,))
            if cur.fetchone()[0] == 0:
                cur.execute("""
                    INSERT INTO customers (user_id, olt_id, name, phone, address, odp_name, pppoe_username, pon_port, onu_id, onu_sn, onu_model, package_name, status, last_rx_power, last_tx_power, last_olt_rx, last_distance, last_optical_status, last_checked_at)
                    VALUES
                    (%s, %s, 'Budi Santoso', '081234567890', 'Jl. Mawar No. 12, RT 02/05', 'ODP-MWR-01', 'budi_ftth', 'PON 1', 1, 'VSOL1A2B3C4D', 'V2801SG', '30 Mbps', 'active', -18.45, 2.10, -19.20, 0.85, 'normal', CURRENT_TIMESTAMP),
                    (%s, %s, 'Siti Rahmawati', '081398765432', 'Perum Griya Asri Blok B4', 'ODP-GRY-03', 'siti_asri', 'PON 1', 2, 'VSOL5E6F7A8B', 'HG8245H', '20 Mbps', 'active', -24.80, 1.85, -25.10, 2.40, 'warning', CURRENT_TIMESTAMP),
                    (%s, %s, 'Ahmad Dahlan', '085712348765', 'Jl. Pemuda No. 45', 'ODP-PMD-02', 'ahmad_dahlan', 'PON 2', 1, 'HWTC9C0D1E2F', 'F609', '50 Mbps', 'active', -28.30, 1.20, -29.00, 4.15, 'critical', CURRENT_TIMESTAMP)
                """, (admin_id, sample_olt_id, admin_id, sample_olt_id, admin_id, sample_olt_id))
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


def create_user(username: str, password: str, role: str = "user", register_ip: str | None = None) -> int:
    conn = _conn()
    try:
        with conn.cursor() as cur:
            hashed = _pwd_ctx.hash(password)
            try:
                cur.execute(
                    "INSERT INTO users (username, hashed_password, role, register_ip) VALUES (%s, %s, %s, %s) RETURNING id",
                    (username, hashed, role, register_ip),
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


def list_users() -> list[dict]:
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT id, username, role, created_at, register_ip FROM users ORDER BY id")
            return [dict(r) for r in cur.fetchall()]
    finally:
        _put(conn)


def update_user_by_admin(user_id: int, role: str | None = None, password: str | None = None) -> bool:
    conn = _conn()
    try:
        with conn.cursor() as cur:
            updates = []
            values = []
            if role is not None:
                updates.append("role = %s")
                values.append(role)
            if password is not None:
                updates.append("hashed_password = %s")
                values.append(_pwd_ctx.hash(password))
            if not updates:
                return True
            values.append(user_id)
            set_clause = ", ".join(updates)
            cur.execute(f"UPDATE users SET {set_clause} WHERE id = %s", values)
            conn.commit()
            return cur.rowcount > 0
    finally:
        _put(conn)


def delete_user(user_id: int) -> bool:
    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM router_configs WHERE user_id = %s", (user_id,))
            cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
            conn.commit()
            return cur.rowcount > 0
    finally:
        _put(conn)

def log_audit(user_id: int, action: str, endpoint: str, target: str | None = None, details: dict | None = None, user_agent: str | None = None, ip_address: str | None = None):
    conn = _conn()
    try:
        with conn.cursor() as cur:
            import json
            cur.execute(
                "INSERT INTO audit_logs (user_id, action, endpoint, target, details, user_agent, ip_address) VALUES (%s, %s, %s, %s, %s, %s, %s)",
                (user_id, action, endpoint, target, json.dumps(details) if details else None, user_agent, ip_address),
            )
            conn.commit()
    finally:
        _put(conn)


def list_audit_logs() -> list[dict]:
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT l.*, u.username FROM audit_logs l JOIN users u ON l.user_id = u.id ORDER BY l.created_at DESC LIMIT 500"
            )
            return [dict(r) for r in cur.fetchall()]
    finally:
        _put(conn)


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


# ── OLT Management ─────────────────────────────────────────

def list_olts(user_id: int, router_id: int | None = None) -> list[dict]:
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            query = """
                SELECT o.*, r.name AS router_name, COUNT(c.id) AS customer_count
                FROM olts o
                LEFT JOIN router_configs r ON r.id = o.router_id
                LEFT JOIN customers c ON c.olt_id = o.id
                WHERE o.user_id = %s
            """
            params: list = [user_id]
            if router_id is not None:
                query += " AND (o.router_id = %s OR o.router_id IS NULL)"
                params.append(router_id)
            query += """
                GROUP BY o.id, r.name
                ORDER BY o.id ASC
            """
            cur.execute(query, params)
            return [dict(r) for r in cur.fetchall()]
    finally:
        _put(conn)


def get_olt(olt_id: int, user_id: int) -> dict | None:
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT o.*, r.name AS router_name, COUNT(c.id) AS customer_count
                FROM olts o
                LEFT JOIN router_configs r ON r.id = o.router_id
                LEFT JOIN customers c ON c.olt_id = o.id
                WHERE o.id = %s AND o.user_id = %s
                GROUP BY o.id, r.name
            """, (olt_id, user_id))
            row = cur.fetchone()
            return dict(row) if row else None
    finally:
        _put(conn)


def add_olt(
    user_id: int,
    name: str,
    router_id: int | None = None,
    brand: str = "vsol",
    host: str = "192.168.1.100",
    snmp_port: int = 161,
    snmp_community: str = "public",
    telnet_port: int = 23,
    telnet_user: str = "admin",
    telnet_pass: str = "admin",
    pon_ports_count: int = 8,
    description: str = "",
) -> int:
    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO olts (
                    user_id, router_id, name, brand, host, snmp_port, snmp_community,
                    telnet_port, telnet_user, telnet_pass, pon_ports_count, description
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                user_id, router_id, name, brand, host, snmp_port, snmp_community,
                telnet_port, telnet_user, telnet_pass, pon_ports_count, description
            ))
            new_id = cur.fetchone()[0]
            conn.commit()
            return new_id
    finally:
        _put(conn)


def update_olt(olt_id: int, user_id: int, **kwargs) -> bool:
    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM olts WHERE id = %s AND user_id = %s", (olt_id, user_id))
            if cur.fetchone() is None:
                return False

            allowed = {
                "name", "router_id", "brand", "host", "snmp_port", "snmp_community",
                "telnet_port", "telnet_user", "telnet_pass", "pon_ports_count", "description"
            }
            updates = {k: v for k, v in kwargs.items() if k in allowed and v is not None}
            if not updates:
                return True

            set_clause = ", ".join(f"{k}=%s" for k in updates)
            values = list(updates.values()) + [olt_id, user_id]
            cur.execute(f"UPDATE olts SET {set_clause} WHERE id=%s AND user_id=%s", values)
            conn.commit()
            return True
    finally:
        _put(conn)


def delete_olt(olt_id: int, user_id: int) -> bool:
    conn = _conn()
    try:
        with conn.cursor() as cur:
            # Delete all ONUs/customers associated with this OLT
            cur.execute("DELETE FROM customers WHERE olt_id = %s AND user_id = %s", (olt_id, user_id))
            cur.execute("DELETE FROM olts WHERE id = %s AND user_id = %s", (olt_id, user_id))
            # Also clean up any orphaned customers whose OLT no longer exists
            cur.execute("""
                DELETE FROM customers 
                WHERE user_id = %s 
                  AND (olt_id IS NULL OR olt_id NOT IN (SELECT id FROM olts WHERE user_id = %s))
            """, (user_id, user_id))
            conn.commit()
            return cur.rowcount > 0
    finally:
        _put(conn)


# ── Customer & Optical Monitoring ──────────────────────────

def list_customers(
    user_id: int,
    router_id: int | None = None,
    olt_id: int | None = None,
    search: str | None = None,
    status_filter: str | None = None,
) -> list[dict]:
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            query = """
                SELECT
                    c.*,
                    o.name AS olt_name,
                    o.brand AS olt_brand,
                    r.name AS router_name
                FROM customers c
                LEFT JOIN olts o ON o.id = c.olt_id
                LEFT JOIN router_configs r ON r.id = c.router_id
                WHERE c.user_id = %s
            """
            params: list = [user_id]

            if router_id is not None:
                query += " AND (c.router_id = %s OR (c.router_id IS NULL AND o.router_id = %s))"
                params.extend([router_id, router_id])

            if olt_id is not None:
                query += " AND c.olt_id = %s"
                params.append(olt_id)

            if search:
                term = f"%{search}%"
                query += """ AND (
                    c.name ILIKE %s OR
                    c.pppoe_username ILIKE %s OR
                    c.phone ILIKE %s OR
                    c.onu_sn ILIKE %s OR
                    c.odp_name ILIKE %s OR
                    c.address ILIKE %s
                )"""
                params.extend([term, term, term, term, term, term])

            if status_filter:
                sf = status_filter.lower()
                if sf in ("normal", "warning", "critical", "los"):
                    query += " AND c.last_optical_status = %s"
                    params.append(sf)
                elif sf in ("active", "isolir", "maintenance"):
                    query += " AND c.status = %s"
                    params.append(sf)

            query += " ORDER BY c.id DESC"
            cur.execute(query, params)
            return [dict(r) for r in cur.fetchall()]
    finally:
        _put(conn)


def get_customer(customer_id: int, user_id: int) -> dict | None:
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT
                    c.*,
                    o.name AS olt_name,
                    o.brand AS olt_brand,
                    r.name AS router_name
                FROM customers c
                LEFT JOIN olts o ON o.id = c.olt_id
                LEFT JOIN router_configs r ON r.id = c.router_id
                WHERE c.id = %s AND c.user_id = %s
            """, (customer_id, user_id))
            row = cur.fetchone()
            return dict(row) if row else None
    finally:
        _put(conn)


def add_customer(user_id: int, **kwargs) -> int:
    conn = _conn()
    try:
        with conn.cursor() as cur:
            allowed = {
                "router_id", "olt_id", "name", "phone", "address",
                "odp_name", "pppoe_username", "pon_port", "onu_id",
                "onu_sn", "onu_model", "package_name", "status",
                "last_rx_power", "last_tx_power", "last_olt_rx",
                "last_distance", "last_optical_status", "last_checked_at"
            }
            fields = ["user_id"]
            values = [user_id]
            for k, v in kwargs.items():
                if k in allowed:
                    fields.append(k)
                    values.append(v)

            cols = ", ".join(fields)
            placeholders = ", ".join(["%s"] * len(fields))
            cur.execute(
                f"INSERT INTO customers ({cols}) VALUES ({placeholders}) RETURNING id",
                values,
            )
            new_id = cur.fetchone()[0]
            conn.commit()
            return new_id
    finally:
        _put(conn)


def deduplicate_customers(user_id: int) -> int:
    """Removes duplicate customer entries for the same user, prioritizing OLT mapping (olt_id, pon_port, onu_id) and pppoe_username."""
    conn = _conn()
    try:
        with conn.cursor() as cur:
            # 0. Clean up any orphaned customers whose OLT was deleted
            cur.execute("""
                DELETE FROM customers
                WHERE user_id = %s
                  AND (olt_id IS NULL OR olt_id NOT IN (SELECT id FROM olts WHERE user_id = %s))
            """, (user_id, user_id))

            # 1. Deduplicate by OLT, PON port, and ONU ID
            cur.execute("""
                DELETE FROM customers
                WHERE user_id = %s
                  AND olt_id IS NOT NULL
                  AND id NOT IN (
                      SELECT MAX(id)
                      FROM customers
                      WHERE user_id = %s AND olt_id IS NOT NULL
                      GROUP BY olt_id, pon_port, onu_id
                  )
            """, (user_id, user_id))
            del1 = cur.rowcount

            # 2. Deduplicate by PPPoE username if provided
            cur.execute("""
                DELETE FROM customers
                WHERE user_id = %s
                  AND pppoe_username IS NOT NULL
                  AND pppoe_username != ''
                  AND id NOT IN (
                      SELECT MAX(id)
                      FROM customers
                      WHERE user_id = %s
                        AND pppoe_username IS NOT NULL
                        AND pppoe_username != ''
                      GROUP BY pppoe_username
                  )
            """, (user_id, user_id))
            del2 = cur.rowcount

            conn.commit()
            return del1 + del2
    finally:
        _put(conn)


def clean_unmatched_customers(user_id: int, olt_id: int | None, valid_customer_ids: list[int]) -> int:
    """Removes customer records that do not belong to the active OLT scan."""
    conn = _conn()
    try:
        with conn.cursor() as cur:
            if valid_customer_ids:
                if olt_id:
                    cur.execute(
                        "DELETE FROM customers WHERE user_id = %s AND (olt_id = %s OR olt_id IS NULL) AND id NOT IN %s",
                        (user_id, olt_id, tuple(valid_customer_ids)),
                    )
                else:
                    cur.execute(
                        "DELETE FROM customers WHERE user_id = %s AND id NOT IN %s",
                        (user_id, tuple(valid_customer_ids)),
                    )
            else:
                if olt_id:
                    cur.execute(
                        "DELETE FROM customers WHERE user_id = %s AND (olt_id = %s OR olt_id IS NULL)",
                        (user_id, olt_id),
                    )
                else:
                    cur.execute("DELETE FROM customers WHERE user_id = %s", (user_id,))
            deleted = cur.rowcount
            conn.commit()
            return deleted
    finally:
        _put(conn)


def upsert_customer(user_id: int, **kwargs) -> tuple[int, bool]:
    """
    Inserts or updates a customer with OLT as master record.
    Matches primarily on (user_id, olt_id, pon_port, onu_id) or (user_id, onu_sn).
    Never merges purely by pppoe_username to avoid conflating physical ONUs.
    """
    olt_id = kwargs.get("olt_id")
    pon_port = kwargs.get("pon_port") or "PON 1"
    onu_id = kwargs.get("onu_id") or 1
    onu_sn = (kwargs.get("onu_sn") or "").strip()

    conn = _conn()
    try:
        with conn.cursor() as cur:
            row = None
            # 1. Match by (olt_id, pon_port, onu_id)
            if olt_id and pon_port and onu_id:
                cur.execute(
                    "SELECT id FROM customers WHERE user_id = %s AND olt_id = %s AND pon_port = %s AND onu_id = %s ORDER BY id DESC LIMIT 1",
                    (user_id, olt_id, pon_port, onu_id),
                )
                row = cur.fetchone()

            # 2. Match by ONU Serial Number / MAC
            if not row and onu_sn:
                cur.execute(
                    "SELECT id FROM customers WHERE user_id = %s AND onu_sn = %s ORDER BY id DESC LIMIT 1",
                    (user_id, onu_sn),
                )
                row = cur.fetchone()

            if row:
                cid = row[0]
                allowed = {
                    "router_id", "olt_id", "name", "phone", "address",
                    "odp_name", "pppoe_username", "pon_port", "onu_id",
                    "onu_sn", "onu_model", "package_name", "status",
                    "last_rx_power", "last_tx_power", "last_olt_rx",
                    "last_distance", "last_optical_status", "last_checked_at"
                }
                updates = {k: v for k, v in kwargs.items() if k in allowed and v is not None}
                if updates:
                    set_clause = ", ".join(f"{k}=%s" for k in updates)
                    values = list(updates.values()) + [cid, user_id]
                    cur.execute(f"UPDATE customers SET {set_clause} WHERE id=%s AND user_id=%s", values)
                    conn.commit()
                return cid, False

            # Otherwise, insert as new customer
            return add_customer(user_id, **kwargs), True
    finally:
        _put(conn)


def update_customer(customer_id: int, user_id: int, **kwargs) -> bool:
    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM customers WHERE id = %s AND user_id = %s", (customer_id, user_id))
            if cur.fetchone() is None:
                return False

            allowed = {
                "router_id", "olt_id", "name", "phone", "address",
                "odp_name", "pppoe_username", "pon_port", "onu_id",
                "onu_sn", "onu_model", "package_name", "status",
                "last_rx_power", "last_tx_power", "last_olt_rx",
                "last_distance", "last_optical_status", "last_checked_at"
            }
            updates = {k: v for k, v in kwargs.items() if k in allowed}
            if not updates:
                return True

            set_clause = ", ".join(f"{k}=%s" for k in updates)
            values = list(updates.values()) + [customer_id, user_id]
            cur.execute(f"UPDATE customers SET {set_clause} WHERE id=%s AND user_id=%s", values)
            conn.commit()
            return True
    finally:
        _put(conn)


def delete_customer(customer_id: int, user_id: int) -> bool:
    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM customers WHERE id = %s AND user_id = %s", (customer_id, user_id))
            conn.commit()
            return cur.rowcount > 0
    finally:
        _put(conn)


def update_customer_optical(
    customer_id: int,
    user_id: int,
    rx_power: float | None,
    tx_power: float | None = None,
    olt_rx: float | None = None,
    distance: float | None = None,
    status: str = "normal",
) -> bool:
    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE customers
                SET
                    last_rx_power = %s,
                    last_tx_power = %s,
                    last_olt_rx = %s,
                    last_distance = %s,
                    last_optical_status = %s,
                    last_checked_at = CURRENT_TIMESTAMP
                WHERE id = %s AND user_id = %s
            """, (rx_power, tx_power, olt_rx, distance, status, customer_id, user_id))
            conn.commit()
            return cur.rowcount > 0
    finally:
        _put(conn)


def get_customer_stats(user_id: int, router_id: int | None = None, olt_id: int | None = None) -> dict:
    conn = _conn()
    try:
        with conn.cursor() as cur:
            query = """
                SELECT
                    COUNT(*) AS total,
                    COUNT(*) FILTER (WHERE c.status = 'active') AS active,
                    COUNT(*) FILTER (WHERE c.last_optical_status = 'normal') AS normal,
                    COUNT(*) FILTER (WHERE c.last_optical_status = 'warning') AS warning,
                    COUNT(*) FILTER (WHERE c.last_optical_status = 'critical') AS critical,
                    COUNT(*) FILTER (WHERE c.last_optical_status = 'los') AS los
                FROM customers c
                LEFT JOIN olts o ON o.id = c.olt_id
                WHERE c.user_id = %s
            """
            params: list = [user_id]
            if router_id is not None:
                query += " AND (c.router_id = %s OR (c.router_id IS NULL AND o.router_id = %s))"
                params.extend([router_id, router_id])
            if olt_id is not None:
                query += " AND c.olt_id = %s"
                params.append(olt_id)

            cur.execute(query, params)
            row = cur.fetchone()
            if not row:
                return {"total": 0, "active": 0, "normal": 0, "warning": 0, "critical": 0, "los": 0}
            return {
                "total": row[0] or 0,
                "active": row[1] or 0,
                "normal": row[2] or 0,
                "warning": row[3] or 0,
                "critical": row[4] or 0,
                "los": row[5] or 0,
            }
    finally:
        _put(conn)


# ─── Backup Functions ───

def get_backup_settings(user_id: int) -> dict:
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM backup_settings WHERE user_id = %s", (user_id,))
            row = cur.fetchone()
            if row:
                return dict(row)
            # Create default settings if none exist
            cur.execute("""
                INSERT INTO backup_settings (user_id, enabled, schedule_day, schedule_hour, schedule_minute, backup_type, retention_count)
                VALUES (%s, TRUE, 6, 2, 0, 'both', 8)
                RETURNING *
            """, (user_id,))
            conn.commit()
            return dict(cur.fetchone())
    finally:
        _put(conn)


def update_backup_settings(
    user_id: int,
    enabled: bool,
    schedule_day: int,
    schedule_hour: int,
    schedule_minute: int,
    backup_type: str,
    retention_count: int,
) -> dict:
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO backup_settings (user_id, enabled, schedule_day, schedule_hour, schedule_minute, backup_type, retention_count, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id) DO UPDATE SET
                    enabled = EXCLUDED.enabled,
                    schedule_day = EXCLUDED.schedule_day,
                    schedule_hour = EXCLUDED.schedule_hour,
                    schedule_minute = EXCLUDED.schedule_minute,
                    backup_type = EXCLUDED.backup_type,
                    retention_count = EXCLUDED.retention_count,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING *
            """, (user_id, enabled, schedule_day, schedule_hour, schedule_minute, backup_type, retention_count))
            row = cur.fetchone()
            conn.commit()
            return dict(row)
    finally:
        _put(conn)


def update_backup_schedule_timestamps(
    user_id: int,
    last_run_at: Any = None,
    next_run_at: Any = None,
):
    conn = _conn()
    try:
        with conn.cursor() as cur:
            if last_run_at and next_run_at:
                cur.execute(
                    "UPDATE backup_settings SET last_run_at = %s, next_run_at = %s WHERE user_id = %s",
                    (last_run_at, next_run_at, user_id),
                )
            elif next_run_at:
                cur.execute(
                    "UPDATE backup_settings SET next_run_at = %s WHERE user_id = %s",
                    (next_run_at, user_id),
                )
            elif last_run_at:
                cur.execute(
                    "UPDATE backup_settings SET last_run_at = %s WHERE user_id = %s",
                    (last_run_at, user_id),
                )
            conn.commit()
    finally:
        _put(conn)


def get_all_enabled_backup_settings() -> list[dict]:
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM backup_settings WHERE enabled = TRUE")
            return [dict(r) for r in cur.fetchall()]
    finally:
        _put(conn)


def create_backup_record(
    user_id: int,
    router_id: int,
    filename: str,
    file_path: str,
    file_size: int,
    backup_type: str,
    trigger_type: str,
    status: str = "completed",
    error_message: str | None = None,
) -> dict:
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO router_backups (
                    user_id, router_id, filename, file_path, file_size,
                    backup_type, trigger_type, status, error_message, created_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
                RETURNING *
            """, (
                user_id, router_id, filename, file_path, file_size,
                backup_type, trigger_type, status, error_message
            ))
            row = cur.fetchone()
            conn.commit()
            return dict(row)
    finally:
        _put(conn)


def list_backups(user_id: int, router_id: int | None = None) -> list[dict]:
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            query = """
                SELECT b.*, r.name AS router_name, r.host AS router_host
                FROM router_backups b
                LEFT JOIN router_configs r ON b.router_id = r.id
                WHERE b.user_id = %s
            """
            params: list[Any] = [user_id]
            if router_id:
                query += " AND b.router_id = %s"
                params.append(router_id)
            query += " ORDER BY b.created_at DESC"
            cur.execute(query, tuple(params))
            return [dict(r) for r in cur.fetchall()]
    finally:
        _put(conn)


def get_backup_by_id(backup_id: int, user_id: int) -> dict | None:
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT b.*, r.name AS router_name, r.host AS router_host
                FROM router_backups b
                LEFT JOIN router_configs r ON b.router_id = r.id
                WHERE b.id = %s AND b.user_id = %s
            """, (backup_id, user_id))
            row = cur.fetchone()
            return dict(row) if row else None
    finally:
        _put(conn)


def delete_backup_record(backup_id: int, user_id: int) -> dict | None:
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("DELETE FROM router_backups WHERE id = %s AND user_id = %s RETURNING *", (backup_id, user_id))
            row = cur.fetchone()
            conn.commit()
            return dict(row) if row else None
    finally:
        _put(conn)


def prune_old_backups(user_id: int, router_id: int, keep_count: int) -> list[str]:
    """Delete backups beyond keep_count per router, returning pruned file paths."""
    if keep_count <= 0:
        return []
    conn = _conn()
    pruned_paths: list[str] = []
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT id, file_path FROM router_backups
                WHERE user_id = %s AND router_id = %s AND status = 'completed'
                ORDER BY created_at DESC
                OFFSET %s
            """, (user_id, router_id, keep_count))
            old_rows = cur.fetchall()
            if old_rows:
                old_ids = [r["id"] for r in old_rows]
                pruned_paths = [r["file_path"] for r in old_rows if r["file_path"]]
                cur.execute("DELETE FROM router_backups WHERE id = ANY(%s)", (old_ids,))
                conn.commit()
        return pruned_paths
    finally:
        _put(conn)


def get_backup_stats(user_id: int) -> dict:
    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    COUNT(*) AS total_count,
                    COALESCE(SUM(file_size), 0) AS total_size,
                    MAX(created_at) AS last_backup_at
                FROM router_backups
                WHERE user_id = %s AND status = 'completed'
            """, (user_id,))
            row = cur.fetchone()
            total_count = row[0] if row else 0
            total_size = row[1] if row else 0
            last_backup_at = row[2] if row else None

            # Get next run
            cur.execute("SELECT next_run_at, enabled FROM backup_settings WHERE user_id = %s", (user_id,))
            s_row = cur.fetchone()
            next_run_at = s_row[0] if s_row else None
            enabled = s_row[1] if s_row else True

            return {
                "total_count": total_count,
                "total_size": total_size,
                "last_backup_at": last_backup_at.isoformat() if last_backup_at else None,
                "next_run_at": next_run_at.isoformat() if next_run_at else None,
                "enabled": enabled,
            }
    finally:
        _put(conn)


def get_genieacs_settings(user_id: int) -> dict:
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM genieacs_settings WHERE user_id = %s", (user_id,))
            row = cur.fetchone()
            if row:
                return dict(row)
            # Create default settings if none exist
            cur.execute("""
                INSERT INTO genieacs_settings (user_id, enabled, url, auth_enabled, username, password, timeout_sec)
                VALUES (%s, TRUE, 'http://192.168.1.10:7557', FALSE, '', '', 10)
                RETURNING *
            """, (user_id,))
            conn.commit()
            return dict(cur.fetchone())
    finally:
        _put(conn)


def update_genieacs_settings(
    user_id: int,
    enabled: bool,
    url: str,
    auth_enabled: bool,
    username: str,
    password: str,
    timeout_sec: int,
) -> dict:
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO genieacs_settings (user_id, enabled, url, auth_enabled, username, password, timeout_sec, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id) DO UPDATE SET
                    enabled = EXCLUDED.enabled,
                    url = EXCLUDED.url,
                    auth_enabled = EXCLUDED.auth_enabled,
                    username = EXCLUDED.username,
                    password = CASE WHEN EXCLUDED.password != '' THEN EXCLUDED.password ELSE genieacs_settings.password END,
                    timeout_sec = EXCLUDED.timeout_sec,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING *
            """, (user_id, enabled, url, auth_enabled, username, password, timeout_sec))
            row = cur.fetchone()
            conn.commit()
            return dict(row)
    finally:
        _put(conn)


def update_genieacs_status(user_id: int, status: str, count: int = 0, error: str | None = None) -> None:
    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE genieacs_settings
                SET last_status = %s,
                    device_count = %s,
                    last_error = %s,
                    last_synced_at = CURRENT_TIMESTAMP
                WHERE user_id = %s
            """, (status, count, error, user_id))
            conn.commit()
    finally:
        _put(conn)


