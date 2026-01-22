// ==========================================
// 1. CONFIGURATION & DATA STRUCTURE
// ==========================================
const AI_ENDPOINT = "https://lfc-ai-gateway.fayechenca.workers.dev/chat";

let userProfile = { role: [], goal: [], ageGroup: "Adult" };

// ✅ DATA ENGINE: Tracks the 4 Pillars
let intentScores = { technique: 0, history: 0, market: 0, theory: 0 };
let questionCount = 0; 

// ✅ CONTENT ENGINE: The "Two-Lane" Journey Data
const LEARNING_PATHS = {
  technique: {
    title: "The Material Observer",
    focus: "Technique & Process",
    reason: "You asked deeply about how the artwork was constructed.",
    learn: ["Impasto & Texture Guide", "The Chemistry of Pigments", "Brushwork Analysis"],
    practice: "Zoom in on one brushstroke. Sketch its direction on paper.",
    reflect: "How does the material change the feeling of the work?",
    next: "Sculpture Floor (Floor 4)"
  },
  history: {
    title: "The Contextual Historian",
    focus: "Time & Context",
    reason: "You focused on the era and the artist's background.",
    learn: ["Timeline of this Era", "Artist Biography", "The World in 2025"],
    practice: "Find one other artist from this same year in the gallery.",
    reflect: "Why did the artist make this *then* and not now?",
    next: "Contemporary Lens (Floor 12)"
  },
  market: {
    title: "The Strategic Collector",
    focus: "Value & Provenance",
    reason: "You inquired about value, collecting, and ownership.",
    learn: ["Auction Results 2024", "How to Value Emerging Art", "Edition Strategy"],
    practice: "Estimate the primary market price vs. secondary market.",
    reflect: "What drives the value of this specific piece?",
    next: "The Atrium (Manifesto)"
  },
  theory: {
    title: "The Critical Thinker",
    focus: "Meaning & Philosophy",
    reason: "You searched for the deeper meaning and concepts.",
    learn: ["Semiotics in Art", "Conceptual Art Manifesto", "Visual Philosophy"],
    practice: "Write one sentence that explains the 'Invisible Meaning' here.",
    reflect: "Is the idea more important than the visual?",
    next: "Installation Floor (Floor 5)"
  },
  general: { 
    title: "The Open Observer",
    focus: "General Appreciation",
    reason: "You are exploring broadly.",
    learn: ["How to Look at Art", "Slow Looking Guide"],
    practice: "Spend 3 minutes looking at one corner of the piece.",
    reflect: "What stands out the most?",
    next: "Painting Floor (Floor 1)"
  }
};

const ATRIUM_CONFIG = {
  videoLink: "https://www.youtube.com/watch?v=ooi2V2Fp2-k",
  videoThumb: "https://img.youtube.com/vi/ooi2V2Fp2-k/maxresdefault.jpg",
  title: "LFC Sky Artspace", subtitle: "Learning From Collections", tagline: "From Viewing to Knowing.",
  desc: "LFC Sky Artspace is a collection-led art education system.",
  method: "Collection-to-Creation Framework", steps: "Visit → Analyze → Create"
};

// 12 FLOORS (DESIGN PRESERVED)
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

let ART_DATA = []; let CATALOG = { products: [] }; 
let chatHistory = []; 
let currentOpenArt = null;
const interactables = [];
let isInputLocked = false;
let isSending = false;

// ==========================================
// 2. REGISTRATION
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
  }, 1500);
}

// ==========================================
// 3. THREE.JS SCENE (DESIGN PRESERVED)
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

const hemiLight = new THREE.HemisphereLight(0xffffff, 0xe0f2fe, 0.5); scene.add(hemiLight);
const dirLight = new THREE.DirectionalLight(0xfffaed, 0.6); dirLight.position.set(50, 100, 50); dirLight.castShadow = true; scene.add(dirLight);

