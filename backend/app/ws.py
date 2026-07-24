import asyncio
import time

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from . import mikrotik
from . import config as cfg_mod
from .auth import decode_token
from . import database as db

router = APIRouter()


async def _authenticate_ws(websocket: WebSocket) -> dict | None:
    """Validate token from query param and return user dict, or None."""
    token = websocket.query_params.get("token")
    if not token:
        return None
    payload = decode_token(token)
    if payload is None:
        return None
    username = payload.get("sub")
    if not username:
        return None
    return db.get_user_by_username(username)


def _get_router_id_from_ws(websocket: WebSocket) -> int | None:
    """Extract router_id from WebSocket query params."""
    rid = websocket.query_params.get("router_id")
    if rid:
        try:
            return int(rid)
        except (ValueError, TypeError):
            pass
    return None


@router.websocket("/ws/traffic")
async def ws_traffic(websocket: WebSocket):
    """Stream single interface traffic each second.

    Query param: ?iface=ether1&token=<jwt>&router_id=<id>
    """
    user = await _authenticate_ws(websocket)
    if user is None:
        await websocket.close(code=4001, reason="Unauthorized")
        return
    await websocket.accept()
    router_id = _get_router_id_from_ws(websocket)
    iface = websocket.query_params.get("iface", "ether1")
    try:
        while True:
            try:
                data = await asyncio.to_thread(mikrotik.monitor_traffic_once, iface, user["id"], router_id)
            except Exception as e:
                await websocket.send_json({"error": str(e)})
                await asyncio.sleep(2)
                continue
            data["ts"] = int(time.time() * 1000)
            data["iface"] = iface
            await websocket.send_json(data)
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        return


@router.websocket("/ws/interfaces-traffic")
async def ws_interfaces_traffic(websocket: WebSocket):
    """Stream traffic for ALL interfaces using delta of rx/tx byte counters.

    Query param: ?token=<jwt>&router_id=<id>
    """
    user = await _authenticate_ws(websocket)
    if user is None:
        await websocket.close(code=4001, reason="Unauthorized")
        return
    await websocket.accept()
    router_id = _get_router_id_from_ws(websocket)
    prev_counters: dict[str, tuple[int, int]] = {}
    prev_ts: float | None = None
    try:
        while True:
            try:
                rows = await asyncio.to_thread(mikrotik.list_interfaces, user["id"], router_id)
            except Exception as e:
                await websocket.send_json({"error": str(e)})
                await asyncio.sleep(2)
                continue

            now = time.time()
            dt = (now - prev_ts) if prev_ts else 1.0
            if dt <= 0:
                dt = 1.0

            iface_payload = []
            tot_rx = 0
            tot_tx = 0
            running = 0
            down = 0
            for r in rows:
                name = r.get("name")
                rx = r.get("rx_byte") or 0
                tx = r.get("tx_byte") or 0
                rx_bps = 0
                tx_bps = 0
                if name in prev_counters and prev_ts is not None:
                    prx, ptx = prev_counters[name]
                    rx_bps = max(0, int(((rx - prx) * 8) / dt))
                    tx_bps = max(0, int(((tx - ptx) * 8) / dt))
                prev_counters[name] = (rx, tx)

                is_running = bool(r.get("running"))
                if is_running:
                    running += 1
                elif not r.get("disabled"):
                    down += 1

                tot_rx += rx_bps
                tot_tx += tx_bps
                iface_payload.append({
                    "name": name,
                    "running": is_running,
                    "disabled": bool(r.get("disabled")),
                    "rx_bps": rx_bps,
                    "tx_bps": tx_bps,
                    "comment": r.get("comment"),
                    "type": r.get("type"),
                })

            payload = {
                "ts": int(now * 1000),
                "interfaces": iface_payload,
                "totals": {
                    "rx_bps": tot_rx,
                    "tx_bps": tot_tx,
                    "running": running,
                    "down": down,
                },
                "first": prev_ts is None,
            }
            await websocket.send_json(payload)
            prev_ts = now
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        return


