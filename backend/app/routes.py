from fastapi import APIRouter, Depends, HTTPException, Header, Request
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import Optional

from . import mikrotik
from . import config as cfg_mod
from . import database as db
from . import olt_service
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


@router.get("/noc/incident-logs")
def noc_incident_logs(limit: int = 20, user: dict = Depends(get_current_user), router_id: int | None = Depends(_get_router_id)):
    """Live warning, error, and critical logs feed."""
    return _safe(mikrotik.get_incident_logs, limit, user["id"], router_id)


@router.get("/noc/multi-ping")
def noc_multi_ping(user: dict = Depends(get_current_user), router_id: int | None = Depends(_get_router_id)):
    """Multi-target ping matrix (ISP Gateway, Cloudflare, Google)."""
    return _safe(mikrotik.get_multi_ping, user["id"], router_id)


@router.get("/noc/dhcp-conntrack")
def noc_dhcp_conntrack(user: dict = Depends(get_current_user), router_id: int | None = Depends(_get_router_id)):
    """DHCP IP pool and firewall connection tracking telemetry."""
    return _safe(mikrotik.get_dhcp_and_conntrack, user["id"], router_id)


# ── OLT & Customer FTTH Monitoring ────────────────────────

class OltCreate(BaseModel):
    name: str
    brand: str = "vsol"
    host: str = "192.168.1.100"
    snmp_port: int = 161
    snmp_community: str = "public"
    telnet_port: int = 23
    telnet_user: str = "admin"
    telnet_pass: str = "admin"
    pon_ports_count: int = 8
    description: str = ""


class OltUpdate(BaseModel):
    name: Optional[str] = None
    brand: Optional[str] = None
    host: Optional[str] = None
    snmp_port: Optional[int] = None
    snmp_community: Optional[str] = None
    telnet_port: Optional[int] = None
    telnet_user: Optional[str] = None
    telnet_pass: Optional[str] = None
    pon_ports_count: Optional[int] = None
    description: Optional[str] = None


class CustomerCreate(BaseModel):
    name: str
    phone: str = ""
    address: str = ""
    odp_name: str = ""
    pppoe_username: str = ""
    router_id: Optional[int] = None
    olt_id: Optional[int] = None
    pon_port: str = "PON 1"
    onu_id: int = 1
    onu_sn: str = ""
    onu_model: str = "V2801SG"
    package_name: str = "20 Mbps"
    status: str = "active"


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    odp_name: Optional[str] = None
    pppoe_username: Optional[str] = None
    router_id: Optional[int] = None
    olt_id: Optional[int] = None
    pon_port: Optional[str] = None
    onu_id: Optional[int] = None
    onu_sn: Optional[str] = None
    onu_model: Optional[str] = None
    package_name: Optional[str] = None
    status: Optional[str] = None


@router.get("/olts")
def get_olts(user: dict = Depends(get_current_user)):
    return db.list_olts(user["id"])


@router.post("/olts")
def create_olt(body: OltCreate, user: dict = Depends(get_current_user)):
    olt_id = db.add_olt(
        user_id=user["id"],
        name=body.name,
        brand=body.brand,
        host=body.host,
        snmp_port=body.snmp_port,
        snmp_community=body.snmp_community,
        telnet_port=body.telnet_port,
        telnet_user=body.telnet_user,
        telnet_pass=body.telnet_pass,
        pon_ports_count=body.pon_ports_count,
        description=body.description,
    )
    return db.get_olt(olt_id, user["id"])


@router.get("/olts/{olt_id}")
def get_single_olt(olt_id: int, user: dict = Depends(get_current_user)):
    olt = db.get_olt(olt_id, user["id"])
    if not olt:
        raise HTTPException(status_code=404, detail="OLT tidak ditemukan")
    return olt


@router.put("/olts/{olt_id}")
def update_single_olt(olt_id: int, body: OltUpdate, user: dict = Depends(get_current_user)):
    ok = db.update_olt(olt_id, user["id"], **body.model_dump(exclude_unset=True))
    if not ok:
        raise HTTPException(status_code=404, detail="OLT tidak ditemukan")
    return db.get_olt(olt_id, user["id"])


