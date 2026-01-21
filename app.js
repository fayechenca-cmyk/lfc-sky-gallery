// ==========================================
// 1. CONFIGURATION
// ==========================================
// ✅ YOUR URL
const AI_ENDPOINT = "https://lfc-ai-gateway.fayechenca.workers.dev/chat"; 

let userProfile = { role: [], goal: [], ageGroup: "Adult" };

const ATRIUM_CONFIG = {
  videoLink: "https://www.youtube.com/watch?v=ooi2V2Fp2-k",
  videoThumb: "https://img.youtube.com/vi/ooi2V2Fp2-k/hqdefault.jpg",
  title: "LFC Sky Artspace", subtitle: "Learning From Collections", tagline: "From Viewing to Knowing.",
  desc: "LFC Sky Artspace is a collection-led art education system.",
  method: "Collection-to-Creation Framework", steps: "Visit → Analyze → Create"
};

// ✅ RESTORED: Full 12 Floors with Types
const FLOORS = [
  { id: 0, name: "The Atrium", type: "reception" },
  { id: 1, name: "Painting / Fine Art", type: "fineart" },
  { id: 2, name: "Print", type: "standard" },
  { id: 3, name: "Photography", type: "standard" },
  { id: 4, name: "Sculpture", type: "standard" },
  { id: 5, name: "Installation", type: "installation" }, // 3D Plinths
  { id: 6, name: "Ceramics", type: "standard" },
  { id: 7, name: "Design", type: "standard" },
  { id: 8, name: "Animation", type: "standard" },
  { id: 9, name: "Film / Video", type: "darkroom" }, // Black Walls
  { id: 10, name: "Performance", type: "standard" },
  { id: 11, name: "Sketch", type: "standard" },
  { id: 12, name: "Contemporary Lens", type: "standard" },
];

let ART_DATA = []; let CATALOG = []; let chatHistory = []; let collectedInterests = []; let currentOpenArt = null; const interactables = []; 

// ==========================================
// 2. REGISTRATION & ENTRANCE
// ==========================================
function showRegistration() {
  document.getElementById('entrance-content').style.opacity = '0';
  setTimeout(() => { document.getElementById('reg-panel').classList.add('active'); }, 300);
}

function toggleOption(category, btn) {
  btn.classList.toggle('selected');
  const txt = btn.innerText;
  const idx = userProfile[category].indexOf(txt);
  if(idx > -1) userProfile[category].splice(idx, 1); else userProfile[category].push(txt);
  
  const enterBtn = document.getElementById('final-enter-btn');
  if(userProfile.role.length > 0 && userProfile.goal.length > 0) enterBtn.classList.add('ready');
  else enterBtn.classList.remove('ready');
}

function completeRegistration() {
  if(userProfile.role.length === 0 || userProfile.goal.length === 0) return;
  document.body.classList.add('doors-open');
  setTimeout(() => {
    document.getElementById('entrance-layer').style.display = 'none';
    document.getElementById('reg-panel').style.display = 'none';
  }, 2000);
}

// ==========================================
// 3. THREE.JS SCENE SETUP
// ==========================================
const container = document.getElementById("canvas-container");
const scene = new THREE.Scene();
const skyColor = new THREE.Color(0xf0f9ff);
scene.background = skyColor;
scene.fog = new THREE.Fog(skyColor, 15, 140);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 30); 

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0xe0f2fe, 0.7); scene.add(hemiLight);
const dirLight = new THREE.DirectionalLight(0xfffaed, 1); dirLight.position.set(50, 100, 50); dirLight.castShadow = true; scene.add(dirLight);

// --- MATERIALS (Restored Variety) ---
const matFloor = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
const matFloorDark = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.6 });
const matWall = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
const matWallDark = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
const matFrame = new THREE.MeshStandardMaterial({ color: 0x111111 });
const matPlinth = new THREE.MeshStandardMaterial({ color: 0xeeeeee });

const textureLoader = new THREE.TextureLoader();
textureLoader.crossOrigin = "anonymous"; 

// ==========================================
// 4. RICH GALLERY BUILDER
// ==========================================
const floorHeight = 40; 

