from fastapi import APIRouter, Depends, HTTPException, Header, Request
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import Optional

from . import mikrotik
from . import config as cfg_mod
from . import database as db
from .auth import create_access_token, get_current_user, require_admin

router = APIRouter(prefix="/api")


def _safe(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Mikrotik error: {e}")


def _get_router_id(x_router_id: Optional[str] = Header(None)) -> int | None:
    """Extract router_id from X-Router-Id header."""
    if x_router_id is not None:
        try:
            return int(x_router_id)
        except (ValueError, TypeError):
            pass
    return None


# ── Auth ────────────────────────────────────────────────────

@router.post("/auth/login")
def login(form: OAuth2PasswordRequestForm = Depends(), request: Request = None):
    user = db.get_user_by_username(form.username)
    if user is None or not db.verify_password(form.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Username atau password salah")
    token = create_access_token({"sub": user["username"]})
    db.log_audit(
        user_id=user["id"], action="LOGIN", endpoint="/api/auth/login", target="Login",
        user_agent=request.headers.get("user-agent") if request else None,
        ip_address=request.client.host if request and request.client else None,
    )
    return {"access_token": token, "token_type": "bearer", "username": user["username"]}


@router.get("/auth/me")
def me(user: dict = Depends(get_current_user)):
    return {"id": user["id"], "username": user["username"], "role": user.get("role", "user")}


class RegisterRequest(BaseModel):
    username: str
    password: str


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/auth/register")
def register(body: RegisterRequest, request: Request):
    """Register a new user."""
    if len(body.username.strip()) < 3:
        raise HTTPException(status_code=400, detail="Username minimal 3 karakter")
    if len(body.password) < 4:
        raise HTTPException(status_code=400, detail="Password minimal 4 karakter")
    client_ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or request.client.host
    try:
        user_id = db.create_user(body.username.strip(), body.password, register_ip=client_ip)
        token = create_access_token({"sub": body.username.strip()})
        db.log_audit(
            user_id=user_id, action="REGISTER", endpoint="/api/auth/register", target="Register",
            user_agent=request.headers.get("user-agent"),
            ip_address=client_ip,
        )
        return {"access_token": token, "token_type": "bearer", "username": body.username.strip()}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/auth/password")
def change_password(body: PasswordChangeRequest, request: Request, user: dict = Depends(get_current_user)):
    """Change user password."""
    if not db.verify_password(body.current_password, user["hashed_password"]):
        raise HTTPException(status_code=400, detail="Password lama salah")
    if len(body.new_password) < 4:
        raise HTTPException(status_code=400, detail="Password baru minimal 4 karakter")
    db.update_user_password(user["id"], body.new_password)
    db.log_audit(
        user_id=user["id"], action="PUT", endpoint="/api/auth/password", target="Change Password",
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    return {"success": True, "message": "Password berhasil diubah"}


# ── Admin User Management (protected - admin only) ─────────

class AdminUserCreate(BaseModel):
    username: str
    password: str
    role: str = "user"


class AdminUserUpdate(BaseModel):
    role: str | None = None
    password: str | None = None


@router.get("/admin/users")
def admin_list_users(admin: dict = Depends(require_admin)):
    """List all users in the system."""
    return db.list_users()


@router.post("/admin/users")
def admin_create_user(body: AdminUserCreate, request: Request, current_user: dict = Depends(require_admin)):
    """Create a new user with a specified role."""
    if len(body.username.strip()) < 3:
        raise HTTPException(status_code=400, detail="Username minimal 3 karakter")
    if len(body.password) < 4:
        raise HTTPException(status_code=400, detail="Password minimal 4 karakter")
    if body.role not in ("admin", "user"):
        raise HTTPException(status_code=400, detail="Role harus 'admin' atau 'user'")
    try:
        new_id = db.create_user(body.username.strip(), body.password, body.role)
        db.log_audit(
            user_id=current_user["id"], action="POST", endpoint="/api/admin/users", target="Create User",
            details={"created_user": body.username.strip(), "role": body.role},
            user_agent=request.headers.get("user-agent"),
            ip_address=request.client.host if request.client else None,
        )
        return {"success": True, "id": new_id, "username": body.username.strip(), "role": body.role}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/admin/users/{user_id}")
def admin_update_user(user_id: int, body: AdminUserUpdate, request: Request, current_user: dict = Depends(require_admin)):
    """Update user role or reset password."""
    if body.role and body.role not in ("admin", "user"):
        raise HTTPException(status_code=400, detail="Role harus 'admin' atau 'user'")
    if body.password and len(body.password) < 4:
        raise HTTPException(status_code=400, detail="Password minimal 4 karakter")
    ok = db.update_user_by_admin(user_id, role=body.role, password=body.password)
    if not ok:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    db.log_audit(
        user_id=current_user["id"], action="PUT", endpoint=f"/api/admin/users/{user_id}", target="Update User",
        details={"target_user_id": user_id, "role": body.role},
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    return {"success": True, "message": "User berhasil diperbarui"}

@router.delete("/admin/users/{user_id}")
def admin_delete_user(user_id: int, request: Request, current_user: dict = Depends(require_admin)):
    """Delete user by ID (prevents self-deletion)."""
    if current_user["id"] == user_id:
        raise HTTPException(status_code=400, detail="Tidak dapat menghapus akun sendiri")
    ok = db.delete_user(user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    db.log_audit(
        user_id=current_user["id"], action="DELETE", endpoint=f"/api/admin/users/{user_id}", target="Delete User",
        details={"deleted_user_id": user_id},
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    return {"success": True, "message": "User berhasil dihapus"}

@router.get("/admin/logs")
def admin_get_logs(admin: dict = Depends(require_admin)):
    return db.list_audit_logs()


# ── Routers CRUD (protected) ──────────────────────────────

class RouterCreate(BaseModel):
    name: str
    host: str
    username: str
    password: str = ""
    port: int = 8728


class RouterUpdate(BaseModel):
    name: str | None = None
    host: str | None = None
    username: str | None = None
    password: str | None = None
    port: int | None = None


@router.get("/routers")
def list_routers(user: dict = Depends(get_current_user)):
    """List all routers for the current user."""
    return db.list_routers(user["id"])


@router.post("/routers")
def add_router(body: RouterCreate, request: Request, user: dict = Depends(get_current_user)):
    """Add a new router."""
    router_id = db.add_router(
        user["id"], body.name, body.host, body.username, body.password, body.port
    )
    db.log_audit(
        user_id=user["id"], action="POST", endpoint="/api/routers", target="Add Router",
        details={"router_name": body.name, "host": body.host},
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    return db.get_router_by_id(router_id, user["id"])


@router.get("/routers/{router_id}")
def get_router(router_id: int, user: dict = Depends(get_current_user)):
    """Get a specific router config."""
    r = db.get_router_by_id(router_id, user["id"])
    if r is None:
        raise HTTPException(status_code=404, detail="Router tidak ditemukan")
    # Mask password
    r["password"] = "••••••••" if r.get("password") else ""
    return r


@router.put("/routers/{router_id}")
def update_router(router_id: int, body: RouterUpdate, request: Request, user: dict = Depends(get_current_user)):
    """Update a router config."""
    ok = db.update_router(router_id, user["id"], **body.model_dump(exclude_none=True))
    if not ok:
        raise HTTPException(status_code=404, detail="Router tidak ditemukan")
    db.log_audit(
        user_id=user["id"], action="PUT", endpoint=f"/api/routers/{router_id}", target="Update Router",
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    mikrotik.reset_connection()
    r = db.get_router_by_id(router_id, user["id"])
    r["password"] = "••••••••" if r.get("password") else ""
    return r


@router.delete("/routers/{router_id}")
def delete_router(router_id: int, request: Request, user: dict = Depends(get_current_user)):
    """Delete a router config."""
    ok = db.delete_router(router_id, user["id"])
    if not ok:
        raise HTTPException(status_code=404, detail="Router tidak ditemukan")
    db.log_audit(
        user_id=user["id"], action="DELETE", endpoint=f"/api/routers/{router_id}", target="Delete Router",
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    mikrotik.reset_connection()
    return {"success": True}


@router.post("/routers/{router_id}/test")
def test_router_connection(router_id: int, user: dict = Depends(get_current_user)):
    """Test connection to a specific router."""
    r = db.get_router_by_id(router_id, user["id"])
    if r is None:
        raise HTTPException(status_code=404, detail="Router tidak ditemukan")
    try:
        res = mikrotik.get_system_resource(user["id"], router_id)
        return {"success": True, "identity": res.get("identity"), "version": res.get("version")}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── System / Interfaces (protected) ────────────────────────

@router.get("/system/resource")
def system_resource(user: dict = Depends(get_current_user), router_id: int | None = Depends(_get_router_id)):
    return _safe(mikrotik.get_system_resource, user["id"], router_id)


@router.get("/interfaces")
def interfaces(user: dict = Depends(get_current_user), router_id: int | None = Depends(_get_router_id)):
    return _safe(mikrotik.list_interfaces, user["id"], router_id)


@router.get("/interfaces/summary")
def interfaces_summary(user: dict = Depends(get_current_user), router_id: int | None = Depends(_get_router_id)):
    return _safe(mikrotik.interface_summary, user["id"], router_id)


@router.get("/ppp/stats")
def ppp_stats(user: dict = Depends(get_current_user), router_id: int | None = Depends(_get_router_id)):
    return _safe(mikrotik.ppp_stats, user["id"], router_id)


@router.get("/ppp/active")
def ppp_active(user: dict = Depends(get_current_user), router_id: int | None = Depends(_get_router_id)):
    return _safe(mikrotik.ppp_active_list, user["id"], router_id)


@router.get("/ppp/secrets")
def ppp_secrets(user: dict = Depends(get_current_user), router_id: int | None = Depends(_get_router_id)):
    return _safe(mikrotik.ppp_secret_list, user["id"], router_id)


@router.get("/hotspot/stats")
def hotspot_stats(user: dict = Depends(get_current_user), router_id: int | None = Depends(_get_router_id)):
    return _safe(mikrotik.hotspot_stats, user["id"], router_id)


@router.get("/hotspot/active")
def hotspot_active(user: dict = Depends(get_current_user), router_id: int | None = Depends(_get_router_id)):
    return _safe(mikrotik.hotspot_active_list, user["id"], router_id)


@router.get("/hotspot/users")
def hotspot_users(user: dict = Depends(get_current_user), router_id: int | None = Depends(_get_router_id)):
    return _safe(mikrotik.hotspot_user_list, user["id"], router_id)


@router.get("/topology")
def topology(user: dict = Depends(get_current_user), router_id: int | None = Depends(_get_router_id)):
    return _safe(mikrotik.get_topology_data, user["id"], router_id)


# ── Legacy Config (protected) ─────────────────────────────

class ConfigUpdate(BaseModel):
    host: str | None = None
    username: str | None = None
    password: str | None = None
    port: int | None = None


@router.get("/config")
def get_config(user: dict = Depends(get_current_user)):
    return cfg_mod.safe_view(user["id"])


@router.put("/config")
def update_config(body: ConfigUpdate, user: dict = Depends(get_current_user)):
    try:
        cfg_mod.save(body.model_dump(exclude_none=True), user["id"])
        mikrotik.reset_connection()
        return cfg_mod.safe_view(user["id"])
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/config/test")
def test_connection(user: dict = Depends(get_current_user)):
    """Test koneksi ke Mikrotik dengan config saat ini."""
    try:
        res = mikrotik.get_system_resource(user["id"], None)
        return {"success": True, "identity": res.get("identity"), "version": res.get("version")}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── NOC Monitoring Endpoints (protected) ───────────────────

@router.get("/noc/overview")
def noc_overview(user: dict = Depends(get_current_user), router_id: int | None = Depends(_get_router_id)):
    """Comprehensive NOC telemetry overview."""
    return _safe(mikrotik.get_noc_overview, user["id"], router_id)


@router.get("/noc/health")
def noc_health(user: dict = Depends(get_current_user), router_id: int | None = Depends(_get_router_id)):
    """Hardware health: temperature, voltage, fan."""
    return _safe(mikrotik.get_system_health, user["id"], router_id)


@router.get("/noc/cpu-cores")
def noc_cpu_cores(user: dict = Depends(get_current_user), router_id: int | None = Depends(_get_router_id)):
    """Per-core CPU usage."""
    return _safe(mikrotik.get_cpu_cores, user["id"], router_id)


@router.get("/noc/ports")
def noc_ports(user: dict = Depends(get_current_user), router_id: int | None = Depends(_get_router_id)):
    """Detailed port and link status with drops and errors."""
    return _safe(mikrotik.get_ports_detail, user["id"], router_id)


@router.get("/noc/top-domains")
def noc_top_domains(limit: int = 5, user: dict = Depends(get_current_user), router_id: int | None = Depends(_get_router_id)):
    """Top accessed root domains from DNS cache."""
    return _safe(mikrotik.get_top_dns_domains, limit, user["id"], router_id)


@router.get("/noc/top-talkers")
def noc_top_talkers(limit: int = 5, user: dict = Depends(get_current_user), router_id: int | None = Depends(_get_router_id)):
    """Top bandwidth consuming clients."""
    return _safe(mikrotik.get_top_talkers, limit, user["id"], router_id)


@router.get("/noc/ping")
def noc_ping(host: str = "8.8.8.8", count: int = 2, user: dict = Depends(get_current_user), router_id: int | None = Depends(_get_router_id)):
    """Live latency measurement."""
    return _safe(mikrotik.get_ping_latency, host, count, user["id"], router_id)