@router.delete("/olts/{olt_id}")
def delete_single_olt(olt_id: int, user: dict = Depends(get_current_user)):
    ok = db.delete_olt(olt_id, user["id"])
    if not ok:
        raise HTTPException(status_code=404, detail="OLT tidak ditemukan")
    return {"message": "OLT berhasil dihapus"}


@router.post("/olts/{olt_id}/test")
def test_olt(olt_id: int, user: dict = Depends(get_current_user)):
    olt = db.get_olt(olt_id, user["id"])
    if not olt:
        raise HTTPException(status_code=404, detail="OLT tidak ditemukan")
    return olt_service.test_olt_connection(
        host=olt["host"],
        snmp_port=olt["snmp_port"],
        snmp_community=olt.get("snmp_community") or "public",
        telnet_port=olt["telnet_port"],
    )


@router.get("/olts/{olt_id}/scan")
def scan_onus(olt_id: int, user: dict = Depends(get_current_user)):
    olt = db.get_olt(olt_id, user["id"])
    if not olt:
        raise HTTPException(status_code=404, detail="OLT tidak ditemukan")
    return olt_service.scan_olt_onus(olt)


# ── Customer FTTH Endpoints ────────────────────────────────

@router.get("/customers/stats")
def customer_stats(user: dict = Depends(get_current_user)):
    return db.get_customer_stats(user["id"])


@router.get("/customers")
def get_customers(
    search: Optional[str] = None,
    status: Optional[str] = None,
    olt_id: Optional[int] = None,
    filter_router_id: Optional[int] = None,
    router_id: Optional[int] = Depends(_get_router_id),
    user: dict = Depends(get_current_user),
):
    customers = db.list_customers(
        user_id=user["id"],
        router_id=filter_router_id,
        olt_id=olt_id,
        search=search,
        status_filter=status,
    )

    # Attach live PPPoE session active status if router is available
    try:
        active_sessions = mikrotik.ppp_active_list(user["id"], router_id)
        active_map = {s.get("name"): s for s in active_sessions if s.get("name")}
        for c in customers:
            u = c.get("pppoe_username")
            if u and u in active_map:
                sess = active_map[u]
                c["is_pppoe_online"] = True
                c["pppoe_ip"] = sess.get("address")
                c["pppoe_uptime"] = sess.get("uptime")
                c["caller_id"] = sess.get("caller_id")
            else:
                c["is_pppoe_online"] = False
                c["pppoe_ip"] = None
                c["pppoe_uptime"] = None
                c["caller_id"] = None
    except Exception:
        for c in customers:
            c["is_pppoe_online"] = False
            c["pppoe_ip"] = None
            c["pppoe_uptime"] = None
            c["caller_id"] = None

    return customers


@router.post("/customers")
def create_customer(
    body: CustomerCreate,
    router_id: Optional[int] = Depends(_get_router_id),
    user: dict = Depends(get_current_user),
):
    data = body.model_dump()
    if not data.get("router_id") and router_id:
        data["router_id"] = router_id
    cid = db.add_customer(user["id"], **data)
    cust = db.get_customer(cid, user["id"])
    if cust and cust.get("olt_id"):
        olt = db.get_olt(cust["olt_id"], user["id"])
        if olt:
            opt = olt_service.fetch_onu_optical(
                olt=olt,
                pon_port=cust.get("pon_port") or "PON 1",
                onu_id=cust.get("onu_id") or 1,
                onu_sn=cust.get("onu_sn") or "",
            )
            db.update_customer_optical(
                customer_id=cid,
                user_id=user["id"],
                rx_power=opt["rx_power"],
                tx_power=opt["tx_power"],
                olt_rx=opt["olt_rx"],
                distance=opt["distance_km"],
                status=opt["status"],
            )
    return db.get_customer(cid, user["id"])


@router.get("/customers/{customer_id}")
def get_single_customer(customer_id: int, user: dict = Depends(get_current_user)):
    c = db.get_customer(customer_id, user["id"])
    if not c:
        raise HTTPException(status_code=404, detail="Pelanggan tidak ditemukan")
    return c


