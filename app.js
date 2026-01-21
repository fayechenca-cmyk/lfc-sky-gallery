// ==========================================
// 1. CONFIGURATION (CONTENT)
// ==========================================

// ⚠️ CHANGE THIS to your real Cloudflare URL
const AI_ENDPOINT = "https://lfc-ai-gateway.fayechenca.workers.dev/chat"; 

// --- ATRIUM CONTENT (Floor 0) ---
const ATRIUM_CONFIG = {
  // The YouTube Link
  videoLink: "https://www.youtube.com/watch?v=ooi2V2Fp2-k",
  // Auto-fetched thumbnail (HQ)
  videoThumb: "https://img.youtube.com/vi/ooi2V2Fp2-k/hqdefault.jpg", 
  
  // The Text Panel
  title: "LFC Sky Artspace",
  subtitle: "Learning From Collections",
  tagline: "From Viewing to Knowing. From Knowing to Making.",
  desc: "LFC Sky Artspace is a collection-led art education system that mirrors the experience of learning inside a real art space—online. Students visit selected artworks, explore personal taste, then build deeper understanding through guided layers: historical background, artist intention, materials/process, visual structure, and contemporary theory.",
  method: "Collection-to-Creation Framework (CCF)",
  steps: "Visit → Analyze → Discuss → Connect → Create"
};

const FLOORS = [
  { id: 0, name: "The Atrium", type: "reception" },
  { id: 1, name: "Painting / Fine Art", type: "fineart" },
  { id: 2, name: "Print", type: "standard" },
  { id: 3, name: "Photography", type: "standard" },
  { id: 4, name: "Sculpture", type: "standard" },
  { id: 5, name: "Installation", type: "installation" },
  { id: 6, name: "Ceramics", type: "standard" },
  { id: 7, name: "Design", type: "standard" },
  { id: 8, name: "Animation", type: "standard" },
  { id: 9, name: "Film / Video", type: "darkroom" },
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

const hemiLight = new THREE.HemisphereLight(0xffffff, 0xdbeafe, 0.6);
scene.add(hemiLight);
const dirLight = new THREE.DirectionalLight(0xfffaed, 1);
dirLight.position.set(50, 100, 50);
dirLight.castShadow = true;
scene.add(dirLight);

const matFloor = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
const matFloorDark = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.6 });
const matWall = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
const matWallDark = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
const matFrame = new THREE.MeshStandardMaterial({ color: 0x111111 });
const matPlinth = new THREE.MeshStandardMaterial({ color: 0xeeeeee });

// ==========================================
// 3. GALLERY BUILDER & TEXT GENERATOR
// ==========================================
const floorHeight = 40; 

// Helper to draw your text onto a texture automatically
function createTextTexture(cfg) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  
  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 1024, 1024);
  
  // Title
  ctx.fillStyle = '#1e3a8a'; // Blue
  ctx.font = 'bold 50px Arial';
  ctx.fillText(cfg.title, 60, 100);
  
  ctx.font = 'italic 36px Times New Roman';
  ctx.fillStyle = '#333';
  ctx.fillText(cfg.subtitle, 60, 150);

  // Tagline
  ctx.fillStyle = '#22c55e'; // Green
  ctx.font = 'bold 30px Arial';
  ctx.fillText(cfg.tagline, 60, 230);

  // Body Text (Word Wrap)
  ctx.fillStyle = '#444';
  ctx.font = '28px Arial';
  const words = cfg.desc.split(' ');
  let line = '';
  let y = 300;
  for(let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > 900 && n > 0) {
      ctx.fillText(line, 60, y);
      line = words[n] + ' ';
      y += 40;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, 60, y);

  // Footer Method
  y += 80;
  ctx.fillStyle = '#1e3a8a';
  ctx.font = 'bold 32px Arial';
  ctx.fillText(cfg.method, 60, y);
  
  y += 50;
  ctx.fillStyle = '#666';
  ctx.font = '28px Arial';
  ctx.fillText(cfg.steps, 60, y);

  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