const matFloor = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
const matFloorDark = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.6 });
const matWall = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
const matWallDark = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
const matFrame = new THREE.MeshStandardMaterial({ color: 0x111111 });
const matPlinth = new THREE.MeshStandardMaterial({ color: 0xeeeeee });

const textureLoader = new THREE.TextureLoader();
textureLoader.crossOrigin = "anonymous";

// ==========================================
// 4. GALLERY BUILDER
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
  ctx.fillText(line, 60, y); 
  y += 80; ctx.fillStyle = '#1e3a8a'; ctx.font = 'bold 32px Arial'; ctx.fillText(cfg.method, 60, y); 
  y += 50; ctx.fillStyle = '#666'; ctx.font = '28px Arial'; ctx.fillText(cfg.steps, 60, y);
  return new THREE.CanvasTexture(canvas);
}

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
    const y = f.id * floorHeight; const group = new THREE.Group();
    let fMat = (f.type === "darkroom") ? matFloorDark : matFloor; let wMat = (f.type === "darkroom") ? matWallDark : matWall;
    const floor = new THREE.Mesh(new THREE.BoxGeometry(40, 0.5, 120), fMat); floor.position.set(0, y, 0); group.add(floor);
    const ceil = new THREE.Mesh(new THREE.BoxGeometry(40, 0.5, 120), wMat); ceil.position.set(0, y+16, 0); group.add(ceil);
    const w1 = new THREE.Mesh(new THREE.BoxGeometry(1, 16, 120), wMat); w1.position.set(19.5, y+8, 0); group.add(w1);
    const w2 = new THREE.Mesh(new THREE.BoxGeometry(1, 16, 120), wMat); w2.position.set(-19.5, y+8, 0); group.add(w2);

    if (f.id === 0) {
      createArtFrame(group, -18.5, y+6, -10, Math.PI/2, 10, 6, { title: "Introduction Video", artist: "Watch on YouTube", img: ATRIUM_CONFIG.videoThumb, link: ATRIUM_CONFIG.videoLink, isExternal: true });
      createArtFrame(group, 18.5, y+6, -10, -Math.PI/2, 10, 8, { title: "Manifesto", artist: "LFC System", texture: createTextTexture(ATRIUM_CONFIG) });
      createArtFrame(group, 0, y+7, -50, 0, 12, 6, { title: "LFC SYSTEM", artist: "FEI TeamArt", img: "https://placehold.co/1200x600/1e3a8a/ffffff?text=LFC+ART+SPACE" });
    }
    if (f.type === "installation") createPlinths(group, y);

    const arts = ART_DATA.filter(a => Number(a.floor) === f.id);
    if(arts.length > 0) {
      const left = []; const right = []; arts.forEach((d, i) => { (i % 2 === 0) ? right.push(d) : left.push(d); });
      let w = 4, h = 5; if(f.type === "darkroom") { w = 8; h = 4.5; }
      const zMin = -50, zMax = 50;
      right.forEach((data, idx) => { const zPos = (right.length <= 1) ? 0 : zMin + (idx * ((zMax - zMin) / (right.length - 1 || 1))); createArtFrame(group, 18.5, y+6.5, zPos, -Math.PI/2, w, h, data); });
      left.forEach((data, idx) => { const zPos = (left.length <= 1) ? 0 : zMin + (idx * ((zMax - zMin) / (left.length - 1 || 1))); createArtFrame(group, -18.5, y+6.5, zPos, Math.PI/2, w, h, data); });
    } else if (f.id !== 0) {
      for(let i=0; i<6; i++) { const isRight = i % 2 === 0; createArtFrame(group, isRight?18.5:-18.5, y+6.5, -40+(i*15), isRight?-Math.PI/2:Math.PI/2, 4, 5, { title: `Future Exhibit`, artist: f.name, img: "" }); }
    }
    scene.add(group);
    const btn = document.createElement("div"); btn.className = "floor-item"; btn.innerHTML = `<div class="floor-label">${f.name}</div><div class="floor-num">${f.id}</div>`; btn.onclick = () => goToFloor(f.id); document.getElementById("elevator").prepend(btn);
  });
}

