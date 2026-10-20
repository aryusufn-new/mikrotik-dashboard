"""RouterOS API wrapper using librouteros with persistent connection."""
from __future__ import annotations

import os
import re
import threading
from collections import Counter
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


def get_topology_data(user_id: int | None = None, router_id: int | None = None) -> dict[str, Any]:
    with ros_api(user_id, router_id) as api:
        identity = None
        try:
            for row in _path(api, "system", "identity"):
                identity = row.get("name")
                break
        except Exception:
            pass

        resource = {}
        try:
            for row in _path(api, "system", "resource"):
                resource = {
                    "board_name": row.get("board-name"),
                    "version": row.get("version"),
                    "cpu_load": _to_int(row.get("cpu-load")),
                    "uptime": row.get("uptime"),
                }
                break
        except Exception:
            pass

        interfaces = []
        try:
            for r in _path(api, "interface"):
                interfaces.append({
                    "name": r.get("name"),
                    "type": r.get("type"),
                    "running": _to_bool(r.get("running")),
                    "disabled": _to_bool(r.get("disabled")),
                    "mac_address": r.get("mac-address"),
                    "comment": r.get("comment"),
                })
        except Exception:
            pass

        ip_addresses = []
        try:
            for r in _path(api, "ip", "address"):
                ip_addresses.append({
                    "address": r.get("address"),
                    "network": r.get("network"),
                    "interface": r.get("interface"),
                    "disabled": _to_bool(r.get("disabled")),
                })
        except Exception:
            pass

        routes = []
        try:
            for r in _path(api, "ip", "route"):
                routes.append({
                    "dst_address": r.get("dst-address"),
                    "gateway": r.get("gateway"),
                    "distance": _to_int(r.get("distance")),
                    "routing_mark": r.get("routing-mark"),
                    "active": _to_bool(r.get("active")),
                    "dynamic": _to_bool(r.get("dynamic")),
                })
        except Exception:
            pass

        arp_table = []
        try:
            for r in _path(api, "ip", "arp"):
                arp_table.append({
                    "address": r.get("address"),
                    "mac_address": r.get("mac-address"),
                    "interface": r.get("interface"),
                    "dynamic": _to_bool(r.get("dynamic")),
                    "complete": _to_bool(r.get("complete")),
                })
        except Exception:
            pass

        neighbors = []
        try:
            for r in _path(api, "ip", "neighbor"):
                neighbors.append({
                    "identity": r.get("identity"),
                    "address": r.get("address"),
                    "address4": r.get("address4"),
                    "interface": r.get("interface"),
                    "mac_address": r.get("mac-address"),
                    "platform": r.get("platform"),
                    "board": r.get("board"),
                    "version": r.get("version"),
                    "system_description": r.get("system-description"),
                })
        except Exception:
            pass

        dhcp_leases = []
        try:
            for r in _path(api, "ip", "dhcp-server", "lease"):
                dhcp_leases.append({
                    "address": r.get("address"),
                    "mac_address": r.get("mac-address"),
                    "host_name": r.get("host-name"),
                    "server": r.get("server"),
                    "status": r.get("status"),
                    "active_address": r.get("active-address"),
                    "comment": r.get("comment"),
                })
        except Exception:
            pass

        ppp_active = []
        try:
            for r in _path(api, "ppp", "active"):
                ppp_active.append({
                    "name": r.get("name"),
                    "service": r.get("service"),
                    "address": r.get("address"),
                    "caller_id": r.get("caller-id"),
                })
        except Exception:
            pass

        hotspot_active = []
        try:
            for r in _path(api, "ip", "hotspot", "active"):
                hotspot_active.append({
                    "user": r.get("user"),
                    "address": r.get("address"),
                    "mac_address": r.get("mac-address"),
                    "server": r.get("server"),
                })
        except Exception:
            pass

        return {
            "identity": identity,
            "host": _cfg(user_id, router_id)["host"],
            "resource": resource,
            "interfaces": interfaces,
            "ip_addresses": ip_addresses,
            "routes": routes,
            "arp_table": arp_table,
            "neighbors": neighbors,
            "dhcp_leases": dhcp_leases,
            "ppp_active": ppp_active,
            "hotspot_active": hotspot_active,
        }