function buildGallery() {
  FLOORS.forEach(f => {
    const y = f.id * floorHeight;
    const group = new THREE.Group();
    
    let fMat = matFloor;
    let wMat = matWall;
    if (f.type === "darkroom") { fMat = matFloorDark; wMat = matWallDark; }

    // Structure
    const floor = new THREE.Mesh(new THREE.BoxGeometry(40, 0.5, 120), fMat);
    floor.position.set(0, y, 0);
    group.add(floor);

    const ceil = new THREE.Mesh(new THREE.BoxGeometry(40, 0.5, 120), wMat);
    ceil.position.set(0, y+16, 0);
    group.add(ceil);

    const w1 = new THREE.Mesh(new THREE.BoxGeometry(1, 16, 120), wMat);
    w1.position.set(19.5, y+8, 0);
    group.add(w1);
    
    const w2 = new THREE.Mesh(new THREE.BoxGeometry(1, 16, 120), wMat);
    w2.position.set(-19.5, y+8, 0);
    group.add(w2);

    // --- ATRIUM (Floor 0) ---
    if (f.id === 0) {
      // 1. YouTube Screen (Left)
      // We use the thumbnail. Clicking it opens the link.
      createArtFrame(group, -19.4, y+6, -10, Math.PI/2, 10, 6, {
        title: "Introduction Video", 
        artist: "Watch on YouTube", 
        img: ATRIUM_CONFIG.videoThumb,
        link: ATRIUM_CONFIG.videoLink, // Special link property
        isExternal: true
      });
      
      // 2. Generated Text Panel (Right)
      const textTex = createTextTexture(ATRIUM_CONFIG);
      createArtFrame(group, 19.4, y+6, -10, -Math.PI/2, 10, 8, {
        title: "Manifesto", artist: "LFC System", texture: textTex
      });
      
      // 3. Logo (Back)
      createArtFrame(group, 0, y+7, -50, 0, 12, 6, {
        title: "LFC SYSTEM", artist: "FEI TeamArt", img: "https://placehold.co/1200x600/1e3a8a/ffffff?text=LFC+ART+SPACE"
      });
    }

    // --- INSTALLATION ROOM ---
    if (f.type === "installation") createPlinths(group, y);

    // --- ARTWORKS ---
    const arts = ART_DATA.filter(a => a.floor == f.id);
    if(arts.length > 0) {
      arts.forEach((data, i) => {
        const isRight = i % 2 === 0;
        const x = isRight ? 19.4 : -19.4;
        const z = -45 + (i * 12); 
        const rot = isRight ? -Math.PI/2 : Math.PI/2;
        let w = 4, h = 5;
        if(f.type === "darkroom") { w = 8; h = 4.5; }
        createArtFrame(group, x, y+6.5, z, rot, w, h, data);
      });
    } else if (f.id !== 0) {
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
  const positions = [0, -15, 15];
  positions.forEach(z => {
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(4, 1.2, 4), matPlinth);
    plinth.position.set(0, y + 0.6, z);
    group.add(plinth);
    const hitbox = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 5), new THREE.MeshBasicMaterial({ visible:false }));
    hitbox.position.set(0, y+3, z);
    hitbox.userData = { type: "art", data: { title: "Installation View", artist: "3D Works", img: "" }, viewPos: { x: 8, y: y+5, z: z+8 } };
    interactables.push(hitbox);
    group.add(hitbox);
  });
}

function createArtFrame(group, x, y, z, rot, w, h, data) {
  const frameGroup = new THREE.Group();
  frameGroup.position.set(x, y, z);
  frameGroup.rotation.y = rot;

  const frame = new THREE.Mesh(new THREE.BoxGeometry(w+0.2, h+0.2, 0.2), matFrame);
  frameGroup.add(frame);

  const canvas = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0xeeeeee }));
  canvas.position.z = 0.11;
  frameGroup.add(canvas);

  // Texture Logic
  if (data.texture) {
    // Dynamic text texture (generated)
    canvas.material = new THREE.MeshBasicMaterial({ map: data.texture });
  } else if (data.img) {
    // Standard image
    new THREE.TextureLoader().load(data.img, (tex) => {
      canvas.material = new THREE.MeshBasicMaterial({ map: tex });
      canvas.material.needsUpdate = true;
    });
  }

  // Hitbox
  const hitbox = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.5), new THREE.MeshBasicMaterial({ visible: false }));
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
// 4. PHYSICS NAVIGATION
// ==========================================
const velocity = new THREE.Vector3();
const speed = 1.8;
const friction = 0.85;
const lookSpeed = 0.002;
let moveForward=false, moveBackward=false, moveLeft=false, moveRight=false;

