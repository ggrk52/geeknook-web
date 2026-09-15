---
description: Always update desktop archive geeknook-website.zip after website changes
---

# GeekNook Deployment Archive Rule

Whenever you make changes, improvements, or fixes to the website files in this repository:
1. Run `./build-archive.ps1` (or `tar -a -c -f ...`) to update the deployment archive on the user's desktop:
   - Primary target: `C:\Users\serge\OneDrive\Desktop\geeknook-website.zip`
   - Secondary target: `C:\Users\serge\Desktop\geeknook-website.zip`
2. Ensure the archive contains only clean production assets: `index.html`, `404.html`, `.htaccess`, `README.md`, `robots.txt`, `sitemap.xml`, `favicon.ico`, `css/`, `js/`, `images/`.
3. Never include `.git/`, `.agents/`, `.gitignore`, or temporary scratch files in the archive.
