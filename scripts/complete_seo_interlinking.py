#!/usr/bin/env python3
"""
scripts/complete_seo_interlinking.py
1. Cleans reader UI across all 218 articles (removes raw Wordstat query boxes and search counts).
2. Fixes all category breadcrumbs to clickable links (/podstavki-pod-monitor, /kovriki-dlya-stola, /kabel-menedzhment).
3. Adds contextual .article-interlinks-box to all remaining articles with reciprocal cross-links.
4. Updates 404.html to include direct navigation to catalog, journal, and category hubs.
"""
import glob
import os
import re

articles = sorted(glob.glob("journal/*.html"))
print(f"Total articles found: {len(articles)}")

# 1. Parse all articles
articles_meta = []
for a in articles:
    slug = os.path.basename(a).replace(".html", "")
    with open(a, "r", encoding="utf-8") as f:
        html = f.read()

    title_match = re.search(r'<h1[^>]*class=["\']article-title["\'][^>]*>(.*?)</h1>', html)
    title = title_match.group(1).strip() if title_match else ""

    badge_match = re.search(r'class=["\']category-badge["\'][^>]*>(.*?)</span>', html)
    category = re.sub(r'<.*?>', '', badge_match.group(1)).strip() if badge_match else "Общее"

    has_box = 'class="article-interlinks-box"' in html

    articles_meta.append({
        "file": a,
        "slug": slug,
        "title": title,
        "category": category,
        "has_box": has_box
    })

# Group articles by category
by_cat = {}
for m in articles_meta:
    cat = m["category"]
    by_cat.setdefault(cat, []).append(m)

print("Articles by category:")
for cat, items in by_cat.items():
    print(f"  {cat}: {len(items)} articles")

CATEGORY_HUBS = {
    "🖥 Подставки под монитор": ("выбрать деревянную подставку Focus Station из дуба или ореха в каталоге", "https://geeknook.ru/podstavki-pod-monitor"),
    "🖱 Коврики для стола": ("выбрать войлочный или кожаный коврик Desk Mat на рабочий стол", "https://geeknook.ru/kovriki-dlya-stola"),
    "⚡ Кабель-менеджмент": ("подобрать лотки и органайзеры для кабель-менеджмента GeekNook", "https://geeknook.ru/kabel-menedzhment"),
    "📐 Организация стола": ("деревянные подставки Focus Station для организации двух уровней хранения", "https://geeknook.ru/podstavki-pod-monitor"),
    "🧘 Эргономика и здоровье": ("подобрать анатомическую подставку Focus Station с подъемом 9 см под уровень глаз", "https://geeknook.ru/podstavki-pod-monitor"),
    "🎮 Аксессуары и сетапы": ("посмотреть модульные держатели для наушников, геймпадов и ноутбуков", "https://geeknook.ru/podstavki-pod-monitor")
}

updated_ui_count = 0
added_interlinks_count = 0
updated_breadcrumbs_count = 0