function createPlinths(group, y) {
  [0, -15, 15].forEach(z => {
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(4, 1.2, 4), matPlinth); plinth.position.set(0, y + 0.6, z); group.add(plinth);
    const hitbox = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 5), new THREE.MeshBasicMaterial({ visible:false })); hitbox.position.set(0, y+3, z); hitbox.userData = { type: "art", data: { title: "Installation View", artist: "3D Works", img: "" }, viewPos: { x: 8, y: y+5, z: z+8 } }; interactables.push(hitbox); group.add(hitbox);
  });
}

function createArtFrame(group, x, y, z, rot, w, h, data) {
  const frameGroup = new THREE.Group(); frameGroup.position.set(x, y, z); frameGroup.rotation.y = rot;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w+0.2, h+0.2, 0.2), matFrame); frameGroup.add(frame);
  const canvas = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0xeeeeee })); canvas.position.z = 0.15; frameGroup.add(canvas);
  if (data.texture) { canvas.material = new THREE.MeshBasicMaterial({ map: data.texture }); }
  else if (data.img) { textureLoader.load(data.img, (tex) => { canvas.material = new THREE.MeshBasicMaterial({ map: tex }); canvas.material.needsUpdate = true; }, undefined, () => { canvas.material = new THREE.MeshBasicMaterial({ map: createFallbackTexture(data.title) }); }); }
  else { canvas.material = new THREE.MeshBasicMaterial({ map: createFallbackTexture(data.title) }); }
  const hitbox = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.5), new THREE.MeshBasicMaterial({ visible: false }));
  hitbox.userData = { type: "art", data: data, viewPos: { x: x + Math.sin(rot)*10, y: y, z: z + Math.cos(rot)*10 } };
  interactables.push(hitbox); frameGroup.add(hitbox); group.add(frameGroup);
}

// ==========================================
// 5. PHYSICS NAVIGATION
// ==========================================
const velocity = new THREE.Vector3(); const speed = 1.8; const friction = 0.8; const lookSpeed = 0.002;
let moveForward=false, moveBackward=false, moveLeft=false, moveRight=false;
document.addEventListener('keydown', (e) => { if(e.code==='ArrowUp'||e.code==='KeyW') moveForward=true; if(e.code==='ArrowLeft'||e.code==='KeyA') moveLeft=true; if(e.code==='ArrowDown'||e.code==='KeyS') moveBackward=true; if(e.code==='ArrowRight'||e.code==='KeyD') moveRight=true; });
document.addEventListener('keyup', (e) => { if(e.code==='ArrowUp'||e.code==='KeyW') moveForward=false; if(e.code==='ArrowLeft'||e.code==='KeyA') moveLeft=false; if(e.code==='ArrowDown'||e.code==='KeyS') moveBackward=false; if(e.code==='ArrowRight'||e.code==='KeyD') moveRight=false; });
function updatePhysics() { if (isInputLocked) return; velocity.x *= friction; velocity.z *= friction; const forward = getForwardVector(); const right = getRightVector(); if(moveForward) velocity.addScaledVector(forward, speed); if(moveBackward) velocity.addScaledVector(forward, -speed); if(moveLeft) velocity.addScaledVector(right, -speed); if(moveRight) velocity.addScaledVector(right, speed); camera.position.x += velocity.x * 0.015; camera.position.z += velocity.z * 0.015; camera.position.x = Math.max(-18, Math.min(18, camera.position.x)); camera.position.z = Math.max(-100, Math.min(100, camera.position.z)); }
function getForwardVector() { const d=new THREE.Vector3(); camera.getWorldDirection(d); d.y=0; d.normalize(); return d; }
function getRightVector() { const f=getForwardVector(); return new THREE.Vector3().crossVectors(f, new THREE.Vector3(0,1,0)).normalize(); }
let isDragging=false, prevMouse={x:0,y:0};
document.addEventListener('pointerdown', (e)=>{ if(!e.target.closest('button') && !e.target.closest('#ai-panel') && !e.target.closest('#entrance-layer') && !e.target.closest('.floor-item')) { isDragging=true; prevMouse={x:e.clientX,y:e.clientY}; }});
document.addEventListener('pointerup', ()=>{isDragging=false;});
document.addEventListener('pointermove', (e)=>{ if(!isDragging || isInputLocked) return; const dx=e.clientX-prevMouse.x, dy=e.clientY-prevMouse.y; const euler=new THREE.Euler(0,0,0,'YXZ'); euler.setFromQuaternion(camera.quaternion); euler.y-=dx*lookSpeed; euler.x-=dy*lookSpeed; euler.x=Math.max(-Math.PI/2.5, Math.min(Math.PI/2.5, euler.x)); camera.quaternion.setFromEuler(euler); prevMouse={x:e.clientX,y:e.clientY}; });
window.moveStart=(d)=>{if(d==='f')moveForward=true;if(d==='b')moveBackward=true;if(d==='l')moveLeft=true;if(d==='r')moveRight=true;}; window.moveStop=()=>{moveForward=false;moveBackward=false;moveLeft=false;moveRight=false;};

