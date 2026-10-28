"""MikroTik automated & manual backup service with FTP retrieval and weekly scheduler."""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta
import ftplib
import os
import re
import shutil
import tempfile
import time
import zipfile
from typing import Any

from . import database as db
from . import mikrotik
from .mikrotik import ros_api

BACKUP_DIR = os.environ.get("BACKUP_DIR", os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backups")))
os.makedirs(BACKUP_DIR, exist_ok=True)


def _format_error(e: Exception) -> str:
    """Format exception with librouteros TrapError message if available."""
    msg = getattr(e, "message", None)
    cat = getattr(e, "category", None)
    if msg:
        return f"RouterOS Trap: {msg}" + (f" (category {cat})" if cat else "")
    err_str = str(e).strip()
    if err_str:
        return err_str
    return f"{type(e).__name__}: {repr(e)}"


def _safe_name(name: str) -> str:
    """Sanitize name for file path."""
    return re.sub(r"[^a-zA-Z0-9_\-]", "_", name).strip("_") or "router"


def _get_ftp_service_info(api) -> tuple[int, bool, str | None]:
    """Detect FTP port, enabled status, and item id from RouterOS."""
    try:
        services = list(mikrotik._path(api, "ip", "service"))
        for s in services:
            if s.get("name") == "ftp":
                port = int(s.get("port", 21))
                disabled = str(s.get("disabled", "false")).lower() in ("true", "yes", "1")
                return port, disabled, s.get(".id")
    except Exception as e:
        print("Warning: unable to query /ip/service for FTP:", e)
    return 21, False, None


def _cleanup_remote_file(api, filename: str):
    """Remove file from RouterOS /file by name using Path API."""
    try:
        base = os.path.basename(filename)
        file_path = api.path("file")
        for f in file_path:
            fname = f.get("name", "")
            if fname == filename or fname.endswith(base):
                try:
                    file_path.remove(f[".id"])
                except Exception:
                    pass
    except Exception as e:
        print(f"Warning: unable to delete remote file {filename}:", e)


def _wait_for_router_file(api, expected_name: str, timeout: int = 60) -> str:
    """Wait for file to appear in RouterOS /file print and finish writing."""
    start = time.time()
    base_name = os.path.basename(expected_name)
    file_path = api.path("file")
    prev_size = -1
    stable_count = 0

    while time.time() - start < timeout:
        time.sleep(1)
        try:
            for f in file_path:
                fname = f.get("name", "")
                if fname == base_name or fname.endswith("/" + base_name) or fname.endswith(base_name):
                    try:
                        curr_size = int(f.get("size", 0) or 0)
                    except (ValueError, TypeError):
                        curr_size = 0

                    if curr_size > 0:
                        if curr_size == prev_size:
                            stable_count += 1
                            if stable_count >= 1:
                                return fname
                        else:
                            prev_size = curr_size
                            stable_count = 0
                    else:
                        # Fallback if router doesn't report size
                        stable_count += 1
                        if stable_count >= 3:
                            return fname
        except Exception as e:
            print("Warning polling file on router:", e)

    raise TimeoutError(f"File {expected_name} tidak selesai dibuat di router setelah {timeout} detik.")


def _trigger_rsc_export(api, clean_rname: str, ts_str: str) -> str:
    """Trigger /export to file on router via script and wait for completion."""
    export_base = f"exp_{clean_rname}_{ts_str}"
    expected_file = f"{export_base}.rsc"

    _cleanup_remote_file(api, expected_file)

    script_name = f"bexp_{int(time.time())}"
    script_path = api.path("system", "script")

    # Clean up prior script if any
    try:
        for s in script_path:
            if s.get("name") == script_name:
                script_path.remove(s[".id"])
    except Exception:
        pass

    # RouterOS export command:
    # 1. /export compact file="..." avoids requiring 'sensitive' policy on ROS v6 and v7.
    # 2. If compact fails, fallback to standard /export file="...".
    source = f':do {{ /export compact file="{export_base}" }} on-error={{ /export file="{export_base}" }}'

    # Add temporary script using Path.add
    script_id = None
    try:
        res = script_path.add(
            name=script_name,
            source=source,
            policy="ftp,read,write,policy,test,password,sniff,sensitive",
            **{"dont-require-permissions": "yes"},
        )
        if isinstance(res, str):
            script_id = res
        elif isinstance(res, dict):
            script_id = res.get(".id") or res.get("ret")
    except Exception as e:
        print("Script add with custom policies failed, falling back to default:", e)
        try:
            res = script_path.add(
                name=script_name,
                source=source,
            )
            if isinstance(res, str):
                script_id = res
            elif isinstance(res, dict):
                script_id = res.get(".id") or res.get("ret")
        except Exception as e2:
            print("Standard script add failed:", e2)

    # If script_id was not returned directly, find it by iterating script_path
    if not script_id:
        for s in script_path:
            if s.get("name") == script_name:
                script_id = s.get(".id")
                break

    if not script_id:
        raise RuntimeError(f"Gagal membuat script '{script_name}' di RouterOS")

    try:
        # Run script - MUST consume the generator with tuple() so the command is actually sent!
        run_err = None
        try:
            tuple(script_path("run", number=script_name))
        except Exception as e1:
            try:
                tuple(script_path("run", number=script_id))
            except Exception as e2:
                try:
                    tuple(api.rawCmd("/system/script/run", f"=number={script_name}"))
                except Exception as e3:
                    try:
                        tuple(api.rawCmd("/system/script/run", f"=number={script_id}"))
                    except Exception as e4:
                        print("All script run attempts raised exceptions:", e4)
                        run_err = e4

        # Wait for file while script runs
        try:
            remote_filename = _wait_for_router_file(api, expected_file, timeout=60)
            return remote_filename
        except TimeoutError as te:
            if run_err:
                raise RuntimeError(f"Gagal menjalankan script export di router: {run_err}") from te
            raise te
    finally:
        # Clean up script AFTER export file has been generated or failed
        try:
            script_path.remove(script_id)
        except Exception:
            pass


def _trigger_system_backup(api, clean_rname: str, ts_str: str) -> str:
    """Trigger /system/backup/save on router and wait for completion."""
    backup_base = f"bak_{clean_rname}_{ts_str}"
    expected_file = f"{backup_base}.backup"

    _cleanup_remote_file(api, expected_file)

    backup_path = api.path("system", "backup")
    try:
        # MUST consume the generator with tuple() so /system/backup/save is actually sent!
        tuple(backup_path("save", name=backup_base, **{"dont-encrypt": "yes"}))
    except Exception as exc:
        print(f"Backup save with dont-encrypt failed ({exc}), retrying without encryption flag...")
        try:
            tuple(backup_path("save", name=backup_base))
        except Exception as exc2:
            print(f"Backup save failed ({exc2}), retrying rawCmd...")
            tuple(api.rawCmd("/system/backup/save", f"=name={backup_base}"))

    remote_filename = _wait_for_router_file(api, expected_file, timeout=60)
    return remote_filename


def _download_via_ftp(host: str, port: int, username: str, password: str, remote_filename: str, local_path: str):
    """Download a file from MikroTik via FTP with passive & active fallback."""
    clean_host = host.split(":")[0].strip()
    ftp = ftplib.FTP()
    try:
        ftp.connect(clean_host, port, timeout=20)
    except Exception as conn_err:
        raise ConnectionError(
            f"Gagal menghubungkan ke FTP {clean_host}:{port} ({conn_err}). "
            f"Pastikan port FTP {port} dibuka di router/firewall."
        )

    try:
        ftp.login(username, password)
    except Exception as login_err:
        raise PermissionError(
            f"Gagal login FTP {clean_host}:{port} ({login_err}). "
            f"Pastikan user '{username}' memiliki hak akses/policy 'ftp' di RouterOS /user group."
        )

    ftp.trust_server_pasv_ipv4_address = False

    try:
        ftp.set_pasv(True)
        with open(local_path, "wb") as f:
            ftp.retrbinary(f"RETR {remote_filename}", f.write)
    except Exception as pasv_err:
        print(f"FTP passive mode failed ({pasv_err}), retrying active mode...")
        try:
            ftp.set_pasv(False)
            with open(local_path, "wb") as f:
                ftp.retrbinary(f"RETR {remote_filename}", f.write)
        except Exception as active_err:
            raise RuntimeError(
                f"Gagal download file '{remote_filename}' via FTP dari {clean_host}:{port}. "
                f"Passive mode: {pasv_err} | Active mode: {active_err}"
            )
    finally:
        try:
            ftp.quit()
        except Exception:
            ftp.close()


def perform_router_backup(
    user_id: int,
    router_id: int,
    backup_type: str = "both",
    trigger_type: str = "manual",
) -> dict[str, Any]:
    """
    Perform backup of a MikroTik router.
    backup_type: 'rsc' | 'backup' | 'both'
    trigger_type: 'manual' | 'auto'
    Saves file to BACKUP_DIR/{user_id}/{filename}.
    """
    router = db.get_router_by_id(router_id, user_id)
    if not router:
        raise ValueError(f"Router #{router_id} tidak ditemukan")

    router_name = router.get("name") or f"Router-{router_id}"
    clean_rname = _safe_name(router_name)
    host = router["host"]
    username = router["username"]
    password = router["password"]

    now = datetime.now()
    ts_str = now.strftime("%Y%m%d_%H%M%S")
    target_user_dir = os.path.join(BACKUP_DIR, str(user_id))
    os.makedirs(target_user_dir, exist_ok=True)

    temp_files = []
    final_filename = ""
    final_filepath = ""
    final_type = backup_type

    remote_files_to_clean = []
    remote_rsc = None
    remote_backup = None
    ftp_port = 21
    temporarily_enabled_ftp = False
    ftp_id = None

    try:
        # Step 1: Generate backup/export files on router via API
        with ros_api(user_id, router_id) as api:
            detected_port, ftp_disabled, ftp_id = _get_ftp_service_info(api)
            ftp_port = detected_port

            if ftp_disabled and ftp_id:
                try:
                    tuple(api.rawCmd("/ip/service/enable", f"=.id={ftp_id}"))
                    temporarily_enabled_ftp = True
                    time.sleep(0.5)
                except Exception as e:
                    print("Warning: failed to temporarily enable FTP service:", e)

            # 1. Generate RSC export if needed
            if backup_type in ("rsc", "both"):
                remote_rsc = _trigger_rsc_export(api, clean_rname, ts_str)
                remote_files_to_clean.append(remote_rsc)

            # 2. Generate System Backup if needed
            if backup_type in ("backup", "both"):
                remote_backup = _trigger_system_backup(api, clean_rname, ts_str)
                remote_files_to_clean.append(remote_backup)

        # Step 2: Download files via FTP (outside ros_api context)
        local_rsc_path = None
        if remote_rsc:
            local_rsc_path = os.path.join(target_user_dir, os.path.basename(remote_rsc))
            _download_via_ftp(host, ftp_port, username, password, remote_rsc, local_rsc_path)
            temp_files.append(local_rsc_path)

        local_backup_path = None
        if remote_backup:
            local_backup_path = os.path.join(target_user_dir, os.path.basename(remote_backup))
            _download_via_ftp(host, ftp_port, username, password, remote_backup, local_backup_path)
            temp_files.append(local_backup_path)

        # Step 3: Clean up remote files on router
        if remote_files_to_clean:
            try:
                with ros_api(user_id, router_id) as api:
                    for rf in remote_files_to_clean:
                        _cleanup_remote_file(api, rf)
            except Exception as clean_err:
                print("Warning cleaning remote files on router:", clean_err)

        # 3. Determine final file
        if backup_type == "both" and local_rsc_path and local_backup_path:
            zip_filename = f"{clean_rname}_{ts_str}_full.zip"
            zip_filepath = os.path.join(target_user_dir, zip_filename)
            with zipfile.ZipFile(zip_filepath, "w", zipfile.ZIP_DEFLATED) as zf:
                zf.write(local_rsc_path, os.path.basename(local_rsc_path))
                zf.write(local_backup_path, os.path.basename(local_backup_path))
            
            for tf in (local_rsc_path, local_backup_path):
                if os.path.exists(tf):
                    os.remove(tf)

            final_filename = zip_filename
            final_filepath = zip_filepath
            final_type = "both"
        elif backup_type == "rsc" and local_rsc_path:
            final_filename = os.path.basename(local_rsc_path)
            final_filepath = local_rsc_path
        elif backup_type == "backup" and local_backup_path:
            final_filename = os.path.basename(local_backup_path)
            final_filepath = local_backup_path
        else:
            raise RuntimeError("Tidak ada file backup yang berhasil dibuat atau diunduh dari router.")

        file_size = os.path.getsize(final_filepath) if os.path.exists(final_filepath) else 0

        # Save record in database
        record = db.create_backup_record(
            user_id=user_id,
            router_id=router_id,
            filename=final_filename,
            file_path=final_filepath,
            file_size=file_size,
            backup_type=final_type,
            trigger_type=trigger_type,
            status="completed",
            error_message=None,
        )

        # Prune according to retention count
        settings = db.get_backup_settings(user_id)
        retention = settings.get("retention_count", 8)
        pruned_paths = db.prune_old_backups(user_id, router_id, retention)
        for p in pruned_paths:
            if os.path.exists(p):
                try:
                    os.remove(p)
                except Exception:
                    pass

        return record

    except Exception as e:
        error_msg = _format_error(e)
        print(f"Error during backup for router #{router_id}:", error_msg)
        for tf in temp_files:
            if os.path.exists(tf):
                try:
                    os.remove(tf)
                except Exception:
                    pass

        record = db.create_backup_record(
            user_id=user_id,
            router_id=router_id,
            filename=final_filename or f"failed_{clean_rname}_{ts_str}",
            file_path="",
            file_size=0,
            backup_type=final_type,
            trigger_type=trigger_type,
            status="failed",
            error_message=error_msg,
        )
        return record

    finally:
        if temporarily_enabled_ftp and ftp_id:
            try:
                with ros_api(user_id, router_id) as api:
                    tuple(api.rawCmd("/ip/service/disable", f"=.id={ftp_id}"))
            except Exception as e:
                print("Warning: failed to revert FTP service state:", e)


def compute_next_run(schedule_day: int, schedule_hour: int, schedule_minute: int) -> datetime:
    """
    Compute next run datetime based on schedule.
    schedule_day: 0=Monday, ..., 6=Sunday.
    """
    now = datetime.now()
    # Start checking from today
    candidate = now.replace(hour=schedule_hour, minute=schedule_minute, second=0, microsecond=0)
    # Days until target day
    days_ahead = (schedule_day - now.weekday()) % 7
    if days_ahead == 0 and candidate <= now:
        days_ahead = 7
    return candidate + timedelta(days=days_ahead)


async def run_backup_scheduler():
    """
    Background worker that runs weekly backups.
    Checks every 60 seconds if any user's schedule is due.
    """
    print("[BackupScheduler] Service started. Monitoring weekly schedules...")
    while True:
        try:
            now = datetime.now()
            all_settings = db.get_all_enabled_backup_settings()

            for s in all_settings:
                user_id = s["user_id"]
                next_run = s.get("next_run_at")
                schedule_day = s.get("schedule_day", 6)
                schedule_hour = s.get("schedule_hour", 2)
                schedule_minute = s.get("schedule_minute", 0)

                # Initialize next_run if not set
                if not next_run:
                    next_run = compute_next_run(schedule_day, schedule_hour, schedule_minute)
                    db.update_backup_schedule_timestamps(user_id, next_run_at=next_run)
                    continue

                if now >= next_run:
                    print(f"[BackupScheduler] Triggering weekly auto-backup for user #{user_id}...")
                    routers = db.list_routers(user_id)
                    btype = s.get("backup_type", "both")

                    for r in routers:
                        try:
                            # Run in thread pool to avoid blocking event loop
                            await asyncio.to_thread(
                                perform_router_backup,
                                user_id=user_id,
                                router_id=r["id"],
                                backup_type=btype,
                                trigger_type="auto",
                            )
                        except Exception as ex:
                            print(f"[BackupScheduler] Failed auto-backup for router #{r['id']}:", ex)

                    # Compute next weekly run (+7 days)
                    new_next_run = compute_next_run(schedule_day, schedule_hour, schedule_minute)
                    db.update_backup_schedule_timestamps(user_id, last_run_at=now, next_run_at=new_next_run)
                    print(f"[BackupScheduler] User #{user_id} backup completed. Next run scheduled at {new_next_run}")

        except Exception as e:
            print("[BackupScheduler] Unexpected error in scheduler loop:", e)

        await asyncio.sleep(60)
