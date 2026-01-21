// ==========================================
// 1. CONFIGURATION (AI & FLOORS)
// ==========================================

// ⚠️ CHANGE THIS URL to your real Cloudflare worker!
// Example: "https://lfc-gallery-api.fayechenca.workers.dev/chat"
const AI_ENDPOINT = "https://lfc-gallery-api.fayechenca.workers.dev/chat"; 

// The Full Floor Plan (Restored)
const FLOORS = [
  { id: 0, name: "Reception", type: "reception" },
  { id: 1, name: "Painting / Fine Art", type: "fineart" },
  { id: 2, name: "Print", type: "standard" },
  { id: 3, name: "Photography", type: "standard" },
  { id: 4, name: "Sculpture", type: "standard" },
  { id: 5, name: "Installation", type: "installation" }, // Flexible 3D space
  { id: 6, name: "Ceramics", type: "standard" },
  { id: 7, name: "Design", type: "standard" },
  { id: 8, name: "Animation", type: "standard" },
  { id: 9, name: "Film / Video", type: "darkroom" }, // Dark room
  { id: 10, name: "Performance", type: "standard" },
  { id: 11, name: "Sketch", type: "standard" },
  { id: 12, name: "Contemporary Lens", type: "standard" },
];

let ART_DATA = []; 
let CATALOG = [];  
let chatHistory = [];
let collectedInterests = [];
const interactables = []; 

// ==========================================
// 2. THREE.JS SCENE SETUP
// ==========================================
const container = document.getElementById("canvas-container");
const scene = new THREE.Scene();
const skyColor = new THREE.Color(0xe0f2fe);
scene.background = skyColor;
scene.fog = new THREE.Fog(skyColor, 15, 140);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 30); 

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
const matFloorDark = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.6 }); // For Video Room
const matWall = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
const matWallDark = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 }); // For Video Room
const matFrame = new THREE.MeshStandardMaterial({ color: 0x111111 });
const matPlinth = new THREE.MeshStandardMaterial({ color: 0xeeeeee }); // For Installation stands

// ==========================================
// 3. RICH GALLERY BUILDER
// ==========================================
const floorHeight = 40; // More space between floors

function buildGallery() {
  FLOORS.forEach(f => {
    const y = f.id * floorHeight;
    const group = new THREE.Group();
    
    // Choose Materials based on Room Type
    let fMat = matFloor;
    let wMat = matWall;
    if (f.type === "darkroom") { fMat = matFloorDark; wMat = matWallDark; }

    // Floor
    const floor = new THREE.Mesh(new THREE.BoxGeometry(40, 0.5, 120), fMat);
    floor.position.set(0, y, 0);
    group.add(floor);

    // Ceiling
    const ceil = new THREE.Mesh(new THREE.BoxGeometry(40, 0.5, 120), wMat);
    ceil.position.set(0, y+16, 0);
    group.add(ceil);

    // Side Walls
    const w1 = new THREE.Mesh(new THREE.BoxGeometry(1, 16, 120), wMat);
    w1.position.set(19.5, y+8, 0);
    group.add(w1);
    
    const w2 = new THREE.Mesh(new THREE.BoxGeometry(1, 16, 120), wMat);
    w2.position.set(-19.5, y+8, 0);
    group.add(w2);

    // SPECIAL ROOMS: Installation (Stands) & Video
    if (f.type === "installation") {
      createPlinths(group, y);
    } 

    // POPULATE ART
    const arts = ART_DATA.filter(a => a.floor == f.id);
    
    // If we have data, use it
    if(arts.length > 0) {
      arts.forEach((data, i) => {
        // Layout: Left/Right walls
        const isRight = i % 2 === 0;
        const x = isRight ? 19.4 : -19.4;
        const z = -45 + (i * 12); 
        const rot = isRight ? -Math.PI/2 : Math.PI/2;
        
        // Video room screens are larger and horizontal
        let w = 4, h = 5;
        if(f.type === "darkroom") { w = 8; h = 4.5; }

        createArtFrame(group, x, y+6.5, z, rot, w, h, data);
      });
    } else {
      // Empty floor placeholders
      for(let i=0; i<6; i++) {
        const isRight = i % 2 === 0;
        const x = isRight ? 19.4 : -19.4;
        const z = -40 + (i * 15);
        const rot = isRight ? -Math.PI/2 : Math.PI/2;
        createArtFrame(group, x, y+6.5, z, rot, 4, 5, { 
          title: `Floor ${f.id}`, artist: f.name, img: "" 
        });
      }
    }

    scene.add(group);
    
    // Elevator UI
    const btn = document.createElement("div");
    btn.className = "floor-item";
    btn.innerHTML = `<div class="floor-label">${f.name}</div><div class="floor-num">${f.id}</div>`;
    btn.onclick = () => goToFloor(f.id);
    document.getElementById("elevator").prepend(btn);
  });
}