def ppp_active_with_interfaces(user_id: int | None = None, router_id: int | None = None) -> list[dict[str, Any]]:
    """Get active PPPoE sessions including their dynamically assigned interface name."""
    with ros_api(user_id, router_id) as api:
        rows = list(_path(api, "ppp", "active"))
        
        all_ifaces = list(_path(api, "interface"))
        ppp_type_ifaces = [
            iface for iface in all_ifaces 
            if iface.get("type") in ("pppoe-out", "pppoe-in", "pptp-out", "pptp-in", "l2tp-out", "l2tp-in", "sstp-out", "sstp-in")
        ]
        
        ip_addresses = {}
        try:
            ip_address_list = list(_path(api, "ip", "address"))
            for ip_entry in ip_address_list:
                iface = ip_entry.get("interface")
                addr = ip_entry.get("address", "")
                if iface and addr:
                    ip_without_mask = addr.split("/")[0] if "/" in addr else addr
                    ip_addresses[ip_without_mask] = iface
        except Exception:
            pass
        
        result = []
        for r in rows:
            username = r.get("name")
            session_address = r.get("address")
            iface_name = None
            
            if session_address and session_address in ip_addresses:
                iface_name = ip_addresses[session_address]
            
            if not iface_name:
                for iface in ppp_type_ifaces:
                    iface_full_name = iface.get("name", "")
                    
                    if username and username in iface_full_name:
                        iface_name = iface_full_name
                        break
            
            if not iface_name and username:
                iface_name = f"<pppoe-{username}>"
            
            result.append({
                "name": username,
                "service": r.get("service"),
                "address": session_address,
                "uptime": r.get("uptime"),
                "caller_id": r.get("caller-id"),
                "interface": iface_name,
            })
        
        return result


def monitor_ppp_traffic(ifaces: list[str], user_id: int | None = None, router_id: int | None = None) -> dict[str, dict[str, int]]:
    """Monitor traffic for a list of PPPoE interfaces.
    
    Returns a dict mapping interface name → {rx_bps, tx_bps}.
    Falls back to zero values if an interface is not found or errors.
    """
    if not ifaces:
        return {}
    
    result: dict[str, dict[str, int]] = {}
    
    with ros_api(user_id, router_id) as api:
        for iface in ifaces:
            try:
                cmd = api.rawCmd(
                    "/interface/monitor-traffic",
                    f"=interface={iface}",
                    "=once=",
                )
                for row in cmd:
                    result[iface] = {
                        "rx_bps": int(row.get("rx-bits-per-second", 0) or 0),
                        "tx_bps": int(row.get("tx-bits-per-second", 0) or 0),
                    }
                    break
            except Exception:
                result[iface] = {"rx_bps": 0, "tx_bps": 0}
    
    return result


def get_system_health(user_id: int | None = None, router_id: int | None = None) -> dict[str, Any]:
    """Fetch hardware health (temperature, voltage, fan) from /system/health."""
    health: dict[str, Any] = {
        "temperature": None,
        "cpu_temperature": None,
        "board_temperature": None,
        "voltage": None,
        "current": None,
        "power_consumption": None,
        "fan_speed": None,
    }
    with ros_api(user_id, router_id) as api:
        try:
            for r in _path(api, "system", "health"):
                name = r.get("name")
                val = r.get("value")
                if name and val is not None:
                    # RouterOS v6 key-value format
                    k = name.lower().replace("-", "_")
                    if k in health:
                        health[k] = val
                    elif "cpu" in k and "temp" in k:
                        health["cpu_temperature"] = val
                    elif "temp" in k:
                        health["temperature"] = val
                    elif "volt" in k:
                        health["voltage"] = val
                    elif "fan" in k:
                        health["fan_speed"] = val
                else:
                    # RouterOS v7 direct key format
                    for k, v in r.items():
                        clean_k = k.lower().replace("-", "_")
                        if clean_k in health and v is not None:
                            health[clean_k] = v
                        elif "cpu" in clean_k and "temp" in clean_k:
                            health["cpu_temperature"] = v
                        elif "board" in clean_k and "temp" in clean_k:
                            health["board_temperature"] = v
                        elif "temp" in clean_k and health["temperature"] is None:
                            health["temperature"] = v
                        elif "volt" in clean_k:
                            health["voltage"] = v
                        elif "fan" in clean_k:
                            health["fan_speed"] = v
        except Exception:
            pass
    return health


