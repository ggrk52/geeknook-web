#!/usr/bin/env python3
"""
Update internal links for the new category /kovriki-dlya-stola across journal articles.
1. Add link to /kovriki-dlya-stola in the footer of all 218 articles.
2. In the 54 articles of category "Коврики для стола", link breadcrumbs and CTA buttons directly to https://geeknook.ru/kovriki-dlya-stola.
"""

import glob
import re

articles = glob.glob("journal/*.html")
print(f"Total articles found: {len(articles)}")

footer_updated = 0
category_updated = 0

old_footer_target = '<a href="https://geeknook.ru/podstavki-pod-monitor">Подставки под монитор</a> • <a href="https://geeknook.ru/journal">Все статьи Журнала</a>'
new_footer_target = '<a href="https://geeknook.ru/podstavki-pod-monitor">Подставки под монитор</a> • <a href="https://geeknook.ru/kovriki-dlya-stola">Коврики для стола</a> • <a href="https://geeknook.ru/journal">Все статьи Журнала</a>'

for a in articles:
    with open(a, "r", encoding="utf-8") as f:
        content = f.read()

    mod = False

    # 1. Footer update
    if old_footer_target in content:
        content = content.replace(old_footer_target, new_footer_target)
        mod = True
        footer_updated += 1

    # 2. If article is in category "Коврики для стола"
    if "Коврики для стола" in content:
        # Breadcrumbs link
        if "<span>Коврики для стола</span>" in content:
            content = content.replace(
                "<span>Коврики для стола</span>",
                '<a href="https://geeknook.ru/kovriki-dlya-stola">Коврики для стола</a>'
            )
            mod = True

        # CTA button link
        content = re.sub(
            r'<a\s+href="https://geeknook\.ru/#mats"[^>]*>.*?Выбрать коврик.*?</a>',
            '<a href="https://geeknook.ru/kovriki-dlya-stola" class="btn-buy-primary"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>Выбрать коврик Desk Mat (от 1 499 ₽)</a>',
            content,
            flags=re.DOTALL
        )
        mod = True
        category_updated += 1

    if mod:
        with open(a, "w", encoding="utf-8") as f:
            f.write(content)

print(f"Footer links updated in: {footer_updated} articles")
print(f"Category mats updated in: {category_updated} articles")