document.addEventListener('keydown', (e) => {
  if(e.code==='ArrowUp'||e.code==='KeyW') moveForward=true;
  if(e.code==='ArrowLeft'||e.code==='KeyA') moveLeft=true;
  if(e.code==='ArrowDown'||e.code==='KeyS') moveBackward=true;
  if(e.code==='ArrowRight'||e.code==='KeyD') moveRight=true;
});
document.addEventListener('keyup', (e) => {
  if(e.code==='ArrowUp'||e.code==='KeyW') moveForward=false;
  if(e.code==='ArrowLeft'||e.code==='KeyA') moveLeft=false;
  if(e.code==='ArrowDown'||e.code==='KeyS') moveBackward=false;
  if(e.code==='ArrowRight'||e.code==='KeyD') moveRight=false;
});

function updatePhysics() {
  if (document.body.classList.contains("ai-open")) return;
  velocity.x *= friction; velocity.z *= friction;
  const forward = getForwardVector();
  const right = getRightVector();
  if(moveForward) velocity.addScaledVector(forward, speed);
  if(moveBackward) velocity.addScaledVector(forward, -speed);
  if(moveLeft) velocity.addScaledVector(right, -speed);
  if(moveRight) velocity.addScaledVector(right, speed);
  
  camera.position.x += velocity.x * 0.015;
  camera.position.z += velocity.z * 0.015;
  camera.position.x = Math.max(-18, Math.min(18, camera.position.x));
  camera.position.z = Math.max(-100, Math.min(100, camera.position.z));
}
function getForwardVector() { const d=new THREE.Vector3(); camera.getWorldDirection(d); d.y=0; d.normalize(); return d; }
function getRightVector() { const f=getForwardVector(); return new THREE.Vector3().crossVectors(f, new THREE.Vector3(0,1,0)).normalize(); }

let isDragging=false, prevMouse={x:0,y:0};
document.addEventListener('pointerdown', (e)=>{ if(!e.target.closest('button') && !e.target.closest('#ai-panel')) { isDragging=true; prevMouse={x:e.clientX,y:e.clientY}; }});
document.addEventListener('pointerup', ()=>{isDragging=false;});
document.addEventListener('pointermove', (e)=>{
  if(!isDragging || document.body.classList.contains("ai-open")) return;
  const dx=e.clientX-prevMouse.x, dy=e.clientY-prevMouse.y;
  const euler=new THREE.Euler(0,0,0,'YXZ'); euler.setFromQuaternion(camera.quaternion);
  euler.y-=dx*lookSpeed; euler.x-=dy*lookSpeed; euler.x=Math.max(-Math.PI/2.5, Math.min(Math.PI/2.5, euler.x));
  camera.quaternion.setFromEuler(euler); prevMouse={x:e.clientX,y:e.clientY};
});
window.moveStart=function(d){if(d==='f')moveForward=true;if(d==='b')moveBackward=true;if(d==='l')moveLeft=true;if(d==='r')moveRight=true;};
window.moveStop=function(){moveForward=false;moveBackward=false;moveLeft=false;moveRight=false;};