// ==========================================
// 6. INTERACTION & AI
// ==========================================
function goToFloor(id) { 
  closeBlueprint(); exitFocus(); 
  isInputLocked = true; 
  new TWEEN.Tween(camera.position).to({ y: (id * floorHeight) + 5 }, 2000).easing(TWEEN.Easing.Quadratic.InOut).onComplete(() => { isInputLocked = false; }).start(); 
}

function focusArt(userData) {
  if (userData.data.isExternal && userData.data.link) { window.open(userData.data.link, "_blank"); return; }
  currentOpenArt = userData.data; isInputLocked = true; document.body.classList.add("ai-open"); camera.userData.returnPos = camera.position.clone(); camera.userData.returnQuat = camera.quaternion.clone(); const t = userData.viewPos; new TWEEN.Tween(camera.position).to({ x:t.x, y:t.y, z:t.z }, 1800).easing(TWEEN.Easing.Cubic.Out).onComplete(()=>{openAI(userData.data); document.getElementById("back-btn").classList.add("visible");}).start(); const dum = new THREE.Object3D(); dum.position.copy(t); dum.lookAt(userData.data.x||t.x, t.y, userData.data.z||t.z); new TWEEN.Tween(camera.quaternion).to({ x:dum.quaternion.x, y:dum.quaternion.y, z:dum.quaternion.z, w:dum.quaternion.w }, 1500).easing(TWEEN.Easing.Cubic.Out).start();
}

function exitFocus() { 
  document.body.classList.remove("ai-open"); document.getElementById("ai-panel").classList.remove("active"); document.getElementById("back-btn").classList.remove("visible"); currentOpenArt = null; 
  if(camera.userData.returnPos) { new TWEEN.Tween(camera.position).to(camera.userData.returnPos, 1200).easing(TWEEN.Easing.Quadratic.Out).onComplete(() => { isInputLocked = false; }).start(); new TWEEN.Tween(camera.quaternion).to(camera.userData.returnQuat, 1200).easing(TWEEN.Easing.Quadratic.Out).start(); } else { isInputLocked = false; }
}

function openAI(data) {
  document.getElementById("ai-panel").classList.add("active");
  if (data.texture) document.getElementById("ai-img").src = "https://placehold.co/800x600/1e3a8a/ffffff?text=LFC+Info"; else document.getElementById("ai-img").src = data.img;
  document.getElementById("ai-title").innerText = data.title; document.getElementById("ai-meta").innerText = (data.artist || "Unknown") + " • " + (data.year || "—");
  
  chatHistory = []; questionCount = 0;
  document.getElementById("chat-stream").innerHTML = "";
  addChatMsg("ai", "I am observing this piece with you. What do you see?");
}

