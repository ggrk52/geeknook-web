const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ARTIFACTS_DIR = '/Users/sergejzatovka/.gemini/antigravity/brain/7292da22-d4dd-43a6-b710-07c4cf4f5933';

function run(cmd, args) {
  console.log(`[Batch] Running: ${cmd} ${args.join(' ')}`);
  const res = spawnSync(cmd, args, { stdio: 'inherit' });
  if (res.status !== 0) {
    throw new Error(`Command failed with status ${res.status}`);
  }
}

// 1. Render Vertical 9:16
run('node', ['.agents/skills/code-motion/scripts/render.js', 'full', 'motion/focus-station-vertical/teaser_vertical.html', '5.8', '60']);
fs.copyFileSync(
  'motion/focus-station-vertical/out/teaser_vertical_master.mp4',
  path.join(ARTIFACTS_DIR, 'focus_station_vertical_master_60fps.mp4')
);
console.log('[Batch] Copied vertical master to artifacts.');

// 2. Render Desk Mat 16:9
run('node', ['.agents/skills/code-motion/scripts/render.js', 'full', 'motion/desk-mat-teaser/teaser_mat.html', '5.8', '60']);
fs.copyFileSync(
  'motion/desk-mat-teaser/out/teaser_mat_master.mp4',
  path.join(ARTIFACTS_DIR, 'desk_mat_light_master_60fps.mp4')
);
console.log('[Batch] Copied desk mat master to artifacts.');

console.log('[Batch] All renders completed and synced to artifacts!');