@router.put("/customers/{customer_id}")
def update_single_customer(customer_id: int, body: CustomerUpdate, user: dict = Depends(get_current_user)):
    ok = db.update_customer(customer_id, user["id"], **body.model_dump(exclude_unset=True))
    if not ok:
        raise HTTPException(status_code=404, detail="Pelanggan tidak ditemukan")
    return db.get_customer(customer_id, user["id"])


@router.delete("/customers/{customer_id}")
def delete_single_customer(customer_id: int, user: dict = Depends(get_current_user)):
    ok = db.delete_customer(customer_id, user["id"])
    if not ok:
        raise HTTPException(status_code=404, detail="Pelanggan tidak ditemukan")
    return {"message": "Pelanggan berhasil dihapus"}


@router.post("/customers/{customer_id}/optical")
def check_single_optical(customer_id: int, user: dict = Depends(get_current_user)):
    cust = db.get_customer(customer_id, user["id"])
    if not cust:
        raise HTTPException(status_code=404, detail="Pelanggan tidak ditemukan")

    olt = db.get_olt(cust["olt_id"], user["id"]) if cust.get("olt_id") else None
    if not olt:
        olt = {"name": "Default OLT", "brand": "vsol", "host": "192.168.1.1"}

    opt = olt_service.fetch_onu_optical(
        olt=olt,
        pon_port=cust.get("pon_port") or "PON 1",
        onu_id=cust.get("onu_id") or 1,
        onu_sn=cust.get("onu_sn") or "",
        current_rx=float(cust["last_rx_power"]) if cust.get("last_rx_power") is not None else None,
    )

    db.update_customer_optical(
        customer_id=customer_id,
        user_id=user["id"],
        rx_power=opt["rx_power"],
        tx_power=opt["tx_power"],
        olt_rx=opt["olt_rx"],
        distance=opt["distance_km"],
        status=opt["status"],
    )

    return opt


@router.post("/customers/check-optical-all")
def check_all_optical(
    olt_id: Optional[int] = None,
    user: dict = Depends(get_current_user),
):
    customers = db.list_customers(user_id=user["id"], olt_id=olt_id)
    olts = {o["id"]: o for o in db.list_olts(user["id"])}
    default_olt = {"name": "Default OLT", "brand": "vsol", "host": "192.168.1.1"}

    results = []
    for c in customers:
        olt = olts.get(c.get("olt_id")) or default_olt
        opt = olt_service.fetch_onu_optical(
            olt=olt,
            pon_port=c.get("pon_port") or "PON 1",
            onu_id=c.get("onu_id") or 1,
            onu_sn=c.get("onu_sn") or "",
            current_rx=float(c["last_rx_power"]) if c.get("last_rx_power") is not None else None,
        )
        db.update_customer_optical(
            customer_id=c["id"],
            user_id=user["id"],
            rx_power=opt["rx_power"],
            tx_power=opt["tx_power"],
            olt_rx=opt["olt_rx"],
            distance=opt["distance_km"],
            status=opt["status"],
        )
        results.append({"customer_id": c["id"], **opt})

    return {"updated": len(results), "items": results}


@router.post("/customers/sync-pppoe")
def sync_pppoe(router_id: Optional[int] = Depends(_get_router_id), user: dict = Depends(get_current_user)):
    """Fetch PPPoE secrets and active sessions from MikroTik and return sync status."""
    secrets = _safe(mikrotik.ppp_secret_list, user["id"], router_id)
    active = _safe(mikrotik.ppp_active_list, user["id"], router_id)
    active_map = {s.get("name"): s for s in active if s.get("name")}

    existing_customers = db.list_customers(user_id=user["id"])
    existing_users = {c.get("pppoe_username") for c in existing_customers if c.get("pppoe_username")}

    unregistered_secrets = []
    for s in secrets:
        uname = s.get("name")
        if uname and uname not in existing_users:
            unregistered_secrets.append({
                "pppoe_username": uname,
                "profile": s.get("profile"),
                "service": s.get("service"),
                "comment": s.get("comment", ""),
                "is_active": uname in active_map,
                "active_ip": active_map[uname].get("address") if uname in active_map else None,
            })

    return {
        "total_secrets": len(secrets),
        "total_active": len(active),
        "synced_customers": len(existing_customers),
        "unregistered_secrets": unregistered_secrets,
    }