async function sendChat() {
  if (isSending) return;
  const i=document.getElementById("user-input"), txt=i.value.trim(); if(!txt)return;
  
  isSending = true;
  const sendBtn = document.getElementById("send-btn");
  if (sendBtn) { sendBtn.disabled = true; sendBtn.style.opacity = "0.7"; }

  addChatMsg("user",txt); i.value="";
  
  questionCount++;
  chatHistory.push({ role: "user", parts: [{ text: txt }] });

  try {
    const artPayload = currentOpenArt ? { title: currentOpenArt.title, artist: currentOpenArt.artist, year: currentOpenArt.year, medium: currentOpenArt.medium, floor: "Gallery" } : { title: "Unknown" };
    
    const thinkId = addChatMsg("ai", "...");
    
    const res = await fetch(AI_ENDPOINT, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({
      message:txt, history:chatHistory, art: artPayload, userProfile: userProfile 
    })});
    
    if(!res.ok) throw new Error(res.status);
    const d=await res.json();
    
    const thinkEl = document.getElementById(thinkId); if(thinkEl) thinkEl.remove();

    let cleanReply = d.reply;
    if (typeof cleanReply === 'string') {
        cleanReply = cleanReply.replace(/```json/gi, "").replace(/```/g, "").trim();
        if (cleanReply.startsWith("{")) { try { const p = JSON.parse(cleanReply); if(p.reply) cleanReply = p.reply; } catch(e){} }
    }
    
    addChatMsg("ai", cleanReply); 
    chatHistory.push({role:"model", parts:[{text:cleanReply}]});
    
    if(d.scores) {
       intentScores.history += (d.scores.history || 0);
       intentScores.technique += (d.scores.technique || 0);
       intentScores.market += (d.scores.market || 0);
       intentScores.theory += (d.scores.theory || 0);

       let signal = "";
       if(d.scores.technique > 0) signal = "Technique";
       else if(d.scores.history > 0) signal = "History";
       else if(d.scores.market > 0) signal = "Market";
       else if(d.scores.theory > 0) signal = "Theory";

       if(signal) { showSignalHint(signal); }
       sendDataBeacon();
    }

    if(questionCount === 3) {
      setTimeout(() => {
        addChatMsg("ai", "I can generate a personal learning path based on what you asked so far. Want to open My Journey?");
        document.getElementById("journey-btn").style.transform = "scale(1.1)";
        setTimeout(()=>document.getElementById("journey-btn").style.transform="scale(1)", 500);
      }, 1500);
    }
    
  } catch(e) { console.error(e); addChatMsg("ai", "⚠️ Connection Error."); }
  finally { isSending = false; if(sendBtn){sendBtn.disabled=false; sendBtn.style.opacity="1";} }
}

function addChatMsg(r,t) { 
  const d=document.createElement("div"); d.className=`msg msg-${r}`; d.innerText=t; 
  d.id = "msg-" + Date.now();
  document.getElementById("chat-stream").appendChild(d); 
  return d.id;
}

function showSignalHint(type) {
  const d = document.createElement("div");
  d.style.cssText = "font-size:10px; color:#64748b; text-align:center; margin:5px 0; text-transform:uppercase; letter-spacing:1px; opacity:0.8;";
  d.innerHTML = `✦ Noted: Focus on <strong>${type}</strong>`;
  document.getElementById("chat-stream").appendChild(d);
}

function sendDataBeacon() {
  console.log("📡 DATA BEACON SENT:", { session: "user_" + Date.now(), interests: intentScores, questions: questionCount });
}

