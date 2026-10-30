"""
GenieACS TR-069 NBI (Northbound Interface) Integration Service.
Connects directly to GenieACS REST API (default port 7557) to retrieve
ONU / ONT Serial Numbers (SN) and corresponding PPPoE Usernames.
"""
from __future__ import annotations

import base64
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Tuple


def normalize_url(url: str) -> str:
    """Normalize GenieACS base URL."""
    if not url:
        return ""
    u = url.strip()
    if not u.startswith("http://") and not u.startswith("https://"):
        u = f"http://{u}"
    return u.rstrip("/")


def build_headers(auth_enabled: bool = False, username: str = "", password: str = "") -> dict:
    headers = {
        "Accept": "application/json",
        "User-Agent": "Mikrotik-Dashboard-GenieACS-Client/1.0",
    }
    if auth_enabled and username:
        creds = f"{username}:{password or ''}"
        b64 = base64.b64encode(creds.encode("utf-8")).decode("ascii")
        headers["Authorization"] = f"Basic {b64}"
    return headers


def _clean_sn(val: Any) -> str:
    """Normalize serial number (alphanumeric uppercase)."""
    if not val:
        return ""
    if isinstance(val, dict):
        val = val.get("_value", "")
    s = str(val).strip()
    return re.sub(r"[^A-Za-z0-9]", "", s).upper()


def _get_val(node: Any) -> Any:
    """Extract primitive value from GenieACS node."""
    if isinstance(node, dict):
        if "_value" in node:
            return node["_value"]
        if "value" in node:
            return node["value"]
    return node


