from fastapi import APIRouter, Depends, HTTPException, Header
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import Optional

from . import mikrotik
from . import config as cfg_mod
from . import database as db
from .auth import create_access_token, get_current_user

router = APIRouter(prefix="/api")


def _safe(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Mikrotik error: {e}")


def _set_user_cfg(user: dict, router_id: int | None = None):
    """Set active user and router so mikrotik module reads the right config."""
    cfg_mod.set_active_user(user["id"], router_id)


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
def login(form: OAuth2PasswordRequestForm = Depends()):
    user = db.get_user_by_username(form.username)
    if user is None or not db.verify_password(form.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Username atau password salah")
    token = create_access_token({"sub": user["username"]})
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
def register(body: RegisterRequest):
    """Register a new user."""
    if len(body.username.strip()) < 3:
        raise HTTPException(status_code=400, detail="Username minimal 3 karakter")
    if len(body.password) < 4:
        raise HTTPException(status_code=400, detail="Password minimal 4 karakter")
    try:
        user_id = db.create_user(body.username.strip(), body.password)
        token = create_access_token({"sub": body.username.strip()})
        return {"access_token": token, "token_type": "bearer", "username": body.username.strip()}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/auth/password")
def change_password(body: PasswordChangeRequest, user: dict = Depends(get_current_user)):
    """Change user password."""
    if not db.verify_password(body.current_password, user["hashed_password"]):
        raise HTTPException(status_code=400, detail="Password lama salah")
    if len(body.new_password) < 4:
        raise HTTPException(status_code=400, detail="Password baru minimal 4 karakter")
    db.update_user_password(user["id"], body.new_password)
    return {"success": True, "message": "Password berhasil diubah"}


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
def add_router(body: RouterCreate, user: dict = Depends(get_current_user)):
    """Add a new router."""
    router_id = db.add_router(
        user["id"], body.name, body.host, body.username, body.password, body.port
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
def update_router(router_id: int, body: RouterUpdate, user: dict = Depends(get_current_user)):
    """Update a router config."""
    ok = db.update_router(router_id, user["id"], **body.model_dump(exclude_none=True))
    if not ok:
        raise HTTPException(status_code=404, detail="Router tidak ditemukan")
    mikrotik.reset_connection()
    r = db.get_router_by_id(router_id, user["id"])
    r["password"] = "••••••••" if r.get("password") else ""
    return r


@router.delete("/routers/{router_id}")
def delete_router(router_id: int, user: dict = Depends(get_current_user)):
    """Delete a router config."""
    ok = db.delete_router(router_id, user["id"])
    if not ok:
        raise HTTPException(status_code=404, detail="Router tidak ditemukan")
    mikrotik.reset_connection()
    return {"success": True}


@router.post("/routers/{router_id}/test")
def test_router_connection(router_id: int, user: dict = Depends(get_current_user)):
    """Test connection to a specific router."""
    r = db.get_router_by_id(router_id, user["id"])
    if r is None:
        raise HTTPException(status_code=404, detail="Router tidak ditemukan")
    _set_user_cfg(user, router_id)
    try:
        res = mikrotik.get_system_resource()
        return {"success": True, "identity": res.get("identity"), "version": res.get("version")}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── System / Interfaces (protected) ────────────────────────

@router.get("/system/resource")
def system_resource(user: dict = Depends(get_current_user), router_id: int | None = Depends(_get_router_id)):
    _set_user_cfg(user, router_id)
    return _safe(mikrotik.get_system_resource)


@router.get("/interfaces")
def interfaces(user: dict = Depends(get_current_user), router_id: int | None = Depends(_get_router_id)):
    _set_user_cfg(user, router_id)
    return _safe(mikrotik.list_interfaces)


@router.get("/interfaces/summary")
def interfaces_summary(user: dict = Depends(get_current_user), router_id: int | None = Depends(_get_router_id)):
    _set_user_cfg(user, router_id)
    return _safe(mikrotik.interface_summary)


@router.get("/ppp/stats")
def ppp_stats(user: dict = Depends(get_current_user), router_id: int | None = Depends(_get_router_id)):
    _set_user_cfg(user, router_id)
    return _safe(mikrotik.ppp_stats)


@router.get("/ppp/active")
def ppp_active(user: dict = Depends(get_current_user), router_id: int | None = Depends(_get_router_id)):
    _set_user_cfg(user, router_id)
    return _safe(mikrotik.ppp_active_list)


@router.get("/ppp/secrets")
def ppp_secrets(user: dict = Depends(get_current_user), router_id: int | None = Depends(_get_router_id)):
    _set_user_cfg(user, router_id)
    return _safe(mikrotik.ppp_secret_list)


@router.get("/hotspot/stats")
def hotspot_stats(user: dict = Depends(get_current_user), router_id: int | None = Depends(_get_router_id)):
    _set_user_cfg(user, router_id)
    return _safe(mikrotik.hotspot_stats)


@router.get("/hotspot/active")
def hotspot_active(user: dict = Depends(get_current_user), router_id: int | None = Depends(_get_router_id)):
    _set_user_cfg(user, router_id)
    return _safe(mikrotik.hotspot_active_list)


@router.get("/hotspot/users")
def hotspot_users(user: dict = Depends(get_current_user), router_id: int | None = Depends(_get_router_id)):
    _set_user_cfg(user, router_id)
    return _safe(mikrotik.hotspot_user_list)


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
    _set_user_cfg(user)
    try:
        res = mikrotik.get_system_resource()
        return {"success": True, "identity": res.get("identity"), "version": res.get("version")}
    except Exception as e:
        return {"success": False, "error": str(e)}
