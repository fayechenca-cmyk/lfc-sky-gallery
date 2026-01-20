// ✅ Your Cloudflare Worker AI endpoint (NO KEY here)
const AI_ENDPOINT = "https://lfc-ai-gateway.fayechenca.workers.dev/chat";

// --- Floors ---
const FLOORS = [{ id: 0, name: "Reception", type: "reception" }];
const floorNames = ["Fine Art", "Photography", "Design", "Sculpture", "New Media", "Textile", "Performance", "Architecture", "Ceramics", "Film", "Concepts", "Masters"];
for (let i = 1; i <= 12; i++) {
  const name = floorNames[(i - 1) % floorNames.length];
  let type = "standard";
  if (name === "Fine Art") type = "fineart";
  if (name === "New Media") type = "newmedia";
  FLOORS.push({ id: i, name, type });
}

// You will later replace this with real data in artworks.json
const IMPORTED_ART_DATA = [];
const builtLevels = new Set();

// --- Three.js setup ---
const container = document.getElementById("canvas-container");
const scene = new THREE.Scene();
const skyColor = new THREE.Color(0xe0f2fe);
scene.background = skyColor;
scene.fog = new THREE.Fog(skyColor, 20, 150);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0xdbeafe, 0.7);
scene.add(hemiLight);
const sun = new THREE.DirectionalLight(0xfffaed, 0.9);
sun.position.set(50, 100, 50);
sun.castShadow = true;
sun.shadow.mapSize.width = 2048;
sun.shadow.mapSize.height = 2048;
scene.add(sun);

const textureLoader = new THREE.TextureLoader();
textureLoader.crossOrigin = "anonymous";

const matFloor = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.1 });
const matFloorDark = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
const matWallWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
const matWallDark = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
const matGlass = new THREE.MeshPhysicalMaterial({ color: 0x8899a6, transmission: 0.9, opacity: 0.3, transparent: true, roughness: 0.0, side: THREE.DoubleSide });
const matCurtain = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 1.0 });
const invisibleMat = new THREE.MeshBasicMaterial({ visible: true, transparent: true, opacity: 0 });

const interactables = [];
const floorHeight = 35;

// Base planes
const infiniteFloor = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), matFloor);
infiniteFloor.rotation.x = -Math.PI / 2;
infiniteFloor.receiveShadow = true;
scene.add(infiniteFloor);

const walkPlane = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), invisibleMat);
walkPlane.rotation.x = -Math.PI / 2;
walkPlane.userData = { type: "floor" };
interactables.push(walkPlane);
scene.add(walkPlane);

// --- Build level (cached) ---
function buildLevel(level) {
  if (builtLevels.has(level)) return;
  builtLevels.add(level);

  const y = level * floorHeight;
  const group = new THREE.Group();
  const config = FLOORS[level];
  const width = 40, length = 100;

  let flMat = matFloor, wMat = matWallWhite;
  if (config.type === "newmedia") { flMat = matFloorDark; wMat = matWallDark; }

  const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.5, length), flMat);
  floorMesh.position.set(0, y, 0);
  floorMesh.receiveShadow = true;
  floorMesh.userData = { type: "floor", level };
  interactables.push(floorMesh);
  group.add(floorMesh);

  const ceil = new THREE.Mesh(new THREE.BoxGeometry(width, 0.5, length), wMat);
  ceil.position.set(0, y + 15, 0);
  group.add(ceil);

  if (config.type === "newmedia") {
    const curtain = new THREE.Mesh(new THREE.BoxGeometry(1, 15, length), matCurtain);
    curtain.position.set(-width / 2 + 0.5, y + 7.5, 0);
    group.add(curtain);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(1, 15, length), wMat);
    rightWall.position.set(width / 2 - 0.5, y + 7.5, 0);
    group.add(rightWall);
  } else {
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 15, length), matGlass);
    leftWall.position.set(-width / 2 + 0.5, y + 7.5, 0);
    group.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(1, 15, length), wMat);
    rightWall.position.set(width / 2 - 0.5, y + 7.5, 0);
    group.add(rightWall);
  }

  // Simple art population
  if (level === 0) {
    createArt({
      floor: 0, w: 8, h: 5, x: width / 2 - 1, y: y + 6, z: 0, rot: -Math.PI / 2,
      title: "LFC SYSTEM",
      artist: "FEI TeamArt",
      year: "2026",
      img: "https://placehold.co/1200x800/111/fff?text=LFC+SYSTEM"
    }, true, group);
  } else {
    const floorArt = IMPORTED_ART_DATA.filter(a => a.floor === level);
    if (floorArt.length) floorArt.forEach(a => createArt(a, false, group));
    else populateFallback(level, group);
  }

  scene.add(group);
}

function populateFallback(level, group) {
  const wallX = 19.4, startZ = -40, spacing = 15;
  for (let i = 0; i < 6; i++) {
    const z = startZ + i * spacing;
    createArt({
      floor: level,
      title: `Work ${level}-${i + 1}`,
      artist: "Collection",
      year: "202X",
      img: `https://placehold.co/1200x800/0b1220/ffffff?text=Floor+${level}+Work+${i + 1}`,
      w: 4, h: 5, x: wallX, z, rot: -Math.PI / 2,
      y: (level * floorHeight) + 6
    }, false, group);
  }
}

