/**
 * GeekNook Module: Hardcore Engineering Suite
 * FEA finite element analysis stress lab, 360° stealth cable management, ISO 9241 ergonomics, and CAD portal.
 */
window.GeekNook = window.GeekNook || {};

  // --- 1. FEA STRESS TEST & SOLID MECHANICS LAB ---
  const feaState = {
    weightKg: 25,
    isShockTesting: false,
    shockStartTime: 0
  };

  const calculateFeaPhysics = (weightKg) => {
    const mass = Math.max(0, Math.min(85, Number(weightKg) || 0));
    const g = 9.81;
    const F = mass * g;
    const Leff = 0.72; // effective span between leg brackets
    const E = 12.5e9;  // Caucasian oak modulus 12.5 GPa
    const b = 0.23;    // beam width 230mm
    const h = 0.022;   // thickness 22mm
    const I = (b * Math.pow(h, 3)) / 12;

    const deltaMeters = (F * Math.pow(Leff, 3)) / (48 * E * I);
    const deltaMm = deltaMeters * 1000;

    const Mmax = (F * Leff) / 4;
    const sigmaPa = (Mmax * (h / 2)) / I;
    const sigmaMpa = sigmaPa / 1e6;

    const yieldStrengthMpa = 85.0;
    const safetyFactor = sigmaMpa > 0.1 ? (yieldStrengthMpa / sigmaMpa) : 99.9;

    return {
      mass,
      F,
      deltaMm: Number(deltaMm.toFixed(2)),
      sigmaMpa: Number(sigmaMpa.toFixed(1)),
      safetyFactor: Number(safetyFactor.toFixed(1))
    };
  };

  let feaAnimationReq = null;

  const renderFeaCanvas = () => {
    const canvas = document.getElementById('feaStressCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = rect.width || 900;
    const h = 260;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // Technical coordinate grid (millimeter rule background)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 25) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += 25) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    const { mass, deltaMm } = calculateFeaPhysics(feaState.weightKg);

    const beamY = 110;
    const beamHeight = 30;
    const padL = 90;
    const padR = w - 90;
    const beamW = padR - padL;
    const legW = 36;
    const legH = 80;

    // Draw Aircraft Aluminum D16T legs with bevels and Portuguese cork pads
    const drawLeg = (lx) => {
      // Cork foot pad (Portugal granulated cork with subtle texture)
      ctx.fillStyle = '#9a3412';
      ctx.fillRect(lx - 2, beamY + beamHeight + legH - 10, legW + 4, 10);
      ctx.fillStyle = '#b45309';
      for (let cx = lx; cx < lx + legW; cx += 5) {
        ctx.fillRect(cx + (cx % 3), beamY + beamHeight + legH - 8, 2, 2);
      }

      // Aluminum leg bracket (D16T satin anodized)
      const legGrad = ctx.createLinearGradient(lx, 0, lx + legW, 0);
      legGrad.addColorStop(0, '#1e293b');
      legGrad.addColorStop(0.25, '#475569');
      legGrad.addColorStop(0.5, '#64748b');
      legGrad.addColorStop(0.75, '#334155');
      legGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = legGrad;
      ctx.fillRect(lx, beamY + beamHeight, legW, legH - 10);

      // Chamfer stroke
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(lx, beamY + beamHeight, legW, legH - 10);

      // Hex mounting bolt M5
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.arc(lx + legW / 2, beamY + beamHeight + 14, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      ctx.stroke();
    };

    drawLeg(padL + 18);
    drawLeg(padR - 18 - legW);

    // Shock impulse vibration calculation
    let vibrationDelta = 0;
    const elapsedShock = feaState.shockStartTime ? (performance.now() - feaState.shockStartTime) / 1000 : 999;
    if (feaState.isShockTesting) {
      if (elapsedShock < 0.55) {
        // 25 Hz oscillation damped by cork with exponential decay
        vibrationDelta = Math.sin(elapsedShock * Math.PI * 2 * 25) * Math.exp(-elapsedShock * 9.2) * 20;
      } else {
        feaState.isShockTesting = false;
      }
    }

    const visualDeflection = (deltaMm * 18) + vibrationDelta;

    // Finite Elements: 56 slices along length x 8 vertical thickness layers
    const numSlices = 56;
    const numLayers = 8;
    const sliceWidth = beamW / numSlices;

    for (let i = 0; i < numSlices; i++) {
      const xNorm = (i + 0.5) / numSlices;
      const flexShape = Math.sin(xNorm * Math.PI);
      const currDeflection = visualDeflection * flexShape;

      for (let j = 0; j < numLayers; j++) {
        const yNorm = (j / (numLayers - 1)) * 2 - 1; // -1 (top compression) to +1 (bottom tension)
        const cellX = padL + i * sliceWidth;
        const cellY = beamY + (j * (beamHeight / numLayers)) + currDeflection;
        const cellH = (beamHeight / numLayers) + 0.6;

        // Stress profile: compression on top, tension on bottom
        const stressRatio = -yNorm * flexShape * Math.min(1, mass / 70);

        let color = '#10b981';
        if (stressRatio > 0.05) {
          const blueIntensity = Math.min(1, stressRatio * 1.6);
          color = `rgb(${Math.round(29 * (1 - blueIntensity))}, ${Math.round(78 + 90 * (1 - blueIntensity))}, ${Math.round(216 * blueIntensity + 100)})`;
        } else if (stressRatio < -0.05) {
          const redIntensity = Math.min(1, -stressRatio * 1.6);
          color = `rgb(${Math.round(239 * redIntensity + 16 * (1 - redIntensity))}, ${Math.round(185 * (1 - redIntensity * 0.7))}, 30)`;
        }

        ctx.fillStyle = color;
        ctx.fillRect(cellX, cellY, sliceWidth + 0.6, cellH);
      }
    }

    // Top surface curve highlight (clearcoat reflection)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let i = 0; i <= numSlices; i++) {
      const xNorm = i / numSlices;
      const flexShape = Math.sin(xNorm * Math.PI);
      const currDeflection = visualDeflection * flexShape;
      const px = padL + i * sliceWidth;
      const py = beamY + currDeflection;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Neutral axis dashed line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= numSlices; i++) {
      const xNorm = i / numSlices;
      const flexShape = Math.sin(xNorm * Math.PI);
      const currDeflection = visualDeflection * flexShape;
      const px = padL + i * sliceWidth;
      const py = beamY + (beamHeight / 2) + currDeflection;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Force vector and pulsating target ring
    if (mass > 0) {
      const centerX = w / 2;
      const centerY = beamY + visualDeflection;
      const arrowLen = 32 + Math.min(45, mass * 0.5);

      // Radar target ring on surface
      const pulseR = 9 + Math.sin(performance.now() * 0.006) * 3;
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(centerX, centerY, pulseR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#f59e0b';
      ctx.fillStyle = '#f59e0b';
      ctx.lineWidth = 2.5;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY - arrowLen);
      ctx.lineTo(centerX, centerY - 6);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(centerX - 6, centerY - 14);
      ctx.lineTo(centerX + 6, centerY - 14);
      ctx.lineTo(centerX, centerY - 4);
      ctx.closePath();
      ctx.fill();

      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = '#f59e0b';
      ctx.textAlign = 'center';
      ctx.fillText(`F = ${(mass * 9.81).toFixed(0)} N (${mass} кг)`, centerX, centerY - arrowLen - 8);
    }

    // High-Tech Vibration Oscilloscope in top-right corner
    const oscW = 210;
    const oscH = 75;
    const oscX = w - oscW - 14;
    const oscY = 12;

    ctx.fillStyle = 'rgba(10, 15, 26, 0.9)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(oscX, oscY, oscW, oscH, 8) : ctx.rect(oscX, oscY, oscW, oscH);
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Phosphor grid lines
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.lineWidth = 0.75;
    for (let gx = oscX + 26; gx < oscX + oscW; gx += 26) {
      ctx.beginPath(); ctx.moveTo(gx, oscY + 18); ctx.lineTo(gx, oscY + oscH - 6); ctx.stroke();
    }
    for (let gy = oscY + 22; gy < oscY + oscH; gy += 18) {
      ctx.beginPath(); ctx.moveTo(oscX + 6, gy); ctx.lineTo(oscX + oscW - 6, gy); ctx.stroke();
    }

    // Oscilloscope Header
    ctx.font = 'bold 9px monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'left';
    ctx.fillText('OSCILLOSCOPE // 25Hz CORK DAMPING', oscX + 8, oscY + 13);
    ctx.textAlign = 'right';
    ctx.fillStyle = feaState.isShockTesting ? '#ef4444' : '#10b981';
    ctx.fillText(feaState.isShockTesting ? '● SAMPLING' : '● DAMPED', oscX + oscW - 8, oscY + 13);

    // Waveform curve
    const midY = oscY + 45;
    const oscPlotW = oscW - 20;
    ctx.beginPath();
    ctx.strokeStyle = feaState.isShockTesting ? '#38bdf8' : '#10b981';
    ctx.lineWidth = 1.5;
    for (let ox = 0; ox <= oscPlotW; ox++) {
      const tSec = (ox / oscPlotW) * 0.45;
      const amp = Math.sin(tSec * Math.PI * 2 * 25) * Math.exp(-tSec * 9.5) * 20;
      const px = oscX + 10 + ox;
      const py = midY + amp;
      if (ox === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Sweep dot cursor if shock test active
    if (feaState.isShockTesting && elapsedShock < 0.45) {
      const dotX = oscX + 10 + (elapsedShock / 0.45) * oscPlotW;
      const dotY = midY + Math.sin(elapsedShock * Math.PI * 2 * 25) * Math.exp(-elapsedShock * 9.5) * 20;
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Oscilloscope footer
    ctx.font = '8px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'left';
    ctx.fillText('ζ = 0.38 (Пробка 2мм)', oscX + 10, oscY + oscH - 4);
    ctx.textAlign = 'right';
    ctx.fillText('Время: 0.14 с', oscX + oscW - 10, oscY + oscH - 4);

    if (feaState.isShockTesting) {
      feaAnimationReq = requestAnimationFrame(renderFeaCanvas);
    }
  };

  const updateFeaWeight = (val) => {
    feaState.weightKg = Number(val);
    const { deltaMm, sigmaMpa, safetyFactor } = calculateFeaPhysics(feaState.weightKg);

    const weightDisplay = document.getElementById('feaWeightDisplay');
    const slider = document.getElementById('feaWeightSlider');
    const deflEl = document.getElementById('feaDeflectionVal');
    const stressEl = document.getElementById('feaStressVal');
    const safetyEl = document.getElementById('feaSafetyVal');

    if (slider && Number(slider.value) !== feaState.weightKg) slider.value = feaState.weightKg;

    if (weightDisplay) {
      let desc = 'Легкая нагрузка';
      if (feaState.weightKg <= 10) desc = 'Монитор 24"';
      else if (feaState.weightKg <= 25) desc = 'Studio Display / Два экрана';
      else if (feaState.weightKg <= 50) desc = 'Два тяжелых моноблока';
      else desc = 'Вес взрослого человека';
      weightDisplay.textContent = `${feaState.weightKg} кг (${desc})`;
    }

    if (deflEl) deflEl.textContent = `${deltaMm} мм`;
    if (stressEl) stressEl.textContent = `${sigmaMpa} МПа`;
    if (safetyEl) {
      safetyEl.textContent = `${safetyFactor}x (${safetyFactor >= 4 ? 'Авиационный' : 'Стандарт'})`;
      safetyEl.style.color = safetyFactor >= 3 ? '#10b981' : '#f59e0b';
    }

    document.querySelectorAll('#feaPresetsRow .fea-preset-chip').forEach(chip => {
      const match = chip.textContent.includes(`${feaState.weightKg} кг`);
      chip.classList.toggle('active', match);
    });

    renderFeaCanvas();
  };

  const setFeaPreset = (weight) => {
    soundEngine.play('click');
    updateFeaWeight(weight);
  };

  const runFeaShockTest = () => {
    soundEngine.play('cart');
    feaState.isShockTesting = true;
    feaState.shockStartTime = performance.now();
    showToast('Дроп-тест: импульс 10 кг погашен пробковыми демпферами за 0.14 с!');
    if (feaAnimationReq) cancelAnimationFrame(feaAnimationReq);
    renderFeaCanvas();
  };

  const initFeaLab = () => {
    updateFeaWeight(feaState.weightKg);
  };

  // --- 2. GEEKNOOK 360° STEALTH CABLE MANAGEMENT & DESK WORKBENCH ---
  const cableState = {
    mode: 'magnetic', // 'magnetic' (Stealth Zen), 'chaos', 'xray'
    draggedPoint: null,
    draggedCable: null,
    mousePos: { x: 0, y: 0 },
    hoveredCable: null,
    hoveredPoint: null,
    cables: [],
    isInitialized: false,
    animFrame: null,
    devices: {
      monitor: true,
      macbook: true,
      iphone: true,
      screenbar: true
    },
    stealthProgress: 1.0, // 0 = full chaos, 1 = full stealth
    xrayProgress: 0.0,    // 0 = solid wood, 1 = blueprint glass
    keyboardProgress: 1.0,// 0 = out on desk, 1 = tucked under shelf
    snapSparks: [],
    simTick: 0
  };

  const updateCableMetrics = () => {
    const mode = cableState.mode;
    const noiseVal = document.getElementById('cableMetricNoise');
    const noiseBadge = document.getElementById('cableMetricNoiseBadge');
    const noiseDesc = document.getElementById('cableMetricNoiseDesc');

    const spaceVal = document.getElementById('cableMetricSpace');
    const spaceBadge = document.getElementById('cableMetricSpaceBadge');
    const spaceDesc = document.getElementById('cableMetricSpaceDesc');

    const hiddenVal = document.getElementById('cableMetricHidden');
    const hiddenBadge = document.getElementById('cableMetricHiddenBadge');
    const hiddenDesc = document.getElementById('cableMetricHiddenDesc');

    const holdVal = document.getElementById('cableMetricHold');
    const holdBadge = document.getElementById('cableMetricHoldBadge');
    const holdDesc = document.getElementById('cableMetricHoldDesc');

    let activeDevCount = 0;
    if (cableState.devices.monitor) activeDevCount++;
    if (cableState.devices.macbook) activeDevCount++;
    if (cableState.devices.iphone) activeDevCount++;
    if (cableState.devices.screenbar) activeDevCount++;

    if (mode === 'chaos') {
      if (noiseVal) noiseVal.textContent = '94%';
      if (noiseBadge) {
        noiseBadge.textContent = 'Критический хаос';
        noiseBadge.className = 'cable-metric-badge badge-bad';
      }
      if (noiseDesc) noiseDesc.textContent = 'Провода хаотично разбросаны по столу, мешают мыши и создают визуальный шум';

      if (spaceVal) spaceVal.textContent = '-38%';
      if (spaceBadge) {
        spaceBadge.textContent = 'Захламлено';
        spaceBadge.className = 'cable-metric-badge badge-bad';
      }
      if (spaceDesc) spaceDesc.textContent = 'Провода и адаптеры отнимают рабочее место перед экраном';

      if (hiddenVal) hiddenVal.textContent = `0 из ${activeDevCount}`;
      if (hiddenBadge) {
        hiddenBadge.textContent = 'Все на виду';
        hiddenBadge.className = 'cable-metric-badge badge-bad';
      }
      if (hiddenDesc) hiddenDesc.textContent = 'Кабели свисают с торца стола без какой-либо фиксации';

      if (holdVal) holdVal.textContent = '0 кгс';
      if (holdBadge) {
        holdBadge.textContent = 'Нет замка';
        holdBadge.className = 'cable-metric-badge badge-bad';
      }
      if (holdDesc) holdDesc.textContent = 'Опасность случайно задеть шнур ногой или пролить кофе';
    } else if (mode === 'xray') {
      if (noiseVal) noiseVal.textContent = '0%';
      if (noiseBadge) {
        noiseBadge.textContent = 'Скрытая инженерия';
        noiseBadge.className = 'cable-metric-badge badge-tech';
      }
      if (noiseDesc) noiseDesc.textContent = 'Двухканальный Т-паз физически разделяет 220V и высокоскоростные линии данных';

      if (spaceVal) spaceVal.textContent = '+40%';
      if (spaceBadge) {
        spaceBadge.textContent = 'Клиренс 90 мм';
        spaceBadge.className = 'cable-metric-badge badge-good';
      }
      if (spaceDesc) spaceDesc.textContent = 'Под полку легко помещается полноразмерная клавиатура и планшет';

      if (hiddenVal) hiddenVal.textContent = `${activeDevCount} канала`;
      if (hiddenBadge) {
        hiddenBadge.textContent = 'Экранировано';
        hiddenBadge.className = 'cable-metric-badge badge-tech';
      }
      if (hiddenDesc) hiddenDesc.textContent = 'Высокочастотные экраны кабелей исключают электромагнитные наводки';

      if (holdVal) holdVal.textContent = '4× N52';
      if (holdBadge) {
        holdBadge.textContent = 'Т-паз Д16Т';
        holdBadge.className = 'cable-metric-badge badge-tech';
      }
      if (holdDesc) holdDesc.textContent = 'Неодимовые муфты удерживают корд с силой до 12 Ньютонов';
    } else {
      // Stealth Mode (Default Zen)
      if (noiseVal) noiseVal.textContent = '0%';
      if (noiseBadge) {
        noiseBadge.textContent = 'Идеальный Дзен';
        noiseBadge.className = 'cable-metric-badge badge-good';
      }
      if (noiseDesc) noiseDesc.textContent = 'Все провода скрыты под полкой в алюминиевом профиле Т-паза';

      if (spaceVal) spaceVal.textContent = '+40%';
      if (spaceBadge) {
        spaceBadge.textContent = 'Клавиатура спрятана';
        spaceBadge.className = 'cable-metric-badge badge-good';
      }
      if (spaceDesc) spaceDesc.textContent = 'Клавиатура и мышь легко убираются в нишу под подставку (90 мм)';

      if (hiddenVal) hiddenVal.textContent = `${activeDevCount} из ${activeDevCount}`;
      if (hiddenBadge) {
        hiddenBadge.textContent = '100% Stealth';
        hiddenBadge.className = 'cable-metric-badge badge-good';
      }
      if (hiddenDesc) hiddenDesc.textContent = 'Кабели питания, Thunderbolt 4 и MagSafe полностью невидимы';

      if (holdVal) holdVal.textContent = '4× N52';
      if (holdBadge) {
        holdBadge.textContent = '1.2 кг на отрыв';
        holdBadge.className = 'cable-metric-badge badge-good';
      }
      if (holdDesc) holdDesc.textContent = 'Неодимовые фиксаторы надежно удерживают кабели в желобе';
    }
  };

  const toggleCableDevice = (deviceId) => {
    if (!cableState.devices.hasOwnProperty(deviceId)) return;
    cableState.devices[deviceId] = !cableState.devices[deviceId];
    soundEngine.play('click');

    const btnIdMap = {
      monitor: 'devToggleMonitor',
      macbook: 'devToggleMacbook',
      iphone: 'devToggleIPhone',
      screenbar: 'devToggleScreenbar'
    };

    const btn = document.getElementById(btnIdMap[deviceId]);
    if (btn) {
      btn.classList.toggle('active', cableState.devices[deviceId]);
    }

    const titles = {
      monitor: 'Studio Display 5K',
      macbook: 'MacBook Pro M3',
      iphone: 'iPhone MagSafe Stand',
      screenbar: 'Лампа ScreenBar'
    };

    showToast(`${titles[deviceId]}: ${cableState.devices[deviceId] ? 'подключен к сетапу ⚡' : 'отключен 🔌'}`);
    updateCableMetrics();
  };

  const initCableSimulator = () => {
    const canvas = document.getElementById('cablePhysicsCanvas');
    if (!canvas || cableState.isInitialized) return;
    cableState.isInitialized = true;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 1200;
    let height = 540;
    let dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        width = rect.width;
        height = rect.height;
      }
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });

    // 4 Authentic Setup Cables
    const cableConfigs = [
      {
        id: 'tb4',
        device: 'macbook',
        name: 'Thunderbolt 4 Pro (MacBook M3)',
        color: '#334155',
        weaveColor: '#64748b',
        sheenColor: 'rgba(56, 189, 248, 0.6)',
        photonColor: '#38bdf8',
        width: 6.5,
        ledColor: '#38bdf8',
        spec: '40 Gbps // 100W PD // Оплетка Kevlar // Ø6.5mm',
        segs: 26,
        // Relative anchors
        getChaosTargets: (w, h, sX, sW, sY) => {
          const isMob = w < 640;
          const sc = isMob ? Math.max(0.55, Math.min(0.85, w / 520)) : 1.0;
          const mbW = (isMob ? 85 : 100) * sc;
          const mbX = isMob ? (sX - mbW - 8) : (sX - 85);
          const p0 = { x: mbX + mbW - 2, y: h * (isMob ? 0.54 : 0.62) };
          const pEnd = { x: w * 0.44, y: sY + 16 };
          return [p0, { x: sX + 10, y: h * 0.72 }, { x: w * 0.35, y: h * 0.80 }, { x: w * 0.40, y: h * 0.68 }, pEnd];
        },
        getStealthTargets: (w, h, sX, sW, sY) => {
          const isMob = w < 640;
          const sc = isMob ? Math.max(0.55, Math.min(0.85, w / 520)) : 1.0;
          const mbW = (isMob ? 85 : 100) * sc;
          const mbX = isMob ? (sX - mbW - 8) : (sX - 85);
          const p0 = { x: mbX + mbW - 2, y: h * (isMob ? 0.54 : 0.62) };
          const p1 = { x: sX - 6, y: sY + 18 };
          const pEnd = { x: sX + sW * 0.22, y: sY + 16 };
          return [p0, p1, pEnd];
        }
      },
      {
        id: 'display',
        device: 'monitor',
        name: 'DisplayPort 2.1 (Studio Display 5K)',
        color: '#0f172a',
        weaveColor: '#1e293b',
        sheenColor: 'rgba(251, 191, 36, 0.6)',
        photonColor: '#fbbf24',
        width: 7.0,
        ledColor: '#fbbf24',
        spec: '5K Retina @ 120Hz // 80 Gbps // Экранирован // Ø7.0mm',
        segs: 24,
        getChaosTargets: (w, h, sX, sW, sY) => {
          // Drooping messily behind monitor and pooling onto tabletop
          const p0 = { x: w * 0.50, y: sY - 40 };
          const pEnd = { x: w * 0.48, y: sY + 36 };
          return [p0, { x: w * 0.53, y: sY + 12 }, { x: w * 0.55, y: h * 0.66 }, { x: w * 0.51, y: h * 0.68 }, pEnd];
        },
        getStealthTargets: (w, h, sX, sW, sY) => {
          // Perfectly straight drop behind the monitor stand into slot 2
          const p0 = { x: w * 0.50, y: sY - 40 };
          const pEnd = { x: w * 0.50, y: sY + 16 };
          return [p0, pEnd];
        }
      },
      {
        id: 'magsafe',
        device: 'iphone',
        name: 'MagSafe 3 Fast Charge (iPhone Stand)',
        color: '#e2e8f0',
        weaveColor: '#cbd5e1',
        sheenColor: 'rgba(16, 185, 129, 0.7)',
        photonColor: '#10b981',
        width: 4.8,
        ledColor: '#10b981',
        spec: '140W Qi2 Fast Charge // Силикон // Ø4.8mm',
        segs: 24,
        getChaosTargets: (w, h, sX, sW, sY) => {
          const isMob = w < 640;
          const sc = isMob ? Math.max(0.55, Math.min(0.85, w / 520)) : 1.0;
          const phW = 32 * sc;
          const phX = isMob ? (sX + sW + 8 + phW / 2) : (sX + sW + 45);
          const p0 = { x: phX, y: h * (isMob ? 0.54 : 0.64) };
          const pEnd = { x: sX + sW * 0.78, y: sY + 16 };
          return [p0, { x: sX + sW + 6, y: h * 0.74 }, { x: sX + sW - 15, y: h * 0.78 }, { x: sX + sW - 30, y: h * 0.65 }, pEnd];
        },
        getStealthTargets: (w, h, sX, sW, sY) => {
          const isMob = w < 640;
          const sc = isMob ? Math.max(0.55, Math.min(0.85, w / 520)) : 1.0;
          const phW = 32 * sc;
          const phX = isMob ? (sX + sW + 8 + phW / 2) : (sX + sW + 45);
          const p0 = { x: phX, y: h * (isMob ? 0.54 : 0.64) };
          const p1 = { x: sX + sW + 6, y: sY + 18 };
          const pEnd = { x: sX + sW * 0.78, y: sY + 16 };
          return [p0, p1, pEnd];
        }
      },
      {
        id: 'power',
        device: 'monitor',
        name: 'AC Mains 220V (Блок питания)',
        color: '#18181b',
        weaveColor: '#27272a',
        sheenColor: 'rgba(249, 115, 22, 0.5)',
        photonColor: '#f97316',
        width: 8.5,
        ledColor: '#f97316',
        spec: '220V 16A Заземление // Скрытый лоток-ложемент // Ø8.5mm',
        segs: 28,
        getChaosTargets: (w, h, sX, sW, sY) => {
          // Ugly dangling cord to the floor with power brick
          const p0 = { x: w * 0.08, y: h - 25 };
          const pEnd = { x: w * 0.38, y: sY + 16 };
          return [p0, { x: w * 0.16, y: h - 45 }, { x: w * 0.22, y: h * 0.70 }, { x: w * 0.30, y: sY + 35 }, pEnd];
        },
        getStealthTargets: (w, h, sX, sW, sY) => {
          // Concealed vertical run along the back leg into rear cradle
          const p0 = { x: w * 0.08, y: h - 25 };
          const p1 = { x: sX + 24, y: h * 0.58 };
          const pEnd = { x: sX + sW * 0.38, y: sY + 16 };
          return [p0, p1, pEnd];
        }
      }
    ];

    const buildCables = () => {
      const isMobile = width < 640;
      const shelfW = isMobile ? Math.min(width * 0.58, 300) : Math.min(Math.max(width * 0.60, 480), 760);
      const shelfX = (width - shelfW) / 2;
      const shelfY = height * 0.42;

      cableState.cables = cableConfigs.map(cfg => {
        const isChaos = cableState.mode === 'chaos';
        const rawPoints = isChaos
          ? cfg.getChaosTargets(width, height, shelfX, shelfW, shelfY)
          : cfg.getStealthTargets(width, height, shelfX, shelfW, shelfY);

        // Generate smooth sampled points
        const points = [];
        const n = cfg.segs;
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          const idx = t * (rawPoints.length - 1);
          const i0 = Math.floor(idx);
          const i1 = Math.min(i0 + 1, rawPoints.length - 1);
          const frac = idx - i0;

          const px = rawPoints[i0].x + (rawPoints[i1].x - rawPoints[i0].x) * frac;
          const py = rawPoints[i0].y + (rawPoints[i1].y - rawPoints[i0].y) * frac;

          points.push({
            x: px,
            y: py,
            oldX: px,
            oldY: py,
            targetX: px,
            targetY: py,
            pinned: i === 0 || i === n
          });
        }

        const constraints = [];
        for (let i = 0; i < n; i++) {
          const p1 = points[i];
          const p2 = points[i + 1];
          const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          constraints.push({ p1, p2, length: len });
        }

        return { ...cfg, points, constraints };
      });
    };
    buildCables();

    // Resize rebuild
    window.addEventListener('resize', () => {
      resize();
      buildCables();
    }, { passive: true });

    // Interactive pointer handling
    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    };

    canvas.addEventListener('mousedown', (e) => {
      const pos = getPos(e);
      cableState.mousePos = pos;
      let closest = null;
      let closestCable = null;
      let minDist = 40;

      cableState.cables.forEach(c => {
        if (!cableState.devices[c.device]) return;
        c.points.forEach(p => {
          if (p.pinned) return;
          const d = Math.hypot(p.x - pos.x, p.y - pos.y);
          if (d < minDist) {
            minDist = d;
            closest = p;
            closestCable = c;
          }
        });
      });

      cableState.draggedPoint = closest;
      cableState.draggedCable = closestCable;
      if (closest) soundEngine.play('click');
    });

    window.addEventListener('mousemove', (e) => {
      const pos = getPos(e);
      cableState.mousePos = pos;

      let hovered = null;
      let hoveredPt = null;
      let minHovDist = 32;

      cableState.cables.forEach(c => {
        if (!cableState.devices[c.device]) return;
        c.points.forEach(p => {
          const d = Math.hypot(p.x - pos.x, p.y - pos.y);
          if (d < minHovDist) {
            minHovDist = d;
            hovered = c;
            hoveredPt = p;
          }
        });
      });

      cableState.hoveredCable = hovered;
      cableState.hoveredPoint = hoveredPt;
    }, { passive: true });

    window.addEventListener('mouseup', () => {
      if (cableState.draggedPoint && cableState.draggedCable) {
        // If pulled near shelf T-track in Stealth or X-ray, trigger magnetic SNAP
        const shelfY = height * 0.42;
        if (cableState.mode !== 'chaos' && Math.abs(cableState.draggedPoint.y - (shelfY + 18)) < 60) {
          soundEngine.play('snap');
          // Emit spark burst
          for (let s = 0; s < 8; s++) {
            cableState.snapSparks.push({
              x: cableState.draggedPoint.x,
              y: cableState.draggedPoint.y,
              vx: (Math.random() - 0.5) * 6,
              vy: (Math.random() - 0.5) * 6,
              life: 1.0,
              color: '#38bdf8'
            });
          }
          showToast(`🧲 ${cableState.draggedCable.name} защелкнут в Т-паз N52!`);
        }
      }
      cableState.draggedPoint = null;
      cableState.draggedCable = null;
    });

    canvas.addEventListener('touchstart', (e) => {
      const pos = getPos(e);
      cableState.mousePos = pos;
      let closest = null;
      let closestCable = null;
      let minDist = 48;

      cableState.cables.forEach(c => {
        if (!cableState.devices[c.device]) return;
        c.points.forEach(p => {
          if (p.pinned) return;
          const d = Math.hypot(p.x - pos.x, p.y - pos.y);
          if (d < minDist) {
            minDist = d;
            closest = p;
            closestCable = c;
          }
        });
      });

      cableState.draggedPoint = closest;
      cableState.draggedCable = closestCable;
      if (closest) soundEngine.play('click');
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (!cableState.draggedPoint) return;
      if (e.cancelable) e.preventDefault();
      cableState.mousePos = getPos(e);
    }, { passive: false });

    window.addEventListener('touchend', () => {
      cableState.draggedPoint = null;
      cableState.draggedCable = null;
      cableState.hoveredCable = null;
      cableState.hoveredPoint = null;
    });

    // Main Simulation & Rendering Loop
    const stepPhysics = () => {
      cableState.simTick++;
      const isChaos = cableState.mode === 'chaos';
      const isXray = cableState.mode === 'xray';

      // Transition progress easing
      const targetStealth = isChaos ? 0 : 1;
      cableState.stealthProgress += (targetStealth - cableState.stealthProgress) * 0.12;

      const targetXray = isXray ? 1 : 0;
      cableState.xrayProgress += (targetXray - cableState.xrayProgress) * 0.12;

      const targetKeyboard = isChaos ? 0 : 1;
      cableState.keyboardProgress += (targetKeyboard - cableState.keyboardProgress) * 0.08;

      const isMobile = width < 640;
      const uiScale = isMobile ? Math.max(0.55, Math.min(0.85, width / 520)) : 1.0;
      const shelfW = isMobile ? Math.min(width * 0.58, 300) : Math.min(Math.max(width * 0.60, 480), 760);
      const shelfX = (width - shelfW) / 2;
      const shelfY = height * 0.42;

      // Update Cable target interpolation and physics
      cableState.cables.forEach(cable => {
        if (!cableState.devices[cable.device]) return;

        const chaosTargets = cable.getChaosTargets(width, height, shelfX, shelfW, shelfY);
        const stealthTargets = cable.getStealthTargets(width, height, shelfX, shelfW, shelfY);
        const n = cable.points.length - 1;

        cable.points.forEach((p, idx) => {
          if (p === cableState.draggedPoint) {
            p.x = cableState.mousePos.x;
            p.y = cableState.mousePos.y;
            p.oldX = p.x;
            p.oldY = p.y;
            return;
          }

          const t = idx / n;

          // Chaos target
          const cIdx = t * (chaosTargets.length - 1);
          const ci0 = Math.floor(cIdx);
          const ci1 = Math.min(ci0 + 1, chaosTargets.length - 1);
          const cFrac = cIdx - ci0;
          const cx = chaosTargets[ci0].x + (chaosTargets[ci1].x - chaosTargets[ci0].x) * cFrac;
          const cy = chaosTargets[ci0].y + (chaosTargets[ci1].y - chaosTargets[ci0].y) * cFrac;

          // Stealth target
          const sIdx = t * (stealthTargets.length - 1);
          const si0 = Math.floor(sIdx);
          const si1 = Math.min(si0 + 1, stealthTargets.length - 1);
          const sFrac = sIdx - si0;
          const sx = stealthTargets[si0].x + (stealthTargets[si1].x - stealthTargets[si0].x) * sFrac;
          const sy = stealthTargets[si0].y + (stealthTargets[si1].y - stealthTargets[si0].y) * sFrac;

          // Blend targets based on stealthProgress
          const tx = cx + (sx - cx) * cableState.stealthProgress;
          const ty = cy + (sy - cy) * cableState.stealthProgress;

          if (isChaos) {
            // In chaos: springy Verlet physics
            let vx = (p.x - p.oldX) * 0.96;
            let vy = (p.y - p.oldY) * 0.96;
            p.oldX = p.x;
            p.oldY = p.y;
            p.x += vx + (tx - p.x) * 0.08;
            p.y += vy + (ty - p.y) * 0.08 + 0.15; // gravity
          } else {
            // In stealth/x-ray: smooth magnetic rail lock
            p.x += (tx - p.x) * 0.18;
            p.y += (ty - p.y) * 0.18;
            p.oldX = p.x;
            p.oldY = p.y;
          }
        });

        // Verlet constraint relaxation (2 passes)
        if (isChaos) {
          for (let iter = 0; iter < 2; iter++) {
            cable.constraints.forEach(c => {
              const dx = c.p2.x - c.p1.x;
              const dy = c.p2.y - c.p1.y;
              const curDist = Math.hypot(dx, dy) || 1;
              const delta = (curDist - c.length) / curDist;
              if (!c.p1.pinned && c.p1 !== cableState.draggedPoint) {
                c.p1.x += dx * 0.4 * delta;
                c.p1.y += dy * 0.4 * delta;
              }
              if (!c.p2.pinned && c.p2 !== cableState.draggedPoint) {
                c.p2.x -= dx * 0.4 * delta;
                c.p2.y -= dy * 0.4 * delta;
              }
            });
          }
        }
      });

      // --- RENDERING CANVAS SCENE ---
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // 1. Studio Ambient Wall Backdrop & Grid
      const wallGrad = ctx.createLinearGradient(0, 0, 0, height);
      wallGrad.addColorStop(0, '#0c1017');
      wallGrad.addColorStop(0.45, '#131822');
      wallGrad.addColorStop(1, '#090d14');
      ctx.fillStyle = wallGrad;
      ctx.fillRect(0, 0, width, height);

      // Fine architectural grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 32) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
      }
      for (let y = 0; y < height; y += 32) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
      }

      // Soft ScreenBar task light glow cone
      if (cableState.devices.screenbar) {
        const lightGrad = ctx.createRadialGradient(width * 0.50, height * 0.16, 20, width * 0.50, height * 0.55, 340);
        lightGrad.addColorStop(0, 'rgba(254, 243, 199, 0.12)');
        lightGrad.addColorStop(0.5, 'rgba(254, 243, 199, 0.04)');
        lightGrad.addColorStop(1, 'rgba(254, 243, 199, 0)');
        ctx.fillStyle = lightGrad;
        ctx.beginPath();
        ctx.moveTo(width * 0.50 - 90, height * 0.18);
        ctx.lineTo(width * 0.50 + 90, height * 0.18);
        ctx.lineTo(width * 0.50 + 320, height * 0.85);
        ctx.lineTo(width * 0.50 - 320, height * 0.85);
        ctx.closePath();
        ctx.fill();
      }

      // 2. The Executive Tabletop (Wood surface in perspective)
      const tableY = height * 0.44;
      const deskBottom = height - 20;

      // Tabletop Wood Gradient
      const deskGrad = ctx.createLinearGradient(0, tableY, 0, deskBottom);
      deskGrad.addColorStop(0, '#1c2430');
      deskGrad.addColorStop(0.3, '#222c3b');
      deskGrad.addColorStop(0.85, '#161c27');
      deskGrad.addColorStop(1, '#0e1219');
      ctx.fillStyle = deskGrad;
      ctx.beginPath();
      ctx.moveTo(0, tableY);
      ctx.lineTo(width, tableY);
      ctx.lineTo(width, deskBottom);
      ctx.lineTo(0, deskBottom);
      ctx.closePath();
      ctx.fill();

      // Front Chamfer Bevel of Desk
      ctx.fillStyle = '#0a0d13';
      ctx.fillRect(0, deskBottom, width, 20);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, deskBottom); ctx.lineTo(width, deskBottom); ctx.stroke();

      // Wood Grain Lines on Tabletop
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
      ctx.lineWidth = 1;
      for (let gy = tableY + 20; gy < deskBottom; gy += 18) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.bezierCurveTo(width * 0.3, gy + 3, width * 0.7, gy - 2, width, gy + 1);
        ctx.stroke();
      }

      // 3. Felt Wool Desk Mat
      const matW = Math.min(width * 0.72, 840);
      const matX = (width - matW) / 2;
      const matY = tableY + 35;
      const matH = deskBottom - matY - 14;

      // Soft drop shadow without expensive shadowBlur
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(matX, matY + 4, matW, matH + 4, 10) : ctx.rect(matX, matY + 4, matW, matH + 4);
      ctx.fill();

      // Felt mat body
      ctx.fillStyle = '#171c26';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(matX, matY, matW, matH, 8) : ctx.rect(matX, matY, matW, matH);
      ctx.fill();

      // Mat stitch line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(matX + 4, matY + 4, matW - 8, matH - 8);
      ctx.setLineDash([]);

      // 4. Wall Outlet & Power Brick (Bottom Left)
      const wallX = width * 0.08;
      const wallY = height - 28;
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(wallX - 16, wallY - 12, 32, 24, 4) : ctx.rect(wallX - 16, wallY - 12, 32, 24);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.beginPath(); ctx.arc(wallX - 6, wallY, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(wallX + 6, wallY, 3, 0, Math.PI * 2); ctx.fill();

      // In Chaos mode: heavy power brick on floor
      if (isChaos) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(width * 0.16, height - 34, 46, 22);
        ctx.strokeStyle = '#334155';
        ctx.strokeRect(width * 0.16, height - 34, 46, 22);
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 7px monospace';
        ctx.fillText('140W BRICK', width * 0.16 + 4, height - 20);
      }

      // 5. RENDER CABLES (Underneath the shelf in Stealth, Over desk in Chaos)
      cableState.cables.forEach(cable => {
        if (!cableState.devices[cable.device]) return;
        const pts = cable.points;
        if (pts.length < 2) return;

        // Shadow pass (crisp offset without multi-pass Gaussian blur)
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y + 4);
        for (let i = 1; i < pts.length; i++) {
          const xc = (pts[i].x + pts[i - 1].x) / 2;
          const yc = (pts[i].y + pts[i - 1].y) / 2 + 4;
          ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y + 4, xc, yc);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y + 4);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.lineWidth = cable.width + 2;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Core Cable Jacket
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          const xc = (pts[i].x + pts[i - 1].x) / 2;
          const yc = (pts[i].y + pts[i - 1].y) / 2;
          ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, xc, yc);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.strokeStyle = cable.color;
        ctx.lineWidth = cable.width;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Braided Weave Texture
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          const xc = (pts[i].x + pts[i - 1].x) / 2;
          const yc = (pts[i].y + pts[i - 1].y) / 2;
          ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, xc, yc);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.strokeStyle = cable.weaveColor;
        ctx.lineWidth = cable.width * 0.45;
        ctx.stroke();
        ctx.restore();

        // Specular Crest Light
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y - cable.width * 0.15);
        for (let i = 1; i < pts.length; i++) {
          const xc = (pts[i].x + pts[i - 1].x) / 2;
          const yc = (pts[i].y + pts[i - 1].y) / 2 - cable.width * 0.15;
          ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y - cable.width * 0.15, xc, yc);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y - cable.width * 0.15);
        ctx.strokeStyle = cable.sheenColor;
        ctx.lineWidth = cable.width * 0.25;
        ctx.stroke();

        // X-Ray Animated Energy & Data Photon Pulses
        if (cableState.xrayProgress > 0.05) {
          ctx.save();
          ctx.globalAlpha = cableState.xrayProgress;
          const pulseSpeed = cable.id === 'tb4' ? 0.08 : 0.05;
          const pPhase = (cableState.simTick * pulseSpeed) % 1;

          for (let k = 0; k < 3; k++) {
            const frac = (pPhase + k * 0.33) % 1;
            const ptIdx = frac * (pts.length - 1);
            const p0 = pts[Math.floor(ptIdx)];
            const p1 = pts[Math.min(Math.floor(ptIdx) + 1, pts.length - 1)];
            const sub = ptIdx - Math.floor(ptIdx);
            const px = p0.x + (p1.x - p0.x) * sub;
            const py = p0.y + (p1.y - p0.y) * sub;

            const glow = ctx.createRadialGradient(px, py, 1, px, py, 10);
            glow.addColorStop(0, cable.photonColor);
            glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = glow;
            ctx.beginPath(); ctx.arc(px, py, 10, 0, Math.PI * 2); ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.arc(px, py, 2.5, 0, Math.PI * 2); ctx.fill();
          }
          ctx.restore();
        }

        // Metal Connectors at endpoints
        const drawPlug = (pt) => {
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(pt.x - 6, pt.y - 6, 12, 12, 2) : ctx.rect(pt.x - 6, pt.y - 6, 12, 12);
          ctx.fill();
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Glowing LED
          ctx.fillStyle = cable.ledColor;
          ctx.beginPath(); ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2); ctx.fill();
        };
        drawPlug(pts[0]);
        drawPlug(pts[pts.length - 1]);
      });

      // 6. Mechanical Keyboard & Mouse (Slides dynamically!)
      const kbW = 150 * uiScale;
      const kbH = 48 * uiScale;
      const kbTuckedY = shelfY + 12;
      const kbOutY = tableY + 95 * uiScale;
      const kbY = kbOutY + (kbTuckedY - kbOutY) * cableState.keyboardProgress;
      const kbX = width * 0.44;

      // Keyboard shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(kbX - kbW / 2, kbY + 3, kbW, kbH, 6) : ctx.rect(kbX - kbW / 2, kbY + 3, kbW, kbH);
      ctx.fill();

      // Keyboard base
      ctx.fillStyle = '#111620';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(kbX - kbW / 2, kbY, kbW, kbH, 5) : ctx.rect(kbX - kbW / 2, kbY, kbW, kbH);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Keycap rows
      ctx.fillStyle = '#1e293b';
      const kCols = isMobile ? 8 : 12;
      const kRows = 3;
      for (let r = 0; r < kRows; r++) {
        for (let c = 0; c < kCols; c++) {
          const kx = kbX - kbW / 2 + 6 * uiScale + c * (kbW / (kCols + 0.5));
          const ky = kbY + 5 * uiScale + r * (kbH / (kRows + 0.8));
          ctx.fillRect(kx, ky, 8 * uiScale, 7 * uiScale);
        }
      }

      // Mouse on the right
      const mouseX = isMobile ? kbX + kbW / 2 + 18 : kbX + kbW / 2 + 45;
      const mouseY = kbY + 4;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(mouseX - 10 * uiScale, mouseY, 20 * uiScale, 32 * uiScale, 8) : ctx.rect(mouseX - 10 * uiScale, mouseY, 20 * uiScale, 32 * uiScale);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.stroke();

      // 7. THE GEEKNOOK FOCUS STATION SHELF (Solid Oak / X-Ray Blueprint)
      const shelfThickness = 18;
      const legW = 24;
      const legH = 34;
      const leftLegX = shelfX + 24;
      const rightLegX = shelfX + shelfW - 24 - legW;

      // Aluminum D16T Legs
      const drawLeg = (lx) => {
        const legGrad = ctx.createLinearGradient(lx, shelfY + shelfThickness, lx + legW, shelfY + shelfThickness);
        legGrad.addColorStop(0, '#334155');
        legGrad.addColorStop(0.5, '#64748b');
        legGrad.addColorStop(1, '#1e293b');
        ctx.fillStyle = legGrad;
        ctx.fillRect(lx, shelfY + shelfThickness, legW, legH);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.strokeRect(lx, shelfY + shelfThickness, legW, legH);

        // Hex bolt
        ctx.fillStyle = '#0f172a';
        ctx.beginPath(); ctx.arc(lx + legW / 2, shelfY + shelfThickness + legH / 2, 3, 0, Math.PI * 2); ctx.fill();

        // Natural Cork foot pad
        ctx.fillStyle = '#b45309';
        ctx.fillRect(lx, shelfY + shelfThickness + legH - 4, legW, 4);
      };
      drawLeg(leftLegX);
      drawLeg(rightLegX);

      // Under-Shelf T-Track Aluminum Guide Rail (Revealed in X-Ray and partially in Stealth)
      const railH = 14;
      const railY = shelfY + shelfThickness;
      const railX = shelfX + 50;
      const railW = shelfW - 100;

      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(railX, railY, railW, railH, 3) : ctx.rect(railX, railY, railW, railH);
      ctx.fill();
      ctx.strokeStyle = cableState.xrayProgress > 0 ? '#38bdf8' : 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 4 Neodymium N52 magnetic brackets on the T-Track
      const slotRels = [0.22, 0.44, 0.62, 0.78];
      const slotLabels = ['N52-A', 'N52-B', 'N52-C', 'N52-D'];
      slotRels.forEach((rel, sIdx) => {
        const sx = shelfX + shelfW * rel;
        ctx.fillStyle = cableState.mode === 'chaos' ? '#334155' : '#0284c7';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(sx - 12, railY + 1, 24, railH - 2, 2) : ctx.rect(sx - 12, railY + 1, 24, railH - 2);
        ctx.fill();

        if (cableState.mode !== 'chaos') {
          // Magnet cyan pulse
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath(); ctx.arc(sx, railY + railH / 2, 2, 0, Math.PI * 2); ctx.fill();
        }

        if (cableState.xrayProgress > 0.3) {
          ctx.save();
          ctx.globalAlpha = cableState.xrayProgress;
          ctx.font = 'bold 7px monospace';
          ctx.fillStyle = '#38bdf8';
          ctx.textAlign = 'center';
          ctx.fillText(`🧲 ${slotLabels[sIdx]}`, sx, railY - 4);
          ctx.restore();
        }
      });

      // The Solid Oak Wood Shelf Plank
      // Drop shadow of shelf on desk (zero blur overhead)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(shelfX, shelfY + 8, shelfW, shelfThickness + 4, 6) : ctx.rect(shelfX, shelfY + 8, shelfW, shelfThickness + 4);
      ctx.fill();

      if (cableState.xrayProgress > 0.02) {
        // X-Ray Mode: Translucent glass blueprint with glowing edge
        ctx.fillStyle = `rgba(15, 23, 42, ${1 - cableState.xrayProgress * 0.75})`;
        ctx.strokeStyle = `rgba(56, 189, 248, ${0.4 + cableState.xrayProgress * 0.6})`;
        ctx.lineWidth = 1.5;
      } else {
        // Normal Solid Oak plank
        const oakGrad = ctx.createLinearGradient(shelfX, shelfY, shelfX, shelfY + shelfThickness);
        oakGrad.addColorStop(0, '#e5be82');
        oakGrad.addColorStop(0.3, '#d4a359');
        oakGrad.addColorStop(0.7, '#c69248');
        oakGrad.addColorStop(1, '#a6722e');
        ctx.fillStyle = oakGrad;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 1;
      }

      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(shelfX, shelfY, shelfW, shelfThickness, 4) : ctx.rect(shelfX, shelfY, shelfW, shelfThickness);
      ctx.fill();
      ctx.stroke();

      // Wood Grain Lines on the shelf top (if not fully X-ray)
      if (cableState.xrayProgress < 0.8) {
        ctx.save();
        ctx.globalAlpha = 1 - cableState.xrayProgress;
        ctx.strokeStyle = 'rgba(120, 70, 20, 0.22)';
        ctx.lineWidth = 1;
        for (let gx = shelfX + 20; gx < shelfX + shelfW - 20; gx += 45) {
          ctx.beginPath();
          ctx.moveTo(gx, shelfY + 2);
          ctx.bezierCurveTo(gx + 10, shelfY + 8, gx - 8, shelfY + 12, gx + 5, shelfY + shelfThickness - 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      // X-Ray center technical branding
      if (cableState.xrayProgress > 0.2) {
        ctx.save();
        ctx.globalAlpha = cableState.xrayProgress;
        ctx.font = 'bold 8px monospace';
        ctx.fillStyle = '#7dd3fc';
        ctx.textAlign = 'center';
        ctx.fillText('FOCUS STATION // INTERNAL T-TRACK CABLE TRAY & DUAL BUS', width * 0.50, shelfY + 11);
        ctx.restore();
      }

      // 8. THE DEVICES ON THE DESK

      // A. Studio Display 5K (Center, resting on Focus Station)
      if (cableState.devices.monitor) {
        const monW = 200 * uiScale;
        const monH = 125 * uiScale;
        const monX = width * 0.50 - monW / 2;
        const monY = shelfY - monH - 16 * uiScale;

        // Monitor Pedestal
        ctx.fillStyle = '#475569';
        ctx.fillRect(width * 0.50 - 14 * uiScale, shelfY - 16 * uiScale, 28 * uiScale, 16 * uiScale);
        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(width * 0.50 - 28 * uiScale, shelfY - 4, 56 * uiScale, 4, 2) : ctx.rect(width * 0.50 - 28 * uiScale, shelfY - 4, 56 * uiScale, 4);
        ctx.fill();

        // Monitor Frame & Screen Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(monX, monY + 4, monW, monH + 4, 8) : ctx.rect(monX, monY + 4, monW, monH + 4);
        ctx.fill();

        // Monitor Frame & Screen Body
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(monX, monY, monW, monH, 8) : ctx.rect(monX, monY, monW, monH);
        ctx.fill();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Screen Wallpaper
        const screenGrad = ctx.createLinearGradient(monX, monY, monX + monW, monY + monH);
        screenGrad.addColorStop(0, '#1e1b4b');
        screenGrad.addColorStop(0.5, '#4338ca');
        screenGrad.addColorStop(0.85, '#06b6d4');
        screenGrad.addColorStop(1, '#f43f5e');
        ctx.fillStyle = screenGrad;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(monX + 5, monY + 5, monW - 10, monH - 12, 4) : ctx.rect(monX + 5, monY + 5, monW - 10, monH - 12);
        ctx.fill();

        // Screen UI Clock & Status
        ctx.font = `bold ${Math.max(9, Math.round(11 * uiScale))}px system-ui, sans-serif`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.textAlign = 'center';
        ctx.fillText('10:42', width * 0.50, monY + 28 * uiScale);

        // ScreenBar Light atop Monitor
        if (cableState.devices.screenbar) {
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(width * 0.50 - 50 * uiScale, monY - 6 * uiScale, 100 * uiScale, 5 * uiScale, 2) : ctx.rect(width * 0.50 - 50 * uiScale, monY - 6 * uiScale, 100 * uiScale, 5 * uiScale);
          ctx.fill();
          ctx.strokeStyle = 'rgba(254, 243, 199, 0.6)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // B. MacBook Pro 16" (Left side on desk)
      if (cableState.devices.macbook) {
        const mbW = (isMobile ? 85 : 100) * uiScale;
        const mbH = (isMobile ? 56 : 70) * uiScale;
        const mbX = isMobile ? (shelfX - mbW - 8) : (shelfX - 85);
        const mbY = height * (isMobile ? 0.50 : 0.56);

        // Base Keyboard Deck
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(mbX, mbY + 36 * uiScale, mbW, 12 * uiScale, 3) : ctx.rect(mbX, mbY + 36 * uiScale, mbW, 12 * uiScale);
        ctx.fill();
        ctx.strokeStyle = '#475569';
        ctx.stroke();

        // Open Screen Lid
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(mbX + 4, mbY, mbW - 8, 36 * uiScale, 4) : ctx.rect(mbX + 4, mbY, mbW - 8, 36 * uiScale);
        ctx.fill();
        ctx.strokeStyle = '#64748b';
        ctx.stroke();

        // MacBook Screen Wallpaper
        const mbGrad = ctx.createLinearGradient(mbX, mbY, mbX + mbW, mbY + 36 * uiScale);
        mbGrad.addColorStop(0, '#0f766e');
        mbGrad.addColorStop(1, '#0284c7');
        ctx.fillStyle = mbGrad;
        ctx.fillRect(mbX + 6, mbY + 3, mbW - 12, 30 * uiScale);

        // MacBook MagSafe/TB4 Port
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(mbX + mbW - 3, mbY + 38 * uiScale, 3, 5 * uiScale);
      }

      // C. iPhone on MagSafe Stand (Right side on desk)
      if (cableState.devices.iphone) {
        const phW = 30 * uiScale;
        const phH = 46 * uiScale;
        const phX = isMobile ? (shelfX + shelfW + 8 + phW / 2) : (shelfX + shelfW + 45);
        const phY = height * (isMobile ? 0.48 : 0.54);

        // Sculpted Stand Pedestal
        ctx.fillStyle = '#475569';
        ctx.fillRect(phX - 3, phY + 32 * uiScale, 6, 22 * uiScale);
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(phX - 14 * uiScale, phY + 54 * uiScale, 28 * uiScale, 4, 2) : ctx.rect(phX - 14 * uiScale, phY + 54 * uiScale, 28 * uiScale, 4);
        ctx.fill();

        // iPhone Body shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(phX - phW / 2, phY + 4, phW, phH, 6) : ctx.rect(phX - phW / 2, phY + 4, phW, phH);
        ctx.fill();

        // iPhone Body in StandBy
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(phX - phW / 2, phY, phW, phH, 5) : ctx.rect(phX - phW / 2, phY, phW, phH);
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        ctx.stroke();

        // StandBy screen
        ctx.fillStyle = '#042f2e';
        ctx.fillRect(phX - phW / 2 + 2, phY + 2, phW - 4, phH - 4);
        ctx.fillStyle = '#10b981';
        ctx.font = `bold ${Math.max(7, Math.round(8 * uiScale))}px system-ui`;
        ctx.textAlign = 'center';
        ctx.fillText('⚡ 100%', phX, phY + phH * 0.55);
      }

      // 9. Magnetic Snap Spark Particles
      for (let i = cableState.snapSparks.length - 1; i >= 0; i--) {
        const spark = cableState.snapSparks[i];
        spark.x += spark.vx;
        spark.y += spark.vy;
        spark.life -= 0.04;

        ctx.fillStyle = spark.color;
        ctx.beginPath();
        ctx.arc(spark.x, spark.y, Math.max(spark.life * 3, 0.5), 0, Math.PI * 2);
        ctx.fill();

        if (spark.life <= 0) {
          cableState.snapSparks.splice(i, 1);
        }
      }

      // 10. Callout Warning / Success Badges
      if (isChaos) {
        // Red warnings in Chaos mode
        const drawWarning = (wx, wy, text) => {
          ctx.save();
          ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
          const bw = isMobile ? 220 : 150;
          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(wx - bw / 2, wy - 12, bw, 24, 12) : ctx.rect(wx - bw / 2, wy - 12, bw, 24);
          ctx.fill();
          ctx.strokeStyle = '#fca5a5';
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.font = 'bold 9px system-ui, sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.fillText(text, wx, wy + 4);
          ctx.restore();
        };

        if (isMobile) {
          drawWarning(width * 0.50, height * 0.86, '⚠️ Хаос: кабели свисают со стола');
        } else {
          drawWarning(width * 0.32, height * 0.78, '⚠️ Провод лежит на мышке');
          drawWarning(width * 0.72, height * 0.76, '⚠️ Кабель цепляет чашку');
        }
      } else if (!isXray) {
        // Green Zen Success Badges in Stealth mode
        const drawZen = (zx, zy, text) => {
          ctx.save();
          ctx.fillStyle = 'rgba(16, 185, 129, 0.88)';
          const bw = isMobile ? 220 : 160;
          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(zx - bw / 2, zy - 11, bw, 22, 11) : ctx.rect(zx - bw / 2, zy - 11, bw, 22);
          ctx.fill();
          ctx.strokeStyle = '#6ee7b7';
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.font = 'bold 9px system-ui, sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.fillText(text, zx, zy + 4);
          ctx.restore();
        };

        if (isMobile) {
          drawZen(width * 0.50, height * 0.86, '✓ Дзен: 100% кабелей спрятаны в лоток');
        } else {
          drawZen(width * 0.26, height * 0.78, '✓ Стол 100% свободен');
          drawZen(width * 0.74, height * 0.78, '✓ Все кабели убраны в Т-паз');
        }
      }

      // 11. Interactive Drag HUD & Telemetry Reticle
      if (cableState.draggedPoint && cableState.draggedCable) {
        const dp = cableState.draggedPoint;
        const dc = cableState.draggedCable;
        const tensionN = (Math.hypot(dp.x - dp.oldX, dp.y - dp.oldY) * 0.4).toFixed(1);

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(dp.x, dp.y, 14, 0, Math.PI * 2); ctx.stroke();

        // Tension readout card
        ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(dp.x + 18, dp.y - 20, 200, 40, 6) : ctx.rect(dp.x + 18, dp.y - 20, 200, 40);
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.stroke();

        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'left';
        ctx.fillText(dc.name.toUpperCase(), dp.x + 26, dp.y - 6);

        ctx.font = '9px monospace';
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText(`ТЯГА: ${tensionN} Н // СИЛА N52: 12 Н`, dp.x + 26, dp.y + 10);
      } else if (cableState.hoveredPoint && cableState.hoveredCable) {
        const hp = cableState.hoveredPoint;
        const hc = cableState.hoveredCable;

        ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(hp.x, hp.y, 10, 0, Math.PI * 2); ctx.stroke();

        ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(hp.x - 110, hp.y - 42, 220, 36, 6) : ctx.rect(hp.x - 110, hp.y - 42, 220, 36);
        ctx.fill();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.stroke();

        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'center';
        ctx.fillText(hc.name.toUpperCase(), hp.x, hp.y - 26);

        ctx.font = '8px monospace';
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText(hc.spec, hp.x, hp.y - 12);
      }

      if (!isCableVisible) {
        cableState.animFrame = null;
        return;
      }
      cableState.animFrame = requestAnimationFrame(stepPhysics);
    };

    let isCableVisible = true;
    if ('IntersectionObserver' in window) {
      const cableObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          isCableVisible = entry.isIntersecting && entry.intersectionRatio > 0;
          if (isCableVisible) {
            if (!cableState.animFrame) {
              cableState.animFrame = requestAnimationFrame(stepPhysics);
            }
          } else {
            if (cableState.animFrame) {
              cancelAnimationFrame(cableState.animFrame);
              cableState.animFrame = null;
            }
          }
        });
      }, { threshold: [0, 0.05] });
      cableObserver.observe(canvas.parentElement || canvas);
    }

    cableState.animFrame = requestAnimationFrame(stepPhysics);
    updateCableMetrics();
  };

  const setCableMode = (mode) => {
    cableState.mode = mode;
    soundEngine.play(mode === 'magnetic' ? 'snap' : (mode === 'xray' ? 'whoosh' : 'toggle'));

    const chaosBtn = document.getElementById('cableModeChaosBtn');
    const magneticBtn = document.getElementById('cableModeMagneticBtn');
    const xrayBtn = document.getElementById('cableModeXrayBtn');

    if (chaosBtn) chaosBtn.classList.toggle('active', mode === 'chaos');
    if (magneticBtn) magneticBtn.classList.toggle('active', mode === 'magnetic');
    if (xrayBtn) xrayBtn.classList.toggle('active', mode === 'xray');

    const statusPill = document.getElementById('cableStatusPill');
    const statusText = document.getElementById('cableStatusText');

    if (statusPill) {
      statusPill.classList.remove('magnetic', 'xray');
      if (mode === 'magnetic') statusPill.classList.add('magnetic');
      if (mode === 'xray') statusPill.classList.add('xray');
    }

    if (mode === 'magnetic') {
      if (statusText) statusText.textContent = '🧲 T-Track замок: 4 канала зафиксированы';
      showToast('✨ GeekNook Stealth: Все кабели уложены в скрытый магнитный желоб!');
    } else if (mode === 'xray') {
      if (statusText) statusText.textContent = '👁️ Рентген лотка: Разделение шин 220V и данных';
      showToast('👁️ Инженерный Рентген: внутренняя архитектура Т-паза и потоки данных');
    } else {
      if (statusText) statusText.textContent = 'Свободное провисание (Хаос на столе)';
      showToast('🌪️ Режим без GeekNook: хаос проводов на рабочей поверхности стола');
    }

    updateCableMetrics();
  };

  const shakeCables = () => {
    soundEngine.play('snap');
    cableState.cables.forEach(c => {
      c.points.forEach(p => {
        if (!p.pinned) {
          p.x += (Math.random() - 0.5) * 80;
          p.y += (Math.random() - 0.5) * 70;
        }
      });
    });
    // Add sparks
    if (cableState.cables.length > 0) {
      const p = cableState.cables[0].points[10];
      if (p) {
        for (let i = 0; i < 10; i++) {
          cableState.snapSparks.push({
            x: p.x + (Math.random() - 0.5) * 60,
            y: p.y + (Math.random() - 0.5) * 40,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            life: 1.0,
            color: '#38bdf8'
          });
        }
      }
    }
    showToast('⚡ Импульс: проверка упругости оплетки и неодимовых магнитов');
  };

  // --- ERGONOMICS POSTURE CALCULATOR (ISO 9241-5) ---
  const ergoState = {
    heightCm: 178,
    deskCm: 75,
    monitorDiag: 27
  };

  const openErgonomicsCalculator = () => {
    updateErgonomicsCalc();
    modalManager.open('ergonomicsModal');
    soundEngine.play('click');
  };

  const selectErgoMonitor = (diag) => {
    ergoState.monitorDiag = Number(diag) || 27;
    document.querySelectorAll('#ergoMonitorChips .ergo-chip').forEach(chip => {
      if (Number(chip.getAttribute('data-diag')) === ergoState.monitorDiag) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });
    updateErgonomicsCalc();
    soundEngine.play('click');
  };

  const updateErgonomicsCalc = () => {
    const heightEl = document.getElementById('ergoUserHeight');
    const deskEl = document.getElementById('ergoDeskHeight');
    const heightDisplay = document.getElementById('ergoUserHeightDisplay');
    const deskDisplay = document.getElementById('ergoDeskHeightDisplay');

    if (heightEl) ergoState.heightCm = Number(heightEl.value) || 178;
    if (deskEl) ergoState.deskCm = Number(deskEl.value) || 75;

    if (heightDisplay) heightDisplay.textContent = `${ergoState.heightCm} см`;
    if (deskDisplay) deskDisplay.textContent = `${ergoState.deskCm} см`;

    // Ergonomic ISO 9241 formula
    const seatedEyeLevelFromFloor = Math.round((ergoState.heightCm * 0.43) + 42);
    const monitorBaseHeights = { 24: 36, 27: 41, 32: 45, 34: 43 };
    const monitorHeightFromDesk = monitorBaseHeights[ergoState.monitorDiag] || 41;
    const currentTopBezelFromFloor = ergoState.deskCm + monitorHeightFromDesk;

    const deltaCm = seatedEyeLevelFromFloor - currentTopBezelFromFloor;
    const recommendedLift = Math.max(7, Math.min(12, Math.round(deltaCm > 0 ? deltaCm : 9)));

    const rawNeckTiltDeg = Math.round(Math.max(12, (ergoState.heightCm - 160) * 0.5 + (75 - ergoState.deskCm) * 0.4));
    const spineLoadKg = Math.round(rawNeckTiltDeg * 0.65 + 4);

    const eyeValEl = document.getElementById('ergoEyeLevelVal');
    const liftValEl = document.getElementById('ergoLiftDeltaVal');
    const neckValEl = document.getElementById('ergoNeckAngleVal');
    const textEl = document.getElementById('ergoRecommendationText');

    if (eyeValEl) eyeValEl.textContent = `${seatedEyeLevelFromFloor} см`;
    if (liftValEl) liftValEl.textContent = `+${recommendedLift}.0 см`;
    if (neckValEl) neckValEl.textContent = `0–3° (Норма)`;

    if (textEl) {
      textEl.innerHTML = `Без подставки при вашем росте (${ergoState.heightCm} см) угол наклона головы составляет <strong>${rawNeckTiltDeg}°</strong>, создавая статическое давление до <strong>${spineLoadKg} кг</strong> на шейные позвонки C1–C7. Подставка Focus Station высотой 9 см выравнивает линию взгляда строго по ISO 9241, разгружая плечевой пояс.`;
    }
  };

  const applyErgonomicsRecommendation = () => {
    closeModal('ergonomicsModal');
    openConfigurator();
    soundEngine.play('click');
    showToast('Параметры эргономики применены к конфигуратору!');
  };

  // --- 3D CAD LIBRARY & B2B ASSET DOWNLOAD ---
  const openCadModal = () => {
    modalManager.open('cadLibraryModal');
    soundEngine.play('click');
  };

  const downloadCadAsset = (filename) => {
    soundEngine.play('click');
    const dummyBlob = new Blob([
      `GEEKNOOK ENGINEERING ASSET: ${filename}\nDate: ${new Date().toISOString()}\nCAD Standard: ISO-9241 / STEP AP214 / PBR glTF\nManufacturer: GEEK NOOK (Moscow, Russia)\nWebsite: https://geeknook.ru`
    ], { type: 'text/plain' });
    const url = URL.createObjectURL(dummyBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Файл «${filename}» загружен!`, 'success');
  };

  const handleB2bSubmit = (e) => {
    e.preventDefault();
    soundEngine.play('cart');
    const company = document.getElementById('b2bCompany')?.value || 'Компания';
    closeModal('cadLibraryModal');
    showToast(`Запрос для «${escapeHTML(company)}» принят! КП отправлено на email.`, 'success');
  };

  // --- SETUP MATCHER (Инженерный примерщик мониторов) ---
  const matcherState = {
    deskWidth: 140,
    monitorSetup: 'single-27'
  };

  const MONITOR_SETUPS = {
    'single-24': { label: '1x 24"', widthMm: 540, count: 1, desc: 'Компактный монитор' },
    'single-27': { label: '1x 27"', widthMm: 610, count: 1, desc: 'Золотой стандарт' },
    'single-34': { label: '1x 34" UW', widthMm: 810, count: 1, desc: 'Ultrawide' },
    'dual-24': { label: '2x 24" Dual', widthMm: 1080, count: 2, desc: 'Два монитора 24"' },
    'dual-27': { label: '2x 27" Dual', widthMm: 1220, count: 2, desc: 'Два монитора 27"' },
    'mac-27': { label: 'MacBook + 27"', widthMm: 930, count: 2, desc: 'Ноутбук + 27" дисплей' }
  };

  const initSetupMatcher = () => {
    const svgWrap = document.getElementById('matcherSvgWrap');
    if (svgWrap) {
      renderMatcherVisualizer();
    }
  };

  const openSetupMatcher = () => {
    modalManager.open('setupMatcherModal');
    renderMatcherVisualizer();
  };

  const selectMatcherDeskWidth = (widthCm) => {
    matcherState.deskWidth = parseInt(widthCm, 10) || 140;
    document.querySelectorAll('#deskWidthChips .matcher-chip').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.width, 10) === matcherState.deskWidth);
    });
    renderMatcherVisualizer();
  };

  const selectMatcherMonitor = (setupKey) => {
    if (!MONITOR_SETUPS[setupKey]) return;
    matcherState.monitorSetup = setupKey;
    document.querySelectorAll('#monitorSetupChips .matcher-chip').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.setup === setupKey);
    });
    renderMatcherVisualizer();
  };

  const renderMatcherVisualizer = () => {
    const svgWrap = document.getElementById('matcherSvgWrap');
    const specsRow = document.getElementById('matcherSpecsRow');
    const recEl = document.getElementById('matcherRecommendation');
    if (!svgWrap || !specsRow) return;

    const deskWidthMm = matcherState.deskWidth * 10;
    const mon = MONITOR_SETUPS[matcherState.monitorSetup];
    const monWidthMm = mon.widthMm;

    const recommendedShelfMm = monWidthMm >= 800 ? 1150 : 900;
    const recommendedShelfName = recommendedShelfMm === 1150 ? 'Focus Station 1150 (115 см)' : 'Focus Station 900 (85-90 см)';
    const remainingSideCm = Math.max(0, Math.round(((deskWidthMm - Math.max(recommendedShelfMm, monWidthMm)) / 2) / 10));

    const svgW = 860;
    const svgH = 200;
    const padX = 40;
    const availableW = svgW - padX * 2;
    const scale = availableW / deskWidthMm;

    const deskPx = deskWidthMm * scale;
    const deskX = padX;
    const deskY = 158;
    const deskH = 22;

    const shelfPx = recommendedShelfMm * scale;
    const shelfX = deskX + (deskPx - shelfPx) / 2;
    const shelfY = 120;
    const shelfH = 14;
    const legsH = 24;

    const monPx = monWidthMm * scale;
    const monX = deskX + (deskPx - monPx) / 2;
    const monY = 28;
    const monH = 80;

    let monitorsSvg = '';
    if (mon.count === 1) {
      monitorsSvg = `
        <rect x="${monX + monPx / 2 - 10}" y="${monY + monH}" width="20" height="${shelfY - (monY + monH)}" fill="#334155" rx="2"/>
        <rect x="${monX + monPx / 2 - 35}" y="${shelfY - 4}" width="70" height="6" fill="#1e293b" rx="2"/>
        <rect x="${monX}" y="${monY}" width="${monPx}" height="${monH}" rx="6" fill="#0f172a" stroke="#3b82f6" stroke-width="2"/>
        <rect x="${monX + 4}" y="${monY + 4}" width="${monPx - 8}" height="${monH - 8}" rx="4" fill="#1e293b" opacity="0.8"/>
        <text x="${monX + monPx / 2}" y="${monY + monH / 2 + 5}" fill="#94a3b8" font-family="monospace" font-size="12" font-weight="bold" text-anchor="middle">${mon.label}</text>
      `;
    } else if (matcherState.monitorSetup === 'mac-27') {
      const macW = 280 * scale;
      const screen27W = 610 * scale;
      const gap = 12 * scale;
      const totalW = macW + gap + screen27W;
      const startX = deskX + (deskPx - totalW) / 2;

      monitorsSvg = `
        <rect x="${startX}" y="${monY + 24}" width="${macW}" height="${monH - 24}" rx="4" fill="#1e293b" stroke="#64748b" stroke-width="1.8"/>
        <text x="${startX + macW / 2}" y="${monY + 60}" fill="#94a3b8" font-family="monospace" font-size="11" text-anchor="middle">MacBook</text>
        <rect x="${startX + macW + gap + screen27W / 2 - 10}" y="${monY + monH}" width="20" height="${shelfY - (monY + monH)}" fill="#334155"/>
        <rect x="${startX + macW + gap}" y="${monY}" width="${screen27W}" height="${monH}" rx="6" fill="#0f172a" stroke="#3b82f6" stroke-width="2"/>
        <text x="${startX + macW + gap + screen27W / 2}" y="${monY + monH / 2 + 5}" fill="#94a3b8" font-family="monospace" font-size="12" font-weight="bold" text-anchor="middle">27" Display</text>
      `;
    } else {
      const singleW = (monPx - 10 * scale) / 2;
      const m1X = monX;
      const m2X = monX + singleW + 10 * scale;
      monitorsSvg = `
        <rect x="${m1X + singleW / 2 - 8}" y="${monY + monH}" width="16" height="${shelfY - (monY + monH)}" fill="#334155"/>
        <rect x="${m1X}" y="${monY}" width="${singleW}" height="${monH}" rx="5" fill="#0f172a" stroke="#3b82f6" stroke-width="2"/>
        <text x="${m1X + singleW / 2}" y="${monY + monH / 2 + 5}" fill="#94a3b8" font-family="monospace" font-size="11" text-anchor="middle">${mon.label.split(' ')[0]}</text>
        <rect x="${m2X + singleW / 2 - 8}" y="${monY + monH}" width="16" height="${shelfY - (monY + monH)}" fill="#334155"/>
        <rect x="${m2X}" y="${monY}" width="${singleW}" height="${monH}" rx="5" fill="#0f172a" stroke="#3b82f6" stroke-width="2"/>
        <text x="${m2X + singleW / 2}" y="${monY + monH / 2 + 5}" fill="#94a3b8" font-family="monospace" font-size="11" text-anchor="middle">${mon.label.split(' ')[0]}</text>
      `;
    }

    svgWrap.innerHTML = `
      <svg viewBox="0 0 ${svgW} ${svgH}" width="100%" height="190" preserveAspectRatio="xMidYMid meet">
        <!-- Desk Top Plate -->
        <rect x="${deskX}" y="${deskY}" width="${deskPx}" height="${deskH}" rx="4" fill="#1e2532" stroke="#334155" stroke-width="1.5"/>
        <text x="${deskX + 16}" y="${deskY + 15}" fill="#64748b" font-family="monospace" font-size="10" font-weight="bold">СТОЛ ${matcherState.deskWidth} СМ</text>

        <!-- Monitors -->
        ${monitorsSvg}

        <!-- GeekNook Focus Station Shelf -->
        <rect x="${shelfX + 22}" y="${shelfY + shelfH}" width="14" height="${legsH}" rx="2" fill="#0f172a" stroke="#475569" stroke-width="1.2"/>
        <rect x="${shelfX + shelfPx - 36}" y="${shelfY + shelfH}" width="14" height="${legsH}" rx="2" fill="#0f172a" stroke="#475569" stroke-width="1.2"/>
        <rect x="${shelfX}" y="${shelfY}" width="${shelfPx}" height="${shelfH}" rx="3" fill="#2563eb" stroke="#60a5fa" stroke-width="1.5"/>
        <text x="${shelfX + shelfPx / 2}" y="${shelfY + 11}" fill="#ffffff" font-family="monospace" font-size="10" font-weight="bold" text-anchor="middle">GEEKNOOK ${recommendedShelfMm} ММ</text>

        <!-- Dimension Arrow lines -->
        <line x1="${shelfX}" y1="${shelfY - 6}" x2="${shelfX + shelfPx}" y2="${shelfY - 6}" stroke="#60a5fa" stroke-width="1.2" stroke-dasharray="3 3"/>
        <text x="${shelfX + shelfPx / 2}" y="${shelfY - 10}" fill="#60a5fa" font-family="monospace" font-size="10" text-anchor="middle">↔ ${recommendedShelfMm} мм</text>

        <line x1="${deskX}" y1="${deskY + deskH + 10}" x2="${deskX + deskPx}" y2="${deskY + deskH + 10}" stroke="#94a3b8" stroke-width="1.2"/>
        <text x="${deskX + deskPx / 2}" y="${deskY + deskH + 22}" fill="#94a3b8" font-family="monospace" font-size="10" text-anchor="middle">Ширина столешницы: ${matcherState.deskWidth} см</text>
      </svg>
    `;

    specsRow.innerHTML = `
      <div class="matcher-spec-col">
        <div class="matcher-spec-title">Ширина столешницы</div>
        <div class="matcher-spec-val">${matcherState.deskWidth} см</div>
      </div>
      <div class="matcher-spec-col">
        <div class="matcher-spec-title">Размах мониторов</div>
        <div class="matcher-spec-val">${Math.round(monWidthMm / 10)} см</div>
      </div>
      <div class="matcher-spec-col">
        <div class="matcher-spec-title">Свободно по бокам</div>
        <div class="matcher-spec-val highlight">${remainingSideCm} см с каждой стороны</div>
      </div>
    `;

    if (recEl) {
      recEl.innerHTML = `Рекомендуемая модель: <strong>${recommendedShelfName}</strong> — идеальный баланс рабочей зоны.`;
    }
  };

  const applyMatcherToConfigurator = () => {
    const mon = MONITOR_SETUPS[matcherState.monitorSetup];
    const targetLen = (mon && mon.widthMm >= 800) ? '115' : '85';
    closeModal('setupMatcherModal');
    openConfigurator();
    selectConfigLength(targetLen);
    showToast(`Выбрана длина подставки ${targetLen} см под ваш сетап!`, 'success');
  };


window.GeekNook.engineeringLab = {
  calculateFeaPhysics,
  renderFeaCanvas,
  updateFeaWeight,
  setFeaPreset,
  runFeaShockTest,
  initFeaLab,
  initCableSimulator,
  cableState,
  setCableMode,
  shakeCables,
  toggleCableDevice,
  updateCableMetrics,
  openErgonomicsCalculator,
  selectErgoMonitor,
  updateErgonomicsCalc,
  applyErgonomicsRecommendation,
  openCadModal,
  downloadCadAsset,
  handleB2bSubmit,
  openSetupMatcher,
  selectMatcherDeskWidth,
  selectMatcherMonitor,
  applyMatcherToConfigurator
};
