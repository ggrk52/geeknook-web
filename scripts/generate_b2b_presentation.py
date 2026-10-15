#!/usr/bin/env python3
"""
GeekNook B2B Corporate Presentation PDF Generator
Produces a high-design, 16:9 landscape graphic PDF presentation deck for corporate IT buyers, founders, and architects.
"""

import os
import sys
from reportlab.lib.pagesizes import landscape
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Page dimensions: 16:9 Landscape (960 x 540 pt)
PAGE_W = 960
PAGE_H = 540

# Color palette
BG_DARK = HexColor('#090c14')
CARD_BG = HexColor('#121826')
CARD_BORDER = HexColor('#1e293b')
TEXT_PRIMARY = HexColor('#f8fafc')
TEXT_MUTED = HexColor('#94a3b8')
TEXT_DIM = HexColor('#64748b')

COLOR_BLUE = HexColor('#2b70f0')
COLOR_BLUE_LIGHT = HexColor('#60a5fa')
COLOR_BLUE_BG = HexColor('#172554')

COLOR_AMBER = HexColor('#d97706')
COLOR_AMBER_LIGHT = HexColor('#fbbf24')
COLOR_AMBER_BG = HexColor('#451a03')

COLOR_GREEN = HexColor('#10b981')
COLOR_GREEN_LIGHT = HexColor('#34d399')
COLOR_GREEN_BG = HexColor('#064e3b')

def init_fonts():
    font_path_regular = '/System/Library/Fonts/Supplemental/Arial.ttf'
    font_path_bold = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
    
    if os.path.exists(font_path_regular):
        pdfmetrics.registerFont(TTFont('AppFont', font_path_regular))
    else:
        pdfmetrics.registerFont(TTFont('AppFont', '/System/Library/Fonts/Helvetica.ttc'))
        
    if os.path.exists(font_path_bold):
        pdfmetrics.registerFont(TTFont('AppFont-Bold', font_path_bold))
    else:
        pdfmetrics.registerFont(TTFont('AppFont-Bold', '/System/Library/Fonts/Helvetica.ttc'))

init_fonts()

STYLE_TITLE = ParagraphStyle('Title', fontName='AppFont-Bold', fontSize=22, leading=26, textColor=TEXT_PRIMARY)
STYLE_SUBTITLE = ParagraphStyle('Sub', fontName='AppFont', fontSize=11, leading=15, textColor=TEXT_MUTED)
STYLE_CARD_TITLE = ParagraphStyle('CardTitle', fontName='AppFont-Bold', fontSize=12, leading=15, textColor=TEXT_PRIMARY)
STYLE_CARD_DESC = ParagraphStyle('CardDesc', fontName='AppFont', fontSize=9.5, leading=13.5, textColor=TEXT_MUTED)
STYLE_CARD_DESC_SM = ParagraphStyle('CardDescSm', fontName='AppFont', fontSize=8.5, leading=12, textColor=TEXT_MUTED)
STYLE_BULLETS = ParagraphStyle('Bullets', fontName='AppFont', fontSize=9, leading=15, textColor=TEXT_MUTED)

def draw_p_top(p, c, x, y_top, max_w, max_h=500):
    w, h = p.wrap(max_w, max_h)
    p.drawOn(c, x, y_top - h)
    return h

def draw_slide_base(c, slide_num_str):
    # Full dark canvas
    c.setFillColor(BG_DARK)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    
    # Outer frame
    c.setStrokeColor(HexColor('#161f30'))
    c.setLineWidth(1)
    c.rect(20, 20, PAGE_W - 40, PAGE_H - 40, fill=0, stroke=1)
    
    # Header Bar
    c.setFont('AppFont-Bold', 12)
    c.setFillColor(COLOR_BLUE_LIGHT)
    c.drawString(48, PAGE_H - 44, 'GEEK NOOK // B2B')
    
    c.setFont('AppFont', 9)
    c.setFillColor(TEXT_DIM)
    c.drawString(185, PAGE_H - 43, 'WORKPLACE ENGINEERING')
    
    c.drawRightString(PAGE_W - 48, PAGE_H - 44, slide_num_str)
    
    # Header separator
    c.setStrokeColor(CARD_BORDER)
    c.setLineWidth(0.8)
    c.line(48, PAGE_H - 54, PAGE_W - 48, PAGE_H - 54)
    
    # Footer separator
    c.line(48, 46, PAGE_W - 48, 46)
    c.setFont('AppFont', 8.5)
    c.setFillColor(TEXT_DIM)
    c.drawString(48, 30, 'ООО «ГИК НУК» • Инженерные рабочие места • Москва')
    c.drawRightString(PAGE_W - 48, 30, 'https://geeknook.ru/b2b • b2b@geeknook.ru • +7 (967) 025-10-30')

