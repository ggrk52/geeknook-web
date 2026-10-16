#!/usr/bin/env python3
"""
Update GeekNook logo and branding across all 218 journal articles.
- Replace SVG square with official logo image in header
- Add brand-link img CSS
- Update Schema.org publisher logo URL to official PNG logo
- Add PNG favicon tag
- Add logo and synchronized legal info in footer
"""

import glob
import os
import re

LOGO_PATH_REL = "../images/tild6164-6364-4661-b835-636430386562__logo_oo.png"
LOGO_URL_ABS = "https://geeknook.ru/images/tild6164-6364-4661-b835-636430386562__logo_oo.png"

articles = sorted(glob.glob("journal/*.html"))
print(f"Found {len(articles)} articles to update...")

updated_count = 0

for file_path in articles:
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    modified = False

    # 1. Update logo in brand-link header
    old_brand = re.search(r"<a href=\"https://geeknook\.ru/\" class=\"brand-link\"[^>]*>.*?</a>", content, re.DOTALL)
    if old_brand and ("<svg" in old_brand.group(0) or "logo_oo.png" not in old_brand.group(0)):
        new_brand = f"""<a href="https://geeknook.ru/" class="brand-link" aria-label="GeekNook Главная">
        <img src="{LOGO_PATH_REL}" alt="GeekNook" width="28" height="28" style="display:block;object-fit:contain;">
        <span>GEEK NOOK</span>
      </a>"""
        content = content.replace(old_brand.group(0), new_brand)
        modified = True

    # 2. Add brand-link img CSS if missing
    if ".brand-link img" not in content and ".brand-link {" in content:
        content = content.replace(".brand-link {", """.brand-link img {
      height: 28px;
      width: auto;
      display: block;
      object-fit: contain;
    }
    .brand-link {""")
        modified = True

    # 3. Update Schema.org publisher logo
    if "favicon.ico" in content and '"publisher"' in content:
        content = re.sub(r"\"url\":\s*\"https://geeknook\.ru/favicon\.ico\"", f'"url": "{LOGO_URL_ABS}"', content)
        modified = True

    # 4. Add png favicon if missing
    if "logo_oo.png" not in content[:1200] and "../favicon.ico" in content:
        content = content.replace(
            '<link rel="icon" type="image/x-icon" href="../favicon.ico">',
            f'<link rel="icon" type="image/x-icon" href="../favicon.ico">\n  <link rel="icon" href="{LOGO_PATH_REL}" type="image/png">'
        )
        modified = True

    # 5. Update footer with logo and full legal info
    old_footer = re.search(r"<footer class=\"site-footer\">.*?</footer>", content, re.DOTALL)
    if old_footer and "logo_oo.png" not in old_footer.group(0):
        new_footer = f"""<footer class="site-footer">
      <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:12px;">
        <img src="{LOGO_PATH_REL}" alt="GeekNook" width="24" height="24" style="display:block;object-fit:contain;">
        <span style="font-weight:900;letter-spacing:0.05em;color:#fff;font-size:1rem;">GEEK NOOK</span>
      </div>
      <p>© 2026 ООО «ГИК НУК» (ИНН 9723239478, ОГРН 1247700620265). Все права защищены.</p>
      <p style="margin-top:6px;"><a href="https://geeknook.ru/">На главную</a> • <a href="https://geeknook.ru/podstavki-pod-monitor">Подставки под монитор</a> • <a href="https://geeknook.ru/journal">Все статьи Журнала</a> • <a href="https://geeknook.ru/legal">Правовой центр</a></p>
    </footer>"""
        content = content.replace(old_footer.group(0), new_footer)
        modified = True

    if modified:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        updated_count += 1

print(f"Successfully processed {len(articles)} articles. Modified: {updated_count}")
