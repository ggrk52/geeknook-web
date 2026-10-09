#!/usr/bin/env python3
"""
GeekNook - Cross-Platform Desktop Archive Generator
Automatically packs clean production website files into geeknook-website.zip on Desktop.
Supports macOS, Linux, and Windows (including OneDrive Desktop).
"""

import os
import sys
import zipfile
import platform
from pathlib import Path

def find_desktop():
    home = Path.home()
    candidates = []

    # Windows checks
    if platform.system() == "Windows":
        userprofile = os.environ.get("USERPROFILE")
        if userprofile:
            candidates.append(Path(userprofile) / "OneDrive" / "Desktop")
            candidates.append(Path(userprofile) / "Desktop")
    
    # macOS & Linux / Unix checks
    candidates.append(home / "Desktop")
    candidates.append(home / "OneDrive" / "Desktop")

    for path in candidates:
        if path.exists() and path.is_dir():
            return path
            
    # Fallback to home directory
    return home

def make_archive():
    project_root = Path(__file__).resolve().parent.parent
    desktop = find_desktop()
    zip_path = desktop / "geeknook-website.zip"

    print(f"📦 Packing GeekNook production website...")
    print(f"📁 Target location: {zip_path}")

    # Production include list
    include_files = [
        "index.html",
        "journal.html",
        "legal.html",
        "404.html",
        ".htaccess",
        "LICENSE",
        "README.md",
        "robots.txt",
        "sitemap.xml",
        "favicon.ico",
        "yandex_72c8b34ebfb18c1b.html",
    ]

    include_dirs = [
        "api",
        "css",
        "js",
        "images",
        "journal",
        "tilda-bundle",
        "docs",
        "scripts",
    ]

    # Explicit exclude patterns
    exclude_patterns = [
        ".git",
        ".agents",
        ".agent",
        ".gsd",
        "scratch",
        "docs/internal",
        "__pycache__",
        "node_modules",
        ".DS_Store",
        "Thumbs.db",
    ]

    def should_exclude(rel_path: str):
        rel_norm = rel_path.replace("\\", "/")
        for exc in exclude_patterns:
            if rel_norm == exc or rel_norm.startswith(exc + "/") or ("/" + exc + "/") in ("/" + rel_norm + "/"):
                return True
        if rel_norm.endswith(".xlsx") or rel_norm.endswith(".csv") or rel_norm.endswith(".tmp") or rel_norm.endswith(".pyc"):
            return True
        return False

    file_count = 0
    try:
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zipf:
            # Add single files
            for fname in include_files:
                fpath = project_root / fname
                if fpath.exists() and fpath.is_file():
                    zipf.write(fpath, arcname=fname)
                    file_count += 1

            # Add directories
            for dname in include_dirs:
                dpath = project_root / dname
                if not dpath.exists():
                    continue
                for root, dirs, files in os.walk(dpath):
                    dirs[:] = [d for d in dirs if not should_exclude(os.path.relpath(os.path.join(root, d), project_root))]
                    for file in files:
                        full_p = os.path.join(root, file)
                        rel_p = os.path.relpath(full_p, project_root)
                        if not should_exclude(rel_p):
                            zipf.write(full_p, arcname=rel_p)
                            file_count += 1
    except PermissionError:
        zip_path = project_root / "geeknook-website.zip"
        print(f"⚠️ Desktop is protected by sandbox. Writing to project root: {zip_path}")
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zipf:
            for fname in include_files:
                fpath = project_root / fname
                if fpath.exists() and fpath.is_file():
                    zipf.write(fpath, arcname=fname)
                    file_count += 1

            for dname in include_dirs:
                dpath = project_root / dname
                if not dpath.exists():
                    continue
                for root, dirs, files in os.walk(dpath):
                    dirs[:] = [d for d in dirs if not should_exclude(os.path.relpath(os.path.join(root, d), project_root))]
                    for file in files:
                        full_p = os.path.join(root, file)
                        rel_p = os.path.relpath(full_p, project_root)
                        if not should_exclude(rel_p):
                            zipf.write(full_p, arcname=rel_p)
                            file_count += 1

    size_mb = os.path.getsize(zip_path) / (1024 * 1024)
    print(f"✅ Success! Packed {file_count} files into {zip_path} ({size_mb:.2f} MB)")
    return zip_path

if __name__ == "__main__":
    make_archive()
