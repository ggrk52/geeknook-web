---
description: Always update desktop archive geeknook-website.zip after website changes
---

# GeekNook Deployment Archive Rule

Whenever you make changes, improvements, or fixes to the website files in this repository:
1. Run `python3 scripts/build-archive.py` (or `./scripts/build-archive.sh`, or on Windows `./build-archive.ps1`) to automatically update the clean deployment archive on the user's desktop:
   - macOS / Linux target: `~/Desktop/geeknook-website.zip`
   - Windows target: `C:\Users\<user>\Desktop\geeknook-website.zip` (and OneDrive Desktop)
2. Ensure the archive contains only clean production assets: `index.html`, `journal.html`, `legal.html`, `404.html`, `.htaccess`, `README.md`, `robots.txt`, `sitemap.xml`, `favicon.ico`, `css/`, `js/`, `images/`, `journal/`, `tilda-bundle/`, `docs/`.
3. Never include `.git/`, `.agents/`, `.agent/`, `.gsd/`, `.gitignore`, `docs/internal/`, or temporary scratch files in the archive.