def draw_badge(c, x, y, text, theme='blue'):
    if theme == 'amber':
        bg, border, fg = COLOR_AMBER_BG, COLOR_AMBER, COLOR_AMBER_LIGHT
    elif theme == 'green':
        bg, border, fg = COLOR_GREEN_BG, COLOR_GREEN, COLOR_GREEN_LIGHT
    else:
        bg, border, fg = COLOR_BLUE_BG, COLOR_BLUE, COLOR_BLUE_LIGHT
        
    w = c.stringWidth(text, 'AppFont-Bold', 8) + 16
    h = 17
    
    c.setFillColor(bg)
    c.setStrokeColor(border)
    c.setLineWidth(0.8)
    c.roundRect(x, y, w, h, 8.5, fill=1, stroke=1)
    
    c.setFillColor(fg)
    c.setFont('AppFont-Bold', 8)
    c.drawString(x + 8, y + 5, text)
    return w

def draw_card(c, x, y, w, h, bg=CARD_BG, border=CARD_BORDER, radius=8):
    c.setFillColor(bg)
    c.setStrokeColor(border)
    c.setLineWidth(1)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=1)

def draw_header_block(c, badge_text, badge_theme, title, subtitle):
    draw_badge(c, 48, PAGE_H - 80, badge_text, badge_theme)
    draw_p_top(Paragraph(f'<b>{title}</b>', STYLE_TITLE), c, 48, PAGE_H - 88, PAGE_W - 96)
    draw_p_top(Paragraph(subtitle, STYLE_SUBTITLE), c, 48, PAGE_H - 118, PAGE_W - 96)

def draw_clipped_image(c, x, y, w, h, img_path, radius=8):
    if not os.path.exists(img_path):
        return
    c.saveState()
    path = c.beginPath()
    path.roundRect(x, y, w, h, radius)
    c.clipPath(path, stroke=0)
    c.drawImage(img_path, x, y, width=w, height=h, preserveAspectRatio=True, anchor='c')
    c.restoreState()
    c.setStrokeColor(CARD_BORDER)
    c.setLineWidth(1)
    c.roundRect(x, y, w, h, radius, fill=0, stroke=1)

# =========================================================================
# SLIDE 1: Cover / Executive Overview
# =========================================================================
def render_slide_1(c):
    draw_slide_base(c, "01 / 08")
    draw_header_block(
        c,
        "WORKPLACE SOLUTIONS", "blue",
        "Инженерные рабочие пространства для IT-команд",
        "Модульные эргономичные сетапы из массива кавказского дуба, американского ореха и стали с T-Track шиной."
    )
    
    cards = [
        ("Тест-драйв", "amber", "14 дней бесплатно", "Привозим 1 комплект прямо в ваш офис в Москве для полевого тестирования в реальных задачах."),
        ("Скидки", "green", "до -20% за объем", "Оптовая шкала от 5 рабочих мест со специальными условиями для IT-компаний и студий."),
        ("Бухгалтерия", "blue", "ЭДО & УПД", "Официальный безналичный расчет, быстрый обмен закрывающими документами через Диадок или СБИС."),
        ("Качество", "blue", "12 мес. гарантия", "Собственное производство в Москве. Быстрая замена любых элементов по рекламации за наш счет.")
    ]
    
    gx = 48
    gy = 95
    gw = 230
    gh = 135
    
    for i, (b_txt, b_thm, c_title, c_desc) in enumerate(cards):
        col = i % 2
        row = i // 2
        cx = gx + col * (gw + 16)
        cy = gy + (1 - row) * (gh + 12)
        
        draw_card(c, cx, cy, gw, gh)
        draw_badge(c, cx + 14, cy + gh - 28, b_txt, b_thm)
        draw_p_top(Paragraph(f'<b>{c_title}</b>', STYLE_CARD_TITLE), c, cx + 14, cy + gh - 36, gw - 28)
        draw_p_top(Paragraph(c_desc, STYLE_CARD_DESC), c, cx + 14, cy + gh - 60, gw - 28)
        
    # Right Column: Hero Visual Showcase
    rx = 544
    ry = 95
    rw = 368
    rh = 282
    draw_card(c, rx, ry, rw, rh)
    
    img_h = 185
    draw_clipped_image(c, rx + 12, ry + rh - img_h - 12, rw - 24, img_h, 'images/tild3835-3834-4638-b030-666334626134__dsc_3305.jpg', radius=6)
    
    draw_badge(c, rx + 16, ry + 56, "Флагманская серия Focus Station", "blue")
    
    desc_html = "<b>Массив кавказского дуба 22 мм + Авиационная шина T-Track (Д16Т)</b><br/><font color='#64748b'>Выдерживает нагрузку до 80 кг. Скрытый стальной кабель-трей под столешницей.</font>"
    draw_p_top(Paragraph(desc_html, STYLE_CARD_DESC), c, rx + 16, ry + 50, rw - 32)

