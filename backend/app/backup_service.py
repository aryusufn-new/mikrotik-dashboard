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


def _download_via_ftp(host: str, port: int, username: str, password: str, remote_filename: str, local_path: str):
    """Download a file from MikroTik via FTP."""
    ftp = ftplib.FTP()
    ftp.connect(host, port, timeout=20)
    ftp.login(username, password)
    try:
        with open(local_path, "wb") as f:
            ftp.retrbinary(f"RETR {remote_filename}", f.write)
        # Clean remote file on router to preserve flash memory
        try:
            ftp.delete(remote_filename)
        except Exception:
            pass
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
        raise ValueError(f"Router #{router_id} not found")

    router_name = router.get("name") or f"Router-{router_id}"
    clean_rname = _safe_name(router_name)
    host = router["host"]
    username = router["username"]
    password = router["password"]

    now = datetime.now()
    ts_str = now.strftime("%Y%m%d_%H%M%S")
    target_user_dir = os.path.join(BACKUP_DIR, str(user_id))
    os.makedirs(target_user_dir, exist_ok=True)

    rsc_remote = f"export_{clean_rname}_{ts_str}.rsc"
    backup_remote = f"backup_{clean_rname}_{ts_str}.backup"

    temp_files = []
    error_msg = None
    final_filename = ""
    final_filepath = ""
    final_type = backup_type

    try:
        with ros_api(user_id, router_id) as api:
            ftp_port, ftp_disabled, ftp_id = _get_ftp_service_info(api)
            temporarily_enabled_ftp = False

            # If FTP is disabled, temporarily enable it for download
            if ftp_disabled and ftp_id:
                try:
                    api.rawCmd("/ip/service/enable", f"=.id={ftp_id}")
                    temporarily_enabled_ftp = True
                    time.sleep(0.5)
                except Exception as e:
                    print("Warning: failed to temporarily enable FTP service:", e)

            try:
                # 1. Generate RSC export if needed
                local_rsc_path = None
                if backup_type in ("rsc", "both"):
                    # Use temporary script to invoke /export file=...
                    script_name = f"auto_exp_{int(time.time())}"
                    try:
                        # Clean up any leftover script with same name
                        for s in api.rawCmd("/system/script/print", f"?name={script_name}"):
                            api.rawCmd("/system/script/remove", f"=.id={s['.id']}")
                    except Exception:
                        pass

                    api.rawCmd(
                        "/system/script/add",
                        f"=name={script_name}",
                        f'=source=/export file="{rsc_remote}"',
                    )
                    api.rawCmd("/system/script/run", f"=number={script_name}")
                    # Give router a moment to finish export
                    time.sleep(1.5)
                    try:
                        api.rawCmd("/system/script/remove", f"=number={script_name}")
                    except Exception:
                        pass

                    local_rsc_path = os.path.join(target_user_dir, rsc_remote)
                    _download_via_ftp(host, ftp_port, username, password, rsc_remote, local_rsc_path)
                    temp_files.append(local_rsc_path)

                # 2. Generate System Backup if needed
                local_backup_path = None
                if backup_type in ("backup", "both"):
                    # Save binary backup
                    backup_name_only = backup_remote.replace(".backup", "")
                    api.rawCmd(
                        "/system/backup/save",
                        f"=name={backup_name_only}",
                        "=dont-encrypt=yes",
                    )
                    time.sleep(1.5)

                    local_backup_path = os.path.join(target_user_dir, backup_remote)
                    _download_via_ftp(host, ftp_port, username, password, backup_remote, local_backup_path)
                    temp_files.append(local_backup_path)

            finally:
                # Restore FTP state if we temporarily enabled it
                if temporarily_enabled_ftp and ftp_id:
                    try:
                        api.rawCmd("/ip/service/disable", f"=.id={ftp_id}")
                    except Exception as e:
                        print("Warning: failed to revert FTP service state:", e)

        # 3. Determine final file
        if backup_type == "both" and local_rsc_path and local_backup_path:
            zip_filename = f"{clean_rname}_{ts_str}_full.zip"
            zip_filepath = os.path.join(target_user_dir, zip_filename)
            with zipfile.ZipFile(zip_filepath, "w", zipfile.ZIP_DEFLATED) as zf:
                zf.write(local_rsc_path, os.path.basename(local_rsc_path))
                zf.write(local_backup_path, os.path.basename(local_backup_path))
            
            # Remove individual files now zipped
            for tf in (local_rsc_path, local_backup_path):
                if os.path.exists(tf):
                    os.remove(tf)

            final_filename = zip_filename
            final_filepath = zip_filepath
            final_type = "both"
        elif backup_type == "rsc" and local_rsc_path:
            final_filename = rsc_remote
            final_filepath = local_rsc_path
        elif backup_type == "backup" and local_backup_path:
            final_filename = backup_remote
            final_filepath = local_backup_path
        else:
            raise RuntimeError("No backup file was successfully created or retrieved.")

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
        error_msg = str(e)
        print(f"Error during backup for router #{router_id}:", e)
        # Clean up any partial files
        for tf in temp_files:
            if os.path.exists(tf):
                try:
                    os.remove(tf)
                except Exception:
                    pass

        # Record failed attempt
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