function createTextTexture(cfg) {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 1024; const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 1024, 1024);
  ctx.fillStyle = '#1e3a8a'; ctx.font = 'bold 50px Arial'; ctx.fillText(cfg.title, 60, 100);
  ctx.font = 'italic 36px Times New Roman'; ctx.fillStyle = '#333'; ctx.fillText(cfg.subtitle, 60, 150);
  ctx.fillStyle = '#22c55e'; ctx.font = 'bold 30px Arial'; ctx.fillText(cfg.tagline, 60, 230);
  ctx.fillStyle = '#444'; ctx.font = '28px Arial';
  const words = cfg.desc.split(' '); let line = ''; let y = 300;
  for(let n = 0; n < words.length; n++) { const testLine = line + words[n] + ' '; if (ctx.measureText(testLine).width > 900 && n > 0) { ctx.fillText(line, 60, y); line = words[n] + ' '; y += 40; } else { line = testLine; } }
  ctx.fillText(line, 60, y); y += 80; ctx.fillStyle = '#1e3a8a'; ctx.font = 'bold 32px Arial'; ctx.fillText(cfg.method, 60, y); y += 50; ctx.fillStyle = '#666'; ctx.font = '28px Arial'; ctx.fillText(cfg.steps, 60, y);
  return new THREE.CanvasTexture(canvas);
}

// ✅ FALLBACK TEXTURE (Safety Net)
function createFallbackTexture(text) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 640; const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f1f5f9'; ctx.fillRect(0, 0, 512, 640);
  ctx.fillStyle = '#1e3a8a'; ctx.font = 'bold 30px Arial'; ctx.textAlign = 'center';
  ctx.fillText("LFC COLLECTION", 256, 300); 
  ctx.font = 'italic 18px Arial'; ctx.fillStyle = '#64748b'; ctx.fillText(text.substring(0,30), 256, 350);
  return new THREE.CanvasTexture(canvas);
}

function buildGallery() {
  FLOORS.forEach(f => {
    const y = f.id * floorHeight; 
    const group = new THREE.Group();
    
    // ✅ RESTORED: Dynamic Materials
    let fMat = (f.type === "darkroom") ? matFloorDark : matFloor; 
    let wMat = (f.type === "darkroom") ? matWallDark : matWall;

    const floor = new THREE.Mesh(new THREE.BoxGeometry(40, 0.5, 120), fMat); floor.position.set(0, y, 0); group.add(floor);
    const ceil = new THREE.Mesh(new THREE.BoxGeometry(40, 0.5, 120), wMat); ceil.position.set(0, y+16, 0); group.add(ceil);
    const w1 = new THREE.Mesh(new THREE.BoxGeometry(1, 16, 120), wMat); w1.position.set(19.5, y+8, 0); group.add(w1);
    const w2 = new THREE.Mesh(new THREE.BoxGeometry(1, 16, 120), wMat); w2.position.set(-19.5, y+8, 0); group.add(w2);

    // ATRIUM
    if (f.id === 0) {
      createArtFrame(group, -19.4, y+6, -10, Math.PI/2, 10, 6, { title: "Introduction Video", artist: "Watch on YouTube", img: ATRIUM_CONFIG.videoThumb, link: ATRIUM_CONFIG.videoLink, isExternal: true });
      createArtFrame(group, 19.4, y+6, -10, -Math.PI/2, 10, 8, { title: "Manifesto", artist: "LFC System", texture: createTextTexture(ATRIUM_CONFIG) });
      createArtFrame(group, 0, y+7, -50, 0, 12, 6, { title: "LFC SYSTEM", artist: "FEI TeamArt", img: "https://placehold.co/1200x600/1e3a8a/ffffff?text=LFC+ART+SPACE" });
    }

    // SPECIAL ROOMS
    if (f.type === "installation") createPlinths(group, y);

    // ARTWORK PLACEMENT (With Safety Net)
    const arts = ART_DATA.filter(a => a.floor == f.id);
    
    if(arts.length > 0) {
      arts.forEach((data, i) => {
        const isRight = i % 2 === 0; const x = isRight ? 19.4 : -19.4; const z = -45 + (i * 12); 
        let w = 4, h = 5; if(f.type === "darkroom") { w = 8; h = 4.5; }
        createArtFrame(group, x, y+6.5, z, isRight ? -Math.PI/2 : Math.PI/2, w, h, data);
      });
    } else if (f.id !== 0) {
      // ✅ RESTORED: If no data, fill with placeholders
      for(let i=0; i<6; i++) {
        const isRight = i % 2 === 0;
        createArtFrame(group, isRight?19.4:-19.4, y+6.5, -40+(i*15), isRight?-Math.PI/2:Math.PI/2, 4, 5, { title: `Future Exhibit`, artist: f.name, img: "" });
      }
    }

    scene.add(group);
    
    const btn = document.createElement("div"); btn.className = "floor-item"; btn.innerHTML = `<div class="floor-label">${f.name}</div><div class="floor-num">${f.id}</div>`; btn.onclick = () => goToFloor(f.id); document.getElementById("elevator").prepend(btn);
  });
}