@router.websocket("/ws/ppp-traffic")
async def ws_ppp_traffic(websocket: WebSocket):
    """Stream per-user PPPoE traffic every 2 seconds.

    Query param: ?token=<jwt>&router_id=<id>
    Sends: { ts, users: { <username>: { rx_bps, tx_bps, interface, address, uptime, caller_id } } }
    """
    user = await _authenticate_ws(websocket)
    if user is None:
        await websocket.close(code=4001, reason="Unauthorized")
        return
    await websocket.accept()
    router_id = _get_router_id_from_ws(websocket)
    try:
        while True:
            try:
                # Fetch active PPPoE sessions with their interface names
                active_sessions = await asyncio.to_thread(mikrotik.ppp_active_with_interfaces, user["id"], router_id)

                # Build mapping: interface_name → session info
                iface_to_session: dict[str, dict] = {}
                ifaces: list[str] = []
                for s in active_sessions:
                    iface = s.get("interface")
                    if iface:
                        iface_to_session[iface] = s
                        ifaces.append(iface)

                # Batch-fetch traffic for all active PPPoE interfaces
                traffic_map: dict[str, dict] = {}
                if ifaces:
                    traffic_map = await asyncio.to_thread(mikrotik.monitor_ppp_traffic, ifaces, user["id"], router_id)

                # Merge traffic data into per-user payload
                users_payload: dict[str, dict] = {}
                for iface, session in iface_to_session.items():
                    traf = traffic_map.get(iface, {"rx_bps": 0, "tx_bps": 0})
                    users_payload[session["name"]] = {
                        "rx_bps": traf["rx_bps"],
                        "tx_bps": traf["tx_bps"],
                        "interface": iface,
                        "address": session.get("address"),
                        "uptime": session.get("uptime"),
                        "caller_id": session.get("caller_id"),
                        "service": session.get("service"),
                    }

                await websocket.send_json({
                    "ts": int(time.time() * 1000),
                    "users": users_payload,
                })
            except Exception as e:
                await websocket.send_json({"error": str(e)})
                await asyncio.sleep(3)
                continue

            await asyncio.sleep(2)
    except WebSocketDisconnect:
        return


@router.websocket("/ws/hotspot-traffic")
async def ws_hotspot_traffic(websocket: WebSocket):
    """Stream per-user Hotspot traffic every 2 seconds.

    Query param: ?token=<jwt>&router_id=<id>
    Sends: { ts, users: { <username>: { rx_bps, tx_bps, address, mac_address, uptime, server } } }
    """
    user = await _authenticate_ws(websocket)
    if user is None:
        await websocket.close(code=4001, reason="Unauthorized")
        return
    await websocket.accept()
    router_id = _get_router_id_from_ws(websocket)
    prev_counters: dict[str, tuple[int, int]] = {}
    prev_ts: float | None = None
    try:
        while True:
            try:
                # Fetch active Hotspot sessions with their bytes counters
                active_users = await asyncio.to_thread(mikrotik.hotspot_active_list_with_bytes, user["id"], router_id)
                now = time.time()
                dt = (now - prev_ts) if prev_ts else 2.0
                if dt <= 0:
                    dt = 2.0

                users_payload: dict[str, dict] = {}
                for u in active_users:
                    username = u["user"]
                    if not username:
                        continue

                    bytes_in = u["bytes_in"]
                    bytes_out = u["bytes_out"]

                    rx_bps = 0
                    tx_bps = 0
                    if username in prev_counters and prev_ts is not None:
                        p_in, p_out = prev_counters[username]
                        # bytes_in is from client (router RX / client Upload)
                        # bytes_out is to client (router TX / client Download)
                        rx_bps = max(0, int(((bytes_in - p_in) * 8) / dt))
                        tx_bps = max(0, int(((bytes_out - p_out) * 8) / dt))

                    prev_counters[username] = (bytes_in, bytes_out)

                    users_payload[username] = {
                        "rx_bps": rx_bps,
                        "tx_bps": tx_bps,
                        "address": u.get("address"),
                        "mac_address": u.get("mac_address"),
                        "uptime": u.get("uptime"),
                        "server": u.get("server"),
                    }

                await websocket.send_json({
                    "ts": int(now * 1000),
                    "users": users_payload,
                })
                prev_ts = now
            except Exception as e:
                await websocket.send_json({"error": str(e)})
                await asyncio.sleep(3)
                continue

            await asyncio.sleep(2)
    except WebSocketDisconnect:
        return