# =========================================================================
# SLIDE 2: Business & HR Problem: RTO & Engineer Health
# =========================================================================
def render_slide_2(c):
    draw_slide_base(c, "02 / 08")
    draw_header_block(
        c,
        "ВЫЗОВЫ БИЗНЕСА И HR", "amber",
        "RTO (Return to Office) и здоровье ведущих инженеров",
        "Почему сильные разработчики сопротивляются офису и как эргономика решает вопрос удержания кадров."
    )
    
    cols = [
        ("Вызов #1", "amber", "1. Конкуренция с домом", 
         "За годы удаленки разработчики вложились в домашний уют: подставки, мониторы, свет. Возвращение за типовой голый стол из ДСП в офисе вызывает глубокую фрустрацию и саботаж RTO-политики компании."),
        ("Вызов #2", "amber", "2. Синдром «текстовой шеи»", 
         "Работа за низким экраном ноутбука вынуждает опускать голову на 45°. Это создает нагрузку в 22 кг на шейный отдел, вызывая хронические головные боли и спад концентрации во второй половине дня."),
        ("Вызов #3", "amber", "3. Визуальный хаос и риски", 
         "Сотни проводов, удлинителей и адаптеров под столами создают неопрятный вид опенспейса и напрямую нарушают требования пожарной безопасности бизнес-центров класса А во время проверок.")
    ]
    
    cw = 274
    ch = 195
    cy = 185
    
    for i, (b_txt, b_thm, c_title, c_desc) in enumerate(cols):
        cx = 48 + i * (cw + 21)
        draw_card(c, cx, cy, cw, ch)
        draw_badge(c, cx + 16, cy + ch - 28, b_txt, b_thm)
        draw_p_top(Paragraph(f'<b>{c_title}</b>', STYLE_CARD_TITLE), c, cx + 16, cy + ch - 36, cw - 32)
        draw_p_top(Paragraph(c_desc, STYLE_CARD_DESC), c, cx + 16, cy + ch - 62, cw - 32)
        
    # Bottom ROI Banner
    by = 70
    bh = 95
    bw = PAGE_W - 96
    draw_card(c, 48, by, bw, bh, bg=HexColor('#0f172a'), border=COLOR_BLUE)
    
    draw_badge(c, 64, by + bh - 26, "ROI ЭРГОНОМИКИ", "green")
    draw_p_top(Paragraph("<b>Инвестиция 25 000 руб. в эргономичный сетап сотрудника окупается за 3 недели</b>", STYLE_CARD_TITLE), c, 64, by + bh - 34, bw - 120)
    
    roi_desc = "Стоимость удержания и замены Senior-разработчика превышает 400 000 руб. Инженерный стол GeekNook становится осязаемым аргументом заботы компании и устраняет отток ключевых кадров."
    draw_p_top(Paragraph(roi_desc, STYLE_CARD_DESC), c, 64, by + bh - 58, bw - 32)