function createPlinths(group, y) {
  // Create 3 stands in the middle of the room for 3D objects
  const positions = [0, -15, 15];
  positions.forEach(z => {
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(4, 1.2, 4), matPlinth);
    plinth.position.set(0, y + 0.6, z);
    group.add(plinth);
    
    // Invisible hitbox for the stand
    const hitbox = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 5), new THREE.MeshBasicMaterial({ visible:false }));
    hitbox.position.set(0, y+3, z);
    hitbox.userData = { 
      type: "art", 
      data: { title: "Installation View", artist: "3D Works", img: "" },
      viewPos: { x: 8, y: y+5, z: z+8 } // Stand back to see it
    };
    interactables.push(hitbox);
    group.add(hitbox);
  });
}

function createArtFrame(group, x, y, z, rot, w, h, data) {
  const frameGroup = new THREE.Group();
  frameGroup.position.set(x, y, z);
  frameGroup.rotation.y = rot;

  // Frame
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w+0.2, h+0.2, 0.2), matFrame);
  frameGroup.add(frame);

  // Canvas
  const canvas = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0xeeeeee }));
  canvas.position.z = 0.11;
  frameGroup.add(canvas);

  if (data.img) {
    new THREE.TextureLoader().load(data.img, (tex) => {
      canvas.material = new THREE.MeshBasicMaterial({ map: tex });
      canvas.material.needsUpdate = true;
    });
  }

  // Hitbox (Clickable)
  const hitbox = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.5), new THREE.MeshBasicMaterial({ visible: false }));
  // viewPos: We stand 8 units back and slightly angled to see it clearly
  hitbox.userData = { 
    type: "art", 
    data: data, 
    viewPos: { x: x + Math.sin(rot)*10, y: y, z: z + Math.cos(rot)*10 } 
  };
  interactables.push(hitbox);
  frameGroup.add(hitbox);

  group.add(frameGroup);
}

// ==========================================
// 4. PHYSICS NAVIGATION (Game Feel)
// ==========================================
const velocity = new THREE.Vector3();
const speed = 1.8;
const friction = 0.85; // Sliding feel
const lookSpeed = 0.002;

let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;

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

  // Collision (Stay in hall)
  camera.position.x = Math.max(-18, Math.min(18, camera.position.x));
  camera.position.z = Math.max(-100, Math.min(100, camera.position.z));
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

// Look Around (Drag)
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

// Mobile Controls
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
// 5. INTERACTION & AI LOGIC
// ==========================================

function goToFloor(id) {
  closeBlueprint();
  exitFocus();
  // Smooth Elevator
  new TWEEN.Tween(camera.position)
    .to({ y: (id * floorHeight) + 5 }, 2500)
    .easing(TWEEN.Easing.Quadratic.InOut)
    .start();
}

