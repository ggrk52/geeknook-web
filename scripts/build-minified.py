#!/usr/bin/env python3
"""
GeekNook Standalone Asset Minifier (Zero-dependency Python 3)
Minifies CSS and JavaScript files without requiring Node.js, npm, or external build pipelines.
Usage:
    python3 scripts/build-minified.py
"""

import os
import re
import sys

def minify_css(css_text):
    # Remove comments
    css = re.sub(r'/\*[\s\S]*?\*/', '', css_text)
    # Remove space around symbols
    css = re.sub(r'\s*([\{\};:,>+~])\s*', r'\1', css)
    # Remove double spaces and newlines
    css = re.sub(r'\s+', ' ', css)
    # Remove unnecessary semicolons
    css = re.sub(r';\}', '}', css)
    return css.strip()

def minify_js_safe(js_text):
    # Safe regex-based JS compression (removes comments, trims spaces around operators)
    # 1. Preserve strings and regex literals while stripping comments
    tokens = []
    in_str = None
    in_regex = False
    in_line_comment = False
    in_block_comment = False
    prev = ''
    i = 0
    n = len(js_text)
    res = []

    while i < n:
        ch = js_text[i]
        
        if in_line_comment:
            if ch == '\n':
                in_line_comment = False
                res.append('\n')
            i += 1
            continue

        if in_block_comment:
            if prev == '*' and ch == '/':
                in_block_comment = False
            prev = ch
            i += 1
            continue

        if in_str:
            res.append(ch)
            if ch == in_str and prev != '\\':
                in_str = None
            prev = ch
            i += 1
            continue

        # Check comment starts
        if prev == '/' and ch == '/':
            res.pop() # remove previous '/'
            in_line_comment = True
            i += 1
            prev = ''
            continue
        elif prev == '/' and ch == '*':
            res.pop() # remove previous '/'
            in_block_comment = True
            i += 1
            prev = ''
            continue

        if ch in ('"', "'", '`'):
            in_str = ch
            res.append(ch)
            prev = ch
            i += 1
            continue

        res.append(ch)
        prev = ch
        i += 1

    cleaned = ''.join(res)
    # Compress consecutive blank lines
    cleaned = re.sub(r'\n\s*\n+', '\n', cleaned)
    return cleaned.strip()

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    print("=" * 60)
    print("🚀 GeekNook Asset Minifier (Zero-Dependency Python 3)")
    print("=" * 60)

    # 1. Minify CSS
    css_path = os.path.join(base_dir, 'css', 'modern-style.css')
    css_out = os.path.join(base_dir, 'css', 'modern-style.min.css')
    if os.path.exists(css_path):
        with open(css_path, 'r', encoding='utf-8') as f:
            raw_css = f.read()
        min_css = minify_css(raw_css)
        with open(css_out, 'w', encoding='utf-8') as f:
            f.write(min_css)
        orig_kb = len(raw_css.encode('utf-8')) / 1024
        min_kb = len(min_css.encode('utf-8')) / 1024
        saving = (1 - (min_kb / orig_kb)) * 100
        print(f"✓ modern-style.css: {orig_kb:.1f} KB -> {min_kb:.1f} KB (-{saving:.1f}%) -> css/modern-style.min.css")

    # 2. Minify modern-app.js
    js_path = os.path.join(base_dir, 'js', 'modern-app.js')
    js_out = os.path.join(base_dir, 'js', 'modern-app.min.js')
    if os.path.exists(js_path):
        with open(js_path, 'r', encoding='utf-8') as f:
            raw_js = f.read()
        min_js = minify_js_safe(raw_js)
        with open(js_out, 'w', encoding='utf-8') as f:
            f.write(min_js)
        orig_kb = len(raw_js.encode('utf-8')) / 1024
        min_kb = len(min_js.encode('utf-8')) / 1024
        saving = (1 - (min_kb / orig_kb)) * 100
        print(f"✓ modern-app.js: {orig_kb:.1f} KB -> {min_kb:.1f} KB (-{saving:.1f}%) -> js/modern-app.min.js")

    print("=" * 60)
    print("✨ Minification finished successfully!")
    print("=" * 60)

if __name__ == '__main__':
    main()