# =========================================================================
# SLIDE 3: Modular Ecosystem: Focus Station
# =========================================================================
def render_slide_3(c):
    draw_slide_base(c, "03 / 08")
    draw_header_block(
        c,
        "ПРОДУКТОВОЕ РЕШЕНИЕ", "blue",
        "Модульная экосистема GeekNook Focus Station",
        "Архитектурная платформа для мониторов, ноутбуков и аксессуаров из массива дерева и авиационного металла."
    )
    
    lx = 48
    lw = 480
    items = [
        ("Натуральный массив дерева 22 мм", "Отборный кавказский дуб и американский орех камерной сушки. Покрытие шелковистым немецким маслом Osmo подчеркивает текстуру и защищает от влаги."),
        ("Авиационная рельса T-Track (Д16Т)", "Интегрированная направляющая из алюминия Д16Т. Быстрая смена положений кронштейна ноутбука, MagSafe-док-станции и держателя наушников за 1 секунду."),
        ("Пожаробезопасный кабель-трей", "Стальной лоток 1.5 мм с порошковым напылением скрывает сетевой фильтр и провода под столешницей. Идеальная эстетика на видеозвонках.")
    ]
    
    ih = 90
    for idx, (title, desc) in enumerate(items):
        iy = 275 - idx * (ih + 12)
        draw_card(c, lx, iy, lw, ih)
        
        c.setFillColor(COLOR_BLUE_LIGHT)
        c.circle(lx + 20, iy + ih - 20, 3.5, fill=1, stroke=0)
        
        draw_p_top(Paragraph(f'<b>{title}</b>', STYLE_CARD_TITLE), c, lx + 32, iy + ih - 12, lw - 50)
        draw_p_top(Paragraph(desc, STYLE_CARD_DESC), c, lx + 32, iy + ih - 36, lw - 50)
        
    rx = 544
    ry = 71
    rw = 368
    rh = 294
    draw_card(c, rx, ry, rw, rh)
    
    img_h = 200
    draw_clipped_image(c, rx + 12, ry + rh - img_h - 12, rw - 24, img_h, 'images/tild3662-6661-4163-a436-623936386366___dsc4074.jpg', radius=6)
    
    draw_badge(c, rx + 16, ry + 56, "Конструктивные параметры", "blue")
    specs_desc = "<b>Распределенная нагрузка: до 80 кг</b><br/><font color='#64748b'>Собственное производство в Москве • Контроль ЧПУ • Гарантия 12 месяцев</font>"
    draw_p_top(Paragraph(specs_desc, STYLE_CARD_DESC), c, rx + 16, ry + 50, rw - 32)

# =========================================================================
# SLIDE 4: Ergonomics Standard ISO 9241-5
# =========================================================================
def render_slide_4(c):
    draw_slide_base(c, "04 / 08")
    draw_header_block(
        c,
        "ЭРГОНОМИКА И БИОМЕХАНИКА", "blue",
        "Эргономический стандарт ISO 9241-5",
        "Инженерный расчет углов обзора и выравнивание высоты экранов для продуктивной 8-часовой работы без усталости."
    )
    
    stats = [
        ("+90 мм", "Уровень взгляда", "Верхняя треть экрана находится строго на уровне глаз. Снижает компрессию межпозвоночных дисков шеи на 40% и исключает сутулость."),
        ("180°", "Единый горизонт экранов", "Кронштейн для ноутбука на рельсе T-Track выравнивает дисплей лэптопа с монитором 27–34\". Глаза не перефокусируются по высоте."),
        ("+40%", "Свободная площадь стола", "Под полку мгновенно убираются клавиатура, мышь и трекпад. Стол освобождается для чертежей, документов или ноутбука коллеги.")
    ]
    
    cw = 274
    ch = 195
    cy = 185
    
    for i, (val, title, desc) in enumerate(stats):
        cx = 48 + i * (cw + 21)
        draw_card(c, cx, cy, cw, ch)
        
        draw_p_top(Paragraph(f'<b><font color="#2b70f0" size="24">{val}</font></b>', STYLE_TITLE), c, cx + 18, cy + ch - 14, cw - 32)
        draw_p_top(Paragraph(f'<b>{title}</b>', STYLE_CARD_TITLE), c, cx + 18, cy + ch - 48, cw - 32)
        draw_p_top(Paragraph(desc, STYLE_CARD_DESC), c, cx + 18, cy + ch - 74, cw - 32)
        
    by = 70
    bh = 95
    bw = PAGE_W - 96
    draw_card(c, 48, by, bw, bh)
    
    draw_badge(c, 64, by + bh - 26, "СООТВЕТСТВИЕ СТАНДАРТАМ", "green")
    draw_p_top(Paragraph("<b>Снижение жалоб на боли в спине и шее до 55% по данным эргономических аудитов</b>", STYLE_CARD_TITLE), c, 64, by + bh - 34, bw - 120)
    
    iso_desc = "Конструкция Focus Station разработана в полном соответствии с ГОСТ Р ИСО 9241-5-2012 («Требования к рабочему месту пользователя видеотерминалов»). Повышает индекс удовлетворенности офисом (eNPS)."
    draw_p_top(Paragraph(iso_desc, STYLE_CARD_DESC), c, 64, by + bh - 58, bw - 32)

