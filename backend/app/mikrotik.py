"""RouterOS API wrapper using librouteros with persistent connection."""
from __future__ import annotations

import os
import threading
from contextlib import contextmanager
from typing import Any, Iterable

from librouteros import connect
from librouteros.exceptions import LibRouterosError


def _cfg(user_id: int | None = None, router_id: int | None = None) -> dict[str, Any]:
    """Load config for specific router."""
    from .config import load as _load_cfg
    return _load_cfg(user_id=user_id, router_id=router_id)


class _ThreadPool:
    """One persistent connection per thread per router."""

    def __init__(self):
        self._local = threading.local()
        self._cfg_version = 0
        self._version_lock = threading.Lock()

    def _get_conn_key(self, router_id: int | None):
        return f"conn_{router_id}" if router_id else "conn_default"

    def _get_ver_key(self, router_id: int | None):
        return f"ver_{router_id}" if router_id else "ver_default"

    def _get_conn(self, router_id: int | None = None):
        key = self._get_conn_key(router_id)
        return getattr(self._local, key, None)

    def _get_ver(self, router_id: int | None = None):
        key = self._get_ver_key(router_id)
        return getattr(self._local, key, -1)

    def _do_connect(self, cfg: dict, router_id: int | None = None):
        api = connect(
            host=cfg["host"],
            username=cfg["username"],
            password=cfg["password"],
            port=cfg["port"],
        )
        conn_key = self._get_conn_key(router_id)
        ver_key = self._get_ver_key(router_id)
        setattr(self._local, conn_key, api)
        setattr(self._local, ver_key, self._cfg_version)
        return api

    def get(self, user_id: int | None = None, router_id: int | None = None):
        api = self._get_conn(router_id)
        if api is not None and self._get_ver(router_id) == self._cfg_version:
            return api
        try:
            if api:
                api.close()
        except Exception:
            pass
        conn_key = self._get_conn_key(router_id)
        setattr(self._local, conn_key, None)
        return self._do_connect(_cfg(user_id, router_id), router_id)

    def invalidate(self, router_id: int | None = None):
        """Close this thread's connection so next get() reconnects."""
        api = self._get_conn(router_id)
        try:
            if api:
                api.close()
        except Exception:
            pass
        conn_key = self._get_conn_key(router_id)
        setattr(self._local, conn_key, None)

    def reset_all(self):
        """Bump version so all threads reconnect on next get()."""
        with self._version_lock:
            self._cfg_version += 1


_pool = _ThreadPool()


def reset_connection():
    """Force all threads to reconnect (e.g. after config change)."""
    _pool.reset_all()


@contextmanager
def ros_api(user_id: int | None = None, router_id: int | None = None):
    """Context manager for RouterOS API connection."""
    try:
        api = _pool.get(user_id, router_id)
        yield api
    except (LibRouterosError, OSError, ConnectionError, BrokenPipeError):
        _pool.invalidate(router_id)
        api = _pool.get(user_id, router_id)
        yield api


def _path(api, *segments: str):
    p = api.path(*segments)
    return p


def _to_int(v):
    try:
        return int(v) if v is not None else None
    except Exception:
        return None


def _to_bool(v):
    if isinstance(v, bool):
        return v
    if v is None:
        return None
    return str(v).lower() in ("true", "yes", "1")


def get_system_resource(user_id: int | None = None, router_id: int | None = None) -> dict[str, Any]:
    with ros_api(user_id, router_id) as api:
        identity = None
        try:
            for row in _path(api, "system", "identity"):
                identity = row.get("name")
                break
        except Exception:
            identity = None
        for row in _path(api, "system", "resource"):
            return {
                "identity": identity,
                "host": _cfg(user_id, router_id)["host"],
                "board_name": row.get("board-name"),
                "version": row.get("version"),
                "cpu_load": _to_int(row.get("cpu-load")),
                "free_memory": _to_int(row.get("free-memory")),
                "total_memory": _to_int(row.get("total-memory")),
                "free_hdd": _to_int(row.get("free-hdd-space")),
                "total_hdd": _to_int(row.get("total-hdd-space")),
                "uptime": row.get("uptime"),
                "architecture_name": row.get("architecture-name"),
            }
    return {}


