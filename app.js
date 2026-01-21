// ==========================================
// 1. CONFIGURATION & SETUP
// ==========================================

// ⚠️ REPLACE THIS with your Cloudflare Worker URL
const AI_ENDPOINT = "https://lfc-gallery-api.YOURNAME.workers.dev/chat"; 

const FLOORS = [
  { id: 0, name: "Reception", type: "reception" },
  { id: 1, name: "Painting", type: "standard" },
  { id: 2, name: "Photography", type: "standard" },
  { id: 3, name: "Design", type: "standard" },
  { id: 4, name: "Sculpture", type: "standard" },
  { id: 5, name: "Film/Video", type: "darkroom" }
];

let ART_DATA = []; 
let CATALOG = [];  
let chatHistory = [];
let collectedInterests = [];
const interactables = []; // Things we can click on

// --- THREE.JS SCENE SETUP ---
const container = document.getElementById("canvas-container");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe0f2fe);
scene.fog = new THREE.Fog(0xe0f2fe, 15, 120);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 30); // Start position

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

// Lighting
const hemiLight = new THREE.HemisphereLight(0xffffff, 0xdbeafe, 0.6);
scene.add(hemiLight);
const dirLight = new THREE.DirectionalLight(0xfffaed, 1);
dirLight.position.set(50, 100, 50);
dirLight.castShadow = true;
scene.add(dirLight);

// Materials
const matFloor = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
const matWall = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
const matFrame = new THREE.MeshStandardMaterial({ color: 0x111111 });

// ==========================================
// 2. GALLERY BUILDER (Floors & Art)
// ==========================================
const floorHeight = 35;

function buildGallery() {
  FLOORS.forEach(f => {
    const y = f.id * floorHeight;
    const group = new THREE.Group();
    
    // Floor
    const floor = new THREE.Mesh(new THREE.BoxGeometry(40, 0.5, 100), matFloor);
    floor.position.set(0, y, 0);
    // Don't add floors to interactables, we use logic to change floors
    group.add(floor);

    // Ceiling
    const ceil = new THREE.Mesh(new THREE.BoxGeometry(40, 0.5, 100), matWall);
    ceil.position.set(0, y+15, 0);
    group.add(ceil);

    // Side Walls
    const w1 = new THREE.Mesh(new THREE.BoxGeometry(1, 15, 100), matWall);
    w1.position.set(19.5, y+7.5, 0);
    group.add(w1);
    
    const w2 = new THREE.Mesh(new THREE.BoxGeometry(1, 15, 100), matWall);
    w2.position.set(-19.5, y+7.5, 0);
    group.add(w2);

    // Populate Art
    const arts = ART_DATA.filter(a => a.floor == f.id);
    if(arts.length > 0) {
      arts.forEach((data, i) => {
        const isRight = i % 2 === 0;
        const x = isRight ? 19 : -19;
        const z = -40 + (i * 15); 
        createArtFrame(group, x, y+6, z, isRight ? -Math.PI/2 : Math.PI/2, data);
      });
    } else {
      // Empty floor placeholder
      createArtFrame(group, 0, y+6, -45, 0, { title: f.name, artist: "LFC Gallery", img: "" });
    }

    scene.add(group);
    
    // Add Elevator Button to HTML
    const btn = document.createElement("div");
    btn.className = "floor-item";
    btn.innerHTML = `<div class="floor-label">${f.name}</div><div class="floor-num">${f.id}</div>`;
    btn.onclick = () => goToFloor(f.id);
    document.getElementById("elevator").prepend(btn);
  });
}

function createArtFrame(group, x, y, z, rot, data) {
  const frameGroup = new THREE.Group();
  frameGroup.position.set(x, y, z);
  frameGroup.rotation.y = rot;

  // Frame
  const frame = new THREE.Mesh(new THREE.BoxGeometry(4.2, 5.2, 0.2), matFrame);
  frameGroup.add(frame);

  // Canvas
  const canvas = new THREE.Mesh(new THREE.PlaneGeometry(4, 5), new THREE.MeshBasicMaterial({ color: 0xeeeeee }));
  canvas.position.z = 0.11;
  frameGroup.add(canvas);

  if (data.img) {
    new THREE.TextureLoader().load(data.img, (tex) => {
      canvas.material = new THREE.MeshBasicMaterial({ map: tex });
      canvas.material.needsUpdate = true;
    });
  }

  // Hitbox (Clickable)
  const hitbox = new THREE.Mesh(new THREE.BoxGeometry(4, 5, 0.5), new THREE.MeshBasicMaterial({ visible: false }));
  hitbox.userData = { type: "art", data: data, viewPos: { x: x + Math.sin(rot)*8, y: y, z: z + Math.cos(rot)*8 } };
  interactables.push(hitbox);
  frameGroup.add(hitbox);

  group.add(frameGroup);
}

// ==========================================
// 3. PHYSICS NAVIGATION (The Game Feel)
// ==========================================
const velocity = new THREE.Vector3();
const speed = 1.8;
const friction = 0.85;
const lookSpeed = 0.002;

let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;

