#!/usr/bin/env python3
"""
scripts/fix_journal_seo.py
Systematic fix for journal articles SEO, indexability, canonical URLs, and internal linking.
"""
import glob
import os
import re

CORE_INTERLINKS = {
    "podstavka-dlya-monitora-zachem-ona-nuzhna-i-kak-vybrat.html": [
        ("как подобрать ширину и глубину подставки под свой стол (85 vs 116 см)", "https://geeknook.ru/journal?article=podstavka-dlya-monitora-na-stol-kak-podobrat-shirinu-i-glubinu-pod-svo"),
        ("как рассчитать правильную высоту экрана под уровень глаз за 2 минуты", "https://geeknook.ru/journal?article=vysota-podstavki-dlya-monitora-kak-rasschitat-za-dve-minuty"),
        ("как разместить два монитора или 49-дюймовый экран на одной подставке", "https://geeknook.ru/journal?article=podstavka-dlya-dvuh-monitorov-kak-razmestit-ekrany-i-ne-poteryat-stol"),
        ("выбрать деревянную подставку Focus Station из дуба или ореха в каталоге", "https://geeknook.ru/podstavki-pod-monitor"),
    ],
    "podstavka-dlya-monitora-na-stol-kak-podobrat-shirinu-i-glubinu-pod-svo.html": [
        ("сравнить подставки шириной 85 и 116 см в каталоге GeekNook", "https://geeknook.ru/podstavki-pod-monitor"),
        ("зачем нужна подставка под монитор и как она организует рабочий стол", "https://geeknook.ru/journal?article=podstavka-dlya-monitora-zachem-ona-nuzhna-i-kak-vybrat"),
        ("расчет анатомической высоты подставки под уровень глаз", "https://geeknook.ru/journal?article=vysota-podstavki-dlya-monitora-kak-rasschitat-za-dve-minuty"),
    ],
    "vysota-podstavki-dlya-monitora-kak-rasschitat-za-dve-minuty.html": [
        ("как подобрать ширину подставки под монитор: 85 или 116 см", "https://geeknook.ru/journal?article=podstavka-dlya-monitora-na-stol-kak-podobrat-shirinu-i-glubinu-pod-svo"),
        ("подобрать анатомическую подставку Focus Station с подъемом 9 см", "https://geeknook.ru/podstavki-pod-monitor"),
        ("7 типичных ошибок при организации рабочего места и установке экрана", "https://geeknook.ru/journal?article=7-oshibok-pri-vybore-podstavki-dlya-monitora-kompyutera"),
    ],
    "derevyannaya-podstavka-dlya-monitora.html": [
        ("сравнить деревянные подставки Focus Station из дуба и ореха в каталоге", "https://geeknook.ru/podstavki-pod-monitor"),
        ("как подобрать ширину и глубину деревянной подставки под монитор", "https://geeknook.ru/journal?article=podstavka-dlya-monitora-na-stol-kak-podobrat-shirinu-i-glubinu-pod-svo"),
        ("руководство: зачем нужна подставка под монитор и как она освобождает стол", "https://geeknook.ru/journal?article=podstavka-dlya-monitora-zachem-ona-nuzhna-i-kak-vybrat"),
    ],
    "podstavka-dlya-dvuh-monitorov-kak-razmestit-ekrany-i-ne-poteryat-stol.html": [
        ("выбрать подставку 116 см под два монитора в каталоге Focus Station", "https://geeknook.ru/podstavki-pod-monitor"),
        ("сравнить подставки шириной 85 и 116 см по полезному пространству", "https://geeknook.ru/journal?article=podstavka-dlya-monitora-na-stol-kak-podobrat-shirinu-i-glubinu-pod-svo"),
    ],
    "7-oshibok-pri-vybore-podstavki-dlya-monitora-kompyutera.html": [
        ("выбрать надежную подставку из массива дуба и ореха с нагрузкой до 50 кг", "https://geeknook.ru/podstavki-pod-monitor"),
        ("как точно рассчитать габариты подставки и не промахнуться с шириной", "https://geeknook.ru/journal?article=podstavka-dlya-monitora-na-stol-kak-podobrat-shirinu-i-glubinu-pod-svo"),
        ("как выставить эргономичную высоту монитора за 2 минуты", "https://geeknook.ru/journal?article=vysota-podstavki-dlya-monitora-kak-rasschitat-za-dve-minuty"),
    ],
    "organizatsiya-stola-sistema-zon-vmesto-razovoy-uborki.html": [
        ("как второй уровень подставки освобождает до 60% площади стола", "https://geeknook.ru/journal?article=podstavka-dlya-monitora-zachem-ona-nuzhna-i-kak-vybrat"),
        ("деревянные подставки Focus Station для организации двух уровней хранения", "https://geeknook.ru/podstavki-pod-monitor"),
        ("как правильно выбрать компьютерный коврик для зонирования стола", "https://geeknook.ru/journal?article=kompyuternyy-kovrik-kak-vybrat-pod-svoy-stol-a-ne-pod-kartinku"),
        ("система кабель-менеджмента рабочего стола без пластиковых стяжек", "https://geeknook.ru/journal?article=kabel-menedzhment-rabochego-stola-sistema-vmesto-styazhek"),
    ],
    "kabel-menedzhment-rabochego-stola-sistema-vmesto-styazhek.html": [
        ("как скрыть провода за деревянной подставкой Focus Station", "https://geeknook.ru/podstavki-pod-monitor"),
        ("пошаговый сценарий организации рабочего стола за один вечер", "https://geeknook.ru/journal?article=organizatsiya-rabochego-stola-za-odin-vecher-poshagovyy-stsenariy"),
    ],
    "kompyuternyy-kovrik-kak-vybrat-pod-svoy-stol-a-ne-pod-kartinku.html": [
        ("как деревянная подставка и коврик собирают рабочее место в единый сетап", "https://geeknook.ru/podstavki-pod-monitor"),
        ("формат коврика: для мыши или на весь рабочий стол", "https://geeknook.ru/journal?article=kovrik-dlya-myshi-ili-kovrik-na-ves-stol-kakoy-format-nuzhen-imenno-va"),
    ],
}

