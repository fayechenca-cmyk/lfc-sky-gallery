// ==========================================
// 1. CONFIGURATION & DATA STRUCTURE
// ==========================================
const AI_ENDPOINT = "https://lfc-ai-gateway.fayechenca.workers.dev/chat";

// Initial State (Will be overwritten by Load)
let userProfile = { 
  role: [],       
  goal: [],       
  ageGroup: "",   
  interests: []   
};

let intentScores = { technique: 0, history: 0, market: 0, theory: 0 };
let questionCount = 0; 
let discoveryProgress = 0; 
let userID = localStorage.getItem('lfc_uid') || 'guest_' + Date.now();
localStorage.setItem('lfc_uid', userID);

// ✅ CONTENT ENGINE (ENHANCED)
const LEARNING_PATHS = {
  technique: {
    title: "The Material Observer",
    focus: "Technique & Process",
    reason: "Your profile suggests a focus on making and process.",
    learn: ["Impasto & Texture Guide", "The Chemistry of Pigments", "Brushwork Analysis"],
    practice: "Zoom in on one brushstroke. Sketch its direction.",
    reflect: "How does the material change the feeling?",
    next: "Sculpture Floor (Floor 4)"
  },
  history: {
    title: "The Contextual Historian",
    focus: "Time & Context",
    reason: "Your profile suggests a focus on history and era.",
    learn: ["Timeline of this Era", "Artist Biography", "World Context"],
    practice: "Find one other artist from this same year.",
    reflect: "Why did the artist make this *then* and not now?",
    next: "Contemporary Lens (Floor 12)"
  },
  market: {
    title: "The Strategic Collector",
    focus: "Value & Provenance",
    reason: "Your profile suggests a focus on the art market and value.",
    learn: ["Auction Results 2024", "Valuation Strategy", "Edition Strategy"],
    practice: "Estimate the primary market price vs. secondary market.",
    reflect: "What drives the value of this piece?",
    next: "The Atrium (Manifesto)"
  },
  theory: {
    title: "The Critical Thinker",
    focus: "Meaning & Philosophy",
    reason: "Your profile suggests a focus on concepts and meaning.",
    learn: ["Semiotics in Art", "Conceptual Manifesto", "Visual Philosophy"],
    practice: "Write one sentence that explains the 'Invisible Meaning'.",
    reflect: "Is the idea more important than the visual?",
    next: "Installation Floor (Floor 5)"
  },
  general: { 
    title: "The Open Observer",
    focus: "General Appreciation",
    reason: "You are exploring broadly.",
    learn: ["How to Look at Art", "Slow Looking Guide"],
    practice: "Spend 3 minutes looking at one corner.",
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

const FLOORS = [
  { id: 0, name: "The Atrium", type: "reception" },
  { id: 1, name: "Painting / Fine Art", type: "fineart" },
  { id: 2, name: "Print", type: "standard" },
  { id: 3, name: "Photography", type: "standard" },
  { id: 4, name: "Sculpture", type: "sculpture" },
  { id: 5, name: "Installation", type: "sculpture" },
  { id: 6, name: "Ceramics", type: "standard" },
  { id: 7, name: "Design", type: "standard" },
  { id: 8, name: "Animation", type: "standard" },
  { id: 9, name: "Film / Video", type: "darkroom" },
  { id: 10, name: "Performance", type: "standard" },
  { id: 11, name: "Sketch", type: "standard" },
  { id: 12, name: "Contemporary Lens", type: "standard" }
];

let ART_DATA = []; 
let CATALOG = { products: [
    { id: "class-sketch-a", title: "Foundation of Sketch A", desc: "Form, Light & Perspective.", price: 0, tag: "technique", type: "course", url: "https://www.feiteamart.com/class-1--intro-sketch-basic" },
    { id: "class-market-101", title: "Art Collecting 101", desc: "Understanding Value & Provenance.", price: 0, tag: "market", type: "course", url: "https://www.feiteamart.com/contact" },
    { id: "class-theory-101", title: "Contemporary Theory", desc: "Philosophy & Meaning.", price: 0, tag: "theory", type: "course", url: "https://www.feiteamart.com/class-7-art-aesthetics-contemporary-art" },
    { id: "service-curator", title: "Human Curator", desc: "Exhibition logic & context.", price: 50, type: "premium", url: "https://www.feiteamart.com/contact" },
    { id: "service-mentor", title: "Artist Mentor", desc: "Technique direction.", price: 75, type: "premium", url: "https://www.feiteamart.com/contact" }
] }; 

let chatHistory = []; 
let currentOpenArt = null;
const interactables = [];
let isInputLocked = false;
let isSending = false;

// ==========================================
// 2. CREATOR LAB LOGIC
// ==========================================
const LAB_TERMS = {
    pro: { trigger: "Creator Lab", title: "Project Charter", name: "Project Title", goal: "Strategic Objective", refs: "Reference Board", steps: "Milestones", addStep: "+ Add Milestone", help: "Contact Mentor", submit: "Submit Proposal" },
    explorer: { trigger: "My Backpack", title: "Mission Card", name: "Adventure Name", goal: "My Quest Goal", refs: "Collected Treasures", steps: "Adventure Map", addStep: "+ Next Step", help: "Ask Guide", submit: "Complete Quest" }
};

class FEICreatorLab {
    constructor(userProfile) {
        this.user = userProfile;
        this.isOpen = false;
        this.projectData = { name: "", goal: "", milestones: [], references: [] };
        this.overlay = document.getElementById("creator-lab-overlay");
        this.trigger = document.getElementById("lab-trigger");
        this.refContainer = document.getElementById("lab-gallery-pins");
        this.milestoneList = document.getElementById("lab-milestone-list");
        this.init();
    }
    init() {
        this.renderInterface();
        this.setupEventListeners();
    }
    renderInterface() {
        const isChild = this.user.ageGroup === 'Child';
        const mode = isChild ? "explorer" : "pro";
        const terms = LAB_TERMS[mode];
        document.body.classList.remove("theme-pro", "theme-explorer");
        document.body.classList.add(isChild ? "theme-explorer" : "theme-pro");
        
        if(document.getElementById("lab-trigger-text")) document.getElementById("lab-trigger-text").innerText = terms.trigger;
        if(document.getElementById("lab-title")) document.getElementById("lab-title").innerText = terms.title;
        if(document.getElementById("label-name")) document.getElementById("label-name").innerText = terms.name;
        if(document.getElementById("label-goal")) document.getElementById("label-goal").innerText = terms.goal;
        if(document.getElementById("label-refs")) document.getElementById("label-refs").innerText = terms.refs;
        if(document.getElementById("label-steps")) document.getElementById("label-steps").innerText = terms.steps;
        if(document.getElementById("btn-add-step")) document.getElementById("btn-add-step").innerText = terms.addStep;
        if(document.getElementById("btn-help")) document.getElementById("btn-help").innerText = terms.help;
        if(document.getElementById("btn-submit")) document.getElementById("btn-submit").innerText = terms.submit;
    }
    toggle() {
        this.isOpen = !this.isOpen;
        if(this.isOpen) this.overlay.classList.add("lab-visible"); else this.overlay.classList.remove("lab-visible");
    }
    pinFromGallery(artData) {
        if (!artData || this.projectData.references.find(r => r.title === artData.title)) return;
        this.projectData.references.push(artData);
        const pin = document.createElement("div"); pin.className = "lab-pin-card";
        const imgUrl = artData.img || "https://placehold.co/100x100/1e3a8a/ffffff?text=ART";
        pin.innerHTML = `<img src="${imgUrl}" class="lab-pin-img"><span>${artData.title}</span>`;
        const emptyState = this.refContainer.querySelector(".lab-empty-state"); if(emptyState) emptyState.remove();
        this.refContainer.appendChild(pin);
        if(!this.isOpen) { const icon = document.getElementById("lab-trigger-icon"); icon.innerText = "✨"; setTimeout(() => icon.innerText = "⚡", 1000); }
    }
    setupEventListeners() {
        const btnAdd = document.getElementById("btn-add-step");
        if(btnAdd) {
            btnAdd.addEventListener("click", () => {
                const li = document.createElement("li"); li.className = "lab-milestone-item";
                li.innerHTML = `<input type="checkbox" class="lab-checkbox"> <input type="text" class="lab-input" style="margin:0; padding:6px;" placeholder="New Step...">`;
                this.milestoneList.appendChild(li);
            });
        }
        const btnSubmit = document.getElementById("btn-submit");
        if(btnSubmit) {
            btnSubmit.addEventListener("click", () => {
                if(this.user.ageGroup === 'Child') {
                    alert("Quest Complete! Your guide has received your adventure map!");
                } else {
                    const nameInput = document.getElementById("project-name-input");
                    const projectName = nameInput ? nameInput.value : "Untitled Project";
                    alert(`✅ SUCCESS\n\nProject "${projectName}" has been submitted to your Mentor.\n\nA confirmation has been sent to info@feiteamart.com.`);
                }
            });
        }
    }
}

// ==========================================
// 3. REGISTRATION & PERSISTENCE
// ==========================================
function saveProgress() {
    const data = {
        profile: userProfile,
        scores: intentScores,
        progress: discoveryProgress,
        history: chatHistory
    };
    localStorage.setItem('lfc_progress_' + userID, JSON.stringify(data));
}

function loadProgress() {
    const saved = localStorage.getItem('lfc_progress_' + userID);
    if(saved) {
        const data = JSON.parse(saved);
        userProfile = data.profile || userProfile;
        intentScores = data.scores || intentScores;
        discoveryProgress = data.progress || 0;
        return true; 
    }
    return false;
}

// ✅ FIX: "Begin Journey" now ALWAYS opens the panel to prevent freezing
function showRegistration() {
    // 1. Fade out the poster
    document.getElementById('entrance-content').style.opacity = '0';
    
    // 2. Open the form directly. 
    setTimeout(() => { 
        document.getElementById('reg-panel').classList.add('active'); 
    }, 300);
}

// 1. Role Selection
function toggleRole(btn) {
  const container = document.getElementById('opt-role');
  const siblings = container.querySelectorAll('.reg-btn');
  siblings.forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  userProfile.role = [btn.innerText]; 
  checkReady();
}

// 2. Age Selection
function toggleAge(btn, val) {
  const container = document.getElementById('opt-age');
  const siblings = container.querySelectorAll('.reg-btn');
  siblings.forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  userProfile.ageGroup = val; 
  checkReady();
}

// 3. Goal Selection
function toggleGoal(btn) {
  const txt = btn.innerText;
  if (btn.classList.contains('selected')) {
    btn.classList.remove('selected');
    userProfile.goal = userProfile.goal.filter(g => g !== txt);
  } else {
    if (userProfile.goal.length < 2) {
      btn.classList.add('selected');
      userProfile.goal.push(txt);
    }
  }
  checkReady();
}

// 4. Interest Selection
function toggleInterest(btn) {
  const txt = btn.innerText;
  if (btn.classList.contains('selected')) {
    btn.classList.remove('selected');
    userProfile.interests = userProfile.interests.filter(i => i !== txt);
  } else {
    if (userProfile.interests.length < 3) {
      btn.classList.add('selected');
      userProfile.interests.push(txt);
    }
  }
}

// 5. Validation
function checkReady() {
  const enterBtn = document.getElementById('final-enter-btn');
  const isReady = userProfile.role.length > 0 && userProfile.ageGroup !== "" && userProfile.goal.length > 0;
  if (isReady) enterBtn.classList.add('ready'); else enterBtn.classList.remove('ready');
}

// 6. Skip Logic
function skipRegistration() {
  userProfile.role = ["Viewer"];
  userProfile.ageGroup = "Adult";
  userProfile.goal = [];
  userProfile.interests = [];
  
  // Bypass visual check and enter
  enterGallery();
}

// 7. Click Handler for "Enter Gallery" Button
function completeRegistration() {
  const enterBtn = document.getElementById('final-enter-btn');
  // Only proceed if button is ready
  if (enterBtn.classList.contains('ready')) {
      enterGallery();
  }
}

// ✅ NEW HELPER: Shared Entry Logic
function enterGallery() {
  saveProgress(); 
  document.body.classList.add('doors-open');
  
  window.creatorLab = new FEICreatorLab(userProfile);
  document.getElementById("lab-trigger").style.display = "flex";
  document.getElementById("discovery-fill").style.width = discoveryProgress + "%";

  setTimeout(() => {
    const tip = document.getElementById('onboarding-tip');
    if(tip) {
        tip.classList.add('visible');
        setTimeout(() => { tip.classList.remove('visible'); }, 5000);
    }
  }, 3000);
  
  setTimeout(() => {
    document.getElementById('entrance-layer').style.display = 'none';
    document.getElementById('reg-panel').style.display = 'none';
  }, 1500);
}

// ==========================================
// 4. THREE.JS SCENE
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
// 5. GALLERY BUILDER
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

    const arts = ART_DATA.filter(a => Number(a.floor) === f.id);
    
    if (f.type === "sculpture") {
        arts.forEach((data, idx) => {
            const z = -40 + (idx * 15);
            const plinth = new THREE.Mesh(new THREE.BoxGeometry(3, 1.5, 3), matPlinth);
            plinth.position.set(0, y + 0.75, z);
            group.add(plinth);
            const standeeGroup = new THREE.Group();
            standeeGroup.position.set(0, y + 2.5, z);
            const geom = new THREE.PlaneGeometry(3, 3);
            const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
            if (data.img) textureLoader.load(data.img, (tex) => { mat.map = tex; mat.needsUpdate = true; });
            const mesh = new THREE.Mesh(geom, mat);
            standeeGroup.add(mesh);
            standeeGroup.rotation.y = Math.random() * 0.5 - 0.25;
            const hitbox = new THREE.Mesh(new THREE.BoxGeometry(4, 5, 4), new THREE.MeshBasicMaterial({ visible: false }));
            hitbox.userData = { type: "art", data: data, viewPos: { x: 5, y: y + 4, z: z + 5 } };
            interactables.push(hitbox);
            standeeGroup.add(hitbox);
            group.add(standeeGroup);
        });
    } 
    else if (arts.length > 0) {
      const left = []; const right = []; arts.forEach((d, i) => { (i % 2 === 0) ? right.push(d) : left.push(d); });
      let w = 4, h = 5; if(f.type === "darkroom") { w = 8; h = 4.5; }
      const zMin = -50, zMax = 50;
      right.forEach((data, idx) => { const zPos = (right.length <= 1) ? 0 : zMin + (idx * ((zMax - zMin) / (right.length - 1 || 1))); createArtFrame(group, 18.5, y+6.5, zPos, -Math.PI/2, w, h, data); });
      left.forEach((data, idx) => { const zPos = (left.length <= 1) ? 0 : zMin + (idx * ((zMax - zMin) / (left.length - 1 || 1))); createArtFrame(group, -18.5, y+6.5, zPos, Math.PI/2, w, h, data); });
    } else if (f.id !== 0) {
      for(let i=0; i<6; i++) { const isRight = i % 2 === 0; createArtFrame(group, isRight?18.5:-18.5, y+6.5, -40+(i*15), isRight?-Math.PI/2:Math.PI/2, 4, 5, { title: `Future Exhibit`, artist: f.name, img: "" }); }
    }
    scene.add(group);
    const btn = document.createElement("div"); btn.className = "floor-item"; btn.innerHTML = `<div class="floor-label">${f.name}</div><div class="floor-num">${f.id}</div>`; btn.onclick = () => window.goToFloor(f.id); document.getElementById("elevator").prepend(btn);
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
// 6. PHYSICS NAVIGATION
// ==========================================
const velocity = new THREE.Vector3(); const speed = 1.8; const friction = 0.8; const lookSpeed = 0.002;
let moveForward=false, moveBackward=false, moveLeft=false, moveRight=false;
document.addEventListener('keydown', (e) => { if(e.code==='ArrowUp'||e.code==='KeyW') moveForward=true; if(e.code==='ArrowLeft'||e.code==='KeyA') moveLeft=true; if(e.code==='ArrowDown'||e.code==='KeyS') moveBackward=true; if(e.code==='ArrowRight'||e.code==='KeyD') moveRight=true; });
document.addEventListener('keyup', (e) => { if(e.code==='ArrowUp'||e.code==='KeyW') moveForward=false; if(e.code==='ArrowLeft'||e.code==='KeyA') moveLeft=false; if(e.code==='ArrowDown'||e.code==='KeyS') moveBackward=false; if(e.code==='ArrowRight'||e.code==='KeyD') moveRight=false; });
function updatePhysics() { if (isInputLocked) return; velocity.x *= friction; velocity.z *= friction; const forward = getForwardVector(); const right = getRightVector(); if(moveForward) velocity.addScaledVector(forward, speed); if(moveBackward) velocity.addScaledVector(forward, -speed); if(moveLeft) velocity.addScaledVector(right, -speed); if(moveRight) velocity.addScaledVector(right, speed); camera.position.x += velocity.x * 0.015; camera.position.z += velocity.z * 0.015; camera.position.x = Math.max(-18, Math.min(18, camera.position.x)); camera.position.z = Math.max(-100, Math.min(100, camera.position.z)); }
function getForwardVector() { const d=new THREE.Vector3(); camera.getWorldDirection(d); d.y=0; d.normalize(); return d; }
function getRightVector() { const f=getForwardVector(); return new THREE.Vector3().crossVectors(f, new THREE.Vector3(0,1,0)).normalize(); }
let isDragging=false, prevMouse={x:0,y:0};
document.addEventListener('pointerdown', (e)=>{ if(!e.target.closest('button') && !e.target.closest('#ai-panel') && !e.target.closest('#entrance-layer') && !e.target.closest('.floor-item') && !e.target.closest('#creator-lab-overlay')) { isDragging=true; prevMouse={x:e.clientX,y:e.clientY}; }});
document.addEventListener('pointerup', ()=>{isDragging=false;});
document.addEventListener('pointermove', (e)=>{ if(!isDragging || isInputLocked) return; const dx=e.clientX-prevMouse.x, dy=e.clientY-prevMouse.y; const euler=new THREE.Euler(0,0,0,'YXZ'); euler.setFromQuaternion(camera.quaternion); euler.y-=dx*lookSpeed; euler.x-=dy*lookSpeed; euler.x=Math.max(-Math.PI/2.5, Math.min(Math.PI/2.5, euler.x)); camera.quaternion.setFromEuler(euler); prevMouse={x:e.clientX,y:e.clientY}; });
window.moveStart=(d)=>{if(d==='f')moveForward=true;if(d==='b')moveBackward=true;if(d==='l')moveLeft=true;if(d==='r')moveRight=true;}; window.moveStop=()=>{moveForward=false;moveBackward=false;moveLeft=false;moveRight=false;};

// ==========================================
// 7. INTERACTION & AI
// ==========================================
// ✅ FIX: EXPORTED GLOBAL FUNCTION for Buttons
window.goToFloor = function(id) { 
  closeBlueprint(); exitFocus(); 
  isInputLocked = true; 
  // Safety: Stop any running tweens to prevent conflicts
  TWEEN.removeAll();
  
  new TWEEN.Tween(camera.position)
    .to({ y: (id * floorHeight) + 5 }, 2000)
    .easing(TWEEN.Easing.Quadratic.InOut)
    .onComplete(() => { 
        isInputLocked = false; 
        console.log("Arrived at Floor " + id);
    })
    .start(); 
};

function focusArt(userData) {
  if (userData.data.isExternal && userData.data.link) { window.open(userData.data.link, "_blank"); return; }
  currentOpenArt = userData.data; 
  isInputLocked = true; 
  document.body.classList.add("ai-open"); 
  camera.userData.returnPos = camera.position.clone(); 
  camera.userData.returnQuat = camera.quaternion.clone(); 
  const t = userData.viewPos; 
  new TWEEN.Tween(camera.position).to({ x:t.x, y:t.y, z:t.z }, 1800).easing(TWEEN.Easing.Cubic.Out).onComplete(()=>{openAI(userData.data); document.getElementById("back-btn").classList.add("visible");}).start(); 
  const dum = new THREE.Object3D(); dum.position.copy(t); dum.lookAt(userData.data.x||t.x, t.y, userData.data.z||t.z); 
  new TWEEN.Tween(camera.quaternion).to({ x:dum.quaternion.x, y:dum.quaternion.y, z:dum.quaternion.z, w:dum.quaternion.w }, 1500).easing(TWEEN.Easing.Cubic.Out).start();
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
  
  // Adaptive Welcome
  let welcomeMsg = "I am observing this piece with you. What do you see?";
  if (userProfile.ageGroup === "Child") welcomeMsg = "Hi! I'm your art buddy. Does this look like anything you've seen before?";
  else if (userProfile.role.includes("Collector")) welcomeMsg = "Welcome. Shall we analyze the provenance and market value?";
  
  addChatMsg("ai", welcomeMsg);
}

// Global function for the Pin button
window.pinCurrentArt = function() {
    if(window.creatorLab && currentOpenArt) {
        window.creatorLab.pinFromGallery(currentOpenArt);
        window.creatorLab.toggle();
    }
};

async function sendChat() {
  if (isSending) return;
  const i=document.getElementById("user-input"), txt=i.value.trim(); if(!txt)return;
  
  isSending = true;
  const sendBtn = document.getElementById("send-btn");
  if (sendBtn) { sendBtn.disabled = true; sendBtn.style.opacity = "0.7"; }

  // ✅ FIX: Force append User Message
  addChatMsg("user",txt); 
  i.value="";
  
  questionCount++;
  discoveryProgress = Math.min(100, discoveryProgress + 15);
  document.getElementById("discovery-fill").style.width = discoveryProgress + "%";
  saveProgress(); 

  chatHistory.push({ role: "user", parts: [{ text: txt }] });

  try {
    const artPayload = currentOpenArt ? { title: currentOpenArt.title, artist: currentOpenArt.artist, year: currentOpenArt.year, medium: currentOpenArt.medium, floor: "Gallery" } : { title: "Unknown" };
    
    let systemInstruction = "You are a helpful art docent.";
    if (userProfile.ageGroup === "Child") systemInstruction = "You are a friendly, encouraging guide for a child.";
    else if (userProfile.role.includes("Collector")) systemInstruction = "You are an art market analyst.";

    const thinkId = addChatMsg("ai", "..."); 
    
    const res = await fetch(AI_ENDPOINT, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({
      message:txt, history:chatHistory, art: artPayload, userProfile: userProfile, systemInstruction: systemInstruction
    })});
    
    // ✅ FIX: Remove Thinking Dots AFTER response returns
    const thinkEl = document.getElementById(thinkId); if(thinkEl) thinkEl.remove();

    if(!res.ok) throw new Error(res.status);
    const d=await res.json();
    
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

// ✅ NEW TWO-LANE JOURNEY LAYOUT (Smart Recommendation)
function startBlueprint() {
  document.getElementById("blueprint").classList.add("active");
  const container = document.getElementById("bp-products");
  container.innerHTML = "<h3 style='text-align:center; color:var(--blue);'>Curating your path...</h3>";
  
  setTimeout(() => {
    let maxScore = 0; let interest = "general";
    
    // 1. Determine Winning Interest (From Chat Scores)
    for(const [key, val] of Object.entries(intentScores)) {
        if(val > maxScore) { maxScore = val; interest = key; }
    }

    // 2. Fallback: Use Keywords if no chat score
    if (maxScore === 0 && userProfile.interests.length > 0) {
        const k = userProfile.interests;
        if(k.includes("Art Market") || k.includes("Understand Collecting/Market")) interest = "market";
        else if(k.includes("History") || k.includes("Impressionism") || k.includes("Learn Art History")) interest = "history";
        else if(k.includes("Painting") || k.includes("Sculpture") || k.includes("Learn Techniques")) interest = "technique";
        else if(k.includes("Philosophy") || k.includes("Social Themes") || k.includes("Explore Meaning & Ideas")) interest = "theory";
    }

    const pathData = LEARNING_PATHS[interest] || LEARNING_PATHS.general;

    let recommendedCourse = null;
    let courseDesc = "";
    let courseTitle = "";
    let courseUrl = "#";

    // ✅ LOGIC: FIND MATCH OR OFFER CUSTOM DESIGN
    if (CATALOG.products) {
        recommendedCourse = CATALOG.products.find(p => p.type === "course" && p.tag === interest);
    }

    if (recommendedCourse) {
        courseTitle = recommendedCourse.title;
        courseDesc = recommendedCourse.desc;
        courseUrl = recommendedCourse.url;
    } else {
        // Fallback to "Custom Design"
        courseTitle = "Custom Curriculum Design";
        courseDesc = "We don't have a pre-made class for this specific interest yet. Work with a mentor to build your own personalized syllabus.";
        courseUrl = "https://www.feiteamart.com/contact";
    }

    let premiumHtml = "";
    if (CATALOG.products) {
        const premiums = CATALOG.products.filter(p => p.type === "premium");
        premiums.forEach(p => {
            premiumHtml += `
            <div class="plan-card" style="padding:1rem; margin:0; border:1px solid #cbd5e1;">
              <strong style="color:var(--blue);">${p.title}</strong>
              <div style="font-size:11px; color:#64748b; margin:4px 0;">${p.desc}</div>
              <button class="plan-btn" style="padding:8px; margin-top:8px; font-size:10px; background:#fff; color:var(--blue); border:1px solid var(--blue);" onclick="window.open('${p.url}', '_blank')">Book Session ($${p.price})</button>
            </div>`;
        });
    }

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
            <ul style="padding-left:20px; font-size:13px; color:#475569;">
                ${Array.isArray(pathData.learn) ? pathData.learn.map(l => `<li style="margin-bottom:5px;">${l}</li>`).join('') : ''}
            </ul>
            <p style="font-size:13px; margin:5px 0;">${pathData.practice}</p>
          </div>
          <div style="margin-bottom:1rem;">
            <strong style="font-size:11px; text-transform:uppercase; color:var(--blue);">2. Reflect</strong>
            <p style="font-size:13px; margin:5px 0;">${pathData.reflect}</p>
          </div>
        </div>
        <div style="background:#fff; padding:2rem; border-radius:16px; border:1px solid #e2e8f0; position:relative; overflow:hidden;">
          <div style="position:absolute; top:0; right:0; background:var(--blue); color:#fff; font-size:9px; padding:5px 10px; border-radius:0 0 0 8px; font-weight:700;">BACKSTAGE</div>
          <div style="margin-bottom:2rem; padding-bottom:1.5rem; border-bottom:1px solid #e2e8f0;">
             <div style="text-transform:uppercase; font-size:10px; letter-spacing:2px; color:var(--gray); margin-bottom:10px;">Recommended Class</div>
             <div style="display:flex; align-items:center; gap:15px;">
                <div style="flex:1;">
                   <strong style="color:var(--blue); font-size:1.1rem;">${courseTitle}</strong>
                   <p style="font-size:11px; color:#64748b; margin:5px 0;">${courseDesc}</p>
                </div>
                <button class="plan-btn" style="width:auto; padding:10px 20px; font-size:11px;" onclick="window.open('${courseUrl}', '_blank')">View Options</button>
             </div>
          </div>
          <div style="text-transform:uppercase; font-size:10px; letter-spacing:2px; color:var(--gray); margin-bottom:10px;">Ask an Expert</div>
          <div style="display:flex; flex-direction:column; gap:10px;">${premiumHtml}</div>
        </div>
      </div>
    `;

    container.innerHTML = html;
    document.getElementById("bp-desc").innerHTML = ""; 
    document.getElementById("bp-steps").innerHTML = ""; 
  }, 1000);
}

// ==========================================
// 8. INIT
// ==========================================
function animate(){ requestAnimationFrame(animate); TWEEN.update(); updatePhysics(); renderer.render(scene, camera); }
animate();
const cr=new THREE.Raycaster(), cm=new THREE.Vector2();
document.addEventListener('pointerup',(e)=>{if(isDragging)return; cm.x=(e.clientX/window.innerWidth)*2-1; cm.y=-(e.clientY/window.innerHeight)*2+1; cr.setFromCamera(cm,camera); const h=cr.intersectObjects(interactables); if(h.length>0 && h[0].object.userData.type==="art") focusArt(h[0].object.userData); });

fetch('artworks.json').then(r=>r.json()).then(d=>{ if(d.floors) Object.values(d.floors).forEach(f=>f.items.forEach(i=>ART_DATA.push(i))); else ART_DATA=d; buildGallery(); }).catch(()=>buildGallery());
// Use internal catalog definition for reliability
// fetch('catalog.json').then(r=>r.json()).then(d=>CATALOG=d);

window.showRegistration = showRegistration; window.toggleOption = toggleOption; window.toggleKeyword = toggleInterest; window.completeRegistration = completeRegistration;
document.getElementById("send-btn").onclick=sendChat; document.getElementById("user-input").onkeypress=(e)=>{if(e.key==="Enter")sendChat();};
window.startBlueprint=startBlueprint; window.closeBlueprint=()=>{document.getElementById("blueprint").classList.remove("active");}; window.exitFocus=exitFocus; window.goToFloor=window.goToFloor; window.moveStop=()=>{moveForward=false;moveBackward=false;moveLeft=false;moveRight=false;};

window.addEventListener('load', () => {
    // We check if data exists, but we NO LONGER auto-complete.
    // The user MUST click "Begin Journey" to enter.
    if(loadProgress()) {
        console.log("Welcome back, " + userID);
    }
});