def list_interfaces(user_id: int | None = None, router_id: int | None = None) -> list[dict[str, Any]]:
    with ros_api(user_id, router_id) as api:
        rows: Iterable[dict] = _path(api, "interface")
        result = []
        for r in rows:
            result.append({
                "name": r.get("name"),
                "type": r.get("type"),
                "running": _to_bool(r.get("running")),
                "disabled": _to_bool(r.get("disabled")),
                "comment": r.get("comment"),
                "rx_byte": _to_int(r.get("rx-byte")),
                "tx_byte": _to_int(r.get("tx-byte")),
                "mac_address": r.get("mac-address"),
            })
        return result


def interface_summary(user_id: int | None = None, router_id: int | None = None) -> dict[str, int]:
    items = list_interfaces(user_id, router_id)
    total = len(items)
    running = sum(1 for i in items if i["running"])
    disabled = sum(1 for i in items if i["disabled"])
    down = total - running - disabled
    return {"total": total, "running": running, "down": max(0, down), "disabled": disabled}


def ppp_stats(user_id: int | None = None, router_id: int | None = None) -> dict[str, int]:
    with ros_api(user_id, router_id) as api:
        secrets = list(_path(api, "ppp", "secret"))
        active = list(_path(api, "ppp", "active"))
    total = len(secrets)
    online = len(active)
    return {"total": total, "online": online, "offline": max(0, total - online)}


def ppp_active_list(user_id: int | None = None, router_id: int | None = None) -> list[dict[str, Any]]:
    with ros_api(user_id, router_id) as api:
        rows = _path(api, "ppp", "active")
        return [
            {
                "name": r.get("name"),
                "service": r.get("service"),
                "address": r.get("address"),
                "uptime": r.get("uptime"),
                "caller_id": r.get("caller-id"),
            }
            for r in rows
        ]


def ppp_secret_list(user_id: int | None = None, router_id: int | None = None) -> list[dict[str, Any]]:
    with ros_api(user_id, router_id) as api:
        active_names = {r.get("name") for r in _path(api, "ppp", "active")}
        rows = _path(api, "ppp", "secret")
        return [
            {
                "name": r.get("name"),
                "service": r.get("service"),
                "profile": r.get("profile"),
                "disabled": _to_bool(r.get("disabled")),
                "online": r.get("name") in active_names,
                "comment": r.get("comment"),
            }
            for r in rows
        ]


def hotspot_active_list(user_id: int | None = None, router_id: int | None = None) -> list[dict[str, Any]]:
    with ros_api(user_id, router_id) as api:
        rows = _path(api, "ip", "hotspot", "active")
        return [
            {
                "user": r.get("user"),
                "address": r.get("address"),
                "mac_address": r.get("mac-address"),
                "uptime": r.get("uptime"),
                "server": r.get("server"),
            }
            for r in rows
        ]


def hotspot_active_list_with_bytes(user_id: int | None = None, router_id: int | None = None) -> list[dict[str, Any]]:
    """Get active Hotspot sessions including bytes counters for traffic calculations."""
    with ros_api(user_id, router_id) as api:
        rows = list(_path(api, "ip", "hotspot", "active"))
        return [
            {
                "user": r.get("user"),
                "address": r.get("address"),
                "mac_address": r.get("mac-address"),
                "uptime": r.get("uptime"),
                "server": r.get("server"),
                "bytes_in": _to_int(r.get("bytes-in")) or 0,
                "bytes_out": _to_int(r.get("bytes-out")) or 0,
            }
            for r in rows
        ]


def hotspot_user_list(user_id: int | None = None, router_id: int | None = None) -> list[dict[str, Any]]:
    with ros_api(user_id, router_id) as api:
        active_users = {r.get("user") for r in _path(api, "ip", "hotspot", "active")}
        rows = _path(api, "ip", "hotspot", "user")
        return [
            {
                "name": r.get("name"),
                "profile": r.get("profile"),
                "disabled": _to_bool(r.get("disabled")),
                "online": r.get("name") in active_users,
                "comment": r.get("comment"),
            }
            for r in rows
        ]