function createPlinths(group, y) {
  [0, -15, 15].forEach(z => {
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(4, 1.2, 4), matPlinth); plinth.position.set(0, y + 0.6, z); group.add(plinth);
    const hitbox = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 5), new THREE.MeshBasicMaterial({ visible:false })); hitbox.position.set(0, y+3, z); 
    hitbox.userData = { type: "art", data: { title: "Installation View", artist: "3D Works", img: "" }, viewPos: { x: 8, y: y+5, z: z+8 } }; 
    interactables.push(hitbox); group.add(hitbox);
  });
}

function createArtFrame(group, x, y, z, rot, w, h, data) {
  const frameGroup = new THREE.Group(); frameGroup.position.set(x, y, z); frameGroup.rotation.y = rot;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w+0.2, h+0.2, 0.2), matFrame); frameGroup.add(frame);
  const canvas = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0xeeeeee })); 
  canvas.position.z = 0.15; frameGroup.add(canvas);

  if (data.texture) {
    canvas.material = new THREE.MeshBasicMaterial({ map: data.texture });
  } else if (data.img) {
    // ✅ FALLBACK SYSTEM
    textureLoader.load(data.img, (tex) => {
      canvas.material = new THREE.MeshBasicMaterial({ map: tex });
      canvas.material.needsUpdate = true;
    }, undefined, () => { 
      canvas.material = new THREE.MeshBasicMaterial({ map: createFallbackTexture(data.title) });
    });
  } else {
    canvas.material = new THREE.MeshBasicMaterial({ map: createFallbackTexture(data.title) });
  }

  const hitbox = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.5), new THREE.MeshBasicMaterial({ visible: false }));
  hitbox.userData = { type: "art", data: data, viewPos: { x: x + Math.sin(rot)*10, y: y, z: z + Math.cos(rot)*10 } };
  interactables.push(hitbox); frameGroup.add(hitbox); group.add(frameGroup);
}

// ==========================================
// 5. PHYSICS NAVIGATION
// ==========================================
const velocity = new THREE.Vector3(); const speed = 1.8; const friction = 0.85; const lookSpeed = 0.002;
let moveForward=false, moveBackward=false, moveLeft=false, moveRight=false;
document.addEventListener('keydown', (e) => { if(e.code==='ArrowUp'||e.code==='KeyW') moveForward=true; if(e.code==='ArrowLeft'||e.code==='KeyA') moveLeft=true; if(e.code==='ArrowDown'||e.code==='KeyS') moveBackward=true; if(e.code==='ArrowRight'||e.code==='KeyD') moveRight=true; });
document.addEventListener('keyup', (e) => { if(e.code==='ArrowUp'||e.code==='KeyW') moveForward=false; if(e.code==='ArrowLeft'||e.code==='KeyA') moveLeft=false; if(e.code==='ArrowDown'||e.code==='KeyS') moveBackward=false; if(e.code==='ArrowRight'||e.code==='KeyD') moveRight=false; });
function updatePhysics() { if (document.body.classList.contains("ai-open")) return; velocity.x *= friction; velocity.z *= friction; const forward = getForwardVector(); const right = getRightVector(); if(moveForward) velocity.addScaledVector(forward, speed); if(moveBackward) velocity.addScaledVector(forward, -speed); if(moveLeft) velocity.addScaledVector(right, -speed); if(moveRight) velocity.addScaledVector(right, speed); camera.position.x += velocity.x * 0.015; camera.position.z += velocity.z * 0.015; camera.position.x = Math.max(-18, Math.min(18, camera.position.x)); camera.position.z = Math.max(-100, Math.min(100, camera.position.z)); }
function getForwardVector() { const d=new THREE.Vector3(); camera.getWorldDirection(d); d.y=0; d.normalize(); return d; }
function getRightVector() { const f=getForwardVector(); return new THREE.Vector3().crossVectors(f, new THREE.Vector3(0,1,0)).normalize(); }
let isDragging=false, prevMouse={x:0,y:0};
document.addEventListener('pointerdown', (e)=>{ if(!e.target.closest('button') && !e.target.closest('#ai-panel') && !e.target.closest('#entrance-layer')) { isDragging=true; prevMouse={x:e.clientX,y:e.clientY}; }});
document.addEventListener('pointerup', ()=>{isDragging=false;});
document.addEventListener('pointermove', (e)=>{ if(!isDragging || document.body.classList.contains("ai-open")) return; const dx=e.clientX-prevMouse.x, dy=e.clientY-prevMouse.y; const euler=new THREE.Euler(0,0,0,'YXZ'); euler.setFromQuaternion(camera.quaternion); euler.y-=dx*lookSpeed; euler.x-=dy*lookSpeed; euler.x=Math.max(-Math.PI/2.5, Math.min(Math.PI/2.5, euler.x)); camera.quaternion.setFromEuler(euler); prevMouse={x:e.clientX,y:e.clientY}; });
window.moveStart=(d)=>{if(d==='f')moveForward=true;if(d==='b')moveBackward=true;if(d==='l')moveLeft=true;if(d==='r')moveRight=true;}; window.moveStop=()=>{moveForward=false;moveBackward=false;moveLeft=false;moveRight=false;};