// ✅ NEW TWO-LANE LAYOUT (LFC Discovery Method)
function startBlueprint() {
  document.getElementById("blueprint").classList.add("active");
  const container = document.getElementById("bp-products");
  container.innerHTML = "<h3 style='text-align:center; color:var(--blue);'>Curating your path...</h3>";
  
  setTimeout(() => {
    // 1. Determine Free Path
    let maxScore = 0; let interest = "general";
    for(const [key, val] of Object.entries(intentScores)) {
        if(val > maxScore) { maxScore = val; interest = key; }
    }
    const pathData = LEARNING_PATHS[interest] || LEARNING_PATHS.general;

    // 2. Generate Premium Options (from Catalog)
    let premiumHtml = "";
    if (CATALOG.products) {
        const premiums = CATALOG.products.filter(p => p.type === "premium");
        premiums.forEach(p => {
            premiumHtml += `
            <div class="plan-card" style="padding:1rem; margin:0; border:1px solid #cbd5e1;">
              <strong style="color:var(--blue);">${p.title}</strong>
              <div style="font-size:11px; color:#64748b; margin:4px 0;">${p.desc}</div>
              <button class="plan-btn" style="padding:8px; margin-top:8px; font-size:10px;" onclick="window.open('${p.url}', '_blank')">Book Session ($${p.price})</button>
            </div>`;
        });
    }

    // 3. Render Two-Lane Layout
    let html = `
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:2rem; width:100%;">
        
        <div style="background:#f8fafc; padding:2rem; border-radius:16px; border:1px solid #e2e8f0;">
          <h2 style="color:var(--blue); font-size:1.8rem; margin:0 0 5px 0;">LFC Discovery Method</h2>
          <div style="text-transform:uppercase; font-size:10px; letter-spacing:2px; color:var(--ok); font-weight:700; margin-bottom:1.5rem;">YOUR PERSONAL GUIDE</div>
          
          <div style="margin-bottom:1rem;">
            <strong style="font-size:12px; color:var(--blue);">Observation Focus: ${pathData.focus}</strong>
            <p style="font-size:13px; margin:5px 0; color:#475569;">${pathData.reason}</p>
          </div>

          <div style="margin-bottom:1rem;">
            <strong style="font-size:11px; text-transform:uppercase; color:var(--blue);">1. Practice</strong>
            <p style="font-size:13px; margin:5px 0;">${pathData.practice}</p>
          </div>

          <div style="margin-bottom:1rem;">
            <strong style="font-size:11px; text-transform:uppercase; color:var(--blue);">2. Reflect</strong>
            <p style="font-size:13px; margin:5px 0;">${pathData.reflect}</p>
          </div>

          <div style="margin-top:2rem; padding-top:1rem; border-top:1px solid #e2e8f0;">
             <strong style="font-size:11px; text-transform:uppercase; color:var(--blue);">Next Step</strong>
             <div style="font-size:13px; margin-top:5px;">Go to: <strong>${pathData.next}</strong></div>
          </div>
        </div>

        <div style="background:#fff; padding:2rem; border-radius:16px; border:1px solid #e2e8f0; position:relative; overflow:hidden;">
          <div style="position:absolute; top:0; right:0; background:var(--blue); color:#fff; font-size:9px; padding:5px 10px; border-radius:0 0 0 8px; font-weight:700;">BACKSTAGE</div>
          <h2 style="color:var(--blue); font-size:1.8rem; margin:0 0 1rem 0;">Ask an Expert</h2>
          <p style="font-size:13px; line-height:1.6; color:#64748b; margin-bottom:2rem;">
            The AI Docent is your guide. For professional critique, career advice, or valuation, connect with a human expert.
          </p>
          <div style="display:flex; flex-direction:column; gap:10px;">
            ${premiumHtml}
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
    document.getElementById("bp-desc").innerHTML = ""; 
    document.getElementById("bp-steps").innerHTML = ""; 
  }, 1000);
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

window.showRegistration = showRegistration; window.toggleOption = toggleOption; window.completeRegistration = completeRegistration;
document.getElementById("send-btn").onclick=sendChat; document.getElementById("user-input").onkeypress=(e)=>{if(e.key==="Enter")sendChat();};
window.startBlueprint=startBlueprint; window.closeBlueprint=()=>{document.getElementById("blueprint").classList.remove("active");}; window.exitFocus=exitFocus; window.goToFloor=goToFloor; window.moveStop=()=>{moveForward=false;moveBackward=false;moveLeft=false;moveRight=false;};