def _extract_ppp_usernames_and_info(obj: Any) -> Tuple[List[str], Dict[str, Any]]:
    """
    Recursively extract PPPoE usernames, IPs, MACs, and optical power from GenieACS device object.
    Supports both nested dictionaries and flat dot-notation keys.
    """
    usernames: List[str] = []
    extra_info = {
        "ip": "",
        "mac": "",
        "rx_power": None,
        "connection_status": "",
    }

    if not isinstance(obj, dict):
        return usernames, extra_info

    # 1. Flat dot-notation check
    for k, v in obj.items():
        k_lower = k.lower()
        val = _get_val(v)
        val_str = str(val).strip() if val is not None else ""

        if ("wanpppconnection" in k_lower or "ppp.interface" in k_lower or "wanipconnection" in k_lower) and k_lower.endswith("username"):
            if val_str and val_str not in usernames:
                usernames.append(val_str)
        elif k_lower.endswith(".username") and ("ppp" in k_lower or "wan" in k_lower):
            if val_str and val_str not in usernames:
                usernames.append(val_str)

        if ("externalipaddress" in k_lower or "ipaddress" in k_lower) and val_str and not extra_info["ip"]:
            if re.match(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$", val_str) and not val_str.startswith("0."):
                extra_info["ip"] = val_str

        if "macaddress" in k_lower and val_str and not extra_info["mac"]:
            extra_info["mac"] = val_str

        if ("rxpower" in k_lower or "opticalsignallevel" in k_lower or "rx_power" in k_lower) and val is not None:
            try:
                rx_val = float(val)
                if rx_val < -100:
                    rx_val = rx_val / 100.0
                extra_info["rx_power"] = rx_val
            except (ValueError, TypeError):
                pass

    # 2. Nested structure recursive check
    def _recurse(d: dict, path: str = ""):
        for key, val in d.items():
            current_path = f"{path}.{key}" if path else key

            if isinstance(val, dict):
                # Check for PPP Connection node
                keys_lower = [k.lower() for k in val.keys()]
                if "username" in keys_lower:
                    uname_val = _get_val(val.get("Username") or val.get("username"))
                    if uname_val and str(uname_val).strip():
                        u_str = str(uname_val).strip()
                        if u_str not in usernames:
                            usernames.append(u_str)

                    ip_val = _get_val(val.get("ExternalIPAddress") or val.get("externalIPAddress") or val.get("IPAddress"))
                    if ip_val and not extra_info["ip"]:
                        ip_str = str(ip_val).strip()
                        if re.match(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$", ip_str) and not ip_str.startswith("0."):
                            extra_info["ip"] = ip_str

                    status_val = _get_val(val.get("ConnectionStatus") or val.get("connectionStatus"))
                    if status_val and not extra_info["connection_status"]:
                        extra_info["connection_status"] = str(status_val)

                _recurse(val, current_path)

    _recurse(obj)

    if not extra_info["ip"] and obj.get("_ip"):
        extra_info["ip"] = str(obj["_ip"])

    return usernames, extra_info


def parse_device(device: dict) -> dict:
    """Parse a GenieACS device JSON into a clean structured dictionary."""
    raw_id = str(device.get("_id") or "")
    dev_id_obj = device.get("DeviceID") or {}
    device_info = (
        device.get("InternetGatewayDevice", {}).get("DeviceInfo", {})
        or device.get("Device", {}).get("DeviceInfo", {})
    )

    raw_sn = (
        _get_val(dev_id_obj.get("SerialNumber"))
        or _get_val(device_info.get("SerialNumber"))
        or device.get("DeviceID.SerialNumber")
        or device.get("InternetGatewayDevice.DeviceInfo.SerialNumber")
        or device.get("Device.DeviceInfo.SerialNumber")
        or ""
    )

    if not raw_sn and raw_id:
        parts = raw_id.split("-")
        if len(parts) >= 3:
            raw_sn = parts[-1]
        else:
            raw_sn = raw_id

    clean_sn = _clean_sn(raw_sn)

    model = (
        _get_val(dev_id_obj.get("ProductClass"))
        or _get_val(device_info.get("ModelName"))
        or device.get("DeviceID.ProductClass")
        or ""
    )
    if not model and raw_id:
        parts = raw_id.split("-")
        if len(parts) >= 2:
            model = parts[1]

    manufacturer = (
        _get_val(dev_id_obj.get("Manufacturer"))
        or _get_val(device_info.get("Manufacturer"))
        or device.get("DeviceID.Manufacturer")
        or ""
    )
    if not manufacturer and raw_id:
        parts = raw_id.split("-")
        if parts:
            manufacturer = parts[0]

    usernames, extra_info = _extract_ppp_usernames_and_info(device)
    primary_username = usernames[0] if usernames else ""
    last_inform = device.get("_lastInform") or device.get("_registered") or ""

    return {
        "id": raw_id,
        "raw_sn": str(raw_sn),
        "clean_sn": clean_sn,
        "pppoe_username": primary_username,
        "all_usernames": usernames,
        "model": str(model or "ONU"),
        "manufacturer": str(manufacturer or ""),
        "ip": extra_info["ip"],
        "mac": extra_info["mac"],
        "rx_power": extra_info["rx_power"],
        "connection_status": extra_info["connection_status"],
        "last_inform": str(last_inform),
    }


def test_connection(
    url: str,
    auth_enabled: bool = False,
    username: str = "",
    password: str = "",
    timeout: int = 6,
) -> dict:
    """Test HTTP connection to GenieACS NBI."""
    base_url = normalize_url(url)
    if not base_url:
        return {"success": False, "status": "error", "message": "URL GenieACS tidak boleh kosong"}

    endpoint = f"{base_url}/devices/?query=%7B%7D&projection=_id"
    headers = build_headers(auth_enabled, username, password)

    start_t = time.time()
    try:
        req = urllib.request.Request(endpoint, headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            latency_ms = int((time.time() - start_t) * 1000)
            if resp.status == 200:
                raw_data = resp.read().decode("utf-8")
                devices = json.loads(raw_data)
                count = len(devices) if isinstance(devices, list) else 0
                return {
                    "success": True,
                    "status": "online",
                    "latency_ms": latency_ms,
                    "device_count": count,
                    "message": f"Koneksi GenieACS Berhasil! Ditemukan {count} perangkat aktif (Latency: {latency_ms}ms).",
                }
            return {
                "success": False,
                "status": "error",
                "latency_ms": latency_ms,
                "message": f"GenieACS mengembalikan kode HTTP {resp.status}",
            }
    except urllib.error.HTTPError as e:
        latency_ms = int((time.time() - start_t) * 1000)
        if e.code == 401:
            return {"success": False, "status": "auth_error", "latency_ms": latency_ms, "message": "Autentikasi gagal (HTTP 401 Unauthorized). Periksa username & password."}
        return {"success": False, "status": "error", "latency_ms": latency_ms, "message": f"HTTP Error {e.code}: {e.reason}"}
    except urllib.error.URLError as e:
        return {"success": False, "status": "unreachable", "latency_ms": 0, "message": f"Tidak dapat terhubung ke GenieACS: {e.reason}"}
    except TimeoutError:
        return {"success": False, "status": "timeout", "latency_ms": 0, "message": f"Koneksi ke GenieACS timeout ({timeout} detik)."}
    except Exception as e:
        return {"success": False, "status": "error", "latency_ms": 0, "message": f"Gagal: {str(e)}"}


def fetch_devices(
    url: str,
    auth_enabled: bool = False,
    username: str = "",
    password: str = "",
    timeout: int = 15,
) -> List[dict]:
    """Fetch all devices with TR-069 PPPoE parameters from GenieACS."""
    base_url = normalize_url(url)
    if not base_url:
        return []

    projection = (
        "_id,DeviceID,InternetGatewayDevice.WANDevice,Device.PPP,"
        "InternetGatewayDevice.LANDevice,Device.IP,InternetGatewayDevice.DeviceInfo,"
        "Device.DeviceInfo,_lastInform,_registered,_ip"
    )
    endpoint = f"{base_url}/devices/?query=%7B%7D&projection={urllib.parse.quote(projection)}"
    headers = build_headers(auth_enabled, username, password)

    try:
        req = urllib.request.Request(endpoint, headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            if resp.status == 200:
                raw_data = resp.read().decode("utf-8")
                devices = json.loads(raw_data)
                if isinstance(devices, list):
                    return devices
    except Exception as e:
        # Fallback to simple endpoint if projection fails
        try:
            fb_endpoint = f"{base_url}/devices/?query=%7B%7D"
            req = urllib.request.Request(fb_endpoint, headers=headers, method="GET")
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                if resp.status == 200:
                    raw_data = resp.read().decode("utf-8")
                    devices = json.loads(raw_data)
                    if isinstance(devices, list):
                        return devices
        except Exception as fb_err:
            print(f"GenieACS fetch_devices error: {e} | fallback: {fb_err}")

    return []


def get_user_acs_mapping(user_id: int) -> dict[str, dict]:
    """
    Load GenieACS settings for user, fetch devices, and build lookup map.
    Keyed by clean_sn, suffixes (12, 8, 6 chars), and MAC.
    """
    from . import database as db

    settings = db.get_genieacs_settings(user_id)
    if not settings or not settings.get("enabled"):
        return {}

    url = settings.get("url")
    if not url:
        return {}

    auth_enabled = bool(settings.get("auth_enabled"))
    username = str(settings.get("username") or "")
    password = str(settings.get("password") or "")
    timeout = int(settings.get("timeout_sec") or 10)

    try:
        raw_devices = fetch_devices(url, auth_enabled, username, password, timeout)
        count = len(raw_devices)

        # Update status
        db.update_genieacs_status(user_id, status="online", count=count, error=None)

        mapping: dict[str, dict] = {}
        for dev in raw_devices:
            parsed = parse_device(dev)
            clean_sn = parsed["clean_sn"]
            if not clean_sn:
                continue

            mapping[clean_sn] = parsed

            # Index suffixes for flexible matching
            if len(clean_sn) >= 12:
                mapping[clean_sn[-12:]] = parsed
            if len(clean_sn) >= 8:
                mapping[clean_sn[-8:]] = parsed
            if len(clean_sn) >= 6:
                mapping[clean_sn[-6:]] = parsed

            # Index MAC
            if parsed.get("mac"):
                clean_mac = _clean_sn(parsed["mac"])
                if clean_mac:
                    mapping[clean_mac] = parsed

        return mapping
    except Exception as e:
        db.update_genieacs_status(user_id, status="error", count=0, error=str(e))
        print("get_user_acs_mapping exception:", e)
        return {}