// ==========================================
// 6. INTERACTION & AI
// ==========================================
function goToFloor(id) { closeBlueprint(); exitFocus(); new TWEEN.Tween(camera.position).to({ y: (id * floorHeight) + 5 }, 2500).easing(TWEEN.Easing.Quadratic.InOut).start(); }
function focusArt(userData) {
  if (userData.data.isExternal && userData.data.link) { window.open(userData.data.link, "_blank"); return; }
  currentOpenArt = userData.data; document.body.classList.add("ai-open"); camera.userData.returnPos = camera.position.clone(); camera.userData.returnQuat = camera.quaternion.clone(); const t = userData.viewPos; new TWEEN.Tween(camera.position).to({ x:t.x, y:t.y, z:t.z }, 1800).easing(TWEEN.Easing.Cubic.Out).onComplete(()=>{openAI(userData.data); document.getElementById("back-btn").classList.add("visible");}).start(); const dum = new THREE.Object3D(); dum.position.copy(t); dum.lookAt(userData.data.x||t.x, t.y, userData.data.z||t.z); new TWEEN.Tween(camera.quaternion).to({ x:dum.quaternion.x, y:dum.quaternion.y, z:dum.quaternion.z, w:dum.quaternion.w }, 1500).easing(TWEEN.Easing.Cubic.Out).start();
}
function exitFocus() { document.body.classList.remove("ai-open"); document.getElementById("ai-panel").classList.remove("active"); document.getElementById("back-btn").classList.remove("visible"); currentOpenArt = null; if(camera.userData.returnPos) { new TWEEN.Tween(camera.position).to(camera.userData.returnPos, 1200).easing(TWEEN.Easing.Quadratic.Out).start(); new TWEEN.Tween(camera.quaternion).to(camera.userData.returnQuat, 1200).easing(TWEEN.Easing.Quadratic.Out).start(); } }

function openAI(data) {
  document.getElementById("ai-panel").classList.add("active");
  if (data.texture) document.getElementById("ai-img").src = "https://placehold.co/800x600/1e3a8a/ffffff?text=LFC+Info"; else document.getElementById("ai-img").src = data.img;
  document.getElementById("ai-title").innerText = data.title; document.getElementById("ai-meta").innerText = (data.artist || "Unknown") + " • " + (data.year || "—");
  chatHistory = []; document.getElementById("chat-stream").innerHTML = "";
  addChatMsg("ai", "I am observing this piece with you. What do you see?");
}

async function sendChat() {
  const i=document.getElementById("user-input"), txt=i.value.trim(); if(!txt)return;
  addChatMsg("user",txt); i.value="";
  try {
    const artPayload = currentOpenArt ? { title: currentOpenArt.title, artist: currentOpenArt.artist, year: currentOpenArt.year, medium: currentOpenArt.medium, floor: "Gallery" } : { title: "Unknown" };
    const res = await fetch(AI_ENDPOINT, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({
      message:txt, history:chatHistory, art: artPayload, 
      userProfile: userProfile // Send array of roles/goals
    })});
    if(!res.ok) throw new Error(res.status);
    const d=await res.json();
    
    // ✅ FIX: SCRUB JSON
    let cleanReply = d.reply;
    if (typeof cleanReply === 'string') {
        cleanReply = cleanReply.replace(/```json/g, '').replace(/```/g, '').trim();
        if(cleanReply.startsWith('{')) { try { const p = JSON.parse(cleanReply); if(p.reply) cleanReply = p.reply; } catch(e){} }
    }

    addChatMsg("ai", cleanReply); chatHistory.push({role:"model", parts:[{text:cleanReply}]});
    
    if(d.save && d.tag) { collectedInterests.push(d.tag); document.getElementById("journey-count").innerText=collectedInterests.length; }
  } catch(e) { 
    console.error(e);
    addChatMsg("ai", "⚠️ Connection Error. Please check your internet connection.");
  }
}
function addChatMsg(r,t) { const d=document.createElement("div"); d.className=`msg msg-${r}`; d.innerText=t; document.getElementById("chat-stream").appendChild(d); }