function createArt(data, isInfo, parentGroup) {
  const group = new THREE.Group();
  group.position.set(data.x || 0, data.y || 0, data.z || 0);
  group.rotation.y = data.rot || 0;

  const frame = new THREE.Mesh(new THREE.BoxGeometry((data.w || 4) + 0.1, (data.h || 5) + 0.1, 0.1), new THREE.MeshStandardMaterial({ color: 0x111111 }));
  group.add(frame);

  const placeholderMat = new THREE.MeshBasicMaterial({ color: 0xcccccc });
  const canvas = new THREE.Mesh(new THREE.PlaneGeometry(data.w || 4, data.h || 5), placeholderMat);
  canvas.position.z = 0.06;
  group.add(canvas);

  if (data.img) {
    textureLoader.load(data.img, (tex) => {
      tex.encoding = THREE.sRGBEncoding;
      canvas.material = new THREE.MeshBasicMaterial({ map: tex });
    });
  }

  if (!isInfo) {
    const hitbox = new THREE.Mesh(new THREE.BoxGeometry(data.w || 4, data.h || 5, 0.6), invisibleMat);
    hitbox.userData = {
      type: "art",
      data,
      viewPos: { x: group.position.x + Math.sin(group.rotation.y) * 8, y: group.position.y, z: group.position.z + Math.cos(group.rotation.y) * 8 },
      lookAt: { x: group.position.x, y: group.position.y, z: group.position.z }
    };
    interactables.push(hitbox);
    group.add(hitbox);
  }

  parentGroup.add(group);
}

// --- UI build ---
function buildElevator() {
  const elev = document.getElementById("elevator");
  elev.innerHTML = "";
  FLOORS.slice().reverse().forEach(f => {
    const b = document.createElement("div");
    b.className = "floor-item";
    b.id = `flr-${f.id}`;
    b.innerHTML = `<div class="floor-label">${f.name}</div><div class="floor-num">${f.id}</div>`;
    b.onclick = () => goToLevel(f.id);
    elev.appendChild(b);
  });
  updateElevator(0);
}

function updateElevator(l) {
  document.querySelectorAll(".floor-item").forEach(b => b.classList.remove("active"));
  const el = document.getElementById(`flr-${l}`);
  if (el) el.classList.add("active");
}

// --- Camera / navigation ---
camera.position.set(0, 5, 30);

let isDragging = false, startX = 0, startY = 0, lon = 0, lat = 0;
let isFocusing = false;
let savedPos = new THREE.Vector3();
let lookTarget = null;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onDown(x, y, target) {
  if (target !== renderer.domElement) return;
  isDragging = true;
  startX = x; startY = y;
}
function onMove(x, y) {
  if (!isDragging || isFocusing) return;
  lon -= (x - startX) * 0.15;
  lat += (y - startY) * 0.15;
  lat = Math.max(-85, Math.min(85, lat));
  startX = x; startY = y;
}
function onUp(x, y, target) {
  if (target !== renderer.domElement) { isDragging = false; return; }
  const isClick = Math.abs(x - startX) < 5 && Math.abs(y - startY) < 5;
  isDragging = false;
  if (isClick) handleClick(x, y);
}

document.addEventListener("mousedown", e => onDown(e.clientX, e.clientY, e.target));
document.addEventListener("mousemove", e => onMove(e.clientX, e.clientY));
document.addEventListener("mouseup", e => onUp(e.clientX, e.clientY, e.target));
document.addEventListener("touchstart", e => onDown(e.touches[0].clientX, e.touches[0].clientY, e.target));
document.addEventListener("touchmove", e => onMove(e.touches[0].clientX, e.touches[0].clientY));
document.addEventListener("touchend", e => onUp(e.changedTouches[0].clientX, e.changedTouches[0].clientY, e.target));