// Keyboard Listeners
document.addEventListener('keydown', (e) => {
  if(e.code === 'ArrowUp' || e.code === 'KeyW') moveForward = true;
  if(e.code === 'ArrowLeft' || e.code === 'KeyA') moveLeft = true;
  if(e.code === 'ArrowDown' || e.code === 'KeyS') moveBackward = true;
  if(e.code === 'ArrowRight' || e.code === 'KeyD') moveRight = true;
});
document.addEventListener('keyup', (e) => {
  if(e.code === 'ArrowUp' || e.code === 'KeyW') moveForward = false;
  if(e.code === 'ArrowLeft' || e.code === 'KeyA') moveLeft = false;
  if(e.code === 'ArrowDown' || e.code === 'KeyS') moveBackward = false;
  if(e.code === 'ArrowRight' || e.code === 'KeyD') moveRight = false;
});

// Mouse Wheel Walk
document.addEventListener('wheel', (e) => {
  if(document.body.classList.contains("ai-open")) return;
  const delta = Math.sign(e.deltaY) * -1;
  const forward = getForwardVector();
  velocity.addScaledVector(forward, delta * 5.0);
}, { passive: false });

// Physics Loop
function updatePhysics() {
  if (document.body.classList.contains("ai-open")) return;

  velocity.x *= friction;
  velocity.z *= friction;

  const forward = getForwardVector();
  const right = getRightVector();

  if (moveForward) velocity.addScaledVector(forward, speed);
  if (moveBackward) velocity.addScaledVector(forward, -speed);
  if (moveLeft) velocity.addScaledVector(right, -speed);
  if (moveRight) velocity.addScaledVector(right, speed);

  const delta = 0.015; 
  camera.position.x += velocity.x * delta;
  camera.position.z += velocity.z * delta;

  // Simple Collision (Stay in hall)
  camera.position.x = Math.max(-18, Math.min(18, camera.position.x));
  camera.position.z = Math.max(-48, Math.min(48, camera.position.z));
}

function getForwardVector() {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  dir.y = 0; dir.normalize();
  return dir;
}
function getRightVector() {
  const forward = getForwardVector();
  const up = new THREE.Vector3(0, 1, 0);
  return new THREE.Vector3().crossVectors(forward, up).normalize();
}

// Looking Around (Drag)
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

document.addEventListener('pointerdown', (e) => {
  if(e.target.closest('button') || e.target.closest('#ai-panel')) return;
  isDragging = true;
  previousMousePosition = { x: e.clientX, y: e.clientY };
});
document.addEventListener('pointerup', () => { isDragging = false; });
document.addEventListener('pointermove', (e) => {
  if (!isDragging || document.body.classList.contains("ai-open")) return;
  const deltaMove = { x: e.clientX - previousMousePosition.x, y: e.clientY - previousMousePosition.y };
  
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  euler.setFromQuaternion(camera.quaternion);
  euler.y -= deltaMove.x * lookSpeed;
  euler.x -= deltaMove.y * lookSpeed;
  euler.x = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, euler.x));
  
  camera.quaternion.setFromEuler(euler);
  previousMousePosition = { x: e.clientX, y: e.clientY };
});

// Mobile Pad hooks
window.moveStart = function(dir) {
  if (dir === 'f') moveForward = true;
  if (dir === 'b') moveBackward = true;
  if (dir === 'l') moveLeft = true;
  if (dir === 'r') moveRight = true;
};
window.moveStop = function() {
  moveForward = false; moveBackward = false; moveLeft = false; moveRight = false;
};

// ==========================================
// 4. INTERACTION & AI LOGIC
// ==========================================

function goToFloor(id) {
  closeBlueprint();
  exitFocus();
  // Elevator
  new TWEEN.Tween(camera.position)
    .to({ y: (id * floorHeight) + 5 }, 2000)
    .easing(TWEEN.Easing.Quadratic.InOut)
    .start();
}

function focusArt(userData) {
  document.body.classList.add("ai-open");
  
  camera.userData.returnPos = camera.position.clone();
  camera.userData.returnQuat = camera.quaternion.clone();

  const targetPos = userData.viewPos;
  
  // Move to Art
  new TWEEN.Tween(camera.position)
    .to({ x: targetPos.x, y: targetPos.y, z: targetPos.z }, 1500)
    .easing(TWEEN.Easing.Cubic.Out)
    .onComplete(() => {
        openAI(userData.data);
        document.getElementById("back-btn").classList.add("visible");
    })
    .start();

  // Look at Art
  const dummy = new THREE.Object3D();
  dummy.position.copy(targetPos);
  dummy.lookAt(userData.data.x || targetPos.x, targetPos.y, userData.data.z || targetPos.z);
  
  new TWEEN.Tween(camera.quaternion)
    .to({ x: dummy.quaternion.x, y: dummy.quaternion.y, z: dummy.quaternion.z, w: dummy.quaternion.w }, 1500)
    .easing(TWEEN.Easing.Cubic.Out)
    .start();
}

