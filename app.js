(() => {
  "use strict";

  // ---------- Helpers ----------
  const $ = (id) => document.getElementById(id);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  function showToast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("active");
    setTimeout(() => t.classList.remove("active"), 1600);
  }

  function shield(on) {
    const s = $("transition-shield");
    if (on) s.classList.add("active");
    else s.classList.remove("active");
  }

  // ---------- Data / Floors ----------
  const floorNames = [
    "Fine Art", "Photography", "Design", "Sculpture", "New Media", "Textile",
    "Performance", "Architecture", "Ceramics", "Film", "Concepts", "Masters",
  ];

  const FLOORS = [{ id: 0, name: "Reception", type: "reception" }];
  for (let i = 1; i <= 12; i++) {
    const name = floorNames[(i - 1) % floorNames.length];
    let type = "standard";
    if (name === "Fine Art") type = "fineart";
    if (name === "New Media") type = "newmedia";
    FLOORS.push({ id: i, name, type });
  }

  // IMPORTANT: Webflow Basic has NO CMS, so artworks come from a JSON file. :contentReference[oaicite:4]{index=4}
  // You will edit artworks.json manually.

  // ---------- Three.js Engine ----------
  const container = $("canvas-container");
  const scene = new THREE.Scene();
  const skyColor = new THREE.Color(0xe0f2fe);
  scene.background = skyColor;
  scene.fog = new THREE.Fog(skyColor, 20, 160);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1200);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Three r128 color handling:
  renderer.outputEncoding = THREE.sRGBEncoding;

  container.appendChild(renderer.domElement);

  // Lighting (lighter than your original for performance)
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0xdbeafe, 0.7);
  scene.add(hemiLight);

  const sun = new THREE.DirectionalLight(0xfffaed, 0.85);
  sun.position.set(50, 90, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 220;
  sun.shadow.camera.left = -80;
  sun.shadow.camera.right = 80;
  sun.shadow.camera.top = 80;
  sun.shadow.camera.bottom = -80;
  scene.add(sun);

  // ---------- Materials ----------
  THREE.Cache.enabled = true;

  const textureLoader = new THREE.TextureLoader();
  textureLoader.crossOrigin = "anonymous";

  const matFloor = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.08 });
  const matFloorDark = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.55, metalness: 0.02 });
  const matWallWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65 });
  const matWallDark = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
  const matGlass = new THREE.MeshPhysicalMaterial({
    color: 0x8899a6, transmission: 0.9, opacity: 0.28, transparent: true,
    roughness: 0.05, side: THREE.DoubleSide
  });

  // IMPORTANT: Keep "visible: true" so raycaster can hit them.
  const invisibleMat = new THREE.MeshBasicMaterial({ visible: true, transparent: true, opacity: 0 });

  // ---------- World Settings ----------
  const floorHeight = 35;
  const HALL = { width: 40, length: 100, wallH: 15 };

  const interactables = [];
  const builtLevelGroups = new Map(); // level -> THREE.Group

  // Base ground (for walking clicks)
  const infiniteFloor = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), matFloor);
  infiniteFloor.rotation.x = -Math.PI / 2;
  infiniteFloor.receiveShadow = true;
  scene.add(infiniteFloor);

  const walkPlane = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), invisibleMat);
  walkPlane.rotation.x = -Math.PI / 2;
  walkPlane.userData = { type: "floor" };
  interactables.push(walkPlane);
  scene.add(walkPlane);

  // ---------- Load artworks.json ----------
  let ARTWORKS = [];

  async function loadArtworks() {
    try {
      $("load-fill").style.width = "35%";
      const r = await fetch("./artworks.json", { cache: "no-store" });
      if (!r.ok) throw new Error("No artworks.json found");
      const data = await r.json();
      if (!Array.isArray(data)) throw new Error("artworks.json must be an array");
      ARTWORKS = data;
      $("load-fill").style.width = "65%";
    } catch (e) {
      // No file? still run with placeholders
      ARTWORKS = [];
      $("load-fill").style.width = "65%";
    }
  }

  // ---------- Layout: auto-place artworks on walls ----------
  function layoutFloorArt(level) {
    const raw = ARTWORKS.filter(a => Number(a.floor) === Number(level));

    // If user has no data on this floor, create placeholders
    const list = raw.length ? raw : Array.from({ length: 10 }).map((_, i) => ({
      title: `Work ${level}-${i + 1}`,
      artist: "LFC Collection",
      year: "2024",
      floor: level,
      imgThumb: `https://placehold.co/600x800?text=Floor+${level}+Work+${i + 1}`,
      imgFull: `https://placehold.co/1200x1600?text=Floor+${level}+Work+${i + 1}`,
    }));

    const placed = [];
    const perWall = 10;
    const spacing = 9;
    const startZ = -(HALL.length / 2) + 12;

    list.forEach((a, idx) => {
      const wallIndex = Math.floor(idx / perWall);
      const inWall = idx % perWall;

      const onRightWall = wallIndex % 2 === 0;
      const x = onRightWall ? (HALL.width / 2 - 1) : -(HALL.width / 2 - 1);
      const rot = onRightWall ? -Math.PI / 2 : Math.PI / 2;

      const z = startZ + inWall * spacing;
      const y = level * floorHeight + 6;

      placed.push({
        title: a.title || "Untitled",
        artist: a.artist || "Unknown",
        year: a.year || "—",
        floor: level,
        imgThumb: a.imgThumb || a.img || "",
        imgFull: a.imgFull || a.imgThumb || a.img || "",
        w: Number(a.w || 4),
        h: Number(a.h || 5),
        x, y, z, rot,
      });
    });

    return placed;
  }

  // ---------- Build Level (idempotent: no duplicates) ----------
  function buildLevel(level) {
    if (builtLevelGroups.has(level)) return;

    const y0 = level * floorHeight;
    const config = FLOORS[level];
    const group = new THREE.Group();

    // Materials by type
    let flMat = matFloor;
    let wMat = matWallWhite;
    if (config.type === "newmedia") { flMat = matFloorDark; wMat = matWallDark; }

    // Floor slab
    const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(HALL.width, 0.5, HALL.length), flMat);
    floorMesh.position.set(0, y0, 0);
    floorMesh.receiveShadow = true;
    floorMesh.userData = { type: "floor", level };
    interactables.push(floorMesh);
    group.add(floorMesh);

    // Ceiling
    const ceil = new THREE.Mesh(new THREE.BoxGeometry(HALL.width, 0.5, HALL.length), wMat);
    ceil.position.set(0, y0 + HALL.wallH, 0);
    ceil.castShadow = false;
    group.add(ceil);

    // Walls
    // Right wall solid
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(1, HALL.wallH, HALL.length), wMat);
    rightWall.position.set(HALL.width / 2 - 0.5, y0 + HALL.wallH / 2, 0);
    group.add(rightWall);

    // Left wall glass or themed
    if (config.type === "newmedia") {
      const leftCurtain = new THREE.Mesh(new THREE.BoxGeometry(1, HALL.wallH, HALL.length), matFloorDark);
      leftCurtain.position.set(-(HALL.width / 2 - 0.5), y0 + HALL.wallH / 2, 0);
      group.add(leftCurtain);
    } else if (config.type === "fineart") {
      const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, HALL.wallH, HALL.length), matGlass);
      leftWall.position.set(-(HALL.width / 2 - 0.25), y0 + HALL.wallH / 2, 0);
      group.add(leftWall);
    } else {
      const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, HALL.wallH, HALL.length), matGlass);
      leftWall.position.set(-(HALL.width / 2 - 0.25), y0 + HALL.wallH / 2, 0);
      group.add(leftWall);
    }

    // Railings
    const backRail = new THREE.Mesh(new THREE.BoxGeometry(HALL.width, 2, 0.1), matGlass);
    backRail.position.set(0, y0 + 1, -HALL.length / 2);
    group.add(backRail);

    const frontRail = new THREE.Mesh(new THREE.BoxGeometry(HALL.width, 2, 0.1), matGlass);
    frontRail.position.set(0, y0 + 1, HALL.length / 2);
    group.add(frontRail);

    // Art
    if (level === 0) {
      createArt({
        title: "LFC SYSTEM",
        artist: "FEI TeamArt",
        year: "—",
        floor: 0,
        imgThumb: "https://placehold.co/1200x800/111/fff?text=LFC+SYSTEM",
        imgFull: "https://placehold.co/1600x1000/111/fff?text=LFC+SYSTEM",
        w: 9, h: 5,
        x: HALL.width / 2 - 1,
        y: y0 + 7,
        z: 0,
        rot: -Math.PI / 2
      }, true, group);
    } else {
      const placed = layoutFloorArt(level);
      placed.forEach(a => createArt(a, false, group));
    }

    scene.add(group);
    builtLevelGroups.set(level, group);
  }

  function createArt(data, isInfo, parentGroup) {
    const g = new THREE.Group();
    g.position.set(data.x, data.y, data.z);
    g.rotation.y = data.rot;

    // Frame
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(data.w + 0.12, data.h + 0.12, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 })
    );
    g.add(frame);

    // Canvas (placeholder)
    const placeholderMat = new THREE.MeshBasicMaterial({ color: 0xcccccc });
    const canvas = new THREE.Mesh(new THREE.PlaneGeometry(data.w, data.h), placeholderMat);
    canvas.position.z = 0.07;
    canvas.userData.isCanvas = true;
    g.add(canvas);

    // Load texture (thumb)
    const url = data.imgThumb || "";
    if (url) {
      textureLoader.load(url, (tex) => {
        tex.encoding = THREE.sRGBEncoding;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        canvas.material = new THREE.MeshBasicMaterial({ map: tex });
      }, undefined, () => {
        // keep placeholder on error
      });
    }

    // Click hitbox (not for info board)
    if (!isInfo) {
      const hitbox = new THREE.Mesh(new THREE.BoxGeometry(data.w, data.h, 0.7), invisibleMat);
      hitbox.userData = {
        type: "art",
        data,
        viewPos: {
          x: data.x + Math.sin(data.rot) * 8,
          y: data.y,
          z: data.z + Math.cos(data.rot) * 8
        },
        lookAt: { x: data.x, y: data.y, z: data.z }
      };
      interactables.push(hitbox);
      g.add(hitbox);
    }

    parentGroup.add(g);
  }

  // ---------- UI: Elevator ----------
  function buildElevatorUI() {
    const elev = $("elevator");
    elev.innerHTML = "";

    // Highest floor on top
    [...FLOORS].slice().reverse().forEach(f => {
      const b = document.createElement("div");
      b.className = "floor-item";
      b.id = `flr-${f.id}`;
      b.innerHTML = `<div class="floor-label">${f.name}</div><div class="floor-num">${f.id}</div>`;
      b.onclick = () => goToLevel(f.id);
      elev.appendChild(b);
    });

    updateElevator(0);
  }

  function updateElevator(level) {
    document.querySelectorAll(".floor-item").forEach(b => b.classList.remove("active"));
    const el = document.querySelector(`#flr-${level}`);
    if (el) el.classList.add("active");
  }

  // ---------- Navigation / Camera ----------
  camera.position.set(0, 5, 30);

  let lon = 0, lat = 0;
  let isDragging = false;
  let downX = 0, downY = 0;
  let lastX = 0, lastY = 0;

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  let isFocusing = false;
  const savedPos = new THREE.Vector3();
  let lookTarget = null;

  function handleClick(x, y) {
    mouse.x = (x / window.innerWidth) * 2 - 1;
    mouse.y = -(y / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(interactables);
    if (!hits.length) return;

    const obj = hits[0].object;
    const type = obj.userData?.type;

    if (isFocusing) {
      // If click not on art, exit
      if (type !== "art") exitFocus();
      return;
    }

    if (type === "floor") {
      const currentY = Math.floor(camera.position.y / floorHeight) * floorHeight;
      moveCamera(hits[0].point.x, currentY + 5, hits[0].point.z);
      return;
    }

    if (type === "art") {
      focusArt(obj.userData);
    }
  }

  function moveCamera(x, y, z) {
    new TWEEN.Tween(camera.position)
      .to({ x, y, z }, 900)
      .easing(TWEEN.Easing.Cubic.Out)
      .start();
  }

  function focusArt(meta) {
    isFocusing = true;
    savedPos.copy(camera.position);

    new TWEEN.Tween(camera.position)
      .to(meta.viewPos, 900)
      .easing(TWEEN.Easing.Cubic.InOut)
      .start();

    lookTarget = new THREE.Vector3(meta.lookAt.x, meta.lookAt.y, meta.lookAt.z);

    setTimeout(() => {
      $("back-btn").classList.add("visible");
      startAI(meta.data);
    }, 450);
  }

  function exitFocus() {
    isFocusing = false;
    lookTarget = null;

    $("back-btn").classList.remove("visible");
    $("ai-panel").classList.remove("active");
    $("blueprint").classList.remove("active");
    $("registration").classList.remove("active");

    new TWEEN.Tween(camera.position)
      .to({ x: savedPos.x, y: savedPos.y, z: savedPos.z }, 700)
      .easing(TWEEN.Easing.Cubic.Out)
      .start();
  }

  // Mouse / touch controls (drag to look, click to interact)
  function onDown(x, y, target) {
    if (target !== renderer.domElement) return;
    if (isFocusing) {
      handleClick(x, y);
      return;
    }
    isDragging = true;
    downX = lastX = x;
    downY = lastY = y;
  }

  function onMove(x, y) {
    if (!isDragging) return;
    const dx = x - lastX;
    const dy = y - lastY;
    lon -= dx * 0.15;
    lat += dy * 0.15;
    lat = clamp(lat, -85, 85);
    lastX = x;
    lastY = y;
  }

  function onUp(x, y, target) {
    if (target !== renderer.domElement) return;
    const moved = Math.abs(x - downX) + Math.abs(y - downY);
    isDragging = false;
    if (moved < 8) handleClick(x, y);
  }

  document.addEventListener("mousedown", (e) => onDown(e.clientX, e.clientY, e.target));
  document.addEventListener("mousemove", (e) => onMove(e.clientX, e.clientY));
  document.addEventListener("mouseup", (e) => onUp(e.clientX, e.clientY, e.target));

  document.addEventListener("touchstart", (e) => onDown(e.touches[0].clientX, e.touches[0].clientY, e.target), { passive: true });
  document.addEventListener("touchmove", (e) => onMove(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
  document.addEventListener("touchend", (e) => onUp(e.changedTouches[0].clientX, e.changedTouches[0].clientY, e.target), { passive: true });

  // ---------- AI Panel (OFFLINE SAFE) ----------
  let collectedInterests = [];
  let currentArt = null;
  let chatHistory = [];
  let currentPersona = "docent";
  const userProfile = { age: null, goal: null };

  function addMsg(role, txt) {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const d = document.createElement("div");
    d.className = `msg msg-${role}`;
    d.id = `msg-${id}`;
    d.textContent = txt;
    const s = $("chat-stream");
    s.appendChild(d);
    s.scrollTop = s.scrollHeight;
    return id;
  }

  function keywordTag(text) {
    const t = (text || "").toLowerCase();
    if (t.match(/color|tone|light|shadow|composition|line|brush|texture/)) return "Technique";
    if (t.match(/history|movement|modern|contemporary|symbol|meaning|context/)) return "History";
    return "Emotion";
  }

  function localDocentReply(userText, art) {
    const tag = keywordTag(userText);
    const prompts = {
      Technique: [
        "Try describing the *edges* you see: are they soft, sharp, or broken?",
        "Look for a dominant shape rhythm — big/medium/small. Where is it strongest?",
        "If you had to recreate the lighting in one sentence, what would it be?"
      ],
      History: [
        "What kind of context might this work belong to: personal diary, social commentary, or formal study?",
        "If this work lived beside a historical movement, which one would you pair it with, and why?",
        "What do you think the artist is *arguing* for (or against) through the image?"
      ],
      Emotion: [
        "Name one emotion you feel — then point to one visual reason that creates it.",
        "If this piece is a scene in a film, what happens right before and right after?",
        "What title would *you* give it if the current title disappeared?"
      ]
    };

    const hook = (prompts[tag] || prompts.Emotion)[Math.floor(Math.random() * 3)];
    const reply =
      `Let’s stay with your first impression.\n` +
      `**${art.title}** feels like a doorway: what is it inviting you to notice?\n` +
      `${hook}`;

    // Save if user wrote something meaningful
    const save = (userText || "").trim().length >= 18;
    return { reply, save, tag };
  }

  function localBlueprint(profile, interests) {
    const tags = interests.map(i => i.tag);
    const top = tags.sort((a,b) =>
      tags.filter(x=>x===b).length - tags.filter(x=>x===a).length
    )[0] || "Technique";

    const title = profile.goal === "Collect"
      ? "Your Collector’s Lens Blueprint"
      : profile.goal === "Teach / Curate"
        ? "Your Curatorial Learning Blueprint"
        : "Your Learning Blueprint";

    const desc =
      `Based on your journey tags (focus: ${top}), here’s a 3-level path you can use inside FEI TeamArt / LFC.`;

    const steps = [
      `Level 1 (Observe): Choose 3 works you saved. Write 3 sentences each: what you see, what you feel, what you question.`,
      `Level 2 (Analyze): Pick 1 tag (${top}). Do a small study: composition map + a 20-minute sketch response.`,
      `Level 3 (Create): Make a final piece inspired by 2 artworks from different floors. Add a short artist statement (5–8 lines).`
    ];

    return { title, desc, steps };
  }

  function startAI(art) {
    currentArt = art;
    chatHistory = [];

    $("ai-img").src = art.imgFull || art.imgThumb || "";
    $("ai-title").textContent = art.title || "Untitled";
    $("ai-meta").textContent = `${art.artist || "Unknown"} · ${art.year || "—"} · Floor ${art.floor}`;

    $("chat-stream").innerHTML = "";
    $("ai-panel").classList.add("active");

    currentPersona = "docent";
    $("btn-docent").classList.add("active");
    $("btn-curator").classList.remove("active");

    addMsg("ai", "Welcome. What strikes you first about this piece?");
  }

  function sendUserMessage() {
    const input = $("user-input");
    const txt = (input.value || "").trim();
    if (!txt) return;

    input.value = "";
    addMsg("user", txt);

    const loadId = addMsg("ai", "…");

    // Offline reply
    const res = localDocentReply(txt, currentArt);
    const loadEl = $(`msg-${loadId}`);
    if (loadEl) loadEl.remove();

    addMsg("ai", res.reply);

    if (res.save) {
      collectedInterests.push({ art: currentArt.title, tag: res.tag });
      $("journey-count").textContent = String(collectedInterests.length);
      showToast(`Saved: ${res.tag}`);
    }
  }

  function openRegistration() {
    $("registration").classList.add("active");
  }

  function closeRegistration() {
    $("registration").classList.remove("active");
  }

  function submitRegistration() {
    userProfile.age = $("reg-age").value;
    userProfile.goal = $("reg-goal").value;
    closeRegistration();
    showFinalCurriculum();
  }

  function showFinalCurriculum() {
    $("blueprint").classList.add("active");
    const bp = localBlueprint(userProfile, collectedInterests);

    $("bp-title").textContent = bp.title;
    $("bp-desc").textContent = bp.desc;

    $("bp-steps").innerHTML = "";
    bp.steps.forEach((s, i) => {
      const div = document.createElement("div");
      div.className = "bp-step";
      div.innerHTML = `<b>Level ${i + 1}</b><div style="color:#475569; line-height:1.6;">${s}</div>`;
      $("bp-steps").appendChild(div);
    });
  }

  function closeBlueprint() {
    $("blueprint").classList.remove("active");
  }

  // Mode buttons
  $("btn-docent").onclick = () => {
    currentPersona = "docent";
    $("btn-docent").classList.add("active");
    $("btn-curator").classList.remove("active");
    showToast("Docent mode");
  };
  $("btn-curator").onclick = () => {
    // locked (no real AI key in browser)
    showToast("Curator is premium (not enabled)");
  };

  // Wire UI
  $("panel-close").onclick = exitFocus;
  $("back-btn").onclick = exitFocus;

  $("send-btn").onclick = sendUserMessage;
  $("user-input").addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendUserMessage();
  });

  $("journey-btn").onclick = () => {
    exitFocus();
    if (!userProfile.age) openRegistration();
    else showFinalCurriculum();
  };

  $("close-registration").onclick = closeRegistration;
  $("submit-registration").onclick = submitRegistration;

  $("close-blueprint").onclick = closeBlueprint;

  // ---------- Floor navigation ----------
  function goToLevel(level) {
    exitFocus();
    shield(true);

    // Build once
    buildLevel(level);

    // Update UI
    updateElevator(level);

    // Move camera
    moveCamera(0, level * floorHeight + 5, 30);

    setTimeout(() => shield(false), 350);
  }

  // ---------- Animation Loop ----------
  function animate() {
    requestAnimationFrame(animate);
    TWEEN.update();

    if (lookTarget) {
      camera.lookAt(lookTarget);
    } else {
      const phi = THREE.MathUtils.degToRad(90 - lat);
      const theta = THREE.MathUtils.degToRad(lon);
      const target = new THREE.Vector3(
        camera.position.x + 500 * Math.sin(phi) * Math.cos(theta),
        camera.position.y + 500 * Math.cos(phi),
        camera.position.z + 500 * Math.sin(phi) * Math.sin(theta)
      );
      camera.lookAt(target);
    }

    renderer.render(scene, camera);
  }

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  });

  // ---------- Init ----------
  (async function init() {
    await loadArtworks();

    // Build initial floors
    buildLevel(0);
    buildLevel(1);

    buildElevatorUI();

    // Loader finish
    $("load-fill").style.width = "100%";
    setTimeout(() => { $("loader").style.opacity = "0"; }, 350);
    setTimeout(() => { $("loader").style.display = "none"; }, 900);

    animate();
  })();

  // Expose goToLevel for debugging (optional)
  window.goToLevel = goToLevel;
})();