function handleClick(x, y) {
  mouse.x = (x / window.innerWidth) * 2 - 1;
  mouse.y = -(y / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects(interactables);
  if (!intersects.length) return;

  const target = intersects[0].object;
  if (target.userData.type === "floor" && !isFocusing) {
    const currentY = Math.floor(camera.position.y / floorHeight) * floorHeight;
    moveCamera(intersects[0].point.x, currentY + 5, intersects[0].point.z);
  }
  if (target.userData.type === "art" && !isFocusing) {
    focusArt(target.userData);
  }
}

function moveCamera(x, y, z) {
  new TWEEN.Tween(camera.position).to({ x, y, z }, 1200).easing(TWEEN.Easing.Cubic.Out).start();
}

function focusArt(ud) {
  isFocusing = true;
  savedPos.copy(camera.position);

  new TWEEN.Tween(camera.position).to(ud.viewPos, 1000).easing(TWEEN.Easing.Cubic.InOut).start();
  lookTarget = new THREE.Vector3(ud.lookAt.x, ud.lookAt.y, ud.lookAt.z);

  setTimeout(() => {
    document.getElementById("back-btn").classList.add("visible");
    startAI(ud.data);
  }, 800);
}

function exitFocus() {
  isFocusing = false;
  lookTarget = null;
  document.getElementById("back-btn").classList.remove("visible");
  document.getElementById("ai-panel").classList.remove("active");
  new TWEEN.Tween(camera.position).to(savedPos, 800).easing(TWEEN.Easing.Cubic.Out).start();
}

// --- AI Panel (calls Worker) ---
let currentArtData = null;
let currentPersona = "docent";
let chatHistory = []; // {role, text}
let collectedInterests = [];
let userProfile = { age: "Adult", goal: "Learn Art" };

function addMsg(role, txt) {
  const id = Date.now().toString() + Math.random().toString(16).slice(2);
  const d = document.createElement("div");
  d.className = `msg msg-${role}`;
  d.id = `msg-${id}`;
  d.innerText = txt;
  const s = document.getElementById("chat-stream");
  s.appendChild(d);
  s.scrollTop = s.scrollHeight;
  return id;
}

async function callAI(payload) {
  const r = await fetch(AI_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const text = await r.text();
  try { return JSON.parse(text); }
  catch { return { reply: "AI returned an invalid response.", save: false, tag: "Concept" }; }
}

function startAI(data) {
  currentArtData = data;
  chatHistory = [];

  document.getElementById("ai-img").src = data.img || "";
  document.getElementById("ai-title").innerText = data.title || "Untitled";
  document.getElementById("ai-meta").innerText = `${data.artist || "Unknown"}, ${data.year || "202X"}`;

  document.getElementById("chat-stream").innerHTML = "";
  document.getElementById("ai-panel").classList.add("active");

  addMsg("ai", "Welcome. What strikes you first about this piece?");
}

async function sendText(txt) {
  addMsg("user", txt);
  chatHistory.push({ role: "user", text: txt });

  const loadingId = addMsg("ai", "…");
  document.getElementById("send-btn").disabled = true;

  const payload = {
    persona: currentPersona,
    art: {
      title: currentArtData?.title,
      artist: currentArtData?.artist,
      year: currentArtData?.year
    },
    userProfile,
    history: chatHistory.slice(-12)
  };

  let res = null;
  try {
    res = await callAI(payload);
  } catch {
    res = { reply: "AI gateway error. Please try again.", save: false, tag: "Concept" };
  }

  const loadingEl = document.getElementById(`msg-${loadingId}`);
  if (loadingEl) loadingEl.remove();

  addMsg("ai", res.reply || "No reply.");
  chatHistory.push({ role: "model", text: res.reply || "" });

  document.getElementById("send-btn").disabled = false;

  // Save insight (local)
  if (res.save) {
    collectedInterests.push({ art: currentArtData?.title || "Untitled", tag: res.tag || "Concept" });
    document.getElementById("journey-count").innerText = collectedInterests.length;
  }
}

// Buttons
document.getElementById("back-btn").onclick = exitFocus;
document.getElementById("panel-close").onclick = exitFocus;
document.getElementById("btn-docent").onclick = () => {
  currentPersona = "docent";
  document.getElementById("btn-docent").classList.add("active");
  document.getElementById("btn-curator").classList.remove("active");
};
document.getElementById("btn-curator").onclick = () => {
  currentPersona = "curator";
  document.getElementById("btn-curator").classList.add("active");
  document.getElementById("btn-docent").classList.remove("active");
};
document.getElementById("send-btn").onclick = () => {
  const input = document.getElementById("user-input");
  const txt = input.value.trim();
  if (!txt) return;
  input.value = "";
  sendText(txt);
};
document.getElementById("user-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("send-btn").click();
});

// Floor navigation
function goToLevel(lvl) {
  exitFocus();
  buildLevel(lvl);
  updateElevator(lvl);
  moveCamera(0, (lvl * floorHeight) + 5, 30);
}

// --- Init: load artworks.json if present ---
fetch("./artworks.json")
  .then(r => r.ok ? r.json() : Promise.reject())
  .then(data => { IMPORTED_ART_DATA.push(...data); })
  .catch(() => {})
  .finally(() => {
    buildLevel(0);
    buildLevel(1);
    buildElevator();
    document.getElementById("load-fill").style.width = "100%";
    setTimeout(() => { document.getElementById("loader").style.opacity = 0; }, 400);
    setTimeout(() => { document.getElementById("loader").style.display = "none"; }, 900);
  });

// --- Render loop ---
function animate() {
  requestAnimationFrame(animate);
  TWEEN.update();

  if (lookTarget) camera.lookAt(lookTarget);
  else {
    const phi = THREE.MathUtils.degToRad(90 - lat);
    const theta = THREE.MathUtils.degToRad(lon);
    const v = new THREE.Vector3(
      500 * Math.sin(phi) * Math.cos(theta),
      500 * Math.cos(phi),
      500 * Math.sin(phi) * Math.sin(theta)
    );
    camera.lookAt(camera.position.clone().add(v));
  }

  renderer.render(scene, camera);
}
animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