function focusArt(userData) {
  document.body.classList.add("ai-open");
  
  // Save return spot
  camera.userData.returnPos = camera.position.clone();
  camera.userData.returnQuat = camera.quaternion.clone();

  const targetPos = userData.viewPos;
  
  // Smoothly move to Viewing Position (Not too close!)
  new TWEEN.Tween(camera.position)
    .to({ x: targetPos.x, y: targetPos.y, z: targetPos.z }, 1800)
    .easing(TWEEN.Easing.Cubic.Out)
    .onComplete(() => {
        openAI(userData.data);
        document.getElementById("back-btn").classList.add("visible");
    })
    .start();

  // Rotate to face Art
  const dummy = new THREE.Object3D();
  dummy.position.copy(targetPos);
  // Look slightly up or down depending on art height
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
    // Return to where we were standing
    new TWEEN.Tween(camera.position).to(camera.userData.returnPos, 1200).easing(TWEEN.Easing.Quadratic.Out).start();
    new TWEEN.Tween(camera.quaternion).to(camera.userData.returnQuat, 1200).easing(TWEEN.Easing.Quadratic.Out).start();
  }
}

// AI CHAT & DIAGNOSIS
function openAI(data) {
  document.getElementById("ai-panel").classList.add("active");
  document.getElementById("ai-img").src = data.img;
  document.getElementById("ai-title").innerText = data.title;
  document.getElementById("ai-meta").innerText = (data.artist || "Unknown") + " • " + (data.year || "—");
  
  chatHistory = [];
  document.getElementById("chat-stream").innerHTML = "";
  addChatMsg("ai", "I am observing this piece with you. What do you see?");
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

    if (!res.ok) throw new Error(`Server Error: ${res.status}`);

    const data = await res.json();
    addChatMsg("ai", data.reply);
    chatHistory.push({ role: "user", parts: [{ text: txt }] });
    chatHistory.push({ role: "model", parts: [{ text: data.reply }] });

    if(data.save) {
      collectedInterests.push(data.tag || "Art Interest");
      document.getElementById("journey-count").innerText = collectedInterests.length;
    }

  } catch(e) {
    console.error(e);
    // DETAILED ERROR MESSAGE FOR YOU
    if(e.message.includes("404")) {
      addChatMsg("ai", "⚠️ Error 404: The URL is wrong. Check the 'AI_ENDPOINT' line in app.js.");
    } else if(e.message.includes("500")) {
      addChatMsg("ai", "⚠️ Error 500: Cloudflare Key is missing. Check your Worker 'Variables'.");
    } else {
      addChatMsg("ai", "⚠️ Connection Failed. Please check your internet or Cloudflare URL.");
    }
  }
}

function addChatMsg(role, text) {
  const div = document.createElement("div");
  div.className = `msg msg-${role}`;
  div.innerText = text;
  document.getElementById("chat-stream").appendChild(div);
}

// ==========================================
// 6. MAIN LOOP & INIT
// ==========================================
function animate() {
  requestAnimationFrame(animate);
  TWEEN.update();
  updatePhysics();
  renderer.render(scene, camera);
}
animate();

// Click Handler
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

// Load Data
fetch('artworks.json').then(r => r.json()).then(data => {
  if(data.floors) {
    Object.values(data.floors).forEach(f => {
      f.items.forEach(item => ART_DATA.push(item));
    });
  } else {
    ART_DATA = data;
  }
  buildGallery();
}).catch(() => {
  console.log("Using default data");
  buildGallery();
});

fetch('catalog.json').then(r => r.json()).then(data => { CATALOG = data; });

// Bind UI
document.getElementById("send-btn").onclick = sendChat;
document.getElementById("user-input").onkeypress = (e) => { if(e.key === "Enter") sendChat(); };
window.startBlueprint = function() { document.getElementById("blueprint").classList.add("active"); };
window.closeBlueprint = function() { document.getElementById("blueprint").classList.remove("active"); };
window.exitFocus = exitFocus;
window.goToFloor = goToFloor;