function exitFocus() {
  document.body.classList.remove("ai-open");
  document.getElementById("ai-panel").classList.remove("active");
  document.getElementById("back-btn").classList.remove("visible");

  if (camera.userData.returnPos) {
    new TWEEN.Tween(camera.position).to(camera.userData.returnPos, 1000).easing(TWEEN.Easing.Quadratic.Out).start();
    new TWEEN.Tween(camera.quaternion).to(camera.userData.returnQuat, 1000).easing(TWEEN.Easing.Quadratic.Out).start();
  }
}

// AI Chat
function openAI(data) {
  document.getElementById("ai-panel").classList.add("active");
  document.getElementById("ai-img").src = data.img;
  document.getElementById("ai-title").innerText = data.title;
  document.getElementById("ai-meta").innerText = (data.artist || "Unknown") + " • " + (data.year || "—");
  
  chatHistory = [];
  document.getElementById("chat-stream").innerHTML = "";
  addChatMsg("ai", "Hello. What catches your eye about this piece?");
}

async function sendChat() {
  const input = document.getElementById("user-input");
  const txt = input.value.trim();
  if(!txt) return;
  
  addChatMsg("user", txt);
  input.value = "";

  const payload = {
    message: txt,
    history: chatHistory,
    art: {
      title: document.getElementById("ai-title").innerText,
      artist: document.getElementById("ai-meta").innerText
    },
    userProfile: { age: "Adult", goal: "Learn" } 
  };

  try {
    const res = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    
    addChatMsg("ai", data.reply);
    chatHistory.push({ role: "user", parts: [{ text: txt }] });
    chatHistory.push({ role: "model", parts: [{ text: data.reply }] });

    if(data.save) {
      collectedInterests.push(data.tag || "Art Interest");
      document.getElementById("journey-count").innerText = collectedInterests.length;
    }

  } catch(e) {
    addChatMsg("ai", "I'm having trouble connecting to the archive.");
  }
}

function addChatMsg(role, text) {
  const div = document.createElement("div");
  div.className = `msg msg-${role}`;
  div.innerText = text;
  document.getElementById("chat-stream").appendChild(div);
}

// --- BLUEPRINT / CATALOG SYSTEM ---
function startBlueprint() {
  document.getElementById("blueprint").classList.add("active");
  const container = document.getElementById("bp-products");
  container.innerHTML = "<h3>Loading Recommendations...</h3>";
  
  // Simulated AI Logic for now
  const interests = collectedInterests.join(", ");
  
  setTimeout(() => {
    const recs = [];
    if (interests.toLowerCase().includes("paint")) recs.push("intro-painting");
    else recs.push("art-history-101"); 
    recs.push("vr-sculpting-advanced"); 

    let html = "";
    recs.forEach(id => {
      const product = CATALOG.products.find(p => p.id === id);
      if (product) {
        html += `
        <div class="plan-card">
          <span class="plan-tag">Available Now</span>
          <h3>${product.title}</h3>
          <p>${product.price}</p>
          <button class="plan-btn" onclick="window.open('${product.url}','_blank')">Enroll Now</button>
        </div>`;
      } else {
        html += `
        <div class="plan-card">
          <span class="plan-tag" style="color:var(--gray)">Coming Soon</span>
          <h3>Advanced VR Sculpting</h3>
          <p>Interest detected. Join waitlist.</p>
          <button class="plan-btn waitlist-btn" onclick="window.location.href='mailto:you@email.com'">Request Class</button>
        </div>`;
      }
    });

    container.innerHTML = html;
    document.getElementById("bp-steps").innerHTML = "<p>Based on your interests: <strong>" + (interests || "General Art") + "</strong></p>";
  }, 1000);
}
function closeBlueprint() { document.getElementById("blueprint").classList.remove("active"); }

// --- MAIN LOOP ---
function animate() {
  requestAnimationFrame(animate);
  TWEEN.update();
  updatePhysics();
  renderer.render(scene, camera);
}
animate();

// --- CLICK HANDLER ---
const clickRaycaster = new THREE.Raycaster();
const clickMouse = new THREE.Vector2();
document.addEventListener('pointerup', (event) => {
  if (isDragging) return; 
  clickMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  clickMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  clickRaycaster.setFromCamera(clickMouse, camera);
  const intersects = clickRaycaster.intersectObjects(interactables);
  if (intersects.length > 0) {
    const obj = intersects[0].object;
    if (obj.userData.type === "art") focusArt(obj.userData);
  }
});

// --- LOAD DATA ---
fetch('artworks.json').then(r => r.json()).then(data => {
  if(data.floors) {
    Object.values(data.floors).forEach(f => {
      f.items.forEach(item => ART_DATA.push(item));
    });
  } else {
    ART_DATA = data;
  }
  buildGallery();
}).catch(e => console.log("No artworks.json, using defaults"));

fetch('catalog.json').then(r => r.json()).then(data => {
  CATALOG = data;
});

// Bind UI
document.getElementById("send-btn").onclick = sendChat;
document.getElementById("user-input").onkeypress = (e) => { if(e.key === "Enter") sendChat(); };
window.startBlueprint = startBlueprint;
window.closeBlueprint = closeBlueprint;
window.exitFocus = exitFocus;
window.goToFloor = goToFloor;