// ==========================================
// 5. INTERACTION & AI
// ==========================================
function goToFloor(id) {
  closeBlueprint(); exitFocus();
  new TWEEN.Tween(camera.position).to({ y: (id * floorHeight) + 5 }, 2500).easing(TWEEN.Easing.Quadratic.InOut).start();
}
function focusArt(userData) {
  // If it is an external link (like YouTube), open it and don't zoom
  if (userData.data.isExternal && userData.data.link) {
    window.open(userData.data.link, "_blank");
    return;
  }

  document.body.classList.add("ai-open");
  camera.userData.returnPos = camera.position.clone();
  camera.userData.returnQuat = camera.quaternion.clone();
  const t = userData.viewPos;
  new TWEEN.Tween(camera.position).to({ x:t.x, y:t.y, z:t.z }, 1800).easing(TWEEN.Easing.Cubic.Out).onComplete(()=>{openAI(userData.data); document.getElementById("back-btn").classList.add("visible");}).start();
  const dum = new THREE.Object3D(); dum.position.copy(t); dum.lookAt(userData.data.x||t.x, t.y, userData.data.z||t.z);
  new TWEEN.Tween(camera.quaternion).to({ x:dum.quaternion.x, y:dum.quaternion.y, z:dum.quaternion.z, w:dum.quaternion.w }, 1500).easing(TWEEN.Easing.Cubic.Out).start();
}
function exitFocus() {
  document.body.classList.remove("ai-open"); document.getElementById("ai-panel").classList.remove("active"); document.getElementById("back-btn").classList.remove("visible");
  if(camera.userData.returnPos) { new TWEEN.Tween(camera.position).to(camera.userData.returnPos, 1200).easing(TWEEN.Easing.Quadratic.Out).start(); new TWEEN.Tween(camera.quaternion).to(camera.userData.returnQuat, 1200).easing(TWEEN.Easing.Quadratic.Out).start(); }
}
function openAI(data) {
  document.getElementById("ai-panel").classList.add("active");
  // If we have a generated texture, we don't show it in the chat header, just a generic icon
  if (data.texture) {
    document.getElementById("ai-img").src = "https://placehold.co/800x600/1e3a8a/ffffff?text=LFC+Info";
  } else {
    document.getElementById("ai-img").src = data.img;
  }
  document.getElementById("ai-title").innerText = data.title;
  document.getElementById("ai-meta").innerText = (data.artist || "Unknown") + " • " + (data.year || "—");
  chatHistory = []; document.getElementById("chat-stream").innerHTML = "";
  addChatMsg("ai", "I am observing this piece with you. What do you see?");
}
async function sendChat() {
  const i=document.getElementById("user-input"), txt=i.value.trim(); if(!txt)return;
  addChatMsg("user",txt); i.value="";
  try {
    const res = await fetch(AI_ENDPOINT, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({message:txt, history:chatHistory, art:{title:document.getElementById("ai-title").innerText}, userProfile:{age:"Adult"}}) });
    if(!res.ok) throw new Error(res.status);
    const d=await res.json();
    addChatMsg("ai",d.reply); chatHistory.push({role:"model", parts:[{text:d.reply}]});
    if(d.save) { collectedInterests.push(d.tag||"Art"); document.getElementById("journey-count").innerText=collectedInterests.length; }
  } catch(e) { 
    addChatMsg("ai", e.message.includes("404")?"⚠️ Error 404: Check AI URL in app.js": "⚠️ Connection Error. Check Cloudflare.");
  }
}
function addChatMsg(r,t) { const d=document.createElement("div"); d.className=`msg msg-${r}`; d.innerText=t; document.getElementById("chat-stream").appendChild(d); }

// ==========================================
// 6. INIT
// ==========================================
function animate(){ requestAnimationFrame(animate); TWEEN.update(); updatePhysics(); renderer.render(scene, camera); }
animate();
const cr=new THREE.Raycaster(), cm=new THREE.Vector2();
document.addEventListener('pointerup',(e)=>{if(isDragging)return; cm.x=(e.clientX/window.innerWidth)*2-1; cm.y=-(e.clientY/window.innerHeight)*2+1; cr.setFromCamera(cm,camera); const h=cr.intersectObjects(interactables); if(h.length>0 && h[0].object.userData.type==="art") focusArt(h[0].object.userData); });

fetch('artworks.json').then(r=>r.json()).then(d=>{ if(d.floors) Object.values(d.floors).forEach(f=>f.items.forEach(i=>ART_DATA.push(i))); else ART_DATA=d; buildGallery(); }).catch(()=>buildGallery());
fetch('catalog.json').then(r=>r.json()).then(d=>CATALOG=d);

document.getElementById("send-btn").onclick=sendChat; document.getElementById("user-input").onkeypress=(e)=>{if(e.key==="Enter")sendChat();};
window.startBlueprint=()=>{document.getElementById("blueprint").classList.add("active");}; window.closeBlueprint=()=>{document.getElementById("blueprint").classList.remove("active");}; window.exitFocus=exitFocus; window.goToFloor=goToFloor;