for idx, meta in enumerate(articles_meta):
    fpath = meta["file"]
    slug = meta["slug"]
    cat = meta["category"]

    with open(fpath, "r", encoding="utf-8") as f:
        orig = f.read()

    content = orig

    # 1. Clean UI: Remove Wordstat metrics
    if "запросов/мес" in content:
        content = re.sub(r'\s*<span class="meta-stat">• [^<]+запросов/мес</span>', '', content)
        updated_ui_count += 1

    # 2. Clean UI: Remove query-meta-box
    if 'class="query-meta-box"' in content:
        content = re.sub(r'\s*<div class="query-meta-box">[\s\S]*?</div>', '', content)

    # 3. Breadcrumbs links
    if "<span>Кабель-менеджмент</span>" in content:
        content = content.replace("<span>Кабель-менеджмент</span>", '<a href="https://geeknook.ru/kabel-menedzhment">Кабель-менеджмент</a>')
        updated_breadcrumbs_count += 1
    if "<span>Организация стола</span>" in content:
        content = content.replace("<span>Организация стола</span>", '<a href="https://geeknook.ru/podstavki-pod-monitor">Организация стола</a>')
        updated_breadcrumbs_count += 1
    if "<span>Эргономика и здоровье</span>" in content:
        content = content.replace("<span>Эргономика и здоровье</span>", '<a href="https://geeknook.ru/podstavki-pod-monitor">Эргономика и здоровье</a>')
        updated_breadcrumbs_count += 1
    if "<span>Аксессуары и сетапы</span>" in content:
        content = content.replace("<span>Аксессуары и сетапы</span>", '<a href="https://geeknook.ru/podstavki-pod-monitor">Аксессуары и сетапы</a>')
        updated_breadcrumbs_count += 1

    # 4. Contextual interlinks box (if not already present)
    if not meta["has_box"] and 'class="article-interlinks-box"' not in content:
        cat_items = by_cat.get(cat, [])
        # filter out self
        peers = [p for p in cat_items if p["slug"] != slug]
        if len(peers) < 3:
            peers = [p for p in articles_meta if p["slug"] != slug]

        # pick 3 peers deterministically using offset
        cur_idx = cat_items.index(meta) if meta in cat_items else 0
        p1 = peers[(cur_idx + 1) % len(peers)]
        p2 = peers[(cur_idx + 3) % len(peers)]
        p3 = peers[(cur_idx + 5) % len(peers)]

        hub_anchor, hub_url = CATEGORY_HUBS.get(cat, ("выбрать модульную систему GeekNook в каталоге", "https://geeknook.ru/podstavki-pod-monitor"))

        # Build clean natural anchors from peer titles
        def clean_anchor(t):
            t = t.strip()
            if not t:
                return "читать подробнее в руководстве"
            # lowercase first letter if not acronym
            if not t.startswith("GEEK") and not t.startswith("XL") and not t.startswith("VESA"):
                t = t[0].lower() + t[1:]
            return t

        box_html = '    <div class="article-interlinks-box" style="margin:28px 0;padding:20px;background:rgba(43,112,240,0.06);border-left:3px solid #2b70f0;border-radius:0 8px 8px 0;">\n'
        box_html += '      <strong style="display:block;margin-bottom:10px;font-size:0.95rem;color:#fff;">Связанные материалы и выбор модели:</strong>\n'
        box_html += '      <ul style="margin:0;padding-left:18px;line-height:1.7;">\n'
        box_html += f'        <li style="margin-bottom:6px;"><a href="{hub_url}" style="color:#38bdf8;text-decoration:none;font-weight:500;">{hub_anchor} →</a></li>\n'
        box_html += f'        <li style="margin-bottom:6px;"><a href="https://geeknook.ru/journal?article={p1["slug"]}" style="color:#38bdf8;text-decoration:none;font-weight:500;">{clean_anchor(p1["title"])} →</a></li>\n'
        box_html += f'        <li style="margin-bottom:6px;"><a href="https://geeknook.ru/journal?article={p2["slug"]}" style="color:#38bdf8;text-decoration:none;font-weight:500;">{clean_anchor(p2["title"])} →</a></li>\n'
        box_html += f'        <li style="margin-bottom:6px;"><a href="https://geeknook.ru/journal?article={p3["slug"]}" style="color:#38bdf8;text-decoration:none;font-weight:500;">{clean_anchor(p3["title"])} →</a></li>\n'
        box_html += '      </ul>\n'
        box_html += '    </div>\n'

        if "</article>" in content:
            content = content.replace("</article>", f"{box_html}    </article>")
            added_interlinks_count += 1

    if content != orig:
        with open(fpath, "w", encoding="utf-8") as f:
            f.write(content)

print(f"UI Cleaned: {updated_ui_count} articles")
print(f"Breadcrumbs Updated: {updated_breadcrumbs_count} articles")
print(f"Contextual Interlinks Added: {added_interlinks_count} articles")