def get_cpu_cores(user_id: int | None = None, router_id: int | None = None) -> list[dict[str, Any]]:
    """Fetch per-core CPU load from /system/resource/cpu."""
    cores: list[dict[str, Any]] = []
    with ros_api(user_id, router_id) as api:
        try:
            for idx, r in enumerate(_path(api, "system", "resource", "cpu")):
                core_id = _to_int(r.get("cpu")) if r.get("cpu") is not None else idx
                load = _to_int(r.get("load")) or 0
                cores.append({"core": core_id, "load": load})
        except Exception:
            pass
    return cores


def get_ports_detail(user_id: int | None = None, router_id: int | None = None) -> list[dict[str, Any]]:
    """Fetch detailed interface port statistics including drops, errors, packets, and link info."""
    with ros_api(user_id, router_id) as api:
        # Get ethernet link speed info if available
        eth_speed_map: dict[str, dict[str, Any]] = {}
        try:
            for eth in _path(api, "interface", "ethernet"):
                name = eth.get("name")
                if name:
                    eth_speed_map[name] = {
                        "speed": eth.get("speed") or eth.get("orig-speed") or eth.get("auto-negotiation"),
                        "full_duplex": _to_bool(eth.get("full-duplex")),
                        "sfp": "sfp" in name.lower(),
                    }
        except Exception:
            pass

        rows: Iterable[dict] = _path(api, "interface")
        ports = []
        for r in rows:
            name = r.get("name", "")
            iface_type = r.get("type", "")
            eth_info = eth_speed_map.get(name, {})

            ports.append({
                "name": name,
                "type": iface_type,
                "running": _to_bool(r.get("running")),
                "disabled": _to_bool(r.get("disabled")),
                "comment": r.get("comment"),
                "mac_address": r.get("mac-address"),
                "rx_byte": _to_int(r.get("rx-byte")) or 0,
                "tx_byte": _to_int(r.get("tx-byte")) or 0,
                "rx_packet": _to_int(r.get("rx-packet")) or 0,
                "tx_packet": _to_int(r.get("tx-packet")) or 0,
                "rx_drop": _to_int(r.get("rx-drop")) or 0,
                "tx_drop": _to_int(r.get("tx-drop")) or 0,
                "rx_error": _to_int(r.get("rx-error")) or 0,
                "tx_error": _to_int(r.get("tx-error")) or 0,
                "speed": eth_info.get("speed"),
                "full_duplex": eth_info.get("full_duplex"),
                "is_ethernet": iface_type in ("ether", "sfp", "sfp-plus") or "ether" in name.lower() or "sfp" in name.lower(),
            })
        return ports


def get_ping_latency(host: str = "8.8.8.8", count: int = 2, user_id: int | None = None, router_id: int | None = None) -> dict[str, Any]:
    """Execute ping from router to test uplink latency."""
    res = {"host": host, "latency_ms": None, "packet_loss": 0, "status": "down"}
    with ros_api(user_id, router_id) as api:
        try:
            cmd = api.rawCmd(
                "/ping",
                f"=address={host}",
                f"=count={count}",
            )
            latencies = []
            received = 0
            sent = 0
            for row in cmd:
                sent += 1
                rtt = row.get("time") or row.get("avg-rtt")
                if rtt:
                    received += 1
                    # Parse '12ms' or '12ms450us' or direct number
                    m = re.search(r"(\d+(?:\.\d+)?)ms", str(rtt))
                    if m:
                        latencies.append(float(m.group(1)))
                    else:
                        val = _to_int(rtt)
                        if val is not None:
                            latencies.append(float(val))

            if latencies:
                res["latency_ms"] = round(sum(latencies) / len(latencies), 1)
                res["status"] = "online"
            loss = int(((sent - received) / max(1, sent)) * 100) if sent > 0 else 100
            res["packet_loss"] = loss
            if received > 0 and res["status"] != "online":
                res["status"] = "online"
        except Exception as e:
            res["error"] = str(e)
    return res