def process_articles():
    files = sorted(glob.glob("journal/*.html"))
    print(f"Found {len(files)} articles in journal/ directory.")
    
    modified_count = 0
    
    for fpath in files:
        fname = os.path.basename(fpath)
        slug = fname.replace(".html", "")
        
        with open(fpath, "r", encoding="utf-8") as fp:
            orig = fp.read()
            
        content = orig
        
        # 1. Neutralize aggressive/infinite redirect on line 4
        # Replace geeknook.ru redirect with github.io redirect to canonical URL
        content = re.sub(
            r'<script>if\(window\.location\.hostname\.includes\([\"\']geeknook\.ru[\"\']\)\)\{window\.location\.replace\([\"\']https://geeknook\.ru/journal(?:\.html)?\?article=[a-z0-9-]+[\"\']\);\}</script>',
            f'<script>if(window.location.hostname.endsWith("github.io")){{window.location.replace("https://geeknook.ru/journal?article={slug}");}}</script>',
            content
        )
        
        # 2. Canonical tag: remove .html
        content = re.sub(
            r'<link rel=\"canonical\" href=\"https://geeknook\.ru/journal\.html\?article=([a-z0-9-]+)\">',
            r'<link rel="canonical" href="https://geeknook.ru/journal?article=\1">',
            content
        )
        
        # 3. OG url: remove .html
        content = re.sub(
            r'<meta property=\"og:url\" content=\"https://geeknook\.ru/journal\.html\?article=([a-z0-9-]+)\">',
            r'<meta property="og:url" content="https://geeknook.ru/journal?article=\1">',
            content
        )
        
        # 4. JSON-LD mainEntityOfPage: remove .html
        content = re.sub(
            r'\"mainEntityOfPage\": \"https://geeknook\.ru/journal\.html\?article=([a-z0-9-]+)\"',
            r'"mainEntityOfPage": "https://geeknook.ru/journal?article=\1"',
            content
        )
        
        # 5. Robots meta tag
        if 'name="robots"' not in content:
            content = content.replace(
                '<link rel="canonical"',
                '<meta name="robots" content="index, follow">\n  <link rel="canonical"'
            )
            
        # 6. Relative .html links to other articles
        # Replace href="some-slug.html" with href="https://geeknook.ru/journal?article=some-slug"
        content = re.sub(
            r'href=\"([a-z0-9-]+)\.html\"',
            r'href="https://geeknook.ru/journal?article=\1"',
            content
        )
        content = content.replace('href="../legal.html"', 'href="https://geeknook.ru/legal"')
        content = content.replace('href="legal.html"', 'href="https://geeknook.ru/legal"')
        content = content.replace('href="../journal.html"', 'href="https://geeknook.ru/journal"')
        
        # 7. Category Breadcrumbs in stands articles
        is_stands = ("Подставки под монитор" in content or "category-badge\">🖥 Подставки" in content)
        if is_stands:
            content = content.replace(
                '<span>Подставки под монитор</span>',
                '<a href="https://geeknook.ru/podstavki-pod-monitor">Подставки под монитор</a>'
            )
            content = content.replace(
                'href="https://geeknook.ru/#boards" class="btn-buy-primary"',
                'href="https://geeknook.ru/podstavki-pod-monitor" class="btn-buy-primary"'
            )
            
        # 8. CTA pricing
        content = content.replace(
            'Заказать Focus Station с доставкой СДЭК (от 14 990 ₽)',
            'Заказать Focus Station с доставкой СДЭК (от 15 999 ₽)'
        )
        
        # 9. Core interlinks block if applicable
        if fname in CORE_INTERLINKS:
            links = CORE_INTERLINKS[fname]
            # Build semantic interlink block HTML
            links_html = '<div class="article-interlinks-box" style="margin:28px 0;padding:20px;background:rgba(43,112,240,0.06);border-left:3px solid #2b70f0;border-radius:0 8px 8px 0;">\n'
            links_html += '  <strong style="display:block;margin-bottom:10px;font-size:0.95rem;color:#fff;">Связанные материалы и выбор модели:</strong>\n'
            links_html += '  <ul style="margin:0;padding-left:18px;line-height:1.7;">\n'
            for anchor, url in links:
                links_html += f'    <li style="margin-bottom:6px;"><a href="{url}" style="color:#38bdf8;text-decoration:none;font-weight:500;">{anchor} →</a></li>\n'
            links_html += '  </ul>\n</div>\n'
            
            # Insert before </article> if not already present
            if 'class="article-interlinks-box"' not in content:
                content = content.replace('</article>', f'{links_html}</article>')
                
        if content != orig:
            with open(fpath, "w", encoding="utf-8") as fp:
                fp.write(content)
            modified_count += 1
            
    print(f"Successfully processed and updated {modified_count} articles.")

if __name__ == "__main__":
    process_articles()