# =========================================================================
# SLIDE 5: Packages & Wholesale Pricing
# =========================================================================
def render_slide_5(c):
    draw_slide_base(c, "05 / 08")
    draw_header_block(
        c,
        "ЦЕНООБРАЗОВАНИЕ & B2B ПРАЙС", "green",
        "Корпоративные пакеты и оптовая сетка скидок",
        "Прозрачное ценообразование со скидками от объема для стартапов, проектных команд и крупных офисов."
    )
    
    packages = [
        ("Скидка 10%", "amber", "Startup Pack", "22 048 руб.", "5–10 рабочих мест", 
         "• Focus Station 85 дуб<br/>• Кронштейн Laptop Stand<br/>• Кабель-органайзеры<br/>• Бесплатная доставка"),
        ("Скидка 15% (Хит)", "green", "Growth Team", "25 497 руб.", "11–25 рабочих мест", 
         "• Focus Station 116 дуб<br/>• Laptop Stand Open<br/>• Подвес для наушников<br/>• Приоритетные сроки"),
        ("Скидка 20%", "blue", "Enterprise Pro", "33 196 руб.", "26–50+ рабочих мест", 
         "• Focus Station 116 орех<br/>• Стальной кабель-трей<br/>• Кожаный Desk Mat<br/>• Сборка под ключ"),
        ("до -25%", "blue", "Custom Project", "По запросу", "от 50 рабочих мест", 
         "• Индивидуальные размеры<br/>• Колеровка по RAL/NCS<br/>• Лазерная гравировка<br/>• Выделенный куратор")
    ]
    
    pw = 202
    ph = 300
    py = 72
    
    for i, (b_txt, b_thm, title, price, tier, items_html) in enumerate(packages):
        px = 48 + i * (pw + 18)
        border_col = COLOR_GREEN if "Хит" in b_txt else CARD_BORDER
        draw_card(c, px, py, pw, ph, border=border_col)
        
        draw_badge(c, px + 14, py + ph - 28, b_txt, b_thm)
        draw_p_top(Paragraph(f'<b>{title}</b>', STYLE_CARD_TITLE), c, px + 14, py + ph - 34, pw - 28)
        draw_p_top(Paragraph(f'<b><font color="#2b70f0" size="14">{price}</font></b>', STYLE_TITLE), c, px + 14, py + ph - 56, pw - 28)
        draw_p_top(Paragraph(f'<font color="#64748b" size="8.5">{tier}</font>', STYLE_CARD_DESC), c, px + 14, py + ph - 80, pw - 28)
        
        c.setStrokeColor(CARD_BORDER)
        c.line(px + 14, py + ph - 96, px + pw - 14, py + ph - 96)
        
        draw_p_top(Paragraph(items_html, STYLE_BULLETS), c, px + 14, py + ph - 108, pw - 28)