def _extract_root_domain(name: str) -> str | None:
    """Normalize and extract root/parent domain from DNS cache name."""
    if not name or "." not in name:
        return None
    name = name.strip().lower().rstrip(".")
    # Ignore reverse DNS and local domains
    if name.endswith((".in-addr.arpa", ".ip6.arpa", ".arpa", ".local", ".lan", ".home")):
        return None
    # Ignore direct IP
    if re.match(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$", name):
        return None

    parts = name.split(".")
    if len(parts) <= 2:
        return name

    # Two-part TLDs (co.id, go.id, or.id, ac.id, com.br, etc.)
    two_part_tlds = {"co.id", "ac.id", "go.id", "or.id", "web.id", "sch.id", "my.id", "com.br", "co.uk"}
    last_two = f"{parts[-2]}.{parts[-1]}"
    if last_two in two_part_tlds and len(parts) >= 3:
        return f"{parts[-3]}.{last_two}"
    return f"{parts[-2]}.{parts[-1]}"


def get_top_dns_domains(limit: int = 5, user_id: int | None = None, router_id: int | None = None) -> list[dict[str, Any]]:
    """Fetch DNS cache and compute top accessed root domains."""
    with ros_api(user_id, router_id) as api:
        counter: Counter[str] = Counter()
        try:
            for r in _path(api, "ip", "dns", "cache"):
                raw_name = r.get("name")
                if raw_name:
                    root = _extract_root_domain(raw_name)
                    if root:
                        counter[root] += 1
        except Exception:
            pass

        total_hits = sum(counter.values())
        top = counter.most_common(limit)
        result = []
        for domain, count in top:
            pct = round((count / total_hits * 100), 1) if total_hits > 0 else 0
            result.append({
                "domain": domain,
                "hits": count,
                "percentage": pct,
            })
        return result


def get_top_talkers(limit: int = 5, user_id: int | None = None, router_id: int | None = None) -> list[dict[str, Any]]:
    """Aggregate top client talkers across active Hotspot / PPPoE / Queues."""
    talkers: list[dict[str, Any]] = []
    with ros_api(user_id, router_id) as api:
        # 1. Check active hotspot users with byte counts
        try:
            for r in _path(api, "ip", "hotspot", "active"):
                bin_val = _to_int(r.get("bytes-in")) or 0
                bout_val = _to_int(r.get("bytes-out")) or 0
                total_b = bin_val + bout_val
                talkers.append({
                    "name": r.get("user") or "unknown",
                    "ip": r.get("address"),
                    "service": "Hotspot",
                    "uptime": r.get("uptime"),
                    "bytes_in": bin_val,
                    "bytes_out": bout_val,
                    "total_bytes": total_b,
                })
        except Exception:
            pass

        # 2. Check active PPPoE sessions and retrieve their interface rx/tx bytes
        try:
            ppp_active_rows = list(_path(api, "ppp", "active"))
            if ppp_active_rows:
                # Map dynamic interfaces for PPPoE
                iface_bytes_map: dict[str, tuple[int, int]] = {}
                try:
                    for iface in _path(api, "interface"):
                        iname = iface.get("name", "")
                        rx = _to_int(iface.get("rx-byte")) or 0
                        tx = _to_int(iface.get("tx-byte")) or 0
                        if iname:
                            iface_bytes_map[iname] = (rx, tx)
                except Exception:
                    pass

                # Also map simple queues as secondary fallback
                queue_bytes_map: dict[str, tuple[int, int]] = {}
                try:
                    for q in _path(api, "queue", "simple"):
                        qname = q.get("name", "")
                        bytes_str = q.get("bytes", "")
                        if qname and "/" in bytes_str:
                            parts = bytes_str.split("/")
                            q_rx = _to_int(parts[0]) or 0
                            q_tx = _to_int(parts[1]) or 0
                            queue_bytes_map[qname] = (q_rx, q_tx)
                except Exception:
                    pass

                for r in ppp_active_rows:
                    name = r.get("name") or "unknown"
                    ip_addr = r.get("address")
                    uptime = r.get("uptime")

                    # Try matching interface: <pppoe-{name}> or search by name in interface names
                    rx_b, tx_b = iface_bytes_map.get(f"<pppoe-{name}>") or (0, 0)
                    if rx_b == 0 and tx_b == 0:
                        rx_b, tx_b = iface_bytes_map.get(name) or (0, 0)
                    if rx_b == 0 and tx_b == 0:
                        for iname, (irx, itx) in iface_bytes_map.items():
                            if name in iname:
                                rx_b, tx_b = irx, itx
                                break

                    # If still 0, try queue_bytes_map
                    if rx_b == 0 and tx_b == 0:
                        rx_b, tx_b = queue_bytes_map.get(f"<pppoe-{name}>") or queue_bytes_map.get(name) or (0, 0)
                        if rx_b == 0 and tx_b == 0:
                            for qname, (qrx, qtx) in queue_bytes_map.items():
                                if name in qname:
                                    rx_b, tx_b = qrx, qtx
                                    break

                    # Router perspective:
                    # tx-byte = transmitted to client (client download / bytes_in)
                    # rx-byte = received from client (client upload / bytes_out)
                    total_b = rx_b + tx_b
                    talkers.append({
                        "name": name,
                        "ip": ip_addr,
                        "service": "PPPoE",
                        "uptime": uptime,
                        "bytes_in": tx_b,
                        "bytes_out": rx_b,
                        "total_bytes": total_b,
                    })
        except Exception:
            pass

        # Sort by total_bytes descending
        talkers.sort(key=lambda x: x["total_bytes"], reverse=True)
        return talkers[:limit]


def get_noc_overview(user_id: int | None = None, router_id: int | None = None) -> dict[str, Any]:
    """Bundle high-priority NOC telemetry into single response for command center view."""
    res = get_system_resource(user_id, router_id)
    health = get_system_health(user_id, router_id)
    cpu_cores = get_cpu_cores(user_id, router_id)
    ping = get_ping_latency("8.8.8.8", count=1, user_id=user_id, router_id=router_id)
    ports = get_ports_detail(user_id, router_id)
    top_domains = get_top_dns_domains(5, user_id, router_id)
    top_talkers = get_top_talkers(5, user_id, router_id)

    # Calculate aggregate port stats
    total_rx_drop = sum(p["rx_drop"] for p in ports)
    total_tx_drop = sum(p["tx_drop"] for p in ports)
    total_rx_error = sum(p["rx_error"] for p in ports)
    total_tx_error = sum(p["tx_error"] for p in ports)
    total_rx_packets = sum(p["rx_packet"] for p in ports)
    total_tx_packets = sum(p["tx_packet"] for p in ports)

    return {
        "resource": res,
        "health": health,
        "cpu_cores": cpu_cores,
        "ping": ping,
        "ports": ports,
        "ports_summary": {
            "total": len(ports),
            "running": sum(1 for p in ports if p["running"]),
            "down": sum(1 for p in ports if not p["running"] and not p["disabled"]),
            "disabled": sum(1 for p in ports if p["disabled"]),
            "rx_drop": total_rx_drop,
            "tx_drop": total_tx_drop,
            "rx_error": total_rx_error,
            "tx_error": total_tx_error,
            "rx_packet": total_rx_packets,
            "tx_packet": total_tx_packets,
        },
        "top_domains": top_domains,
        "top_talkers": top_talkers,
    }

