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
    res = []
    i = 0
    n = len(js_text)
    stack = []
    is_escaped = False
    last_non_ws = None

    while i < n:
        ch = js_text[i]
        current_state = stack[-1][0] if stack else None

        # 1. Inside single- or double-quoted strings
        if current_state in ('STR_SINGLE', 'STR_DOUBLE'):
            res.append(ch)
            if is_escaped:
                is_escaped = False
            elif ch == '\\':
                is_escaped = True
            elif (current_state == 'STR_SINGLE' and ch == "'") or (current_state == 'STR_DOUBLE' and ch == '"'):
                stack.pop()
                last_non_ws = ch
            i += 1
            continue

        # 2. Inside template literal string segments
        elif current_state == 'TEMPLATE':
            if is_escaped:
                res.append(ch)
                is_escaped = False
                i += 1
                continue
            elif ch == '\\':
                res.append(ch)
                is_escaped = True
                i += 1
                continue
            elif ch == '$' and i + 1 < n and js_text[i+1] == '{':
                res.append('${')
                stack.append(('EXPR', 0))
                last_non_ws = '{'
                i += 2
                continue
            elif ch == '`':
                res.append(ch)
                stack.pop()
                last_non_ws = '`'
                i += 1
                continue
            else:
                res.append(ch)
                i += 1
                continue

        # 3. Comments, regex literals, or division
        if ch == '/' and i + 1 < n:
            next_ch = js_text[i+1]
            if next_ch == '/':
                # Line comment
                i += 2
                while i < n and js_text[i] != '\n':
                    i += 1
                if i < n:
                    res.append('\n')
                    i += 1
                continue
            elif next_ch == '*':
                # Block comment
                i += 2
                while i + 1 < n and not (js_text[i] == '*' and js_text[i+1] == '/'):
                    i += 1
                i += 2
                continue
            else:
                # Distinguish regex literal from division
                is_regex = False
                if last_non_ws in (None, '(', '[', '{', ',', ';', ':', '?', '=', '!', '&', '|', '+', '-', '*', '%', '^', '~', '<', '>'):
                    is_regex = True
                elif isinstance(last_non_ws, str) and last_non_ws in ('return', 'typeof', 'case', 'throw', 'yield', 'await'):
                    is_regex = True

                if is_regex:
                    res.append(ch)
                    i += 1
                    in_char_class = False
                    reg_escaped = False
                    while i < n:
                        rc = js_text[i]
                        res.append(rc)
                        if reg_escaped:
                            reg_escaped = False
                        elif rc == '\\':
                            reg_escaped = True
                        elif rc == '[' and not in_char_class:
                            in_char_class = True
                        elif rc == ']' and in_char_class:
                            in_char_class = False
                        elif rc == '/' and not in_char_class:
                            i += 1
                            while i < n and js_text[i] in 'gimsuy':
                                res.append(js_text[i])
                                i += 1
                            break
                        i += 1
                    last_non_ws = '/'
                    continue

        # 4. Opening quotes
        if ch == "'":
            stack.append(('STR_SINGLE', 0))
            res.append(ch)
            last_non_ws = "'"
            i += 1
            continue
        elif ch == '"':
            stack.append(('STR_DOUBLE', 0))
            res.append(ch)
            last_non_ws = '"'
            i += 1
            continue
        elif ch == '`':
            stack.append(('TEMPLATE', 0))
            res.append(ch)
            last_non_ws = '`'
            i += 1
            continue

        # 5. Expressions inside template literals
        if current_state == 'EXPR':
            if ch == '{':
                state, d = stack.pop()
                stack.append((state, d + 1))
            elif ch == '}':
                state, d = stack.pop()
                if d == 0:
                    res.append(ch)
                    last_non_ws = '}'
                    i += 1
                    continue
                else:
                    stack.append((state, d - 1))

        if not ch.isspace():
            last_non_ws = ch

        res.append(ch)
        i += 1

    cleaned = ''.join(res)
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