# =========================================================================
# SLIDE 6: Corporate Branding & Personalization
# =========================================================================
def render_slide_6(c):
    draw_slide_base(c, "06 / 08")
    draw_header_block(
        c,
        "КОРПОРАТИВНАЯ АЙДЕНТИКА", "blue",
        "Персонализация под брендбук компании",
        "Интегрируйте айдентику вашей компании в рабочее пространство сотрудников и подчеркните статус."
    )
    
    lx = 48
    lw = 480
    options = [
        ("Лазерная гравировка", "blue", "Металлическая шильда с логотипом", 
         "Прецизионная лазерная гравировка на торце анодированной шины T-Track (+1 200 руб./место, бесплатно от 25 мест)."),
        ("Блинтовое тиснение", "amber", "Фирменное тиснение на коже", 
         "Глубокое горячее тиснение логотипа на ковриках для стола из премиальной итальянской кожи или войлока."),
        ("Индивидуальная колеровка", "green", "Подбор цвета дерева под офис", 
         "Тонирование массива кавказского дуба в точный оттенок офисных столов и брендбука натуральными маслами Osmo / Saicos.")
    ]
    
    oh = 90
    for idx, (b_txt, b_thm, title, desc) in enumerate(options):
        oy = 275 - idx * (oh + 12)
        draw_card(c, lx, oy, lw, oh)
        
        draw_badge(c, lx + 16, oy + oh - 26, b_txt, b_thm)
        draw_p_top(Paragraph(f'<b>{title}</b>', STYLE_CARD_TITLE), c, lx + 16, oy + oh - 32, lw - 32)
        draw_p_top(Paragraph(desc, STYLE_CARD_DESC), c, lx + 16, oy + oh - 54, lw - 32)
        
    rx = 544
    ry = 71
    rw = 368
    rh = 294
    draw_card(c, rx, ry, rw, rh)
    
    img_h = 200
    draw_clipped_image(c, rx + 12, ry + rh - img_h - 12, rw - 24, img_h, 'images/tild6634-3865-4138-b035-306136313762___dsc2944.jpg', radius=6)
    
    draw_badge(c, rx + 16, ry + 56, "Качество и ручная доводка", "blue")
    craft_desc = "<b>Безупречная геометрия и финишная шлифовка</b><br/><font color='#64748b'>Каждое изделие проходит ручную доводку мастерами на столичном производстве.</font>"
    draw_p_top(Paragraph(craft_desc, STYLE_CARD_DESC), c, rx + 16, ry + 50, rw - 32)

# =========================================================================
# SLIDE 7: 14-Day Free Office Test-Drive
# =========================================================================
def render_slide_7(c):
    draw_slide_base(c, "07 / 08")
    draw_header_block(
        c,
        "ОФФЕР-ЛОКОМОТИВ", "amber",
        "Программа «Офисный тест-драйв на 14 дней»",
        "Без рисков и финансовых обязательств: оцените качество и эргономику в реальной работе до подписания договора."
    )
    
    steps = [
        ("Шаг 1", "blue", "Заявка за 1 мин", "Оставляете заявку на странице geeknook.ru/b2b или в Telegram @geeknook с адресом офиса."),
        ("Шаг 2", "blue", "Доставка Demo Box", "Курьер привозит полностью собранный флагманский сетап в презентабельном защитном кофре."),
        ("Шаг 3", "amber", "14 дней в бою", "Ведущий разработчик или тимлид работает за ним 2 недели в решении реальных задач."),
        ("Шаг 4", "green", "Простое решение", "Понравилось — выкупаете образец со скидкой и утверждаете тираж. Не подошло — бесплатно забираем.")
    ]
    
    sw = 202
    sh = 195
    sy = 185
    
    for i, (b_txt, b_thm, title, desc) in enumerate(steps):
        sx = 48 + i * (sw + 18)
        draw_card(c, sx, sy, sw, sh)
        
        draw_badge(c, sx + 14, sy + sh - 28, b_txt, b_thm)
        draw_p_top(Paragraph(f'<b>{title}</b>', STYLE_CARD_TITLE), c, sx + 14, sy + sh - 36, sw - 28)
        draw_p_top(Paragraph(desc, STYLE_CARD_DESC), c, sx + 14, sy + sh - 62, sw - 28)
        
    by = 70
    bh = 95
    bw = PAGE_W - 96
    draw_card(c, 48, by, bw, bh, bg=HexColor('#0f172a'), border=COLOR_AMBER)
    
    draw_badge(c, 64, by + bh - 26, "УСЛОВИЯ ТЕСТ-ДРАЙВА", "amber")
    draw_p_top(Paragraph("<b>0 рублей предоплаты и никаких скрытых обязательств по закупке</b>", STYLE_CARD_TITLE), c, 64, by + bh - 34, bw - 120)
    
    demo_desc = "В активной ротации находятся 2 комплекта Demo Box. Бронирование даты тест-драйва осуществляется в порядке поступления заявок. Доставка и вывоз в пределах Москвы — бесплатно."
    draw_p_top(Paragraph(demo_desc, STYLE_CARD_DESC), c, 64, by + bh - 58, bw - 32)

