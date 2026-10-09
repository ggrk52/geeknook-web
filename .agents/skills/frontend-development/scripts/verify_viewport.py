import asyncio
import os
import sys
from playwright.async_api import async_playwright

async def verify_viewport(url):
    print(f"Starting automated viewport audit for: {url}")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        viewports = [
            (320, 568, 'iPhone 5/SE 1st Gen'),
            (375, 667, 'iPhone SE 2nd/3rd Gen'),
            (390, 844, 'iPhone 14/15'),
            (414, 896, 'iPhone XR/11'),
            (768, 1024, 'iPad Air/Pro')
        ]
        
        all_passed = True
        for w, h, name in viewports:
            page = await browser.new_page(viewport={'width': w, 'height': h})
            errors = []
            page.on('console', lambda msg: errors.append(msg.text) if msg.type == 'error' else None)
            page.on('pageerror', lambda exc: errors.append(str(exc)))
            
            await page.goto(url)
            await page.wait_for_timeout(1000)
            
            scroll_w = await page.evaluate('document.documentElement.scrollWidth')
            client_w = await page.evaluate('document.documentElement.clientWidth')
            body_scroll_w = await page.evaluate('document.body.scrollWidth')
            
            passed = (scroll_w == client_w == body_scroll_w) and (len(errors) == 0)
            status = "PASS" if passed else "FAIL"
            if not passed:
                all_passed = False
            print(f"[{status}] {name} ({w}x{h}): scrollW={scroll_w}, clientW={client_w}, bodyScrollW={body_scroll_w}, errors={len(errors)}")
            
            if not passed:
                overflowing = await page.evaluate("""() => {
                    const elements = [];
                    document.querySelectorAll('*').forEach(el => {
                        const rect = el.getBoundingClientRect();
                        if (rect.right > window.innerWidth + 1) {
                            elements.push({
                                tag: el.tagName,
                                id: el.id,
                                className: typeof el.className === 'string' ? el.className.slice(0, 40) : '',
                                right: Math.round(rect.right),
                                width: Math.round(rect.width)
                            });
                        }
                    });
                    return elements.slice(0, 5);
                }""")
                for el in overflowing:
                    print(f"    Overflow: <{el['tag']} id='{el['id']}' class='{el['className']}'> right={el['right']}")
            await page.close()
            
        await browser.close()
        if all_passed:
            print("ALL VIEWPORT TESTS PASSED: 0px overflow and 0 errors!")
        else:
            print("SOME TESTS FAILED!")
            sys.exit(1)

if __name__ == '__main__':
    default_url = 'file:///' + os.path.abspath('index.html').replace('\\', '/')
    target_url = sys.argv[1] if len(sys.argv) > 1 else default_url
    asyncio.run(verify_viewport(target_url))