def hotspot_stats(user_id: int | None = None, router_id: int | None = None) -> dict[str, int]:
    """Hotspot users stats: total = /ip hotspot user, online = /ip hotspot active."""
    with ros_api(user_id, router_id) as api:
        users = list(_path(api, "ip", "hotspot", "user"))
        active = list(_path(api, "ip", "hotspot", "active"))
    total = len(users)
    online = len(active)
    return {"total": total, "online": online, "offline": max(0, total - online)}


def monitor_traffic_once(iface: str, user_id: int | None = None, router_id: int | None = None) -> dict[str, int]:
    """Run /interface monitor-traffic once=yes for given interface."""
    with ros_api(user_id, router_id) as api:
        cmd = api.rawCmd(
            "/interface/monitor-traffic",
            f"=interface={iface}",
            "=once=",
        )
        for row in cmd:
            return {
                "rx_bps": int(row.get("rx-bits-per-second", 0) or 0),
                "tx_bps": int(row.get("tx-bits-per-second", 0) or 0),
            }
    return {"rx_bps": 0, "tx_bps": 0}


def ppp_active_with_interfaces(user_id: int | None = None, router_id: int | None = None) -> list[dict[str, Any]]:
    """Get active PPPoE sessions including their dynamically assigned interface name."""
    with ros_api(user_id, router_id) as api:
        rows = list(_path(api, "ppp", "active"))
        
        iface_map = {}
        try:
            all_ifaces = list(_path(api, "interface"))
            for iface in all_ifaces:
                iface_type = iface.get("type", "")
                iface_name = iface.get("name", "")
                
                if iface_type in ("pppoe-out", "pppoe-in", "pptp-out", "pptp-in", "l2tp-out", "l2tp-in", "sstp-out", "sstp-in"):
                    for username_candidate in [name.strip("<>") for name in [iface_name]]:
                        if username_candidate:
                            iface_map[username_candidate] = iface_name
                    
                    if "<" in iface_name and ">" in iface_name:
                        extracted = iface_name.split("<")[-1].split(">")[0]
                        if extracted.startswith(("pppoe-", "pptp-", "l2tp-", "sstp-")):
                            extracted = extracted.split("-", 1)[-1]
                        if extracted:
                            iface_map[extracted] = iface_name
        except Exception:
            pass
        
        result = []
        for r in rows:
            username = r.get("name")
            iface_name = iface_map.get(username) if username else None
            
            if not iface_name and username:
                iface_name = f"<pppoe-{username}>"
            
            result.append({
                "name": username,
                "service": r.get("service"),
                "address": r.get("address"),
                "uptime": r.get("uptime"),
                "caller_id": r.get("caller-id"),
                "interface": iface_name,
            })
        
        return result


def monitor_ppp_traffic(ifaces: list[str], user_id: int | None = None, router_id: int | None = None) -> dict[str, dict[str, int]]:
    """Monitor traffic for a list of PPPoE interfaces in a single API call.

    Returns a dict mapping interface name → {rx_bps, tx_bps}.
    Falls back to zero values if an interface is not found or errors.
    """
    if not ifaces:
        return {}
    result: dict[str, dict[str, int]] = {iface: {"rx_bps": 0, "tx_bps": 0} for iface in ifaces}
    try:
        with ros_api(user_id, router_id) as api:
            # Join all interface names with comma for a single batch call
            iface_list = ",".join(ifaces)
            cmd = api.rawCmd(
                "/interface/monitor-traffic",
                f"=interface={iface_list}",
                "=once=",
            )
            idx = 0
            for row in cmd:
                if idx < len(ifaces):
                    result[ifaces[idx]] = {
                        "rx_bps": int(row.get("rx-bits-per-second", 0) or 0),
                        "tx_bps": int(row.get("tx-bits-per-second", 0) or 0),
                    }
                    idx += 1
    except Exception:
        pass
    return result
