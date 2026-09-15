/**
 * GeekNook Module: Three.js 3D Studio & Shaders
 * Procedural photorealistic wood texture generation, interactive 3D workbench configurator, and antigravity hero sphere.
 */
window.GeekNook = window.GeekNook || {};

  // --- CONFIGURATOR WORKBENCH ---
  const openConfigurator = () => {
    renderConfiguratorUI();
    modalManager.open('configuratorModal');
  };

  const triggerPricePulse = () => {
    const priceEl = document.getElementById('modalConfigTotalPrice');
    if (!priceEl) return;
    priceEl.classList.remove('price-pulse');
    void priceEl.offsetWidth;
    priceEl.classList.add('price-pulse');
  };

  const renderConfiguratorUI = () => {
    const finish = GEEKNOOK_DATA.configurator.finishes.find(f => f.id === state.config.finishId) || GEEKNOOK_DATA.configurator.finishes[0];
    const length = GEEKNOOK_DATA.configurator.lengths.find(l => l.id === state.config.lengthId) || GEEKNOOK_DATA.configurator.lengths[0];

    const previewImg = document.getElementById('modalConfigPreviewImg');
    const statusPill = document.getElementById('modalConfigStatusPill');
    const totalPriceEl = document.getElementById('modalConfigTotalPrice');

    if (previewImg) previewImg.src = finish.img;
    if (statusPill) statusPill.textContent = `Focus Station • ${finish.name} • ${length.id} см`;

    // Calculate total price with optional laser engraving
    const addonsTotal = state.config.selectedAddonIds.reduce((sum, id) => {
      const a = GEEKNOOK_DATA.configurator.addons.find(item => item.id === id);
      return sum + (a ? a.price : 0);
    }, 0);

    const engravingPrice = state.config.engravingEnabled ? 1200 : 0;
    const grandTotal = length.priceBase + finish.priceDelta + addonsTotal + engravingPrice;
    if (totalPriceEl) totalPriceEl.textContent = formatPrice(grandTotal);

    // Sync Engraving badge and inputs
    const engravingBadge = document.getElementById('engravingBadgeOverlay');
    const engravingText = document.getElementById('engravingBadgeText');
    const engravingCheckbox = document.getElementById('configEngravingCheckbox');
    const engravingInputWrap = document.getElementById('configEngravingInputWrap');
    const engravingInput = document.getElementById('configEngravingInput');

    if (engravingCheckbox) engravingCheckbox.checked = Boolean(state.config.engravingEnabled);
    if (engravingInputWrap) engravingInputWrap.style.display = state.config.engravingEnabled ? 'block' : 'none';
    if (engravingBadge) engravingBadge.style.display = state.config.engravingEnabled ? 'flex' : 'none';
    if (engravingText) engravingText.textContent = state.config.engravingText ? state.config.engravingText.toUpperCase() : 'GEEKNOOK // LAB';
    if (engravingInput && !engravingInput.value) engravingInput.value = state.config.engravingText || '';

    // Finishes
    const finishesWrap = document.getElementById('modalConfigFinishes');
    if (finishesWrap) {
      finishesWrap.innerHTML = GEEKNOOK_DATA.configurator.finishes.map(f => `
        <div class="finish-option ${f.id === state.config.finishId ? 'active' : ''}" 
             onclick="window.geekNookApp.selectConfigFinish('${f.id}')"
             style="border:2px solid ${f.id === state.config.finishId ? 'var(--primary)' : 'var(--border)'};border-radius:8px;padding:12px;cursor:pointer;background:var(--surface-card);color:var(--text-main);transition:all var(--transition-fast);">
          <div style="width:24px;height:24px;border-radius:50%;background:${f.hex};margin-bottom:8px;border:1px solid rgba(128,128,128,0.3);"></div>
          <div style="font-weight:700;font-size:0.875rem;">${f.name}</div>
        </div>
      `).join('');
    }

    // Lengths
    const lengthsWrap = document.getElementById('modalConfigLengths');
    if (lengthsWrap) {
      lengthsWrap.innerHTML = GEEKNOOK_DATA.configurator.lengths.map(l => `
        <div class="length-btn ${l.id === state.config.lengthId ? 'active' : ''}" 
             onclick="window.geekNookApp.selectConfigLength('${l.id}')"
             style="border:2px solid ${l.id === state.config.lengthId ? 'var(--primary)' : 'var(--border)'};border-radius:8px;padding:12px;cursor:pointer;background:var(--surface-card);color:var(--text-main);transition:all var(--transition-fast);">
          <div style="font-weight:800;font-size:0.9375rem;">${l.title}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);">${l.descr}</div>
        </div>
      `).join('');
    }

    // Addons
    const addonsWrap = document.getElementById('modalConfigAddons');
    if (addonsWrap) {
      addonsWrap.innerHTML = GEEKNOOK_DATA.configurator.addons.map(a => {
        const isSelected = state.config.selectedAddonIds.includes(a.id);
        return `
          <div class="addon-check-item ${isSelected ? 'active' : ''}" 
               onclick="window.geekNookApp.toggleConfigAddon('${a.id}')"
               style="display:flex;align-items:center;justify-content:space-between;border:1px solid ${isSelected ? 'var(--primary)' : 'var(--border)'};border-radius:8px;padding:10px 14px;cursor:pointer;background:var(--surface-card);color:var(--text-main);margin-bottom:8px;transition:all var(--transition-fast);">
            <div style="display:flex;align-items:center;gap:12px;">
              <img src="${a.img}" style="width:40px;height:40px;border-radius:4px;object-fit:cover;" />
              <div>
                <div style="font-size:0.875rem;font-weight:600;">${a.name}</div>
                <div style="font-size:0.8125rem;color:var(--primary);font-weight:700;">+${formatPrice(a.price)}</div>
              </div>
            </div>
            <div style="width:20px;height:20px;border-radius:4px;border:2px solid ${isSelected ? 'var(--primary)' : 'var(--border)'};background:${isSelected ? 'var(--primary)' : 'transparent'};color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;">
              ${isSelected ? '✓' : ''}
            </div>
          </div>
        `;
      }).join('');
    }
  };

  const selectConfigFinish = (id) => {
    if (state.config.finishId === id) return;
    state.config.finishId = id;
    soundEngine.play('click');

    const previewImg = document.getElementById('modalConfigPreviewImg');
    if (previewImg) {
      previewImg.classList.add('crossfade-out');
      setTimeout(() => {
        renderConfiguratorUI();
        triggerPricePulse();
        previewImg.classList.remove('crossfade-out');
        previewImg.classList.add('crossfade-in');
        setTimeout(() => previewImg.classList.remove('crossfade-in'), 250);
      }, 140);
    } else {
      renderConfiguratorUI();
      triggerPricePulse();
    }
  };

  const selectConfigLength = (id) => {
    state.config.lengthId = id;
    soundEngine.play('click');
    renderConfiguratorUI();
    triggerPricePulse();
  };

  const toggleConfigAddon = (id) => {
    const idx = state.config.selectedAddonIds.indexOf(id);
    if (idx >= 0) {
      state.config.selectedAddonIds.splice(idx, 1);
    } else {
      state.config.selectedAddonIds.push(id);
    }
    soundEngine.play('click');
    renderConfiguratorUI();
    triggerPricePulse();
  };

  const toggleConfigEngraving = (enabled) => {
    state.config.engravingEnabled = Boolean(enabled);
    soundEngine.play('toggle');
    renderConfiguratorUI();
    triggerPricePulse();
  };

  const updateConfigEngravingText = (text) => {
    state.config.engravingText = text;
    const badgeText = document.getElementById('engravingBadgeText');
    if (badgeText) {
      badgeText.textContent = text.trim() ? text.trim().toUpperCase() : 'GEEKNOOK // LAB';
    }
    if (focusStation3DStudio?.isInitialized) {
      focusStation3DStudio.updateModel();
    }
  };

  // --- PROCEDURAL PHOTOREALISTIC WOOD TEXTURES & THREE.JS 3D ENGINE ---
  let cachedWoodTextures = null;

  const getWoodTextures = () => {
    if (cachedWoodTextures) return cachedWoodTextures;
    if (typeof THREE === 'undefined') return null;

    const finishes = {
      'finish-oak': {
        name: 'Кавказский дуб',
        base: ['#caa06e', '#bc9360', '#ab804d', '#dab17f'],
        fiber: 'rgba(124, 84, 42, 0.20)',
        rings: 'rgba(90, 61, 30, 0.24)',
        pores: 'rgba(70, 45, 20, 0.16)',
        roughness: 0.38,
        metalness: 0.04
      },
      'finish-walnut': {
        name: 'Американский орех',
        base: ['#4e321e', '#3e2413', '#563821', '#341d0e'],
        fiber: 'rgba(35, 18, 7, 0.24)',
        rings: 'rgba(26, 13, 5, 0.28)',
        pores: 'rgba(20, 10, 4, 0.18)',
        roughness: 0.34,
        metalness: 0.04
      },
      'finish-black': {
        name: 'Чёрное дерево',
        base: ['#1c1d22', '#16171a', '#22232a', '#141417'],
        fiber: 'rgba(40, 42, 50, 0.25)',
        rings: 'rgba(10, 10, 14, 0.35)',
        pores: 'rgba(50, 52, 62, 0.18)',
        roughness: 0.42,
        metalness: 0.06
      }
    };

    cachedWoodTextures = {};

    Object.entries(finishes).forEach(([key, config]) => {
      // 1. Diffuse canvas (1024x512)
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');

      const grad = ctx.createLinearGradient(0, 0, 1024, 0);
      grad.addColorStop(0, config.base[0]);
      grad.addColorStop(0.33, config.base[1]);
      grad.addColorStop(0.66, config.base[2]);
      grad.addColorStop(1, config.base[3]);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1024, 512);

      // Sinusoidal longitudinal wood fibers
      for (let y = 0; y < 512; y += 2) {
        const alpha = 0.06 + Math.sin(y * 0.1) * 0.04 + Math.cos(y * 0.025) * 0.03;
        ctx.strokeStyle = config.fiber;
        ctx.lineWidth = 1 + (y % 4 === 0 ? 1.5 : 0.6);
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x < 1024; x += 24) {
          const wave = Math.sin(x * 0.012 + y * 0.02) * 5 + Math.cos(x * 0.03) * 2;
          ctx.lineTo(x, y + wave);
        }
        ctx.stroke();
      }

      // Organic annual ring swirls
      for (let i = 0; i < 3; i++) {
        const cx = 180 + i * 320;
        const cy = 200 + (i % 2) * 80;
        for (let r = 12; r < 100; r += 9) {
          ctx.strokeStyle = config.rings;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.ellipse(cx, cy, r * 2.8, r * 0.65, 0.06, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Micro pores
      ctx.fillStyle = config.pores;
      for (let p = 0; p < 600; p++) {
        const px = Math.random() * 1024;
        const py = Math.random() * 512;
        ctx.fillRect(px, py, 2.5, 1);
      }

      // 2. Bump / Roughness Map (512x256)
      const bumpCanvas = document.createElement('canvas');
      bumpCanvas.width = 512;
      bumpCanvas.height = 256;
      const bctx = bumpCanvas.getContext('2d');
      bctx.fillStyle = '#808080';
      bctx.fillRect(0, 0, 512, 256);

      for (let y = 0; y < 256; y += 3) {
        const shade = Math.sin(y * 0.18) * 35;
        bctx.strokeStyle = shade > 0 
          ? `rgba(255, 255, 255, ${(shade / 140).toFixed(2)})` 
          : `rgba(0, 0, 0, ${(-shade / 140).toFixed(2)})`;
        bctx.lineWidth = 1.2;
        bctx.beginPath();
        bctx.moveTo(0, y);
        for (let x = 0; x < 512; x += 20) {
          const wave = Math.sin(x * 0.02 + y * 0.03) * 3.5;
          bctx.lineTo(x, y + wave);
        }
        bctx.stroke();
      }

      const diffuseTex = new THREE.CanvasTexture(canvas);
      diffuseTex.wrapS = THREE.ClampToEdgeWrapping;
      diffuseTex.wrapT = THREE.ClampToEdgeWrapping;

      const bumpTex = new THREE.CanvasTexture(bumpCanvas);
      bumpTex.wrapS = THREE.ClampToEdgeWrapping;
      bumpTex.wrapT = THREE.ClampToEdgeWrapping;

      cachedWoodTextures[key] = {
        diffuse: diffuseTex,
        bump: bumpTex,
        roughness: config.roughness,
        metalness: config.metalness
      };
    });

    return cachedWoodTextures;
  };

  const createBeveledDeckMesh = (width = 8.5, height = 0.24, depth = 2.3) => {
    const shape = new THREE.Shape();
    const hw = width / 2;
    const hd = depth / 2;
    const r = 0.12;

    shape.moveTo(-hw + r, -hd);
    shape.lineTo(hw - r, -hd);
    shape.quadraticCurveTo(hw, -hd, hw, -hd + r);
    shape.lineTo(hw, hd - r);
    shape.quadraticCurveTo(hw, hd, hw - r, hd);
    shape.lineTo(-hw + r, hd);
    shape.quadraticCurveTo(-hw, hd, -hw, hd - r);
    shape.lineTo(-hw, -hd + r);
    shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd);

    const extrudeSettings = {
      depth: height,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: 0.035,
      bevelThickness: 0.035
    };

    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.rotateX(Math.PI / 2);

    // Planar UV projection across horizontal desk face and edges
    const pos = geo.attributes.position;
    const uvs = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const pz = pos.getZ(i);
      const py = pos.getY(i);
      uvs.setXY(i, (px / width) + 0.5, (pz / depth) + 0.5 + py * 0.2);
    }
    uvs.needsUpdate = true;
    geo.computeVertexNormals();

    const textures = getWoodTextures();
    const oak = textures?.['finish-oak'] || {};
    const mat = new THREE.MeshStandardMaterial({
      map: oak.diffuse || null,
      bumpMap: oak.bump || null,
      bumpScale: 0.025,
      roughness: oak.roughness || 0.38,
      metalness: oak.metalness || 0.04
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  const createContactShadowMesh = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 120);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.58)');
    grad.addColorStop(0.35, 'rgba(0, 0, 0, 0.32)');
    grad.addColorStop(0.7, 'rgba(0, 0, 0, 0.08)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.85,
      depthWrite: false
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(11.0, 4.5), mat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -0.05;
    return plane;
  };

  function create3DSceneController(options) {
    return {
      isInitialized: false,
      isRunning: true,
      isVisible: true,
      rafId: null,
      observer: null,
      _animate: null,
      scene: null,
      camera: null,
      renderer: null,
      mainGroup: null,
      deckMesh: null,
      tTrackSlot: null,
      badgeMesh: null,
      badgeTexture: null,
      badgeCanvas: null,
      legsGroup: null,
      corkGroup: null,
      shadowMesh: null,
      modulesGroup: null,
      lights: {},
      isExploded: false,
      autoRotate: Boolean(options.autoRotateDefault),
      isUserInteracting: false,
      currentFinish: options.initialFinish || 'finish-oak',
      currentLength: options.initialLength || 85,
      lightingMode: 'studio',
      clock: new THREE.Clock(),

      start() {
        this.isRunning = true;
        if (!this.rafId && this.isVisible && this.renderer && this._animate) {
          this.clock.getDelta();
          this.rafId = requestAnimationFrame(this._animate);
        }
      },

      stop() {
        this.isRunning = false;
        if (this.rafId) {
          cancelAnimationFrame(this.rafId);
          this.rafId = null;
        }
      },

      init() {
        if (this.isInitialized) {
          this.updateModel();
          return;
        }
        if (typeof THREE === 'undefined') return;

        const canvas = document.getElementById(options.canvasId);
        const container = document.getElementById(options.containerId);
        if (!canvas || !container) return;

        const width = container.clientWidth || 600;
        const height = container.clientHeight || 420;
        const isMobile = (window.innerWidth || 1024) < 768;
        const maxDpr = isMobile ? 1.4 : 1.6;

        // 1. Scene & Camera
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
        this.camera.position.set(0, 5.2, 13.0);

        // 2. Renderer with soft shadows & powerPreference
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, alpha: true, powerPreference: 'high-performance' });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // 3. Cinematic 3-Point Lights
        this.lights.ambient = new THREE.AmbientLight(0xffffff, 0.82);
        this.scene.add(this.lights.ambient);

        this.lights.dir = new THREE.DirectionalLight(0xffffff, 1.05);
        this.lights.dir.position.set(7, 14, 9);
        this.lights.dir.castShadow = true;
        const shadowMapRes = isMobile ? 512 : 1024;
        this.lights.dir.shadow.mapSize.width = shadowMapRes;
        this.lights.dir.shadow.mapSize.height = shadowMapRes;
        this.lights.dir.shadow.bias = -0.0005;
        this.scene.add(this.lights.dir);

        this.lights.fill = new THREE.DirectionalLight(0xffffff, 0.4);
        this.lights.fill.position.set(-6, 4, 6);
        this.scene.add(this.lights.fill);

        this.lights.rim = new THREE.PointLight(0x60a5fa, 0.75, 25);
        this.lights.rim.position.set(-8, 5, -7);
        this.scene.add(this.lights.rim);

        // 4. Main Model Group
        this.mainGroup = new THREE.Group();
        this.scene.add(this.mainGroup);

        this.buildModel();
        this.initOrbitControls(canvas);

        // 5. Render loop with idle breathing & auto-rotation (with offscreen pause)
        this._animate = () => {
          if (!this.isRunning || !this.isVisible) {
            this.rafId = null;
            return;
          }
          this.rafId = requestAnimationFrame(this._animate);
          const time = this.clock.getElapsedTime();

          // Idle organic floating & breathing
          const idleFloatY = Math.sin(time * 1.4) * 0.03;
          const targetDeckY = this.isExploded ? 1.85 : 1.0;
          const targetLegY = this.isExploded ? 0.22 : 0.48;
          const targetCorkY = this.isExploded ? -0.22 : -0.02;

          if (this.deckMesh) {
            this.deckMesh.position.y += (targetDeckY + idleFloatY - this.deckMesh.position.y) * 0.08;
          }
          if (this.legsGroup) {
            this.legsGroup.children.forEach(l => {
              l.position.y += (targetLegY - l.position.y) * 0.08;
            });
          }
          if (this.corkGroup) {
            this.corkGroup.children.forEach(c => {
              c.position.y += (targetCorkY - c.position.y) * 0.08;
            });
          }

          // Auto-rotation when enabled and user not dragging
          if (this.autoRotate && !this.isUserInteracting) {
            this.mainGroup.rotation.y += 0.0035;
          }

          // Smooth orbital momentum damping
          if (this.orbit && !this.orbit.isDragging) {
            if (Math.abs(this.orbit.velTheta) > 0.0001 || Math.abs(this.orbit.velPhi) > 0.0001) {
              this.orbit.spherical.theta += this.orbit.velTheta;
              this.orbit.spherical.phi = Math.max(0.35, Math.min(1.45, this.orbit.spherical.phi + this.orbit.velPhi));
              this.orbit.velTheta *= 0.92;
              this.orbit.velPhi *= 0.92;
              this.orbit.updateCam();
            }
          }

          this.renderer.render(this.scene, this.camera);
        };

        // Automatic IntersectionObserver to pause rendering when scrolled out of viewport
        if ('IntersectionObserver' in window) {
          this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
              const visible = entry.isIntersecting && entry.intersectionRatio > 0;
              this.isVisible = visible;
              if (this.isVisible) {
                if (!this.rafId && this.isRunning) {
                  this.clock.getDelta();
                  this.rafId = requestAnimationFrame(this._animate);
                }
              } else {
                if (this.rafId) {
                  cancelAnimationFrame(this.rafId);
                  this.rafId = null;
                }
              }
            });
          }, { threshold: [0, 0.05] });
          this.observer.observe(container);
        }

        this.rafId = requestAnimationFrame(this._animate);

        // Resize listener
        window.addEventListener('resize', () => {
          if (!container.clientWidth) return;
          const w = container.clientWidth;
          const h = container.clientHeight;
          this.camera.aspect = w / h;
          this.camera.updateProjectionMatrix();
          this.renderer.setSize(w, h);
        });

        this.isInitialized = true;
        this.updateModel();
      },

      buildModel() {
        // 1. Deck Mesh with bevel
        this.deckMesh = createBeveledDeckMesh(8.5, 0.24, 2.3);
        this.deckMesh.position.y = 1.0;
        this.mainGroup.add(this.deckMesh);

        // 2. T-Track Slot
        const slotGeo = new THREE.BoxGeometry(8.1, 0.08, 0.16);
        const slotMat = new THREE.MeshStandardMaterial({
          color: 0x0f172a,
          roughness: 0.22,
          metalness: 0.85
        });
        this.tTrackSlot = new THREE.Mesh(slotGeo, slotMat);
        this.tTrackSlot.position.set(0, 0.11, -0.85);
        this.deckMesh.add(this.tTrackSlot);

        // 3. Metallic Engraved Badge
        this.badgeCanvas = document.createElement('canvas');
        this.badgeCanvas.width = 512;
        this.badgeCanvas.height = 128;
        this.badgeTexture = new THREE.CanvasTexture(this.badgeCanvas);
        this.updateBadgeTexture('GEEKNOOK // LAB');

        const badgeGeo = new THREE.BoxGeometry(1.6, 0.15, 0.03);
        const badgeMat = new THREE.MeshStandardMaterial({
          map: this.badgeTexture,
          metalness: 0.88,
          roughness: 0.28
        });
        this.badgeMesh = new THREE.Mesh(badgeGeo, badgeMat);
        this.badgeMesh.position.set(2.8, 0, 1.16);
        this.deckMesh.add(this.badgeMesh);

        // 4. Aluminum Legs (Д16Т anodized)
        this.legsGroup = new THREE.Group();
        this.mainGroup.add(this.legsGroup);

        const legMat = new THREE.MeshStandardMaterial({
          color: 0x1e2634,
          metalness: 0.85,
          roughness: 0.25
        });
        const legGeo = new THREE.BoxGeometry(0.35, 1.0, 2.1);

        const leftLeg = new THREE.Mesh(legGeo, legMat);
        leftLeg.position.set(-3.6, 0.48, 0);
        leftLeg.castShadow = true;
        this.legsGroup.add(leftLeg);

        const rightLeg = new THREE.Mesh(legGeo, legMat);
        rightLeg.position.set(3.6, 0.48, 0);
        rightLeg.castShadow = true;
        this.legsGroup.add(rightLeg);

        // 5. Cork feet
        this.corkGroup = new THREE.Group();
        this.mainGroup.add(this.corkGroup);

        const corkMat = new THREE.MeshStandardMaterial({
          color: 0xb45309,
          roughness: 0.95,
          metalness: 0.0
        });
        const corkGeo = new THREE.BoxGeometry(0.37, 0.04, 2.12);

        const leftCork = new THREE.Mesh(corkGeo, corkMat);
        leftCork.position.set(-3.6, -0.02, 0);
        this.corkGroup.add(leftCork);

        const rightCork = new THREE.Mesh(corkGeo, corkMat);
        rightCork.position.set(3.6, -0.02, 0);
        this.corkGroup.add(rightCork);

        // 6. Contact Ground Shadow
        this.shadowMesh = createContactShadowMesh();
        this.mainGroup.add(this.shadowMesh);

        // 7. Addons / Modules group
        this.modulesGroup = new THREE.Group();
        this.mainGroup.add(this.modulesGroup);

        const laptopMod = new THREE.Group();
        laptopMod.name = 'addon-laptop-stand-open';
        const lapBase = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.05, 0.7), legMat);
        const lapUp = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.1, 0.05), legMat);
        lapUp.position.set(0, 0.55, -0.35);
        laptopMod.add(lapBase);
        laptopMod.add(lapUp);
        laptopMod.position.set(-1.8, 1.15, -0.85);
        this.modulesGroup.add(laptopMod);

        const hpMod = new THREE.Group();
        hpMod.name = 'addon-headphone-stand';
        const hpBar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 16), legMat);
        hpBar.position.set(0, 0.7, 0);
        const hpHook = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 0.4), legMat);
        hpHook.position.set(0, 1.4, 0.2);
        hpMod.add(hpBar);
        hpMod.add(hpHook);
        hpMod.position.set(1.8, 1.12, -0.85);
        this.modulesGroup.add(hpMod);

        const trayMod = new THREE.Group();
        trayMod.name = 'addon-phone-dock';
        const trayMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.9), legMat);
        trayMod.add(trayMesh);
        trayMod.position.set(0, 1.15, -0.85);
        this.modulesGroup.add(trayMod);
      },

      updateBadgeTexture(text) {
        if (!this.badgeCanvas) return;
        const ctx = this.badgeCanvas.getContext('2d');
        const w = this.badgeCanvas.width;
        const h = this.badgeCanvas.height;

        const grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, '#d4af37');
        grad.addColorStop(0.5, '#fef08a');
        grad.addColorStop(1, '#b45309');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        const drawScrew = (x, y) => {
          ctx.fillStyle = '#78350f';
          ctx.beginPath();
          ctx.arc(x, y, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#451a03';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x - 6, y);
          ctx.lineTo(x + 6, y);
          ctx.stroke();
        };
        drawScrew(24, h / 2);
        drawScrew(w - 24, h / 2);

        ctx.fillStyle = '#291403';
        ctx.font = 'bold 36px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const clean = (text || 'GEEKNOOK // LAB').toUpperCase();
        ctx.fillText(clean, w / 2, h / 2);

        if (this.badgeTexture) this.badgeTexture.needsUpdate = true;
      },

      initOrbitControls(canvas) {
        let isDragging = false;
        let prevMouse = { x: 0, y: 0 };
        let spherical = { radius: 13.0, theta: 0.25, phi: 1.15 };
        let velTheta = 0;
        let velPhi = 0;

        const updateCam = () => {
          this.camera.position.x = spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
          this.camera.position.y = spherical.radius * Math.cos(spherical.phi);
          this.camera.position.z = spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
          this.camera.lookAt(0, 0.7, 0);
        };

        this.orbit = {
          get isDragging() { return isDragging; },
          spherical,
          get velTheta() { return velTheta; },
          set velTheta(v) { velTheta = v; },
          get velPhi() { return velPhi; },
          set velPhi(v) { velPhi = v; },
          updateCam
        };

        canvas.addEventListener('mousedown', (e) => {
          isDragging = true;
          this.isUserInteracting = true;
          velTheta = 0;
          velPhi = 0;
          prevMouse = { x: e.clientX, y: e.clientY };
        });

        window.addEventListener('mousemove', (e) => {
          if (!isDragging) return;
          const dx = e.clientX - prevMouse.x;
          const dy = e.clientY - prevMouse.y;
          prevMouse = { x: e.clientX, y: e.clientY };

          velTheta = -dx * 0.006;
          velPhi = -dy * 0.006;
          spherical.theta += velTheta;
          spherical.phi = Math.max(0.35, Math.min(1.45, spherical.phi + velPhi));
          updateCam();
        });

        window.addEventListener('mouseup', () => {
          isDragging = false;
          setTimeout(() => { this.isUserInteracting = false; }, 800);
        });

        canvas.addEventListener('wheel', (e) => {
          e.preventDefault();
          spherical.radius = Math.max(7, Math.min(20, spherical.radius + e.deltaY * 0.012));
          updateCam();
        }, { passive: false });

        canvas.addEventListener('touchstart', (e) => {
          if (e.touches.length === 1) {
            isDragging = true;
            this.isUserInteracting = true;
            velTheta = 0;
            velPhi = 0;
            prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          }
        }, { passive: true });

        window.addEventListener('touchmove', (e) => {
          if (!isDragging || e.touches.length !== 1) return;
          const dx = e.touches[0].clientX - prevMouse.x;
          const dy = e.touches[0].clientY - prevMouse.y;
          prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };

          velTheta = -dx * 0.006;
          velPhi = -dy * 0.006;
          spherical.theta += velTheta;
          spherical.phi = Math.max(0.35, Math.min(1.45, spherical.phi + velPhi));
          updateCam();
        }, { passive: true });

        window.addEventListener('touchend', () => {
          isDragging = false;
          setTimeout(() => { this.isUserInteracting = false; }, 800);
        });

        updateCam();
      },

      updateModel() {
        if (!this.deckMesh) return;

        // 1. Finish texture & material
        const textures = getWoodTextures();
        const wood = textures?.[this.currentFinish] || textures?.['finish-oak'];
        if (wood && this.deckMesh.material) {
          this.deckMesh.material.map = wood.diffuse;
          this.deckMesh.material.bumpMap = wood.bump;
          this.deckMesh.material.bumpScale = 0.02;
          this.deckMesh.material.roughness = wood.roughness;
          this.deckMesh.material.metalness = wood.metalness;
          this.deckMesh.material.needsUpdate = true;
        }

        // 2. Length scale
        const scaleX = Number(this.currentLength) === 116 ? 1.36 : 1.0;
        this.deckMesh.scale.x = scaleX;

        if (this.legsGroup) {
          const legOffset = 3.6 * scaleX;
          this.legsGroup.children[0].position.x = -legOffset;
          this.legsGroup.children[1].position.x = legOffset;
          this.corkGroup.children[0].position.x = -legOffset;
          this.corkGroup.children[1].position.x = legOffset;
        }
        if (this.shadowMesh) {
          this.shadowMesh.scale.x = scaleX;
        }

        // Status badge
        if (options.statusBadgeId) {
          const badge = document.getElementById(options.statusBadgeId);
          if (badge) {
            const woodName = this.currentFinish === 'finish-walnut' ? 'Американский орех' : (this.currentFinish === 'finish-black' ? 'Чёрное дерево' : 'Кавказский дуб 22 мм');
            badge.textContent = `Focus Station • ${woodName} • ${this.currentLength} см • Сплав Д16Т • Т-паз 45°`;
          }
        }
      },

      setFinish(finishId) {
        this.currentFinish = finishId;
        this.updateModel();
      },

      setLength(len) {
        this.currentLength = Number(len);
        this.updateModel();
      },

      toggleExplode() {
        this.isExploded = !this.isExploded;
        return this.isExploded;
      },

      toggleAutoRotate() {
        this.autoRotate = !this.autoRotate;
        return this.autoRotate;
      },

      setLighting(mode) {
        this.lightingMode = mode;
        if (mode === 'cyber') {
          this.lights.ambient.color.setHex(0x1e1b4b);
          this.lights.dir.color.setHex(0x06b6d4);
          this.lights.rim.color.setHex(0xec4899);
        } else if (mode === 'sunset') {
          this.lights.ambient.color.setHex(0x7c2d12);
          this.lights.dir.color.setHex(0xfb923c);
          this.lights.rim.color.setHex(0xfacc15);
        } else {
          // studio
          this.lights.ambient.color.setHex(0xffffff);
          this.lights.dir.color.setHex(0xffffff);
          this.lights.rim.color.setHex(0x60a5fa);
        }
      }
    };
  }

  // 1. Configurator 3D Studio Instance
  const focusStation3DStudio = create3DSceneController({
    canvasId: 'config3dCanvas',
    containerId: 'config3dViewport',
    autoRotateDefault: false
  });

  // Configurator-specific module sync
  const originalConfigUpdate = focusStation3DStudio.updateModel.bind(focusStation3DStudio);
  focusStation3DStudio.updateModel = function() {
    this.currentFinish = state.config.finishId;
    this.currentLength = state.config.lengthId;
    originalConfigUpdate();

    // Laser Engraved Badge in modal
    if (this.badgeMesh) {
      this.badgeMesh.visible = Boolean(state.config.engravingEnabled);
      if (state.config.engravingEnabled) {
        this.updateBadgeTexture(state.config.engravingText);
      }
    }

    // Addon modules in modal
    if (this.modulesGroup) {
      const hasAddons = state.config.selectedAddonIds.length > 0;
      const trackWrap = document.getElementById('config3dTrackWrap');
      if (trackWrap) trackWrap.style.display = hasAddons ? 'flex' : 'none';

      this.modulesGroup.children.forEach(child => {
        child.visible = state.config.selectedAddonIds.includes(child.name);
      });
    }
  };

  focusStation3DStudio.setModulePosition = function(pct) {
    const offset = (Number(pct) / 100) * 2.6;
    if (this.modulesGroup) {
      this.modulesGroup.position.x = offset;
    }
  };

  // 2. Production Section 3D Studio Instance (Embedded in Page)
  const production3DStudio = create3DSceneController({
    canvasId: 'production3dCanvas',
    containerId: 'prod3dViewport',
    statusBadgeId: 'prod3dStatusBadge',
    autoRotateDefault: true
  });

  const initProduction3DStudio = () => {
    if (typeof THREE !== 'undefined' && !production3DStudio.isInitialized) {
      production3DStudio.init();
    }
  };

  const setProduction3dFinish = (finishId) => {
    soundEngine.play('click');
    production3DStudio.setFinish(finishId);
    document.querySelectorAll('#prod3dFinishPills .prod-pill').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-finish') === finishId);
    });
  };

  const setProduction3dLength = (len) => {
    soundEngine.play('click');
    production3DStudio.setLength(len);
    document.querySelectorAll('#prod3dLengthPills .prod-pill').forEach(btn => {
      btn.classList.toggle('active', Number(btn.getAttribute('data-len')) === Number(len));
    });
  };

  const setProduction3dLighting = (mode) => {
    soundEngine.play('click');
    production3DStudio.setLighting(mode);
    document.querySelectorAll('#prod3dLightPills .prod-pill').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-light') === mode);
    });
  };

  const toggleProduction3dExplode = () => {
    soundEngine.play('click');
    const isExp = production3DStudio.toggleExplode();
    const btn = document.getElementById('btnProd3dExplode');
    if (btn) btn.classList.toggle('active', isExp);
    showToast(isExp ? '3D Взрыв-схема: компоненты разнесены' : '3D Сборка Focus Station');
  };

  const toggleProduction3dAutoRotate = () => {
    soundEngine.play('click');
    const rotating = production3DStudio.toggleAutoRotate();
    const btn = document.getElementById('btnProd3dAutoRotate');
    if (btn) btn.classList.toggle('active', rotating);
    showToast(rotating ? 'Авто-вращение 360° включено' : 'Авто-вращение остановлено');
  };

  const toggleProduction3dAddon = (addonId) => {
    soundEngine.play('click');
    if (!production3DStudio.modulesGroup) return;
    const item = production3DStudio.modulesGroup.getObjectByName(addonId);
    let isVisible = false;
    if (item) {
      item.visible = !item.visible;
      isVisible = item.visible;
    }
    const btn = document.querySelector(`#prod3dAddonPills [data-addon="${addonId}"]`);
    if (btn) btn.classList.toggle('active', isVisible);

    let label = 'Модуль';
    if (addonId === 'addon-laptop-stand-open') label = 'Кронштейн ноутбука';
    else if (addonId === 'addon-headphone-stand') label = 'Стойка наушников';
    else if (addonId === 'addon-phone-dock') label = 'Док-станция для телефона';
    showToast(isVisible ? `✨ ${label} установлен на Т-паз 45°` : `${label} снят с подставки`);
  };

  const setConfigViewMode = (mode) => {
    soundEngine.play('toggle');
    const btn2d = document.getElementById('configView2dBtn');
    const btn3d = document.getElementById('configView3dBtn');
    const wrap2d = document.getElementById('config2dPreviewWrap');
    const wrap3d = document.getElementById('config3dViewport');

    if (mode === '3d') {
      btn2d?.classList.remove('active');
      btn3d?.classList.add('active');
      if (wrap2d) wrap2d.style.display = 'none';
      if (wrap3d) {
        wrap3d.style.display = 'block';
        focusStation3DStudio.init();
        focusStation3DStudio.start();
      }
    } else {
      btn3d?.classList.remove('active');
      btn2d?.classList.add('active');
      if (wrap3d) wrap3d.style.display = 'none';
      if (wrap2d) wrap2d.style.display = 'block';
      focusStation3DStudio.stop();
    }
  };

  const toggle3dExplode = () => focusStation3DStudio.toggleExplode();
  const set3dLighting = (mode) => focusStation3DStudio.setLighting(mode);
  const update3dModulePosition = (val) => focusStation3DStudio.setModulePosition(val);

  const addConfiguredBundleToCart = () => {
    const finish = GEEKNOOK_DATA.configurator.finishes.find(f => f.id === state.config.finishId);
    const length = GEEKNOOK_DATA.configurator.lengths.find(l => l.id === state.config.lengthId);

    // Add main shelf
    const engravingSuffix = state.config.engravingEnabled 
      ? ` + Лазерная гравировка [${state.config.engravingText || 'GEEKNOOK LAB'}]` 
      : '';
    const mainShelfPrice = length.priceBase + finish.priceDelta + (state.config.engravingEnabled ? 1200 : 0);
    
    // Custom shelf cart key
    const shelfKey = `focus-station-900_${finish.name}_${length.id}_${state.config.engravingEnabled ? 'engraved' : 'plain'}`;
    const existingShelf = state.cart.find(i => i.cartKey === shelfKey);
    if (existingShelf) {
      existingShelf.quantity += 1;
    } else {
      state.cart.push({
        cartKey: shelfKey,
        id: 'focus-station-900',
        title: 'Focus Station 900',
        option: `${finish.name} (${length.id} см)${engravingSuffix}`,
        price: mainShelfPrice,
        image: finish.img,
        quantity: 1
      });
    }

    // Add individual selected modular addons with deduplication
    state.config.selectedAddonIds.forEach(id => {
      const addon = GEEKNOOK_DATA.configurator.addons.find(a => a.id === id);
      if (addon) {
        const cartKey = `custom_${addon.id}`;
        const existing = state.cart.find(i => i.cartKey === cartKey);
        if (existing) {
          existing.quantity += 1;
        } else {
          state.cart.push({
            cartKey,
            id: addon.id,
            title: addon.name,
            option: 'Модуль T-Track',
            price: addon.price,
            image: addon.img,
            quantity: 1
          });
        }
      }
    });

    saveCart();
    triggerBadgeBounce();
    soundEngine.play('cart');
    closeModal('configuratorModal');
    showToast('Индивидуальный комплект добавлен в корзину!', 'success');
    openCartDrawer();
  };

  // --- GOOGLE ANTIGRAVITY INTERACTIVE 3D PARTICLE SPHERE ---
  const initAntigravitySphere = () => {
    const canvas = document.getElementById('antigravityCanvas');
    const hero = document.getElementById('hero');
    if (!canvas || !hero) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let width = 0;
    let height = 0;

    const resize = () => {
      width = hero.clientWidth || window.innerWidth;
      height = hero.clientHeight || 700;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });

    // Optimized particle distribution on 3D sphere (Fibonacci lattice)
    const isMobile = (hero.clientWidth || window.innerWidth) < 768;
    const PARTICLE_COUNT = isMobile ? 120 : 220;
    const SPHERE_RADIUS = Math.min(width, height) > 800 ? 175 : 135;
    const particles = [];
    const goldenRatio = (1 + Math.sqrt(5)) / 2;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const theta = (2 * Math.PI * i) / goldenRatio;
      const phi = Math.acos(1 - (2 * (i + 0.5)) / PARTICLE_COUNT);

      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.cos(phi);
      const z = Math.sin(phi) * Math.sin(theta);

      // Google Antigravity / DeepMind palette: Cyan, Electric Blue, Violet, Light Pearl
      const colorType = i % 5;
      let cr = 56, cg = 189, cb = 248; // cyan
      if (colorType === 0) { cr = 37; cg = 99; cb = 235; } // electric blue
      else if (colorType === 1) { cr = 129; cg = 140; cb = 248; } // violet
      else if (colorType === 2) { cr = 224; cg = 242; cb = 254; } // pearl white
      else if (colorType === 3) { cr = 14; cg = 165; cb = 233; } // sky

      particles.push({
        origX: x * SPHERE_RADIUS,
        origY: y * SPHERE_RADIUS,
        origZ: z * SPHERE_RADIUS,
        dispX: 0,
        dispY: 0,
        dispZ: 0,
        baseSize: 1.4 + Math.random() * 1.6,
        r: cr,
        g: cg,
        b: cb,
        projX: 0,
        projY: 0,
        projZ: 0,
        projScale: 1
      });
    }

    let isVisible = true;
    let isMouseInside = false;

    // Resting target position on right side of hero
    let currentX = width * 0.72;
    let currentY = height * 0.48;
    let targetX = currentX;
    let targetY = currentY;

    // 3D rotation angles & velocities
    let rotX = 0.25;
    let rotY = 0;
    let rotVelX = 0.003;
    let rotVelY = 0.005;

    let mouseClientX = 0;
    let mouseClientY = 0;
    let prevMouseX = 0;
    let prevMouseY = 0;

    let shockwaveRadius = 0;
    let shockwaveActive = false;

    // Track mouse across the entire hero / screen without boundaries
    window.addEventListener('mousemove', (e) => {
      const rect = hero.getBoundingClientRect();
      if (e.clientY >= rect.top - 40 && e.clientY <= rect.bottom + 40) {
        const hx = e.clientX - rect.left;
        const hy = e.clientY - rect.top;

        isMouseInside = true;
        mouseClientX = hx;
        mouseClientY = hy;

        // Full freedom of movement across 100% of the screen width and height
        targetX = Math.max(0, Math.min(width, hx));
        targetY = Math.max(0, Math.min(height, hy));

        // Compute mouse velocity impulse for 3D rotation
        const dx = hx - prevMouseX;
        const dy = hy - prevMouseY;
        rotVelY += dx * 0.0004;
        rotVelX -= dy * 0.0004;
        prevMouseX = hx;
        prevMouseY = hy;
      } else {
        isMouseInside = false;
        targetX = width * 0.55;
        targetY = height * 0.48;
      }
    }, { passive: true });

    window.addEventListener('click', (e) => {
      const rect = hero.getBoundingClientRect();
      if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
        shockwaveActive = true;
        shockwaveRadius = 10;
      }
    });

    // Auto-pause when hero is scrolled out of viewport
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          isVisible = entry.isIntersecting;
          if (isVisible && !rafId) {
            render();
          }
        });
      }, { threshold: 0.05 });
      observer.observe(hero);
    }

    let rafId = null;
    let tick = 0;

    const render = () => {
      if (!isVisible) {
        rafId = null;
        return;
      }

      tick++;

      // Smooth spring inertia tracking towards mouse cursor
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;

      // Ambient floating levitation
      const hoverOscX = Math.sin(tick * 0.016) * 8;
      const hoverOscY = Math.cos(tick * 0.012) * 12;
      const sphereCenterX = currentX + hoverOscX;
      const sphereCenterY = currentY + hoverOscY;

      // Damped rotation with ambient drift
      rotVelX *= 0.94;
      rotVelY *= 0.94;
      rotY += rotVelY + 0.0035;
      rotX += rotVelX + 0.0016;

      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      // Radial shockwave on click
      if (shockwaveActive) {
        shockwaveRadius += 10;
        if (shockwaveRadius > SPHERE_RADIUS * 2.6) {
          shockwaveActive = false;
          shockwaveRadius = 0;
        }
      }

      ctx.clearRect(0, 0, width, height);

      const focalLength = 340;

      // Update and project particles
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const p = particles[i];

        // 3D rotation Y
        const x1 = p.origX * cosY - p.origZ * sinY;
        const z1 = p.origZ * cosY + p.origX * sinY;

        // 3D rotation X
        const y2 = p.origY * cosX - z1 * sinX;
        const z2 = z1 * cosX + p.origY * sinX;
        const x2 = x1;

        const px = x2 + p.dispX;
        const py = y2 + p.dispY;
        const pz = z2 + p.dispZ;

        const scale = focalLength / (focalLength + pz + SPHERE_RADIUS * 0.8);
        const screenX = sphereCenterX + px * scale;
        const screenY = sphereCenterY + py * scale;

        // Antigravity cursor repulsion
        if (isMouseInside) {
          const mdx = screenX - mouseClientX;
          const mdy = screenY - mouseClientY;
          const distToMouse = Math.sqrt(mdx * mdx + mdy * mdy);
          const repulseDist = 135;

          if (distToMouse < repulseDist && distToMouse > 0.001) {
            const force = Math.pow(1 - distToMouse / repulseDist, 2) * 38;
            p.dispX += (mdx / distToMouse) * force;
            p.dispY += (mdy / distToMouse) * force;
          }
        }

        // Shockwave displacement
        if (shockwaveActive) {
          const distFromCenter = Math.sqrt(px * px + py * py + pz * pz);
          const waveDiff = Math.abs(distFromCenter - shockwaveRadius);
          if (waveDiff < 28) {
            const waveForce = (1 - waveDiff / 28) * 20;
            const norm = distFromCenter > 0 ? waveForce / distFromCenter : 0;
            p.dispX += px * norm;
            p.dispY += py * norm;
            p.dispZ += pz * norm;
          }
        }

        // Spring return to spherical surface
        p.dispX *= 0.88;
        p.dispY *= 0.88;
        p.dispZ *= 0.88;

        p.projX = screenX;
        p.projY = screenY;
        p.projZ = pz;
        p.projScale = scale;
      }

      // Sort by depth for correct blending
      particles.sort((a, b) => a.projZ - b.projZ);

      // Ambient radial back glow
      const auraGrad = ctx.createRadialGradient(
        sphereCenterX,
        sphereCenterY,
        SPHERE_RADIUS * 0.2,
        sphereCenterX,
        sphereCenterY,
        SPHERE_RADIUS * 1.45
      );
      auraGrad.addColorStop(0, 'rgba(43, 112, 240, 0.16)');
      auraGrad.addColorStop(0.5, 'rgba(37, 99, 235, 0.05)');
      auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(sphereCenterX, sphereCenterY, SPHERE_RADIUS * 1.45, 0, Math.PI * 2);
      ctx.fill();

      // Constellation lines for front-facing particles
      ctx.lineWidth = 0.65;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const p1 = particles[i];
        if (p1.projZ < 0) continue;

        for (let j = i + 1; j < Math.min(i + 8, PARTICLE_COUNT); j++) {
          const p2 = particles[j];
          if (p2.projZ < 0) continue;

          const ddx = p1.projX - p2.projX;
          const ddy = p1.projY - p2.projY;
          const lineDist = Math.sqrt(ddx * ddx + ddy * ddy);

          if (lineDist < 36) {
            const lineAlpha = (1 - lineDist / 36) * 0.28 * (p1.projZ / SPHERE_RADIUS);
            ctx.strokeStyle = `rgba(96, 165, 250, ${Math.max(0, lineAlpha)})`;
            ctx.beginPath();
            ctx.moveTo(p1.projX, p1.projY);
            ctx.lineTo(p2.projX, p2.projY);
            ctx.stroke();
          }
        }
      }

      // Draw particles with depth-attenuated glow (zero shadowBlur overhead)
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const p = particles[i];
        const zNorm = (p.projZ + SPHERE_RADIUS) / (SPHERE_RADIUS * 2);
        const alpha = Math.max(0.12, Math.min(0.95, 0.15 + zNorm * 0.8));
        const radius = Math.max(0.8, p.baseSize * p.projScale * (0.6 + zNorm * 0.7));

        if (zNorm > 0.65) {
          // Soft glowing halo for prominent front particles
          ctx.fillStyle = `rgba(${p.r}, ${p.g}, ${p.b}, ${alpha * 0.25})`;
          ctx.beginPath();
          ctx.arc(p.projX, p.projY, radius * 1.8, 0, Math.PI * 2);
          ctx.fill();
        }

        // Crisp luminous particle core
        ctx.fillStyle = `rgba(${p.r}, ${p.g}, ${p.b}, ${zNorm > 0.55 ? alpha : alpha * 0.55})`;
        ctx.beginPath();
        ctx.arc(p.projX, p.projY, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      rafId = requestAnimationFrame(render);
    };

    render();
  };


window.GeekNook.threeStudio = {
  openConfigurator,
  selectConfigFinish,
  selectConfigLength,
  toggleConfigAddon,
  toggleConfigEngraving,
  updateConfigEngravingText,
  addConfiguredBundleToCart,
  focusStation3DStudio,
  production3DStudio,
  initProduction3DStudio,
  setProduction3dFinish,
  setProduction3dLength,
  setProduction3dLighting,
  toggleProduction3dExplode,
  toggleProduction3dAutoRotate,
  toggleProduction3dAddon,
  setConfigViewMode,
  toggle3dExplode,
  set3dLighting,
  update3dModulePosition,
  initAntigravitySphere
};
