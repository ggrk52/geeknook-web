const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT_DIR = '/Users/sergejzatovka/.gemini/antigravity/brain/7292da22-d4dd-43a6-b710-07c4cf4f5933';
const TMP_FRAMES = path.resolve('tmp_scroll_demo_frames');

(async () => {
  fs.rmSync(TMP_FRAMES, { recursive: true, force: true });
  fs.mkdirSync(TMP_FRAMES, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    executablePath: fs.existsSync(CHROME_PATH) ? CHROME_PATH : undefined
  });

  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('file://' + path.resolve('test-scroll-assembly.html'), { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => document.fonts && document.fonts.ready);

  const track = await page.evaluate(() => {
    const el = document.getElementById('assemblyTrack');
    const r = el.getBoundingClientRect();
    return { top: r.top + window.scrollY, height: el.offsetHeight };
  });

  // Animation timeline (total 6.0s at 30 FPS = 180 frames)
  const fps = 30;
  const totalFrames = 180;
  const startY = track.top - 200;
  const totalScrollable = track.height - 800;

  console.log(`[Record] Capturing ${totalFrames} frames of scroll assembly demo...`);

  for (let i = 0; i < totalFrames; i++) {
    const t = i / totalFrames; // 0.0 to 1.0
    // Smooth easeInOut curve for scroll travel
    const easeT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const curScrollY = startY + (totalScrollable + 300) * easeT;

    await page.evaluate((y) => window.scrollTo(0, y), curScrollY);
    await page.waitForTimeout(16);

    const framePath = path.join(TMP_FRAMES, `f_${String(i).padStart(4, '0')}.jpg`);
    await page.screenshot({ path: framePath, quality: 90 });
  }

  await browser.close();

  // Encode with FFmpeg
  const outMp4 = path.join(OUT_DIR, 'scroll_assembly_demo.mp4');
  spawnSync('ffmpeg', [
    '-y',
    '-framerate', String(fps),
    '-i', path.join(TMP_FRAMES, 'f_%04d.jpg'),
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-crf', '18',
    outMp4
  ], { stdio: 'inherit' });

  fs.rmSync(TMP_FRAMES, { recursive: true, force: true });
  console.log(`[Record] Scroll Assembly demo video saved -> ${outMp4}`);
})();