# =========================================================================
# SLIDE 8: Direct Contacts & Requisites
# =========================================================================
def render_slide_8(c):
    draw_slide_base(c, "08 / 08")
    draw_header_block(
        c,
        "КОНТАКТЫ & РЕКВИЗИТЫ", "green",
        "Свяжитесь с корпоративным отделом GeekNook",
        "Забронируйте бесплатный тест-драйв или запросите официальное КП с расчетом спецификации под ваш офис."
    )
    
    cw = 422
    ch = 300
    cy = 72
    
    # Left Card: Direct Contacts
    lx = 48
    draw_card(c, lx, cy, cw, ch)
    draw_badge(c, lx + 20, cy + ch - 28, "ПРЯМАЯ СВЯЗЬ С РУКОВОДИТЕЛЕМ", "green")
    draw_p_top(Paragraph("<b>Контакты B2B направления</b>", STYLE_CARD_TITLE), c, lx + 20, cy + ch - 34, cw - 40)
    
    contacts_html = """
    <b>Email:</b> <font color="#2b70f0">b2b@geeknook.ru</font><br/>
    <font color="#64748b">Отвечаем на запросы в течение 2 часов в рабочее время</font><br/><br/>
    <b>Телефон:</b> <font color="#2b70f0">+7 (967) 025-10-30</font><br/>
    <font color="#64748b">Пн – Пт с 10:00 до 19:00 по московскому времени</font><br/><br/>
    <b>Telegram:</b> <font color="#2b70f0">@geeknook</font><br/>
    <font color="#64748b">Прямой чат с руководителем для оперативных расчетов</font><br/><br/>
    <b>Веб-портал:</b> <font color="#2b70f0">https://geeknook.ru/b2b</font>
    """
    draw_p_top(Paragraph(contacts_html, STYLE_CARD_DESC), c, lx + 20, cy + ch - 62, cw - 40)
    
    # Right Card: Requisites
    rx = 490
    draw_card(c, rx, cy, cw, ch)
    draw_badge(c, rx + 20, cy + ch - 28, "ОФИЦИАЛЬНЫЙ ПОСТАВЩИК", "blue")
    draw_p_top(Paragraph("<b>Реквизиты и документооборот</b>", STYLE_CARD_TITLE), c, rx + 20, cy + ch - 34, cw - 40)
    
    req_html = """
    <b>ООО «ГИК НУК»</b><br/>
    <b>ИНН:</b> 9723239478 &nbsp;&nbsp;|&nbsp;&nbsp; <b>КПП:</b> 772301001<br/>
    <b>ОГРН:</b> 1247700620265<br/>
    <b>Юридический адрес:</b> 115193, г. Москва, ул. Петра Романова, дом 7, стр. 1, помещение 20/5<br/><br/>
    <b>Электронный документооборот (ЭДО):</b><br/>
    Диадок (СКБ Контур) или СБИС — мгновенное подписание УПД и договоров.<br/><br/>
    <b>Форма оплаты:</b> Безналичный расчет (УСН без НДС / с НДС через партнера)<br/>
    <b>Сроки производства:</b> 5–16 рабочих дней с фиксацией в договоре.
    """
    draw_p_top(Paragraph(req_html, STYLE_CARD_DESC), c, rx + 20, cy + ch - 62, cw - 40)

# =========================================================================
# MAIN GENERATOR
# =========================================================================
def generate_pdf():
    output_dir = 'docs'
    os.makedirs(output_dir, exist_ok=True)
    pdf_path = os.path.join(output_dir, 'GeekNook_B2B_Presentation.pdf')
    
    print(f"Generating presentation to {pdf_path}...")
    c = canvas.Canvas(pdf_path, pagesize=(PAGE_W, PAGE_H))
    c.setTitle("GeekNook // B2B Corporate Presentation")
    c.setAuthor("ООО «ГИК НУК»")
    c.setSubject("Инженерные рабочие пространства для IT-команд")
    
    render_slide_1(c)
    c.showPage()
    
    render_slide_2(c)
    c.showPage()
    
    render_slide_3(c)
    c.showPage()
    
    render_slide_4(c)
    c.showPage()
    
    render_slide_5(c)
    c.showPage()
    
    render_slide_6(c)
    c.showPage()
    
    render_slide_7(c)
    c.showPage()
    
    render_slide_8(c)
    c.showPage()
    
    c.save()
    
    size_kb = os.path.getsize(pdf_path) / 1024
    print(f"Presentation generated successfully: {pdf_path} ({size_kb:.1f} KB, 8 slides)")

if __name__ == '__main__':
    generate_pdf()