// ✅ SMART CURRICULUM GENERATOR
function startBlueprint() {
  document.getElementById("blueprint").classList.add("active");
  const container = document.getElementById("bp-products");
  container.innerHTML = "<h3>Generating Plan...</h3>";
  
  setTimeout(() => {
    let recs = [];
    const roles = userProfile.role.join(" ").toLowerCase();
    const goals = userProfile.goal.join(" ").toLowerCase();
    
    if (CATALOG.products) {
      if (roles.includes("student") || goals.includes("learn") || goals.includes("teach")) {
        recs.push(CATALOG.products.find(p => p.id.includes("001")) || {title:"Intro Course"});
        recs.push(CATALOG.products.find(p => p.id.includes("003")) || {title:"Color Theory"});
      }
      if (roles.includes("artist") || goals.includes("market") || goals.includes("technique")) {
        recs.push(CATALOG.products.find(p => p.id.includes("brand")) || {title:"Brand Creator"});
      }
      if (recs.length === 0) recs.push(CATALOG.products[0]);
    }

    let html = "";
    recs.forEach(p => {
      if(p) {
        html += `
        <div class="plan-card">
          <span class="plan-tag">Recommended</span>
          <h3>${p.title}</h3>
          <p>${p.price > 0 ? "$"+p.price : "Free"}</p>
          <button class="plan-btn" onclick="window.open('${p.buyUrl||p.detailsUrl}', '_blank')">
            ${p.buyUrl ? "Enroll Now" : "Join Waitlist"}
          </button>
        </div>`;
      }
    });
    container.innerHTML = html;
    
    document.getElementById("bp-desc").innerHTML = `
      As a <strong>${userProfile.role.join(", ")}</strong> interested in <strong>${userProfile.goal.join(", ")}</strong>, 
      and having explored <em>${collectedInterests.length > 0 ? collectedInterests.join(", ") : "various concepts"}</em>, 
      we recommend this path:
    `;
    
    document.getElementById("bp-steps").innerHTML = `
      <div style="background:#f8fafc; padding:15px; border-radius:10px; margin-bottom:10px; border-left:4px solid var(--blue);"><strong>Step 1: Observation</strong><br>Analyze visual structures in the gallery.</div>
      <div style="background:#f8fafc; padding:15px; border-radius:10px; margin-bottom:10px; border-left:4px solid #22c55e;"><strong>Step 2: Context</strong><br>Connect historical references to modern theory.</div>
    `;

  }, 800);
}

// ==========================================
// 7. INIT
// ==========================================
function animate(){ requestAnimationFrame(animate); TWEEN.update(); updatePhysics(); renderer.render(scene, camera); }
animate();
const cr=new THREE.Raycaster(), cm=new THREE.Vector2();
document.addEventListener('pointerup',(e)=>{if(isDragging)return; cm.x=(e.clientX/window.innerWidth)*2-1; cm.y=-(e.clientY/window.innerHeight)*2+1; cr.setFromCamera(cm,camera); const h=cr.intersectObjects(interactables); if(h.length>0 && h[0].object.userData.type==="art") focusArt(h[0].object.userData); });

fetch('artworks.json').then(r=>r.json()).then(d=>{ if(d.floors) Object.values(d.floors).forEach(f=>f.items.forEach(i=>ART_DATA.push(i))); else ART_DATA=d; buildGallery(); }).catch(()=>buildGallery());
fetch('catalog.json').then(r=>r.json()).then(d=>CATALOG=d);

window.showRegistration = showRegistration;
window.toggleOption = toggleOption;
window.completeRegistration = completeRegistration;
document.getElementById("send-btn").onclick=sendChat; document.getElementById("user-input").onkeypress=(e)=>{if(e.key==="Enter")sendChat();};
window.startBlueprint=startBlueprint; window.closeBlueprint=()=>{document.getElementById("blueprint").classList.remove("active");}; window.exitFocus=exitFocus; window.goToFloor=goToFloor;
