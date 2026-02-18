// ===== Supabase Init =====
const SUPABASE_URL = "https://rudztwseatwayhztbarj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1ZHp0d3NlYXR3YXloenRiYXJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NTQyOTYsImV4cCI6MjA4NjUzMDI5Nn0.YrPIS26glb-N5JIKspFuzdtp-t32qXAtLoDHwTbLVtk";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
// ==========================================
// 1. CONFIGURATION & DATA STRUCTURE
// ==========================================

// ✅ This is your Gemini gateway (Cloudflare Worker). No OpenAI text is used anywhere in the UI.
const AI_ENDPOINT = "https://lfc-ai-gateway.fayechenca.workers.dev/chat";
const PREMIUM_CONTACT_URL = "https://www.feiteamart.com/contact";

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
let userID = localStorage.getItem("lfc_uid") || "guest_" + Date.now();
localStorage.setItem("lfc_uid", userID);

// ✅ AI Persona: Docent vs Curator (Curator = premium-style guidance)
let aiPersona = localStorage.getItem("lfc_ai_persona") || "docent"; // "docent" | "curator"

// ✅ My Journey Session Memory (across artworks)
let journeyLog = [];           // detailed transcript/events
let visitedArtworks = [];      // {title, artist, year, floor, ts}
let pinnedArtworks = [];       // lightweight refs for blueprint display

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
  title: "LFC Sky Artspace",
  subtitle: "Learning From Collections",
  tagline: "From Viewing to Knowing.",
  desc: "LFC Sky Artspace is a collection-led art education system.",
  method: "Collection-to-Creation Framework",
  steps: "Visit → Analyze → Create"
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
let CATALOG = {
  products: [
    { id: "class-sketch-a", title: "Foundation of Sketch A", desc: "Form, Light & Perspective.", price: 0, tag: "technique", type: "course", url: "https://www.feiteamart.com/class-1--intro-sketch-basic" },
    { id: "class-market-101", title: "Art Collecting 101", desc: "Understanding Value & Provenance.", price: 0, tag: "market", type: "course", url: "https://www.feiteamart.com/contact" },
    { id: "class-theory-101", title: "Contemporary Theory", desc: "Philosophy & Meaning.", price: 0, tag: "theory", type: "course", url: "https://www.feiteamart.com/class-7-art-aesthetics-contemporary-art" },
    { id: "service-curator", title: "Human Curator", desc: "Exhibition logic & context.", price: 50, type: "premium", url: "https://www.feiteamart.com/contact" },
    { id: "service-mentor", title: "Artist Mentor", desc: "Technique direction.", price: 75, type: "premium", url: "https://www.feiteamart.com/contact" }
  ]
};

let chatHistory = []; // per artwork chat (Gemini-style)
let currentOpenArt = null;
const interactables = [];
let isInputLocked = false;
let isSending = false;

// ==========================================
// 1.1 JOURNEY HELPERS (NEW)
// ==========================================
function floorNameById(id) {
  const f = FLOORS.find(x => x.id === Number(id));
  return f ? f.name : "Unknown Floor";
}

function toSafeText(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function logJourney(entry) {
  journeyLog.push(entry);
  if (journeyLog.length > 250) journeyLog.shift();
}

function recordVisit(art) {
  if (!art) return;
  const already = visitedArtworks.find(a => a.title === art.title && a.artist === art.artist);
  if (already) return;
  visitedArtworks.push({
    title: art.title || "Untitled",
    artist: art.artist || "Unknown",
    year: art.year || "—",
    floor: art.floor ?? "Gallery",
    ts: Date.now()
  });
  if (visitedArtworks.length > 80) visitedArtworks.shift();
}

function recordPin(art) {
  if (!art) return;
  const already = pinnedArtworks.find(a => a.title === art.title && a.artist === art.artist);
  if (already) return;
  pinnedArtworks.push({
    title: art.title || "Untitled",
    artist: art.artist || "Unknown",
    year: art.year || "—",
    floor: art.floor ?? "Gallery",
    ts: Date.now()
  });
  if (pinnedArtworks.length > 50) pinnedArtworks.shift();
}

function updateAIModeUI() {
  const docentBtn = document.getElementById("mode-docent");
  const curatorBtn = document.getElementById("mode-curator");
  if (!docentBtn || !curatorBtn) return;

  docentBtn.classList.remove("selected");
  curatorBtn.classList.remove("selected");

  if (aiPersona === "curator") curatorBtn.classList.add("selected");
  else docentBtn.classList.add("selected");
}

// ✅ Exposed toggle for UI buttons
window.setAIPersona = function(mode) {
  if (userProfile.ageGroup === "Child" && mode === "curator") {
    aiPersona = "docent";
    localStorage.setItem("lfc_ai_persona", aiPersona);
    updateAIModeUI();
    addChatMsg("ai", "Curator mode is for advanced visitors. Let’s stay in Docent mode for now.");
    return;
  }

  aiPersona = (mode === "curator") ? "curator" : "docent";
  localStorage.setItem("lfc_ai_persona", aiPersona);
  updateAIModeUI();

  if (aiPersona === "curator") {
    // Premium alignment: we keep the mode, but also surface the booking path.
    addChatMsg("ai", "Curator mode enabled. Deeper theory, context, and curatorial logic. (Premium guidance style.)");
  } else {
    addChatMsg("ai", "Docent mode enabled. Friendly guidance, accessible interpretation, and learning prompts.");
  }
};

// ==========================================
// 2. CREATOR LAB LOGIC
// ==========================================
const LAB_TERMS = {
  pro: {
    trigger: "Creator Lab",
    title: "Project Charter",
    name: "Project Title",
    goal: "Strategic Objective",
    refs: "Reference Board",
    steps: "Milestones",
    addStep: "+ Add Milestone",
    help: "Contact Mentor",
    submit: "Submit Proposal",
  },
  explorer: {
    trigger: "My Backpack",
    title: "Mission Card",
    name: "Adventure Name",
    goal: "My Quest Goal",
    refs: "Collected Treasures",
    steps: "Adventure Map",
    addStep: "+ Next Step",
    help: "Ask Guide",
    submit: "Complete Quest",
  },
};

const FORMSPREE_ENDPOINT = "https://formspree.io/f/mnjvqkdb";

class FEICreatorLab {
  constructor(userProfile) {
    this.user = userProfile || {};
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
    const isChild = this.user.ageGroup === "Child";
    const mode = isChild ? "explorer" : "pro";
    const terms = LAB_TERMS[mode];

    document.body.classList.remove("theme-pro", "theme-explorer");
    document.body.classList.add("theme-pro"); // force original look for everyone

    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.innerText = text;
    };

    setText("lab-trigger-text", terms.trigger);
    setText("lab-title", terms.title);
    setText("label-name", terms.name);
    setText("label-goal", terms.goal);
    setText("label-refs", terms.refs);
    setText("label-steps", terms.steps);

    const btnAdd = document.getElementById("btn-add-step");
    if (btnAdd) btnAdd.innerText = terms.addStep;

    const btnHelp = document.getElementById("btn-help");
    if (btnHelp) btnHelp.innerText = terms.help;

    const btnSubmit = document.getElementById("btn-submit");
    if (btnSubmit) btnSubmit.innerText = terms.submit;
  }

  toggle() {
    if (!this.overlay) return;

    this.isOpen = !this.isOpen;
    if (this.isOpen) this.overlay.classList.add("lab-visible");
    else this.overlay.classList.remove("lab-visible");
  }

  pinFromGallery(artData) {
    if (!artData) return;
    if (this.projectData.references.find((r) => r.title === artData.title)) return;

    // optional: only call if it exists
    if (typeof recordPin === "function") recordPin(artData);

    this.projectData.references.push(artData);

    // If the UI container doesn't exist, don't crash.
    if (!this.refContainer) return;

    const pin = document.createElement("div");
    pin.className = "lab-pin-card";
    const imgUrl = artData.img || "https://placehold.co/100x100/1e3a8a/ffffff?text=ART";
    pin.innerHTML = `<img src="${imgUrl}" class="lab-pin-img"><span>${typeof toSafeText === "function" ? toSafeText(artData.title) : (artData.title || "")}</span>`;

    const emptyState = this.refContainer.querySelector(".lab-empty-state");
    if (emptyState) emptyState.remove();

    this.refContainer.appendChild(pin);

    if (typeof logJourney === "function") {
      logJourney({
        ts: Date.now(),
        type: "pin",
        title: artData.title,
        artist: artData.artist,
        floor: artData.floor ?? "Gallery",
      });
    }

    if (!this.isOpen) {
      const icon = document.getElementById("lab-trigger-icon");
      if (icon) {
        icon.innerText = "✨";
        setTimeout(() => (icon.innerText = "⚡"), 1000);
      }
    }
  }

  setupEventListeners() {
    // Add step
    const btnAdd = document.getElementById("btn-add-step");
    if (btnAdd) {
      btnAdd.addEventListener("click", () => {
        if (!this.milestoneList) return;

        const li = document.createElement("li");
        li.className = "lab-milestone-item";
        li.innerHTML =
          `<input type="checkbox" class="lab-checkbox"> ` +
          `<input type="text" class="lab-input" style="margin:0; padding:6px;" placeholder="New Step...">`;

        this.milestoneList.appendChild(li);
      });
    }

    // Help button
    const btnHelp = document.getElementById("btn-help");
    if (btnHelp) {
      btnHelp.addEventListener("click", () => {
        if (typeof PREMIUM_CONTACT_URL !== "undefined" && PREMIUM_CONTACT_URL) {
          window.open(PREMIUM_CONTACT_URL, "_blank");
        } else {
          alert("Contact link is not set yet.");
        }
      });
    }

    // Submit button -> Formspree
    const btnSubmit = document.getElementById("btn-submit");
    if (btnSubmit) {
      btnSubmit.addEventListener("click", async () => {
        // prevent double-submit
        btnSubmit.disabled = true;
        btnSubmit.style.opacity = "0.6";
        btnSubmit.style.pointerEvents = "none";

        try {
          // Project name
          const nameInput = document.getElementById("project-name-input");
          const projectName = nameInput?.value?.trim() || "Untitled Project";

          // Goal (support multiple possible IDs)
          const goalInput =
            document.getElementById("project-goal-input") ||
            document.getElementById("goal-input") ||
            document.getElementById("project-goal");
          const projectGoal = goalInput?.value?.trim() || "";

          // Milestones
          const milestones = [...document.querySelectorAll("#lab-milestone-list .lab-milestone-item")]
            .map((li) => {
              const done = li.querySelector(".lab-checkbox")?.checked ?? false;
              const text = li.querySelector('input[type="text"]')?.value?.trim() || "";
              return text ? { done, text } : null;
            })
            .filter(Boolean);

          // Pinned references
          const references = Array.isArray(this.projectData?.references) ? this.projectData.references : [];

          // Formspree payload
          const payload = {
            intent_type: "creator_lab_submit",
            mode: this.user?.ageGroup === "Child" ? "explorer" : "pro",
            age_group: this.user?.ageGroup || "",
            project_name: projectName,
            project_goal: projectGoal,
            milestones: JSON.stringify(milestones),
            references: JSON.stringify(references),
            page_url: location.href,
            ts: new Date().toISOString(),
            _subject: `Creator Lab Submission: ${projectName}`,
          };

          const formData = new FormData();
          Object.entries(payload).forEach(([k, v]) => formData.append(k, v));

          const res = await fetch(FORMSPREE_ENDPOINT, {
            method: "POST",
            body: formData,
            headers: { Accept: "application/json" },
          });

          if (!res.ok) {
            let msg = "Submission failed.";
            try {
              const data = await res.json();
              if (data?.errors?.length) msg = data.errors.map((e) => e.message).join(" | ");
            } catch {}
            throw new Error(msg);
          }

          // Success message
          if (this.user?.ageGroup === "Child") {
            alert("Quest Complete! Your guide has received your adventure map!");
          } else {
            alert(`✅ SUCCESS\n\nProject "${projectName}" has been submitted.\n\nThank you! We'll review it and get back to you if needed.`);
          }
        } catch (err) {
          alert(`❌ Submission failed.\n\n${err?.message || "Unknown error"}`);
        } finally {
          btnSubmit.disabled = false;
          btnSubmit.style.opacity = "";
          btnSubmit.style.pointerEvents = "";
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
    history: chatHistory, // per-art (current)
    aiPersona: aiPersona,

    // ✅ new persistence for My Journey
    journeyLog: journeyLog,
    visitedArtworks: visitedArtworks,
    pinnedArtworks: pinnedArtworks
  };
  localStorage.setItem("lfc_progress_" + userID, JSON.stringify(data));
}

function loadProgress() {
  const saved = localStorage.getItem("lfc_progress_" + userID);
  if (saved) {
    const data = JSON.parse(saved);
    userProfile = data.profile || userProfile;
    intentScores = data.scores || intentScores;
    discoveryProgress = data.progress || 0;
    aiPersona = data.aiPersona || aiPersona;

    journeyLog = Array.isArray(data.journeyLog) ? data.journeyLog : [];
    visitedArtworks = Array.isArray(data.visitedArtworks) ? data.visitedArtworks : [];
    pinnedArtworks = Array.isArray(data.pinnedArtworks) ? data.pinnedArtworks : [];

    return true;
  }
  return false;
}

// ✅ FIX: "Begin Journey" now ALWAYS opens the panel to prevent freezing
function showRegistration() {
  document.getElementById("entrance-content").style.opacity = "0";
  setTimeout(() => {
    document.getElementById("reg-panel").classList.add("active");
  }, 300);
}

// 1. Role Selection
function toggleRole(btn) {
  const container = document.getElementById("opt-role");
  const siblings = container.querySelectorAll(".reg-btn");
  siblings.forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");
  userProfile.role = [btn.innerText];
  checkReady();
}

// 2. Age Selection
function toggleAge(btn, val) {
  const container = document.getElementById("opt-age");
  const siblings = container.querySelectorAll(".reg-btn");
  siblings.forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");
  userProfile.ageGroup = val;

  // ✅ safety: child cannot be curator mode
  if (userProfile.ageGroup === "Child") {
    aiPersona = "docent";
    localStorage.setItem("lfc_ai_persona", aiPersona);
  }

  checkReady();
}

// 3. Goal Selection
function toggleGoal(btn) {
  const txt = btn.innerText;
  if (btn.classList.contains("selected")) {
    btn.classList.remove("selected");
    userProfile.goal = userProfile.goal.filter(g => g !== txt);
  } else {
    if (userProfile.goal.length < 2) {
      btn.classList.add("selected");
      userProfile.goal.push(txt);
    }
  }
  checkReady();
}

// 4. Interest Selection
function toggleInterest(btn) {
  const txt = btn.innerText;
  if (btn.classList.contains("selected")) {
    btn.classList.remove("selected");
    userProfile.interests = userProfile.interests.filter(i => i !== txt);
  } else {
    if (userProfile.interests.length < 3) {
      btn.classList.add("selected");
      userProfile.interests.push(txt);
    }
  }
}

// 5. Validation
function checkReady() {
  const enterBtn = document.getElementById("final-enter-btn");
  const isReady = userProfile.role.length > 0 && userProfile.ageGroup !== "" && userProfile.goal.length > 0;
  if (isReady) enterBtn.classList.add("ready");
  else enterBtn.classList.remove("ready");
}

// 6. Skip Logic
function skipRegistration() {
  userProfile.role = ["Viewer"];
  userProfile.ageGroup = "Adult";
  userProfile.goal = [];
  userProfile.interests = [];
  enterGallery();
}

// 7. Click Handler for "Enter Gallery" Button
function completeRegistration() {
  const enterBtn = document.getElementById("final-enter-btn");
  if (enterBtn.classList.contains("ready")) {
    enterGallery();
  }
}

// ✅ NEW HELPER: Shared Entry Logic
function enterGallery() {
  saveProgress();
  document.body.classList.add("doors-open");

  window.creatorLab = new FEICreatorLab(userProfile);
  document.getElementById("lab-trigger").style.display = "flex";
  document.getElementById("discovery-fill").style.width = discoveryProgress + "%";

  setTimeout(() => {
    const tip = document.getElementById("onboarding-tip");
    if (tip) {
      tip.classList.add("visible");
      setTimeout(() => {
        tip.classList.remove("visible");
      }, 5000);
    }
  }, 3000);

  setTimeout(() => {
    document.getElementById("entrance-layer").style.display = "none";
    document.getElementById("reg-panel").style.display = "none";
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

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 30);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0xe0f2fe, 0.5);
scene.add(hemiLight);
const dirLight = new THREE.DirectionalLight(0xfffaed, 0.6);
dirLight.position.set(50, 100, 50);
dirLight.castShadow = true;
scene.add(dirLight);

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
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 1024, 1024);
  ctx.fillStyle = "#1e3a8a";
  ctx.font = "bold 50px Arial";
  ctx.fillText(cfg.title, 60, 100);
  ctx.font = "italic 36px Times New Roman";
  ctx.fillStyle = "#333";
  ctx.fillText(cfg.subtitle, 60, 150);
  ctx.fillStyle = "#22c55e";
  ctx.font = "bold 30px Arial";
  ctx.fillText(cfg.tagline, 60, 230);
  ctx.fillStyle = "#444";
  ctx.font = "28px Arial";
  const words = cfg.desc.split(" ");
  let line = "";
  let y = 300;
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    if (ctx.measureText(testLine).width > 900 && n > 0) {
      ctx.fillText(line, 60, y);
      line = words[n] + " ";
      y += 40;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, 60, y);
  y += 80;
  ctx.fillStyle = "#1e3a8a";
  ctx.font = "bold 32px Arial";
  ctx.fillText(cfg.method, 60, y);
  y += 50;
  ctx.fillStyle = "#666";
  ctx.font = "28px Arial";
  ctx.fillText(cfg.steps, 60, y);
  return new THREE.CanvasTexture(canvas);
}

function createFallbackTexture(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 640;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f1f5f9";
  ctx.fillRect(0, 0, 512, 640);
  ctx.fillStyle = "#1e3a8a";
  ctx.font = "bold 30px Arial";
  ctx.textAlign = "center";
  ctx.fillText("LFC COLLECTION", 256, 300);
  ctx.font = "italic 18px Arial";
  ctx.fillStyle = "#64748b";
  ctx.fillText(toSafeText(text).substring(0, 30), 256, 350);
  return new THREE.CanvasTexture(canvas);
}

function buildGallery() {
  FLOORS.forEach(f => {
    const y = f.id * floorHeight;
    const group = new THREE.Group();
    let fMat = f.type === "darkroom" ? matFloorDark : matFloor;
    let wMat = f.type === "darkroom" ? matWallDark : matWall;

    const floor = new THREE.Mesh(new THREE.BoxGeometry(40, 0.5, 120), fMat);
    floor.position.set(0, y, 0);
    group.add(floor);

    const ceil = new THREE.Mesh(new THREE.BoxGeometry(40, 0.5, 120), wMat);
    ceil.position.set(0, y + 16, 0);
    group.add(ceil);

    const w1 = new THREE.Mesh(new THREE.BoxGeometry(1, 16, 120), wMat);
    w1.position.set(19.5, y + 8, 0);
    group.add(w1);

    const w2 = new THREE.Mesh(new THREE.BoxGeometry(1, 16, 120), wMat);
    w2.position.set(-19.5, y + 8, 0);
    group.add(w2);

    if (f.id === 0) {
      createArtFrame(group, -18.5, y + 6, -10, Math.PI / 2, 10, 6, {
        title: "Introduction Video",
        artist: "Watch on YouTube",
        img: ATRIUM_CONFIG.videoThumb,
        link: ATRIUM_CONFIG.videoLink,
        isExternal: true,
        floor: 0
      });
      createArtFrame(group, 18.5, y + 6, -10, -Math.PI / 2, 10, 8, {
        title: "Manifesto",
        artist: "LFC System",
        texture: createTextTexture(ATRIUM_CONFIG),
        floor: 0
      });
      createArtFrame(group, 0, y + 7, -50, 0, 12, 6, {
        title: "LFC SYSTEM",
        artist: "FEI TeamArt",
        img: "https://placehold.co/1200x600/1e3a8a/ffffff?text=LFC+ART+SPACE",
        floor: 0
      });
    }

    const arts = ART_DATA.filter(a => Number(a.floor) === f.id);

    if (f.type === "sculpture") {
      arts.forEach((data, idx) => {
        const z = -40 + idx * 15;
        const plinth = new THREE.Mesh(new THREE.BoxGeometry(3, 1.5, 3), matPlinth);
        plinth.position.set(0, y + 0.75, z);
        group.add(plinth);

        const standeeGroup = new THREE.Group();
        standeeGroup.position.set(0, y + 2.5, z);

        const geom = new THREE.PlaneGeometry(3, 3);
        const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
        if (data.img) {
          textureLoader.load(data.img, tex => {
            mat.map = tex;
            mat.needsUpdate = true;
          });
        }
        const mesh = new THREE.Mesh(geom, mat);
        standeeGroup.add(mesh);
        standeeGroup.rotation.y = Math.random() * 0.5 - 0.25;

        const hitbox = new THREE.Mesh(new THREE.BoxGeometry(4, 5, 4), new THREE.MeshBasicMaterial({ visible: false }));
        hitbox.userData = { type: "art", data: data, viewPos: { x: 5, y: y + 4, z: z + 5 } };
        interactables.push(hitbox);
        standeeGroup.add(hitbox);
        group.add(standeeGroup);
      });
    } else if (arts.length > 0) {
      const left = [];
      const right = [];
      arts.forEach((d, i) => {
        i % 2 === 0 ? right.push(d) : left.push(d);
      });

      let w = 4,
        h = 5;
      if (f.type === "darkroom") {
        w = 8;
        h = 4.5;
      }
      const zMin = -50,
        zMax = 50;

      right.forEach((data, idx) => {
        const zPos = right.length <= 1 ? 0 : zMin + idx * ((zMax - zMin) / (right.length - 1 || 1));
        createArtFrame(group, 18.5, y + 6.5, zPos, -Math.PI / 2, w, h, data);
      });

      left.forEach((data, idx) => {
        const zPos = left.length <= 1 ? 0 : zMin + idx * ((zMax - zMin) / (left.length - 1 || 1));
        createArtFrame(group, -18.5, y + 6.5, zPos, Math.PI / 2, w, h, data);
      });
    } else if (f.id !== 0) {
      for (let i = 0; i < 6; i++) {
        const isRight = i % 2 === 0;
        createArtFrame(group, isRight ? 18.5 : -18.5, y + 6.5, -40 + i * 15, isRight ? -Math.PI / 2 : Math.PI / 2, 4, 5, {
          title: `Future Exhibit`,
          artist: f.name,
          img: "",
          floor: f.id
        });
      }
    }

    scene.add(group);

    const btn = document.createElement("div");
    btn.className = "floor-item";
    btn.innerHTML = `<div class="floor-label">${f.name}</div><div class="floor-num">${f.id}</div>`;
    btn.onclick = () => window.goToFloor(f.id);
    document.getElementById("elevator").prepend(btn);
  });
}

function createArtFrame(group, x, y, z, rot, w, h, data) {
  const frameGroup = new THREE.Group();
  frameGroup.position.set(x, y, z);
  frameGroup.rotation.y = rot;

  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, h + 0.2, 0.2), matFrame);
  frameGroup.add(frame);

  const canvas = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0xeeeeee }));
  canvas.position.z = 0.15;
  frameGroup.add(canvas);

  if (data.texture) {
    canvas.material = new THREE.MeshBasicMaterial({ map: data.texture });
  } else if (data.img) {
    textureLoader.load(
      data.img,
      tex => {
        canvas.material = new THREE.MeshBasicMaterial({ map: tex });
        canvas.material.needsUpdate = true;
      },
      undefined,
      () => {
        canvas.material = new THREE.MeshBasicMaterial({ map: createFallbackTexture(data.title) });
      }
    );
  } else {
    canvas.material = new THREE.MeshBasicMaterial({ map: createFallbackTexture(data.title) });
  }

  const hitbox = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.5), new THREE.MeshBasicMaterial({ visible: false }));
  hitbox.userData = { type: "art", data: data, viewPos: { x: x + Math.sin(rot) * 10, y: y, z: z + Math.cos(rot) * 10 } };
  interactables.push(hitbox);
  frameGroup.add(hitbox);
  group.add(frameGroup);
}

// ==========================================
// 6. PHYSICS NAVIGATION
// ==========================================
const velocity = new THREE.Vector3();
const speed = 1.8;
const friction = 0.8;
const lookSpeed = 0.002;
let moveForward = false,
  moveBackward = false,
  moveLeft = false,
  moveRight = false;

document.addEventListener("keydown", e => {
  if (e.code === "ArrowUp" || e.code === "KeyW") moveForward = true;
  if (e.code === "ArrowLeft" || e.code === "KeyA") moveLeft = true;
  if (e.code === "ArrowDown" || e.code === "KeyS") moveBackward = true;
  if (e.code === "ArrowRight" || e.code === "KeyD") moveRight = true;
});
document.addEventListener("keyup", e => {
  if (e.code === "ArrowUp" || e.code === "KeyW") moveForward = false;
  if (e.code === "ArrowLeft" || e.code === "KeyA") moveLeft = false;
  if (e.code === "ArrowDown" || e.code === "KeyS") moveBackward = false;
  if (e.code === "ArrowRight" || e.code === "KeyD") moveRight = false;
});

function updatePhysics() {
  if (isInputLocked) return;
  velocity.x *= friction;
  velocity.z *= friction;
  const forward = getForwardVector();
  const right = getRightVector();
  if (moveForward) velocity.addScaledVector(forward, speed);
  if (moveBackward) velocity.addScaledVector(forward, -speed);
  if (moveLeft) velocity.addScaledVector(right, -speed);
  if (moveRight) velocity.addScaledVector(right, speed);
  camera.position.x += velocity.x * 0.015;
  camera.position.z += velocity.z * 0.015;
  camera.position.x = Math.max(-18, Math.min(18, camera.position.x));
  camera.position.z = Math.max(-100, Math.min(100, camera.position.z));
}
function getForwardVector() {
  const d = new THREE.Vector3();
  camera.getWorldDirection(d);
  d.y = 0;
  d.normalize();
  return d;
}
function getRightVector() {
  const f = getForwardVector();
  return new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize();
}

let isDragging = false,
  prevMouse = { x: 0, y: 0 };
document.addEventListener("pointerdown", e => {
  if (
    !e.target.closest("button") &&
    !e.target.closest("#ai-panel") &&
    !e.target.closest("#entrance-layer") &&
    !e.target.closest(".floor-item") &&
    !e.target.closest("#creator-lab-overlay") &&
    !e.target.closest("#blueprint")
  ) {
    isDragging = true;
    prevMouse = { x: e.clientX, y: e.clientY };
  }
});
document.addEventListener("pointerup", () => {
  isDragging = false;
});
document.addEventListener("pointermove", e => {
  if (!isDragging || isInputLocked) return;
  const dx = e.clientX - prevMouse.x,
    dy = e.clientY - prevMouse.y;
  const euler = new THREE.Euler(0, 0, 0, "YXZ");
  euler.setFromQuaternion(camera.quaternion);
  euler.y -= dx * lookSpeed;
  euler.x -= dy * lookSpeed;
  euler.x = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, euler.x));
  camera.quaternion.setFromEuler(euler);
  prevMouse = { x: e.clientX, y: e.clientY };
});

window.moveStart = d => {
  if (d === "f") moveForward = true;
  if (d === "b") moveBackward = true;
  if (d === "l") moveLeft = true;
  if (d === "r") moveRight = true;
};
window.moveStop = () => {
  moveForward = false;
  moveBackward = false;
  moveLeft = false;
  moveRight = false;
};

// ==========================================
// 7. INTERACTION & AI
// ==========================================

// ✅ FIX: EXPORTED GLOBAL FUNCTION for Buttons
window.goToFloor = function(id) {
  if (window.closeBlueprint) window.closeBlueprint();
  exitFocus();
  isInputLocked = true;
  TWEEN.removeAll();

  new TWEEN.Tween(camera.position)
    .to({ y: id * floorHeight + 5 }, 2000)
    .easing(TWEEN.Easing.Quadratic.InOut)
    .onComplete(() => {
      isInputLocked = false;
      console.log("Arrived at Floor " + id);
    })
    .start();
};

function focusArt(userData) {
  if (userData.data.isExternal && userData.data.link) {
    window.open(userData.data.link, "_blank");
    return;
  }

  currentOpenArt = userData.data;

  // ✅ record visit for My Journey
  recordVisit(currentOpenArt);
  logJourney({
    ts: Date.now(),
    type: "visit",
    title: currentOpenArt.title,
    artist: currentOpenArt.artist,
    floor: currentOpenArt.floor ?? currentOpenArt.floor === 0 ? 0 : (currentOpenArt.floor ?? "Gallery")
  });

  isInputLocked = true;
  document.body.classList.add("ai-open");
  camera.userData.returnPos = camera.position.clone();
  camera.userData.returnQuat = camera.quaternion.clone();
  const t = userData.viewPos;

  new TWEEN.Tween(camera.position)
    .to({ x: t.x, y: t.y, z: t.z }, 1800)
    .easing(TWEEN.Easing.Cubic.Out)
    .onComplete(() => {
      openAI(userData.data);
      document.getElementById("back-btn").classList.add("visible");
    })
    .start();

  const dum = new THREE.Object3D();
  dum.position.copy(t);
  dum.lookAt(userData.data.x || t.x, t.y, userData.data.z || t.z);
  new TWEEN.Tween(camera.quaternion)
    .to({ x: dum.quaternion.x, y: dum.quaternion.y, z: dum.quaternion.z, w: dum.quaternion.w }, 1500)
    .easing(TWEEN.Easing.Cubic.Out)
    .start();
}

function exitFocus() {
  document.body.classList.remove("ai-open");
  document.getElementById("ai-panel").classList.remove("active");
  document.getElementById("back-btn").classList.remove("visible");
  currentOpenArt = null;

  if (camera.userData.returnPos) {
    new TWEEN.Tween(camera.position)
      .to(camera.userData.returnPos, 1200)
      .easing(TWEEN.Easing.Quadratic.Out)
      .onComplete(() => {
        isInputLocked = false;
      })
      .start();
    new TWEEN.Tween(camera.quaternion).to(camera.userData.returnQuat, 1200).easing(TWEEN.Easing.Quadratic.Out).start();
  } else {
    isInputLocked = false;
  }
}

function openAI(data) {
  document.getElementById("ai-panel").classList.add("active");
  if (data.texture) document.getElementById("ai-img").src = "https://placehold.co/800x600/1e3a8a/ffffff?text=LFC+Info";
  else document.getElementById("ai-img").src = data.img;

  document.getElementById("ai-title").innerText = data.title;
  document.getElementById("ai-meta").innerText = (data.artist || "Unknown") + " • " + (data.year || "—");

  // reset per-art chat
  chatHistory = [];
  questionCount = 0;
  document.getElementById("chat-stream").innerHTML = "";

  // ensure mode UI reflects stored value
  updateAIModeUI();

  // Adaptive Welcome
  let welcomeMsg = "I am observing this piece with you. What do you see?";

  if (userProfile.ageGroup === "Child") {
    welcomeMsg = "Hi! I'm your art buddy. Does this look like anything you've seen before?";
  } else if (aiPersona === "curator") {
    welcomeMsg = "Curator here. We can analyze this like a professional: curatorial context, concept structure, and why it belongs in a show. What part should we start with: form, context, or meaning?";
  } else if (userProfile.role.includes("Collector")) {
    welcomeMsg = "Welcome. Shall we analyze the provenance and market value?";
  }

  addChatMsg("ai", welcomeMsg);
}

window.pinCurrentArt = function() {
  if (window.creatorLab && currentOpenArt) {
    window.creatorLab.pinFromGallery(currentOpenArt);
    window.creatorLab.toggle();
  }
};

// ==========================================
// 7.1 GEMINI CALL (SHARED)
// ==========================================
async function callGeminiLikeGateway({ message, history, art, userProfile, systemInstruction }) {
  const res = await fetch(AI_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      history,
      art,
      userProfile,
      systemInstruction
    })
  });

  if (!res.ok) throw new Error(res.status);
  return await res.json();
}

function cleanPossiblyJsonReply(raw) {
  let cleanReply = raw;
  if (typeof cleanReply === "string") {
    cleanReply = cleanReply.replace(/```json/gi, "").replace(/```/g, "").trim();
  }
  return cleanReply;
}

function tryParseJsonFromText(text) {
  const t = cleanPossiblyJsonReply(text);
  if (!t) return null;
  if (t.startsWith("{") || t.startsWith("[")) {
    try {
      return JSON.parse(t);
    } catch (e) {}
  }
  // try extract first JSON block
  const firstBrace = t.indexOf("{");
  const lastBrace = t.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const chunk = t.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(chunk);
    } catch (e) {}
  }
  return null;
}

// ==========================================
// 7.2 CHAT SEND
// ==========================================
async function sendChat() {
  if (isSending) return;
  const i = document.getElementById("user-input"),
    txt = i.value.trim();
  if (!txt) return;

  isSending = true;
  const sendBtn = document.getElementById("send-btn");
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.style.opacity = "0.7";
  }

  // ✅ Force append User Message
  addChatMsg("user", txt);

  // ✅ record into Journey log
  logJourney({
    ts: Date.now(),
    type: "chat",
    role: "user",
    persona: aiPersona,
    art: currentOpenArt ? { title: currentOpenArt.title, artist: currentOpenArt.artist, year: currentOpenArt.year, floor: currentOpenArt.floor } : null,
    text: txt
  });

  i.value = "";

  questionCount++;
  discoveryProgress = Math.min(100, discoveryProgress + 15);
  document.getElementById("discovery-fill").style.width = discoveryProgress + "%";
  saveProgress();

  // Gemini-style history
  chatHistory.push({ role: "user", parts: [{ text: txt }] });

  try {
    const artPayload = currentOpenArt
      ? { title: currentOpenArt.title, artist: currentOpenArt.artist, year: currentOpenArt.year, medium: currentOpenArt.medium, floor: currentOpenArt.floor ?? "Gallery" }
      : { title: "Unknown" };

    // ✅ Docent vs Curator logic (adult/teen only)
    let systemInstruction = "You are a helpful art docent.";

    if (userProfile.ageGroup === "Child") {
      systemInstruction = "You are a friendly, encouraging guide for a child. Use simple language, ask playful questions, and invite observation without pressure.";
    } else if (aiPersona === "curator") {
      systemInstruction =
        "You are a professional museum curator and contemporary art critic. Speak clearly but at an advanced level. Use curatorial framing: context, exhibition logic, interpretation, conceptual structure, and why the work matters. Ask strong, precise questions. Give concrete next steps (what to read, what to compare, what to practice).";
    } else if (userProfile.role.includes("Collector")) {
      systemInstruction = "You are an art market analyst. Focus on provenance, edition, valuation logic, and market context without inventing fake prices.";
    } else if (userProfile.role.includes("Student")) {
      systemInstruction = "You are a helpful art docent who teaches. Give structured feedback and small practice prompts.";
    }

    const thinkId = addChatMsg("ai", "...");

    const d = await callGeminiLikeGateway({
      message: txt,
      history: chatHistory,
      art: artPayload,
      userProfile: userProfile,
      systemInstruction: systemInstruction
    });

    // remove thinking bubble
    const thinkEl = document.getElementById(thinkId);
    if (thinkEl) thinkEl.remove();

    // reply
    let replyText = d.reply;
    replyText = cleanPossiblyJsonReply(replyText);

    // if gateway returned JSON with {reply:"..."}
    const parsed = tryParseJsonFromText(replyText);
    if (parsed && parsed.reply) replyText = parsed.reply;

    addChatMsg("ai", replyText);
    chatHistory.push({ role: "model", parts: [{ text: replyText }] });

    // ✅ record AI reply into Journey log
    logJourney({
      ts: Date.now(),
      type: "chat",
      role: "model",
      persona: aiPersona,
      art: currentOpenArt ? { title: currentOpenArt.title, artist: currentOpenArt.artist, year: currentOpenArt.year, floor: currentOpenArt.floor } : null,
      text: replyText
    });

    // scoring
    if (d.scores) {
      intentScores.history += d.scores.history || 0;
      intentScores.technique += d.scores.technique || 0;
      intentScores.market += d.scores.market || 0;
      intentScores.theory += d.scores.theory || 0;

      let signal = "";
      if ((d.scores.technique || 0) > 0) signal = "Technique";
      else if ((d.scores.history || 0) > 0) signal = "History";
      else if ((d.scores.market || 0) > 0) signal = "Market";
      else if ((d.scores.theory || 0) > 0) signal = "Theory";

      if (signal) showSignalHint(signal);
      sendDataBeacon();
    }

    // prompt journey
    if (questionCount === 3) {
      setTimeout(() => {
        addChatMsg("ai", "I can generate a detailed My Journey report based on your path, keywords, and questions so far. Open My Journey when you’re ready.");
        const jb = document.getElementById("journey-btn");
        if (jb) {
          jb.style.transform = "scale(1.1)";
          setTimeout(() => (jb.style.transform = "scale(1)"), 500);
        }
      }, 1500);
    }

    saveProgress();
  } catch (e) {
    console.error(e);
    addChatMsg("ai", "⚠️ Connection Error.");
  } finally {
    isSending = false;
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.style.opacity = "1";
    }
  }
}

function addChatMsg(r, t) {
  const d = document.createElement("div");
  d.className = `msg msg-${r}`;
  d.innerText = t;

  const uid = "msg-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  d.id = uid;

  document.getElementById("chat-stream").appendChild(d);
  return uid;
}

function showSignalHint(type) {
  const d = document.createElement("div");
  d.style.cssText =
    "font-size:10px; color:#64748b; text-align:center; margin:5px 0; text-transform:uppercase; letter-spacing:1px; opacity:0.8;";
  d.innerHTML = `✦ Noted: Focus on <strong>${type}</strong>`;
  document.getElementById("chat-stream").appendChild(d);
}

function sendDataBeacon() {
  console.log("📡 DATA BEACON SENT:", { session: "user_" + Date.now(), interests: intentScores, questions: questionCount });
}

// ==========================================
// 7.3 MY JOURNEY (AI-GENERATED UPGRADE)
// ==========================================

// Compute strongest interest category (existing logic)
function getWinningInterest() {
  let maxScore = 0;
  let interest = "general";
  for (const [key, val] of Object.entries(intentScores)) {
    if (val > maxScore) {
      maxScore = val;
      interest = key;
    }
  }

  if (maxScore === 0 && userProfile.interests.length > 0) {
    const k = userProfile.interests;
    if (k.includes("Art Market") || k.includes("Understand Collecting/Market")) interest = "market";
    else if (k.includes("History") || k.includes("Impressionism") || k.includes("Learn Art History")) interest = "history";
    else if (k.includes("Painting") || k.includes("Sculpture") || k.includes("Learn Techniques")) interest = "technique";
    else if (k.includes("Philosophy") || k.includes("Social Themes") || k.includes("Explore Meaning & Ideas")) interest = "theory";
  }

  return interest;
}

function buildJourneyTranscript(limit = 60) {
  const items = journeyLog.filter(x => x && x.type === "chat").slice(-limit);
  return items
    .map(x => {
      const artLabel = x.art && x.art.title ? `(${x.art.title})` : "(Gallery)";
      const who = x.role === "user" ? "USER" : "AI";
      const mode = x.persona ? x.persona.toUpperCase() : "DOCENT";
      return `${who} ${mode} ${artLabel}: ${toSafeText(x.text)}`;
    })
    .join("\n");
}

async function generateJourneyReport() {
  const interest = getWinningInterest();

  const visitedList = visitedArtworks
    .slice(-20)
    .map(a => `- ${a.title} — ${a.artist} (${a.year}) [Floor: ${floorNameById(a.floor)}]`)
    .join("\n");

  const pinnedList = pinnedArtworks
    .slice(-20)
    .map(a => `- ${a.title} — ${a.artist} (${a.year})`)
    .join("\n");

  const transcript = buildJourneyTranscript(80);

  const courseList = (CATALOG.products || [])
    .filter(p => p.type === "course")
    .map(p => `- ${p.id}: ${p.title} (tag=${p.tag})`)
    .join("\n");

  const prompt = `
You are the "LFC My Journey Engine" inside an online gallery.
Generate a detailed "My Journey" report using the provided data.

Return STRICT JSON ONLY (no markdown, no extra text). Use this schema:

{
  "sessionSummary": "3-6 sentences",
  "keywords": ["10-20 concise keywords"],
  "themes": ["up to 6 themes"],
  "visitorType": "short label (ex: Explorer / Student / Collector / Artist / Art Lover / Educator)",
  "recommendedTrack": "one of: technique, history, market, theory, general",
  "whyThisTrack": "short reasoning",
  "learningPlan": {
    "practice": ["3-5 concrete practice tasks"],
    "reflection": ["2-4 reflection prompts"],
    "nextSteps": ["3-5 next steps in the gallery or learning"]
  },
  "recommendedClassId": "one course id from list OR 'custom'",
  "recommendedClassWhy": "short reasoning",
  "curatorUpgrade": {
    "shouldUpgrade": true/false,
    "why": "short reason",
    "suggestedQuestions": ["3-6 advanced questions for curator mode"]
  }
}

DATA:
Visitor Profile:
- role: ${JSON.stringify(userProfile.role)}
- ageGroup: ${JSON.stringify(userProfile.ageGroup)}
- goals: ${JSON.stringify(userProfile.goal)}
- interests: ${JSON.stringify(userProfile.interests)}
- discoveryProgress: ${discoveryProgress}
- intentScores: ${JSON.stringify(intentScores)}
- currentPreferredInterest: ${interest}

Visited Artworks (recent):
${visitedList || "- (none yet)"}

Pinned Artworks (recent):
${pinnedList || "- (none yet)"}

Transcript (recent):
${transcript || "(no conversation yet)"}

Available Courses:
${courseList || "- (none)"}

Remember: output JSON only.
`.trim();

  const systemInstruction =
    "You are a precise education+curation engine. You must not invent facts about specific real artworks. Use the transcript and user data. Return JSON only.";

  const d = await callGeminiLikeGateway({
    message: prompt,
    history: [], // keep clean for reliability
    art: { title: "My Journey", artist: "LFC System", year: "—", floor: "Blueprint" },
    userProfile: userProfile,
    systemInstruction: systemInstruction
  });

  const raw = cleanPossiblyJsonReply(d.reply);
  const parsed = tryParseJsonFromText(raw);
  if (!parsed) throw new Error("Journey JSON parse failed");
  return parsed;
}

// ✅ NEW: Detailed My Journey Layout (AI + fallback)
async function startBlueprint() {
  document.getElementById("blueprint").classList.add("active");

  const container = document.getElementById("bp-products");
  container.innerHTML = "<h3 style='text-align:center; color:var(--blue);'>Curating your journey...</h3>";

  // clear old areas
  const desc = document.getElementById("bp-desc");
  const steps = document.getElementById("bp-steps");
  if (desc) desc.innerHTML = "";
  if (steps) steps.innerHTML = "";

  // Always show quick trail (even if AI fails)
  const trailHtml = renderTrailBlock();

  try {
    const report = await generateJourneyReport();
    const interest = report.recommendedTrack || getWinningInterest();
    const pathData = LEARNING_PATHS[interest] || LEARNING_PATHS.general;

    const recommendedCourse = pickCourseByIdOrTag(report.recommendedClassId, interest);
    const courseTitle = recommendedCourse ? recommendedCourse.title : "Custom Curriculum Design";
    const courseDesc = recommendedCourse ? recommendedCourse.desc : "We don’t have a perfect pre-made match yet. Work with a mentor to build your personalized syllabus.";
    const courseUrl = recommendedCourse ? recommendedCourse.url : PREMIUM_CONTACT_URL;

    // premium cards
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

    const keywords = Array.isArray(report.keywords) ? report.keywords : [];
    const themes = Array.isArray(report.themes) ? report.themes : [];
    const practice = report.learningPlan && Array.isArray(report.learningPlan.practice) ? report.learningPlan.practice : [];
    const reflection = report.learningPlan && Array.isArray(report.learningPlan.reflection) ? report.learningPlan.reflection : [];
    const nextSteps = report.learningPlan && Array.isArray(report.learningPlan.nextSteps) ? report.learningPlan.nextSteps : [];
    const curatorQ =
      report.curatorUpgrade && Array.isArray(report.curatorUpgrade.suggestedQuestions) ? report.curatorUpgrade.suggestedQuestions : [];

    const curatorUpgradeBlock = `
      <div style="margin-top:1.5rem; padding:1rem; border:1px solid #e2e8f0; border-radius:12px; background:#f8fafc;">
        <div style="font-size:10px; letter-spacing:2px; text-transform:uppercase; color:var(--gray); margin-bottom:8px;">Curator Upgrade</div>
        <div style="font-size:13px; color:#475569; margin-bottom:10px;">
          ${toSafeText(report.curatorUpgrade && report.curatorUpgrade.why ? report.curatorUpgrade.why : "Curator mode offers deeper analysis, structure, and professional-level guidance.")}
        </div>
        ${
          curatorQ.length
            ? `<ul style="padding-left:18px; margin:0; font-size:13px; color:#475569;">
                 ${curatorQ.map(q => `<li style="margin:6px 0;">${q}</li>`).join("")}
               </ul>`
            : ""
        }
        <div style="display:flex; gap:10px; margin-top:12px; flex-wrap:wrap;">
          <button class="plan-btn" style="width:auto; padding:10px 14px; font-size:10px;" onclick="setAIPersona('curator')">Enable Curator Mode</button>
          <button class="plan-btn" style="width:auto; padding:10px 14px; font-size:10px; background:#fff; color:var(--blue); border:1px solid var(--blue);" onclick="window.open('${PREMIUM_CONTACT_URL}', '_blank')">Book Human Curator</button>
        </div>
      </div>
    `;

    const html = `
      ${trailHtml}

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:2rem; width:100%; margin-top:1.5rem;">
        <div style="background:#f8fafc; padding:2rem; border-radius:16px; border:1px solid #e2e8f0;">
          <h2 style="color:var(--blue); font-size:1.8rem; margin:0 0 5px 0;">My Journey Report</h2>
          <div style="text-transform:uppercase; font-size:10px; letter-spacing:2px; color:var(--ok); font-weight:700; margin-bottom:1.5rem;">AI-GENERATED SUMMARY</div>

          <div style="margin-bottom:1rem;">
            <strong style="font-size:12px; color:var(--blue);">Session Summary</strong>
            <p style="font-size:13px; margin:8px 0; color:#475569; line-height:1.7;">${toSafeText(report.sessionSummary)}</p>
          </div>

          ${
            keywords.length
              ? `<div style="margin-bottom:1rem;">
                   <strong style="font-size:11px; text-transform:uppercase; color:var(--blue);">Keywords Captured</strong>
                   <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:10px;">
                     ${keywords.map(k => `<span style="font-size:10px; padding:6px 10px; border-radius:999px; background:#fff; border:1px solid #e2e8f0; color:#475569; font-weight:700;">${k}</span>`).join("")}
                   </div>
                 </div>`
              : ""
          }

          ${
            themes.length
              ? `<div style="margin-bottom:1rem;">
                   <strong style="font-size:11px; text-transform:uppercase; color:var(--blue);">Themes</strong>
                   <ul style="padding-left:18px; margin:10px 0 0; font-size:13px; color:#475569;">
                     ${themes.map(t => `<li style="margin-bottom:6px;">${t}</li>`).join("")}
                   </ul>
                 </div>`
              : ""
          }

          <div style="margin-top:1.5rem; padding-top:1.5rem; border-top:1px solid #e2e8f0;">
            <strong style="font-size:12px; color:var(--blue);">Your Track: ${pathData.title}</strong>
            <p style="font-size:13px; margin:8px 0; color:#475569;">${toSafeText(report.whyThisTrack || pathData.reason)}</p>

            <div style="margin-top:1rem;">
              <strong style="font-size:11px; text-transform:uppercase; color:var(--blue);">Practice Plan</strong>
              <ul style="padding-left:18px; margin:10px 0 0; font-size:13px; color:#475569;">
                ${(practice.length ? practice : pathData.learn).map(x => `<li style="margin-bottom:6px;">${x}</li>`).join("")}
              </ul>
            </div>

            <div style="margin-top:1rem;">
              <strong style="font-size:11px; text-transform:uppercase; color:var(--blue);">Reflection</strong>
              <ul style="padding-left:18px; margin:10px 0 0; font-size:13px; color:#475569;">
                ${(reflection.length ? reflection : [pathData.reflect]).map(x => `<li style="margin-bottom:6px;">${x}</li>`).join("")}
              </ul>
            </div>

            <div style="margin-top:1rem;">
              <strong style="font-size:11px; text-transform:uppercase; color:var(--blue);">Next Steps</strong>
              <ul style="padding-left:18px; margin:10px 0 0; font-size:13px; color:#475569;">
                ${(nextSteps.length ? nextSteps : [pathData.practice, `Next: ${pathData.next}`]).map(x => `<li style="margin-bottom:6px;">${x}</li>`).join("")}
              </ul>
            </div>
          </div>

          ${curatorUpgradeBlock}
        </div>

        <div style="background:#fff; padding:2rem; border-radius:16px; border:1px solid #e2e8f0; position:relative; overflow:hidden;">
          <div style="position:absolute; top:0; right:0; background:var(--blue); color:#fff; font-size:9px; padding:5px 10px; border-radius:0 0 0 8px; font-weight:700;">BACKSTAGE</div>

          <div style="margin-bottom:2rem; padding-bottom:1.5rem; border-bottom:1px solid #e2e8f0;">
            <div style="text-transform:uppercase; font-size:10px; letter-spacing:2px; color:var(--gray); margin-bottom:10px;">Recommended Class</div>
            <div style="display:flex; align-items:center; gap:15px;">
              <div style="flex:1;">
                <strong style="color:var(--blue); font-size:1.1rem;">${courseTitle}</strong>
                <p style="font-size:11px; color:#64748b; margin:5px 0;">${courseDesc}</p>
                ${
                  report.recommendedClassWhy
                    ? `<p style="font-size:11px; color:#475569; margin:10px 0 0; line-height:1.6;"><strong style="color:var(--blue);">Why:</strong> ${toSafeText(
                        report.recommendedClassWhy
                      )}</p>`
                    : ""
                }
              </div>
              <button class="plan-btn" style="width:auto; padding:10px 20px; font-size:11px;" onclick="window.open('${courseUrl}', '_blank')">View Options</button>
            </div>
          </div>

          <div style="text-transform:uppercase; font-size:10px; letter-spacing:2px; color:var(--gray); margin-bottom:10px;">Ask an Expert</div>
          <div style="display:flex; flex-direction:column; gap:10px;">${premiumHtml}</div>

          <div style="margin-top:2rem; padding-top:1.5rem; border-top:1px solid #e2e8f0;">
            <div style="text-transform:uppercase; font-size:10px; letter-spacing:2px; color:var(--gray); margin-bottom:10px;">Session Data</div>
            <div style="font-size:12px; color:#475569; line-height:1.8;">
              <div><strong style="color:var(--blue);">Visitor:</strong> ${toSafeText(report.visitorType || (userProfile.role[0] || "Visitor"))}</div>
              <div><strong style="color:var(--blue);">Goals:</strong> ${userProfile.goal.length ? userProfile.goal.join(", ") : "—"}</div>
              <div><strong style="color:var(--blue);">Interests:</strong> ${userProfile.interests.length ? userProfile.interests.join(", ") : "—"}</div>
              <div><strong style="color:var(--blue);">Mode:</strong> ${aiPersona === "curator" ? "Curator" : "Docent"}</div>
              <div><strong style="color:var(--blue);">Progress:</strong> ${discoveryProgress}%</div>
            </div>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
  } catch (e) {
    console.error(e);

    // fallback: keep your previous blueprint logic (static), but still show trail
    container.innerHTML = trailHtml + renderFallbackBlueprint();
  }
}

function pickCourseByIdOrTag(courseId, interestTag) {
  if (!CATALOG.products) return null;
  if (courseId && courseId !== "custom") {
    const byId = CATALOG.products.find(p => p.id === courseId);
    if (byId) return byId;
  }
  const byTag = CATALOG.products.find(p => p.type === "course" && p.tag === interestTag);
  return byTag || null;
}

function renderTrailBlock() {
  const visited = visitedArtworks.slice(-12).reverse();
  const pinned = pinnedArtworks.slice(-8).reverse();

  const visitedHtml = visited.length
    ? `<ul style="padding-left:18px; margin:10px 0 0; font-size:13px; color:#475569;">
         ${visited
           .map(v => `<li style="margin-bottom:6px;"><strong>${toSafeText(v.title)}</strong> <span style="color:#64748b;">— ${toSafeText(v.artist)} • ${toSafeText(
             v.year
           )} • ${floorNameById(v.floor)}</span></li>`)
           .join("")}
       </ul>`
    : `<div style="font-size:13px; color:#64748b; margin-top:10px;">No artworks visited yet. Click an artwork to start a trail.</div>`;

  const pinnedHtml = pinned.length
    ? `<div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:10px;">
         ${pinned
           .map(p => `<span style="font-size:10px; padding:6px 10px; border-radius:999px; background:#fff; border:1px solid #e2e8f0; color:#475569; font-weight:700;">📌 ${toSafeText(
             p.title
           )}</span>`)
           .join("")}
       </div>`
    : `<div style="font-size:13px; color:#64748b; margin-top:10px;">Nothing pinned yet. Use “📌 Start LFC Project”.</div>`;

  return `
    <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:1.5rem; width:100%;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; flex-wrap:wrap;">
        <div>
          <h2 style="color:var(--blue); font-size:1.6rem; margin:0;">My Journey</h2>
          <div style="text-transform:uppercase; font-size:10px; letter-spacing:2px; color:var(--gray); margin-top:6px;">Trail • Pinned • Transcript • Recommendations</div>
        </div>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button class="plan-btn" style="width:auto; padding:10px 14px; font-size:10px;" onclick="setAIPersona('docent')">Docent</button>
          <button class="plan-btn" style="width:auto; padding:10px 14px; font-size:10px; background:#fff; color:var(--blue); border:1px solid var(--blue);" onclick="setAIPersona('curator')">Curator</button>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: 1.4fr 1fr; gap:1.5rem; margin-top:1.2rem;">
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:1rem;">
          <div style="text-transform:uppercase; font-size:10px; letter-spacing:2px; color:var(--gray); margin-bottom:6px;">Visited Trail</div>
          ${visitedHtml}
        </div>
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:1rem;">
          <div style="text-transform:uppercase; font-size:10px; letter-spacing:2px; color:var(--gray); margin-bottom:6px;">Pinned</div>
          ${pinnedHtml}
        </div>
      </div>
    </div>
  `;
}

function renderFallbackBlueprint() {
  // Your original static blueprint (kept), but without removing or changing your layout style.
  let maxScore = 0;
  let interest = "general";
  for (const [key, val] of Object.entries(intentScores)) {
    if (val > maxScore) {
      maxScore = val;
      interest = key;
    }
  }

  if (maxScore === 0 && userProfile.interests.length > 0) {
    const k = userProfile.interests;
    if (k.includes("Art Market") || k.includes("Understand Collecting/Market")) interest = "market";
    else if (k.includes("History") || k.includes("Impressionism") || k.includes("Learn Art History")) interest = "history";
    else if (k.includes("Painting") || k.includes("Sculpture") || k.includes("Learn Techniques")) interest = "technique";
    else if (k.includes("Philosophy") || k.includes("Social Themes") || k.includes("Explore Meaning & Ideas")) interest = "theory";
  }

  const pathData = LEARNING_PATHS[interest] || LEARNING_PATHS.general;

  let recommendedCourse = null;
  if (CATALOG.products) {
    recommendedCourse = CATALOG.products.find(p => p.type === "course" && p.tag === interest);
  }

  let courseTitle = recommendedCourse ? recommendedCourse.title : "Custom Curriculum Design";
  let courseDesc = recommendedCourse
    ? recommendedCourse.desc
    : "We don't have a pre-made class for this specific interest yet. Work with a mentor to build your own personalized syllabus.";
  let courseUrl = recommendedCourse ? recommendedCourse.url : PREMIUM_CONTACT_URL;

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

  return `
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:2rem; width:100%; margin-top:1.5rem;">
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
            ${Array.isArray(pathData.learn) ? pathData.learn.map(l => `<li style="margin-bottom:5px;">${l}</li>`).join("") : ""}
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
}

// ==========================================
// 8. INIT
// ==========================================
function animate() {
  requestAnimationFrame(animate);
  TWEEN.update();
  updatePhysics();
  renderer.render(scene, camera);
}
animate();

const cr = new THREE.Raycaster(),
  cm = new THREE.Vector2();
document.addEventListener("pointerup", e => {
  if (isDragging) return;
  cm.x = (e.clientX / window.innerWidth) * 2 - 1;
  cm.y = -(e.clientY / window.innerHeight) * 2 + 1;
  cr.setFromCamera(cm, camera);
  const h = cr.intersectObjects(interactables);
  if (h.length > 0 && h[0].object.userData.type === "art") focusArt(h[0].object.userData);
});

fetch("artworks.json")
  .then(r => r.json())
  .then(d => {
    if (d.floors) Object.values(d.floors).forEach(f => f.items.forEach(i => ART_DATA.push(i)));
    else ART_DATA = d;
    buildGallery();
  })
  .catch(() => buildGallery());

// Use internal catalog definition for reliability
// fetch('catalog.json').then(r=>r.json()).then(d=>CATALOG=d);

window.showRegistration = showRegistration;
window.toggleKeyword = toggleInterest;
window.completeRegistration = completeRegistration;
window.toggleRole = toggleRole;
window.toggleAge = toggleAge;
window.toggleGoal = toggleGoal;
window.toggleInterest = toggleInterest;
window.skipRegistration = skipRegistration;

document.getElementById("send-btn").onclick = sendChat;
document.getElementById("user-input").onkeypress = e => {
  if (e.key === "Enter") sendChat();
};

window.startBlueprint = startBlueprint;

// ✅ FIX: real function + exported to window (so buttons + inline onclick both work)
function closeBlueprint() {
  const bp = document.getElementById("blueprint");
  if (bp) bp.classList.remove("active");
}
window.closeBlueprint = closeBlueprint;

window.exitFocus = exitFocus;
window.goToFloor = window.goToFloor;
window.moveStop = () => {
  moveForward = false;
  moveBackward = false;
  moveLeft = false;
  moveRight = false;
};

window.addEventListener("load", () => {
  if (loadProgress()) {
    console.log("Welcome back, " + userID);
  }
});

window.addEventListener("DOMContentLoaded", () => {
  // ensure the close button works
  const closeBtn =
    document.getElementById("bp-close") ||
    document.getElementById("blueprint-close") ||
    document.getElementById("close-blueprint") ||
    document.querySelector(".bp-close") ||
    document.querySelector('[data-action="close-blueprint"]');

  if (closeBtn) {
    closeBtn.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      if (window.closeBlueprint) window.closeBlueprint();
    });
  }

  // ensure AI mode buttons reflect saved preference
  updateAIModeUI();
});
/* ===========================
   LFC PATCH (P0) - minimal additive patch
   A: 3D artwork size/aspect scaling + baseline align
   B: Detail image zoom/pan + reset
   C: Creator Lab email required + inject into Formspree FormData (no change to your submit logic)
   D: Onboarding tip + where-am-I + teleport feedback + Home + hover preview
   =========================== */
(function(){
  'use strict';

  var PATCH_VER = 'lfc-p0-patch-v1';
  window.__LFC_PATCH_VERSION = PATCH_VER;
  try { console.log('[LFC PATCH]', PATCH_VER, 'loaded'); } catch(e){}

  function $(sel, root){ return (root||document).querySelector(sel); }
  function $all(sel, root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); }
  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
  function once(fn){ var done=false; return function(){ if(done) return; done=true; return fn.apply(this, arguments);} }
  function safeText(el, txt){ if(el) el.textContent = txt; }
  function isNumber(n){ return typeof n === 'number' && isFinite(n); }
  function toNum(v){ var n = parseFloat(v); return isFinite(n) ? n : null; }

  /* ---------------------------------
     [C] Creator Lab contact (Email required)
     - adds validation without changing your existing button/submit wiring
     - injects email into any Formspree FormData request
  --------------------------------- */
  var EMAIL_KEY = 'Email';
  var OTHER_KEY = 'Preferred Contact';

  function getEmail(){
    var el = $('#contact-email-input');
    return el ? (el.value||'').trim() : '';
  }
  function getOther(){
    var el = $('#contact-other-input');
    return el ? (el.value||'').trim() : '';
  }
  function isValidEmail(email){
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function ensureLabErrorBox(){
    var emailEl = $('#contact-email-input');
    if(!emailEl) return null;

    var existing = $('#lab-email-error');
    if(existing) return existing;

    var box = document.createElement('div');
    box.id = 'lab-email-error';
    box.style.marginTop = '-6px';
    box.style.marginBottom = '10px';
    box.style.padding = '10px 12px';
    box.style.borderRadius = '8px';
    box.style.fontSize = '11px';
    box.style.fontWeight = '700';
    box.style.color = '#334155';
    box.style.background = '#f1f5f9';
    box.style.borderLeft = '3px solid #1e3a8a';
    box.style.display = 'none';
    emailEl.insertAdjacentElement('afterend', box);
    return box;
  }

  function showLabEmailError(msg){
    var box = ensureLabErrorBox();
    if(!box) return;
    box.textContent = msg;
    box.style.display = 'block';
  }
  function clearLabEmailError(){
    var box = $('#lab-email-error');
    if(box) box.style.display = 'none';
  }

  (function bindLabValidation(){
    var btn = $('#btn-submit');
    if(!btn) return;

    btn.addEventListener('click', function(ev){
      var emailInput = $('#contact-email-input');
      if(!emailInput) return; // means index.html hasn't added the field yet

      clearLabEmailError();

      var email = getEmail();
      if(!email){
        ev.preventDefault(); ev.stopPropagation();
        if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        showLabEmailError('Please enter your email (required) so we can contact you.');
        try { emailInput.focus(); } catch(e){}
        return;
      }
      if(!isValidEmail(email)){
        ev.preventDefault(); ev.stopPropagation();
        if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        showLabEmailError('Email Invalid email format. Example: name@example.com');
        try { emailInput.focus(); } catch(e){}
        return;
      }

      window.__LFC_LAST_CONTACT = { email: email, other: getOther() || '' };
    }, true);

    var emailEl = $('#contact-email-input');
    if(emailEl){
      emailEl.addEventListener('input', function(){ clearLabEmailError(); }, { passive:true });
    }
  })();

  (function patchFetchForFormspree(){
    if(!window.fetch || window.__LFC_FETCH_PATCHED) return;

    var origFetch = window.fetch.bind(window);
    window.fetch = function(input, init){
      try{
        var url = (typeof input === 'string') ? input : (input && input.url);
        if(url && url.indexOf('formspree.io') !== -1 && init && init.body && (typeof FormData !== 'undefined') && (init.body instanceof FormData)){
          var c = window.__LFC_LAST_CONTACT || null;
          if(c && c.email){
            if(!init.body.has(EMAIL_KEY)) init.body.append(EMAIL_KEY, c.email);
            if(c.other && !init.body.has(OTHER_KEY)) init.body.append(OTHER_KEY, c.other);
          }
        }
      }catch(e){}
      return origFetch(input, init).then(function(res){
        try{
          var url2 = (typeof input === 'string') ? input : (input && input.url);
          if(url2 && url2.indexOf('formspree.io') !== -1){
            var c2 = window.__LFC_LAST_CONTACT || null;
            if(res && res.ok && c2 && c2.email){
              var tip = $('#lab-submit-hint');
              if(!tip){
                var footer = $('.lab-footer');
                if(footer){
                  tip = document.createElement('div');
                  tip.id = 'lab-submit-hint';
                  tip.style.marginTop = '10px';
                  tip.style.fontSize = '11px';
                  tip.style.fontWeight = '700';
                  tip.style.color = '#64748b';
                  tip.style.textTransform = 'uppercase';
                  tip.style.letterSpacing = '1px';
                  footer.insertAdjacentElement('afterend', tip);
                }
              }
              if(tip){
                tip.textContent = 'We will contact you at: ' + c2.email;
              }
            }
          }
        }catch(e){}
        return res;
      });
    };

    window.__LFC_FETCH_PATCHED = true;
  })();

  /* ---------------------------------
     [B] Zoom & pan for #ai-img
     - wheel zoom + drag pan + pinch zoom + Reset
     - no layout changes, injects a small Reset button using existing reg-btn
  --------------------------------- */
  (function enableImageZoom(){
    var img = $('#ai-img');
    if(!img) return;

    var header = img.parentElement;
    if(header && !$('#ai-zoom-reset')){
      var btn = document.createElement('button');
      btn.id = 'ai-zoom-reset';
      btn.className = 'reg-btn';
      btn.type = 'button';
      btn.textContent = 'Reset View';
      btn.style.padding = '8px 12px';
      btn.style.fontSize = '9px';
      btn.style.marginTop = '10px';
      btn.style.opacity = '0.9';
      header.appendChild(btn);
    }

    var state = { scale:1, tx:0, ty:0, dragging:false, px:0, py:0, pointers:{}, lastDist:0 };

    function apply(){
      img.style.transform = 'translate(' + state.tx + 'px,' + state.ty + 'px) scale(' + state.scale + ')';
    }
    function reset(){
      state.scale = 1; state.tx = 0; state.ty = 0;
      state.dragging=false; state.pointers={}; state.lastDist=0;
      apply();
      img.style.cursor = 'grab';
    }

    img.style.transformOrigin = '50% 50%';
    img.style.userSelect = 'none';
    img.style.touchAction = 'none';
    img.style.cursor = 'grab';
    apply();

    var resetBtn = $('#ai-zoom-reset');
    if(resetBtn){
      resetBtn.addEventListener('click', function(){ reset(); }, { passive:true });
    }

    img.addEventListener('wheel', function(e){
      e.preventDefault();
      var delta = (e.deltaY || 0);
      var factor = delta > 0 ? 0.92 : 1.08;
      state.scale = clamp(state.scale * factor, 1, 4);
      apply();
    }, { passive:false });

    function pointerCount(){
      return Object.keys(state.pointers).length;
    }
    function getTwoPointers(){
      var keys = Object.keys(state.pointers);
      if(keys.length < 2) return null;
      return [state.pointers[keys[0]], state.pointers[keys[1]]];
    }

    img.addEventListener('pointerdown', function(e){
      try { img.setPointerCapture(e.pointerId); } catch(err){}
      state.pointers[e.pointerId] = { x:e.clientX, y:e.clientY };

      if(pointerCount() === 1){
        state.dragging = true;
        state.px = e.clientX; state.py = e.clientY;
        img.style.cursor = 'grabbing';
      }
    });

    img.addEventListener('pointermove', function(e){
      if(!state.pointers[e.pointerId]) return;

      var prev = state.pointers[e.pointerId];
      state.pointers[e.pointerId] = { x:e.clientX, y:e.clientY };

      if(pointerCount() === 1 && state.dragging && state.scale > 1){
        var dx = e.clientX - state.px;
        var dy = e.clientY - state.py;
        state.px = e.clientX; state.py = e.clientY;
        state.tx += dx;
        state.ty += dy;
        apply();
        return;
      }

      if(pointerCount() === 2){
        var pts = getTwoPointers();
        if(!pts) return;
        var dx2 = pts[0].x - pts[1].x;
        var dy2 = pts[0].y - pts[1].y;
        var dist = Math.sqrt(dx2*dx2 + dy2*dy2);

        if(state.lastDist){
          var ratio = dist / state.lastDist;
          state.scale = clamp(state.scale * ratio, 1, 4);
          apply();
        }
        state.lastDist = dist;
      }
    });

    function endPointer(e){
      delete state.pointers[e.pointerId];
      if(pointerCount() < 2) state.lastDist = 0;
      if(pointerCount() === 0){
        state.dragging = false;
        img.style.cursor = 'grab';
      }
    }
    img.addEventListener('pointerup', endPointer);
    img.addEventListener('pointercancel', endPointer);

    img.addEventListener('dblclick', function(){ reset(); }, { passive:true });

    var lastSrc = img.src;
    setInterval(function(){
      if(img.src !== lastSrc){
        lastSrc = img.src;
        reset();
      }
    }, 300);
  })();

  /* ---------------------------------
     [D] Onboarding + where-am-I + teleport feedback + Home + hover preview
  --------------------------------- */
  (function onboardingTip(){
    var tip = $('#onboarding-tip');
    if(!tip) return;

    var KEY = 'lfc_onboard_v1_done';
    if(localStorage.getItem(KEY) === '1') return;

    tip.style.pointerEvents = 'auto';
    tip.style.cursor = 'pointer';
    tip.textContent = 'Drag to rotate · WASD/Arrow keys to move · Use the elevator to teleport · Click artwork to chat · Return to Walk to exit';

    var hide = once(function(){
      tip.classList.remove('visible');
      localStorage.setItem(KEY, '1');
    });
    tip.addEventListener('click', hide);

    var tries = 0;
    var t = setInterval(function(){
      tries++;
      if(document.body && document.body.classList.contains('doors-open')){
        tip.classList.add('visible');
        setTimeout(hide, 6000);
        clearInterval(t);
      }
      if(tries > 60) clearInterval(t);
    }, 200);
  })();

  (function whereAmI(){
    var hud = $('#hud');
    if(!hud) return;
    if($('#whereami')) return;

    var tag = document.createElement('div');
    tag.id = 'whereami';
    tag.className = 'discovery-text';
    tag.style.marginTop = '6px';
    tag.style.opacity = '0.9';
    tag.textContent = 'MODE: WALK';
    hud.appendChild(tag);

    function update(){
      var mode = 'WALK';
      if($('#blueprint') && $('#blueprint').classList.contains('active')) mode = 'JOURNEY';
      else if($('#ai-panel') && $('#ai-panel').classList.contains('active')) mode = 'ARTWORK';

      var loc = '';
      var active = $('#elevator .floor-item.active .floor-label');
      if(active && active.textContent) loc = active.textContent.trim();

      tag.textContent = 'MODE: ' + mode + (loc ? ' • ' + loc : '');
    }
    setInterval(update, 400);
    update();
  })();

  (function teleportFeedback(){
    var elevator = $('#elevator');
    var tip = $('#onboarding-tip');
    if(!elevator || !tip) return;

    elevator.addEventListener('click', function(e){
      var item = e.target && e.target.closest ? e.target.closest('.floor-item') : null;
      if(!item) return;

      tip.textContent = 'Teleporting…';
      tip.classList.add('visible');

      clearTimeout(window.__LFC_TP_TIMER);
      window.__LFC_TP_TIMER = setTimeout(function(){
        if(localStorage.getItem('lfc_onboard_v1_done') !== '1'){
          tip.textContent = 'Drag to rotate · WASD/Arrow keys to move · Use the elevator to teleport · Click artwork to chat · Return to Walk to exit';
        } else {
          tip.classList.remove('visible');
        }
      }, 900);
    }, true);
  })();

  (function elevatorHoverPreview(){
    var elevator = $('#elevator');
    if(!elevator) return;

    if($('#elevator-preview-card')) return;

    var card = document.createElement('div');
    card.id = 'elevator-preview-card';
    card.style.position = 'fixed';
    card.style.zIndex = '9999';
    card.style.display = 'none';
    card.style.pointerEvents = 'none';
    card.style.background = 'rgba(255,255,255,0.95)';
    card.style.backdropFilter = 'blur(14px)';
    card.style.border = '1px solid #e2e8f0';
    card.style.borderRadius = '10px';
    card.style.padding = '10px 12px';
    card.style.boxShadow = '0 12px 35px rgba(0,0,0,0.10)';
    card.style.fontFamily = 'Montserrat, sans-serif';
    card.innerHTML =
      '<div style="font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:1px; color:#1e3a8a" id="ep-title"></div>' +
      '<div style="margin-top:6px; font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:1px" id="ep-meta"></div>';
    document.body.appendChild(card);

    function getSectionInfo(label){
      var info = { count: null };
      try{
        var list = window.ARTWORKS || window.artworks || null;
        if(Array.isArray(list)){
          var hits = list.filter(function(a){
            var sec = (a.section || a.floor || a.zone || '').toString().toLowerCase();
            return sec && label && sec.indexOf(label.toLowerCase()) !== -1;
          });
          if(hits.length) info.count = hits.length;
        }
      }catch(e){}
      return info;
    }

    elevator.addEventListener('mousemove', function(e){
      var item = e.target && e.target.closest ? e.target.closest('.floor-item') : null;
      if(!item) return;

      var labelEl = item.querySelector('.floor-label');
      var label = labelEl ? labelEl.textContent.trim() : 'Section';
      var info = getSectionInfo(label);

      safeText($('#ep-title'), label);
      safeText($('#ep-meta'), (info.count != null ? (info.count + ' works') : 'Click to teleport'));

      card.style.left = (e.clientX - 220) + 'px';
      card.style.top = (e.clientY - 20) + 'px';
      card.style.display = 'block';
    });

    elevator.addEventListener('mouseleave', function(){
      card.style.display = 'none';
    });
  })();

  (function addHomeButton(){
    var tries = 0;
    var inserted = false;
    var homeState = { camPos:null, target:null };

    function captureHome(){
      if(window.camera && window.camera.position && !homeState.camPos && window.camera.position.clone){
        homeState.camPos = window.camera.position.clone();
      }
      if(window.controls && window.controls.target && !homeState.target && window.controls.target.clone){
        homeState.target = window.controls.target.clone();
      }
    }

    function goHome(){
      captureHome();
      if(!homeState.camPos || !window.camera) return;

      try{
        if(window.TWEEN && window.TWEEN.Tween){
          new window.TWEEN.Tween(window.camera.position)
            .to({ x: homeState.camPos.x, y: homeState.camPos.y, z: homeState.camPos.z }, 900)
            .easing(window.TWEEN.Easing.Quadratic.Out)
            .start();

          if(window.controls && homeState.target){
            new window.TWEEN.Tween(window.controls.target)
              .to({ x: homeState.target.x, y: homeState.target.y, z: homeState.target.z }, 900)
              .easing(window.TWEEN.Easing.Quadratic.Out)
              .start();
          }
        } else {
          window.camera.position.copy(homeState.camPos);
          if(window.controls && homeState.target) window.controls.target.copy(homeState.target);
        }
      }catch(e){}

      try{ if(typeof window.exitFocus === 'function') window.exitFocus(); }catch(e){}
    }

    var timer = setInterval(function(){
      tries++;
      captureHome();

      var elevator = $('#elevator');
      if(!elevator){ if(tries>120) clearInterval(timer); return; }

      var items = elevator.querySelectorAll('.floor-item');
      if(items && items.length && !inserted){
        var home = document.createElement('div');
        home.className = 'floor-item';
        home.innerHTML = '<div class="floor-label">Home</div><div class="floor-num">⟲</div>';
        home.addEventListener('click', function(e){ e.preventDefault(); goHome(); }, true);
        elevator.insertBefore(home, elevator.firstChild);
        inserted = true;
      }

      if(tries > 200) clearInterval(timer);
    }, 250);
  })();

  /* ---------------------------------
     [A] 3D artwork size/aspect scaling + baseline align
     IMPORTANT: needs window.scene available.
     If your app.js does not expose it, add ONE line after scene creation:
       window.scene = scene; window.camera = camera; window.controls = controls;
  --------------------------------- */
  (function patchArtworkScaling(){
    var tries = 0;
    var done = false;

    function isArtworkMesh(obj){
      if(!obj || !obj.isMesh) return false;

      var hasMap = false;
      if(obj.material){
        if(obj.material.map) hasMap = true;
        else if(Array.isArray(obj.material)){
          for(var i=0;i<obj.material.length;i++){
            if(obj.material[i] && obj.material[i].map){ hasMap = true; break; }
          }
        }
      }
      if(!hasMap) return false;

      var geo = obj.geometry;
      var isPlane = !!(geo && (geo.type === 'PlaneGeometry' || geo.type === 'PlaneBufferGeometry'));
      if(!isPlane) return false;

      var ud = obj.userData || {};
      var hasMeta = !!(ud.artwork || ud.isArtwork || ud.data || ud.title || ud.artist || ud.id || ud.meta);
      return hasMeta;
    }

    function extractDims(obj){
      var ud = obj.userData || {};
      var data = ud.data || ud.art || ud.artwork || ud;

      var w = toNum(data.width) || toNum(data.w) || toNum(data.pixelWidth) || toNum(data.imageWidth);
      var h = toNum(data.height) || toNum(data.h) || toNum(data.pixelHeight) || toNum(data.imageHeight);

      var aspect = null;

      var tex = null;
      if(obj.material){
        if(obj.material.map) tex = obj.material.map;
        else if(Array.isArray(obj.material)){
          for(var i=0;i<obj.material.length;i++){
            if(obj.material[i] && obj.material[i].map){ tex = obj.material[i].map; break; }
          }
        }
      }

      if(w && h) aspect = w / h;
      if(!aspect && data && (toNum(data.aspect) || toNum(data.ratio))) aspect = toNum(data.aspect) || toNum(data.ratio);
      if(!aspect && tex && tex.image && tex.image.width && tex.image.height) aspect = tex.image.width / tex.image.height;
      if(!aspect) aspect = 1;

      return { w:w, h:h, aspect:aspect };
    }

    function getWorldHeight(obj){
      try{
        var geo = obj.geometry;
        var h = null;
        if(geo && geo.parameters && isNumber(geo.parameters.height)) h = geo.parameters.height;
        if(h == null && geo && geo.computeBoundingBox){
          geo.computeBoundingBox();
          if(geo.boundingBox) h = geo.boundingBox.max.y - geo.boundingBox.min.y;
        }
        if(h == null) h = 1;
        return h * (obj.scale ? obj.scale.y : 1);
      }catch(e){ return 1; }
    }

    function applyScaling(scene){
      var meshes = [];
      scene.traverse(function(o){ if(isArtworkMesh(o)) meshes.push(o); });
      if(!meshes.length) return false;

      var bottoms = meshes.map(function(m){
        var h = getWorldHeight(m);
        return (m.position ? m.position.y : 0) - (h/2);
      }).sort(function(a,b){ return a-b; });

      var baseline = bottoms[Math.floor(bottoms.length/2)] || 0;

      var physHeights = meshes.map(function(m){
        var d = extractDims(m);
        return d.h;
      }).filter(function(v){ return v != null; }).sort(function(a,b){ return a-b; });

      var medianH = physHeights.length ? physHeights[Math.floor(physHeights.length/2)] : null;

      var avgH = meshes.map(getWorldHeight).reduce(function(a,b){ return a+b; },0) / meshes.length;
      var TARGET_H = clamp(avgH, 0.9, 1.8);
      var MAX_W = TARGET_H * 2.2;

      meshes.forEach(function(m){
        var d = extractDims(m);
        var aspect = d.aspect || 1;

        var sizeFactor = 1.0;
        if(medianH && d.h){
          sizeFactor = clamp(d.h / medianH, 0.75, 1.25);
        } else {
          if(aspect > 1.6) sizeFactor = 0.88;
          else if(aspect < 0.75) sizeFactor = 1.12;
          else sizeFactor = 1.0;
        }

        var hWorld = TARGET_H * sizeFactor;
        var wWorld = hWorld * aspect;

        if(wWorld > MAX_W){
          var s = MAX_W / wWorld;
          wWorld *= s; hWorld *= s;
        }

        var geoH = 1, geoW = 1;
        try{
          if(m.geometry && m.geometry.parameters){
            if(isNumber(m.geometry.parameters.height)) geoH = m.geometry.parameters.height;
            if(isNumber(m.geometry.parameters.width)) geoW = m.geometry.parameters.width;
          }
        }catch(e){}

        var sx = wWorld / geoW;
        var sy = hWorld / geoH;

        if(m.scale && m.scale.set){
          m.scale.set(sx, sy, 1);
        } else if(m.scale){
          m.scale.x = sx; m.scale.y = sy; m.scale.z = 1;
        }

        if(m.position){
          m.position.y = baseline + (hWorld / 2);
        }

        if(m.children && m.children.length){
          m.children.forEach(function(ch){
            if(ch && ch.scale) ch.scale.z = 1;
          });
        }
      });

      return true;
    }

    var timer = setInterval(function(){
      tries++;

      if(done){ clearInterval(timer); return; }
      if(!window.scene){ if(tries>160) clearInterval(timer); return; }

      try{
        var ok = applyScaling(window.scene);
        if(ok) done = true;
      }catch(e){}

      if(tries > 200) clearInterval(timer);
    }, 250);
  })();

  /* ---------------------------------
     Extra compatibility patch:
     - Some environments don't fire click reliably on canvas.
     - Forward pointerdown => mousedown/click.
  --------------------------------- */
  (function pointerCompat(){
    var cc = $('#canvas-container');
    if(!cc) return;

    var canvas = cc.querySelector('canvas');
    if(!canvas) return;

    canvas.addEventListener('pointerdown', function(e){
      try{
        canvas.dispatchEvent(new MouseEvent('mousedown', { bubbles:true, cancelable:true, clientX:e.clientX, clientY:e.clientY }));
        canvas.dispatchEvent(new MouseEvent('click', { bubbles:true, cancelable:true, clientX:e.clientX, clientY:e.clientY }));
      }catch(err){}
    }, { passive:true });
  })();

  /* ---------------------------------
     Safety: if toggleGoal is missing (your iPad "第三项点不了"常见原因)
     define a fallback WITHOUT touching your existing code.
  --------------------------------- */
  (function regFallback(){
    if(typeof window.toggleGoal === 'function') return;

    window.toggleGoal = function(btn){
      try{
        var group = document.getElementById('opt-goal');
        if(!group || !btn) return;

        var selected = group.querySelectorAll('.reg-btn.selected');
        var isSelected = btn.classList.contains('selected');

        if(isSelected){
          btn.classList.remove('selected');
        } else {
          if(selected.length >= 2) return; // Max 2 goals
          btn.classList.add('selected');
        }
      }catch(e){}
    };
  })();

})();
/* ===========================
   LFC Thinking Quest - Chapter 1 (Level 1)
   Minimal overlay + local storage Judgment Card
   - does NOT touch Gemini/OpenAI logic
   - does NOT change layout, only uses existing DOM
   =========================== */
(function(){
  'use strict';

  // --- tiny helpers
  function $(s, r){ return (r||document).querySelector(s); }
  function $all(s, r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); }
  function now(){ return Date.now(); }

  // --- Visitor ID (anonymous, local)
  (function initVisitor(){
    var KEY='lfc_visitor_id';
    var id = localStorage.getItem(KEY);
    if(!id){
      id = 'v_' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(KEY, id);
      localStorage.setItem('lfc_first_seen', String(now()));
    }
    localStorage.setItem('lfc_last_seen', String(now()));
    window.LFC_VISITOR = { id:id };
  })();

  var KEY_CARDS = 'lfc_cards_v1';

  function readCards(){
    try{ return JSON.parse(localStorage.getItem(KEY_CARDS) || '[]'); }catch(e){ return []; }
  }
  function writeCards(cards){
    try{ localStorage.setItem(KEY_CARDS, JSON.stringify(cards)); }catch(e){}
  }

  // --- Try get current artwork info from existing UI (no dependency on your internals)
  function getCurrentArtworkInfo(){
    var title = ($('#ai-title') && $('#ai-title').textContent) ? $('#ai-title').textContent.trim() : 'Untitled';
    var meta  = ($('#ai-meta') && $('#ai-meta').textContent) ? $('#ai-meta').textContent.trim() : '';
    // If you already have a current artwork object somewhere, we will use it if present:
    var aw = window.currentArtwork || window.__CURRENT_ARTWORK || window.__LFC_CURRENT_ARTWORK || null;
    var id = (aw && (aw.id || aw.slug || aw.key)) ? String(aw.id || aw.slug || aw.key) : ('ui_' + title.toLowerCase().replace(/\s+/g,'_').slice(0,32));
    return { id:id, title:title, meta:meta };
  }

  // --- Question bank (Level 1 only, grouped)
  var BANK = {
    teen: {
      q: "Stay for 10 seconds. What do you notice first?",
      choices: ["Color", "Shape", "Character/Scene", "Texture", "Feeling"]
    },
    early_adult: {
      q: "What is the strongest visual signal here (before you explain it)?",
      choices: ["Light/Shadow", "Composition", "Material", "Gesture/Movement", "Mood"]
    },
    adult: {
      q: "What is the primary formal decision that controls your attention?",
      choices: ["Scale", "Space", "Color System", "Material Language", "Rhythm/Pattern"]
    },
    pro: {
      q: "Identify one deliberate constraint in the work (what the artist limits on purpose).",
      choices: ["Palette Constraint", "Material Constraint", "Process Constraint", "Spatial Constraint", "Narrative Constraint"]
    }
  };

  // --- Overlay elements
  var overlay = $('#tq-overlay');
  var btnOpen = $('#btn-thinking-quest');
  if(!overlay || !btnOpen) return;

  var closeX = $('#tq-close');
  var backdrop = $('#tq-backdrop');
  var artLine = $('#tq-art');
  var qEl = $('#tq-q');
  var choicesWrap = $('#tq-choices');
  var textEl = $('#tq-text');
  var saveBtn = $('#tq-save');
  var toast = $('#tq-toast');
  var groupHint = $('#tq-group-hint');

  var state = { group:null, choice:null };

  function setVisible(v){
    overlay.style.display = v ? 'block' : 'none';
    overlay.setAttribute('aria-hidden', v ? 'false' : 'true');
    if(!v){
      // reset light
      state.group=null; state.choice=null;
      textEl.value='';
      toast.style.display='none';
      groupHint.textContent='Pick one';
      $all('[data-tq-group]').forEach(function(b){ b.classList.remove('selected'); });
      choicesWrap.innerHTML='';
      qEl.textContent='Question will appear here.';
    }
  }

  function renderForGroup(g){
    state.group = g;
    state.choice = null;

    var pack = BANK[g] || BANK.adult;
    qEl.textContent = pack.q;

    choicesWrap.innerHTML = '';
    pack.choices.forEach(function(c){
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'reg-btn';
      b.style.padding = '10px 12px';
      b.style.fontSize = '10px';
      b.textContent = c;
      b.addEventListener('click', function(){
        state.choice = c;
        $all('#tq-choices .reg-btn').forEach(function(x){ x.classList.remove('selected'); });
        b.classList.add('selected');
      });
      choicesWrap.appendChild(b);
    });

    groupHint.textContent = 'Group: ' + g.replace('_',' ').toUpperCase();
  }

  // group buttons
  $all('[data-tq-group]').forEach(function(b){
    b.addEventListener('click', function(){
      $all('[data-tq-group]').forEach(function(x){ x.classList.remove('selected'); });
      b.classList.add('selected');
      renderForGroup(b.getAttribute('data-tq-group'));
    });
  });

  function openQuest(){
    var aw = getCurrentArtworkInfo();
    artLine.textContent = 'Artwork: ' + aw.title + (aw.meta ? (' · ' + aw.meta) : '');
    setVisible(true);
  }

  async function saveCard(){
    if(!state.group){
      toast.style.display='block';
      toast.textContent='Pick a group first.';
      return;
    }
    if(!state.choice && !(textEl.value||'').trim()){
      toast.style.display='block';
      toast.textContent='Choose one option or write one sentence.';
      return;
    }

    var aw = getCurrentArtworkInfo();
    var cards = readCards();

    var card = {
      id: 'card_' + now(),
      visitorId: (window.LFC_VISITOR && window.LFC_VISITOR.id) ? window.LFC_VISITOR.id : 'unknown',
      artworkId: aw.id,
      artworkTitle: aw.title,
      cardType: 'sight', // Chapter 1 Level 1
      level: 1,
      group: state.group,
      responses: {
        choice: state.choice || '',
        text: (textEl.value||'').trim()
      },
      createdAt: now()
    };

    cards.push(card);
    writeCards(cards);
try {
  const { error } = await supabaseClient
    .from("judgment_cards")
    .insert([{
      user_id: card.visitorId,
      artwork_id: card.artworkId,
      level: card.level,
      first_choice: card.responses.choice,
      second_choice: null,
      sentence: card.responses.text,
      created_at: new Date().toISOString()
    }]);

  if (error) {
    console.error("Supabase insert error:", error);
  } else {
    console.log("Saved to Supabase");
  }
} catch (err) {
  console.error("Connection error:", err);
}
    toast.style.display='block';
    toast.textContent = 'Saved. +' + 1 + ' card';

    // subtle hook: briefly show then close
    setTimeout(function(){ setVisible(false); }, 900);
  }

  // open / close wiring
  btnOpen.addEventListener('click', function(e){ e.preventDefault(); openQuest(); });
  if(closeX) closeX.addEventListener('click', function(){ setVisible(false); });
  if(backdrop) backdrop.addEventListener('click', function(){ setVisible(false); });
  if(saveBtn) saveBtn.addEventListener('click', function(){ saveCard(); });

})();
/* ===========================
   LFC My Journey Patch (Judgment Cards)
   - Renders saved cards into Blueprint (My Journey)
   - Adds Milestone naming + next target hook
   - Does NOT change layout or AI logic
   =========================== */
(function(){
  'use strict';

  function $(s, r){ return (r||document).querySelector(s); }
  function esc(s){ return String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  var KEY_CARDS = 'lfc_cards_v1';

  function readCards(){
    try{ return JSON.parse(localStorage.getItem(KEY_CARDS) || '[]'); }catch(e){ return []; }
  }

  // --- Milestone system (simple now, expandable later)
  // You can edit names/thresholds later without breaking storage.
  var MILESTONES = [
    { n: 1,  title: 'Curiosity Spark',        need: 0 },
    { n: 2,  title: 'Observation Starter',    need: 3 },
    { n: 3,  title: 'Pattern Finder',         need: 7 },
    { n: 4,  title: 'Meaning Seeker',         need: 12 },
    { n: 5,  title: 'Context Builder',        need: 20 },
    { n: 6,  title: 'Critical Apprentice',    need: 30 },
    { n: 7,  title: 'Independent Critic',     need: 45 },
    { n: 8,  title: 'Senior Critic (Path)',   need: 65 }
  ];

  function getMilestone(total){
    var cur = MILESTONES[0];
    for(var i=0;i<MILESTONES.length;i++){
      if(total >= MILESTONES[i].need) cur = MILESTONES[i];
    }
    var next = null;
    for(var j=0;j<MILESTONES.length;j++){
      if(MILESTONES[j].need > cur.need){ next = MILESTONES[j]; break; }
    }
    return { current: cur, next: next };
  }

  function formatTime(ts){
    try{
      var d = new Date(ts);
      var y = d.getFullYear();
      var m = String(d.getMonth()+1).padStart(2,'0');
      var day = String(d.getDate()).padStart(2,'0');
      return y + '-' + m + '-' + day;
    }catch(e){ return ''; }
  }

  // --- Render into Blueprint
  function renderQuestSummary(){
    var host = $('#bp-quest');
    if(!host) return;

    var cards = readCards().slice().sort(function(a,b){ return (b.createdAt||0) - (a.createdAt||0); });
    var total = cards.length;

    var ms = getMilestone(total);
    var cur = ms.current;
    var next = ms.next;

    var toNext = next ? Math.max(0, next.need - total) : 0;

    // recent cards (max 3)
    var recent = cards.slice(0,3).map(function(c){
      var title = esc(c.artworkTitle || 'Untitled');
      var group = esc((c.group||'').replace('_',' '));
      var choice = esc((c.responses && c.responses.choice) ? c.responses.choice : '');
      var text = esc((c.responses && c.responses.text) ? c.responses.text : '');
      var line = choice || text || '—';
      return (
        '<div style="padding:12px 12px; border:1px solid #e2e8f0; border-radius:14px; background:#fff; margin-top:10px;">' +
          '<div style="font-size:10px; font-weight:900; letter-spacing:1px; text-transform:uppercase; color:#1e3a8a;">Judgment Card · ' + formatTime(c.createdAt) + '</div>' +
          '<div style="margin-top:6px; font-size:13px; font-weight:800; color:#0f172a;">' + title + '</div>' +
          '<div style="margin-top:6px; font-size:10px; font-weight:800; letter-spacing:1px; text-transform:uppercase; color:#64748b;">Group: ' + group + '</div>' +
          '<div style="margin-top:8px; font-size:13px; line-height:1.7; color:#334155; font-weight:600;">' + line + '</div>' +
        '</div>'
      );
    }).join('');

    var hint = next
      ? ('Next title: <span style="color:#0f172a;">' + esc(next.title) + '</span> · ' + toNext + ' card(s) to go')
      : ('You’ve reached the current top milestone. New tiers can be added anytime.');

    // “Hook”: a gentle next action, not exam-like
    var hook = (total === 0)
      ? 'Try 1 card today. One minute. No pressure.'
      : (total < 3)
        ? 'Small streaks work. Save one more card next time you visit.'
        : 'Next time: pick a different artwork form (photo / sculpture / installation) to widen your lens.';

    host.innerHTML =
      '<div style="margin-top:6px; padding:14px 14px; border-radius:18px; border:1px solid #e2e8f0; background:rgba(255,255,255,0.92); box-shadow:0 12px 35px rgba(0,0,0,0.05);">' +
        '<div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">' +
          '<div>' +
            '<div style="font-size:10px; font-weight:900; letter-spacing:2px; text-transform:uppercase; color:#1e3a8a;">LFC Thinking Quest</div>' +
            '<div style="margin-top:6px; font-size:14px; font-weight:900; color:#0f172a;">' + esc(cur.title) + '</div>' +
            '<div style="margin-top:6px; font-size:10px; font-weight:800; letter-spacing:1px; text-transform:uppercase; color:#64748b;">Cards saved: ' + total + '</div>' +
          '</div>' +
          '<div style="min-width:240px; flex:1;">' +
            '<div style="font-size:10px; font-weight:900; letter-spacing:1px; text-transform:uppercase; color:#64748b;">Progress</div>' +
            '<div style="margin-top:8px; height:8px; border-radius:999px; background:rgba(15,23,42,0.10); overflow:hidden;">' +
              '<div style="height:100%; width:' + (next ? Math.min(100, Math.round((total / next.need) * 100)) : 100) + '%; background:#22c55e;"></div>' +
            '</div>' +
            '<div style="margin-top:8px; font-size:10px; font-weight:800; letter-spacing:1px; text-transform:uppercase; color:#64748b;">' + hint + '</div>' +
          '</div>' +
        '</div>' +

        '<div style="margin-top:12px; font-size:12px; font-weight:700; color:#334155; line-height:1.7; border-top:1px solid #e2e8f0; padding-top:12px;">' +
          '<span style="font-weight:900; color:#1e3a8a; letter-spacing:1px; text-transform:uppercase; font-size:10px;">Hook</span><br>' +
          esc(hook) +
        '</div>' +

        (recent
          ? ('<div style="margin-top:14px;">' +
              '<div style="font-size:10px; font-weight:900; letter-spacing:2px; text-transform:uppercase; color:#64748b;">Recent Cards</div>' +
              recent +
             '</div>')
          : '') +
      '</div>';
  }

  // --- Ensure it refreshes when Blueprint opens
  // We won’t rewrite your startBlueprint(), just wrap it if exists.
  (function(){
    if(typeof window.startBlueprint === 'function' && !window.__LFC_BP_WRAPPED){
      var orig = window.startBlueprint;
      window.startBlueprint = function(){
        var r = orig.apply(this, arguments);
        try{ renderQuestSummary(); }catch(e){}
        return r;
      };
      window.__LFC_BP_WRAPPED = true;
    }
  })();

  // Also refresh if user saved a card and then opens later
  // (safe periodic refresh, cheap)
  setInterval(function(){
    var bp = $('#blueprint');
    if(bp && bp.classList.contains('active')) renderQuestSummary();
  }, 800);

})();
/* ===========================
   LFC Thinking Quest (Chapter 1 / Level 1) - Minimal UI + Save Card
   - Adds a small "Thinking Quest" button in AI panel (artwork detail)
   - Opens a clean overlay modal (no layout break)
   - Saves a Judgment Card to localStorage: lfc_cards_v1
   - Works with your existing My Journey renderer (bp-quest)
   - Does NOT touch Gemini / AI logic
   =========================== */
(function(){
  'use strict';

  function $(s, r){ return (r||document).querySelector(s); }
  function esc(s){ return String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  var KEY_CARDS = 'lfc_cards_v1';
  var KEY_GROUP = 'lfc_user_group_v1';

  function readCards(){
    try{ return JSON.parse(localStorage.getItem(KEY_CARDS) || '[]'); }catch(e){ return []; }
  }
  function writeCards(list){
    try{ localStorage.setItem(KEY_CARDS, JSON.stringify(list||[])); }catch(e){}
  }

  function getArtworkSnapshot(){
    // robust: read from existing UI, no dependency on your internal variables
    var title = ($('#ai-title') && $('#ai-title').textContent) ? $('#ai-title').textContent.trim() : 'Untitled';
    var meta  = ($('#ai-meta') && $('#ai-meta').textContent) ? $('#ai-meta').textContent.trim() : '';
    var imgEl = $('#ai-img');
    var img   = imgEl && imgEl.src ? imgEl.src : '';
    return { title:title, meta:meta, img:img };
  }

  function toast(msg){
    // reuse your teleport toast if exists, otherwise create a tiny one
    var t = $('#teleport-toast');
    if(!t){
      t = document.createElement('div');
      t.id = 'teleport-toast';
      t.style.position = 'fixed';
      t.style.top = '18px';
      t.style.left = '50%';
      t.style.transform = 'translateX(-50%) translateY(-18px)';
      t.style.background = 'rgba(30, 58, 138, 0.92)';
      t.style.color = '#fff';
      t.style.padding = '10px 18px';
      t.style.borderRadius = '50px';
      t.style.fontSize = '11px';
      t.style.fontWeight = '800';
      t.style.letterSpacing = '1px';
      t.style.textTransform = 'uppercase';
      t.style.opacity = '0';
      t.style.pointerEvents = 'none';
      t.style.zIndex = '9100';
      t.style.boxShadow = '0 10px 30px rgba(30,58,138,0.35)';
      t.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('visible');
    clearTimeout(window.__LFC_TOAST_TIMER);
    window.__LFC_TOAST_TIMER = setTimeout(function(){
      t.classList.remove('visible');
    }, 1400);
  }

  function ensureQuestButton(){
    var panel = $('#ai-panel');
    var header = panel ? panel.querySelector('.ai-header') : null;
    if(!header) return;

    if($('#btn-thinking-quest')) return;

    // place near existing mode buttons (Docent/Curator). Minimal footprint.
    var modeDocent = $('#mode-docent');
    var mount = modeDocent ? modeDocent.parentElement : header;

    var btn = document.createElement('button');
    btn.id = 'btn-thinking-quest';
    btn.className = 'reg-btn';
    btn.type = 'button';
    btn.textContent = 'Thinking Quest';
    btn.style.padding = '8px 12px';
    btn.style.fontSize = '9px';
    btn.style.whiteSpace = 'nowrap';

    // keep it visually consistent, not screaming for attention
    btn.style.borderColor = 'rgba(30,58,138,0.35)';
    btn.style.color = '#1e3a8a';

    // add to the same row, without changing layout rules
    if(mount && mount.appendChild){
      mount.appendChild(btn);
    }else{
      header.appendChild(btn);
    }

    btn.addEventListener('click', function(e){
      e.preventDefault();
      openQuest();
    }, true);
  }

  function ensureModal(){
    if($('#lfc-quest-overlay')) return;

    var overlay = document.createElement('div');
    overlay.id = 'lfc-quest-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(15, 23, 42, 0.35)';
    overlay.style.backdropFilter = 'blur(10px)';
    overlay.style.zIndex = '9200';
    overlay.style.display = 'none';
    overlay.style.pointerEvents = 'none';

    var card = document.createElement('div');
    card.id = 'lfc-quest-card';
    card.style.position = 'absolute';
    card.style.top = '50%';
    card.style.left = '50%';
    card.style.transform = 'translate(-50%, -50%)';
    card.style.width = '92%';
    card.style.maxWidth = '720px';
    card.style.background = 'rgba(255,255,255,0.94)';
    card.style.border = '1px solid rgba(226,232,240,1)';
    card.style.borderRadius = '20px';
    card.style.boxShadow = '0 30px 60px rgba(0,0,0,0.18)';
    card.style.padding = '18px';
    card.style.fontFamily = 'Montserrat, sans-serif';
    card.style.color = '#0f172a';

    card.innerHTML = `
      <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:10px;">
        <div>
          <div style="font-size:10px; font-weight:900; letter-spacing:2px; text-transform:uppercase; color:#1e3a8a;">
            LFC THINKING QUEST
          </div>
          <div style="margin-top:6px; font-size:14px; font-weight:900;">
            Chapter 1 · Level 1 (Observation)
          </div>
          <div style="margin-top:6px; font-size:11px; font-weight:700; color:#64748b; line-height:1.6;" id="lfc-quest-artline"></div>
        </div>
        <div id="lfc-quest-close" style="font-size:22px; font-weight:900; color:#1e3a8a; cursor:pointer; padding:6px 10px;">×</div>
      </div>

      <div style="margin-top:14px; border-top:1px solid #e2e8f0; padding-top:14px;">
        <div style="font-size:10px; font-weight:900; letter-spacing:2px; text-transform:uppercase; color:#64748b;">Choose your path</div>
        <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;" id="lfc-group-row"></div>
      </div>

      <div style="margin-top:14px; border-top:1px solid #e2e8f0; padding-top:14px;" id="lfc-q-area"></div>

      <div style="margin-top:14px; display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap;">
        <button class="reg-btn" id="lfc-quest-cancel" type="button" style="padding:10px 14px; font-size:10px;">Close</button>
        <button class="reg-btn selected" id="lfc-quest-save" type="button" style="padding:10px 14px; font-size:10px;">Save Card</button>
      </div>

      <div id="lfc-quest-msg" style="display:none; margin-top:10px; padding:10px 12px; border-radius:12px; background:#f1f5f9; border:1px solid #e2e8f0; font-size:11px; font-weight:800; letter-spacing:1px; text-transform:uppercase; color:#334155;"></div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    function close(){
      overlay.style.display = 'none';
      overlay.style.pointerEvents = 'none';
    }

    $('#lfc-quest-close').addEventListener('click', close, true);
    $('#lfc-quest-cancel').addEventListener('click', close, true);

    overlay.addEventListener('click', function(e){
      if(e.target === overlay) close();
    }, true);
  }

  function buildGroupButtons(selected){
    var row = $('#lfc-group-row');
    if(!row) return;

    var groups = [
      { k:'teen',  label:'Teen (12–18)' },
      { k:'early', label:'Early Adult (19–25)' },
      { k:'adult', label:'Adult (26+)' },
      { k:'pro',   label:'Professional' }
    ];

    row.innerHTML = '';
    groups.forEach(function(g){
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'reg-btn';
      b.textContent = g.label;
      b.style.padding = '10px 12px';
      b.style.fontSize = '10px';
      if(selected === g.k) b.classList.add('selected');

      b.addEventListener('click', function(){
        try{ localStorage.setItem(KEY_GROUP, g.k); }catch(e){}
        // refresh visuals
        buildGroupButtons(g.k);
        buildQuestions(g.k);
      }, true);

      row.appendChild(b);
    });
  }

  function buildQuestions(groupKey){
    var area = $('#lfc-q-area');
    if(!area) return;

    // Chapter 1 Level 1: Observation
    // Keep it light: 2 choices + 1 optional text. Later you can swap these prompts per artwork or per group.
    var q1 = {
      id:'first_impression',
      title:'1) First impression',
      prompt:'What do you notice first?',
      options: (groupKey === 'pro')
        ? ['Material / technique', 'Composition / structure', 'Concept / intention', 'Context / reference']
        : ['Color / light', 'Subject / figure', 'Mood / feeling', 'Details / patterns']
    };

    var q2 = {
      id:'time_spent',
      title:'2) Stay with it',
      prompt:'If you stay 10 more seconds, what changes?',
      options: (groupKey === 'teen')
        ? ['I notice new details', 'My feeling changes', 'I start asking “why?”', 'Nothing changes yet']
        : ['A new detail appears', 'The story shifts', 'The mood deepens', 'Still unclear (and that’s ok)']
    };

    var q3 = {
      id:'one_sentence',
      title:'3) Optional (one sentence)',
      prompt:'In one sentence, what do you think this work is doing?',
      placeholder:'Example: It turns an ordinary scene into something uneasy and poetic…'
    };

    function optHTML(q){
      return q.options.map(function(o){
        return `<button type="button" class="reg-btn lfc-opt" data-q="${esc(q.id)}" data-v="${esc(o)}" style="padding:10px 12px; font-size:10px;">${esc(o)}</button>`;
      }).join('');
    }

    area.innerHTML = `
      <div style="font-size:10px; font-weight:900; letter-spacing:2px; text-transform:uppercase; color:#1e3a8a;">Level 1</div>

      <div style="margin-top:10px; padding:12px 12px; border:1px solid #e2e8f0; border-radius:16px; background:#fff;">
        <div style="font-size:10px; font-weight:900; letter-spacing:2px; text-transform:uppercase; color:#64748b;">${esc(q1.title)}</div>
        <div style="margin-top:6px; font-size:13px; font-weight:800; color:#0f172a;">${esc(q1.prompt)}</div>
        <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">${optHTML(q1)}</div>
      </div>

      <div style="margin-top:10px; padding:12px 12px; border:1px solid #e2e8f0; border-radius:16px; background:#fff;">
        <div style="font-size:10px; font-weight:900; letter-spacing:2px; text-transform:uppercase; color:#64748b;">${esc(q2.title)}</div>
        <div style="margin-top:6px; font-size:13px; font-weight:800; color:#0f172a;">${esc(q2.prompt)}</div>
        <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">${optHTML(q2)}</div>
      </div>

      <div style="margin-top:10px; padding:12px 12px; border:1px solid #e2e8f0; border-radius:16px; background:#fff;">
        <div style="font-size:10px; font-weight:900; letter-spacing:2px; text-transform:uppercase; color:#64748b;">${esc(q3.title)}</div>
        <div style="margin-top:6px; font-size:13px; font-weight:800; color:#0f172a;">${esc(q3.prompt)}</div>
        <textarea id="lfc-q-text" class="lab-input" rows="3" placeholder="${esc(q3.placeholder)}" style="margin-top:10px;"></textarea>
      </div>
    `;

    // selection logic: single select per question
    area.querySelectorAll('.lfc-opt').forEach(function(btn){
      btn.addEventListener('click', function(){
        var qid = btn.getAttribute('data-q');
        // clear siblings for same q
        area.querySelectorAll('.lfc-opt[data-q="'+qid+'"]').forEach(function(b){ b.classList.remove('selected'); });
        btn.classList.add('selected');
      }, true);
    });
  }

  function collectResponses(){
    var area = $('#lfc-q-area');
    if(!area) return null;

    function selectedVal(qid){
      var b = area.querySelector('.lfc-opt.selected[data-q="'+qid+'"]');
      return b ? b.getAttribute('data-v') : '';
    }
    var textEl = $('#lfc-q-text');
    return {
      first_impression: selectedVal('first_impression'),
      time_spent: selectedVal('time_spent'),
      one_sentence: textEl ? (textEl.value||'').trim() : ''
    };
  }

  function showMsg(m){
    var box = $('#lfc-quest-msg');
    if(!box) return;
    box.textContent = m;
    box.style.display = 'block';
  }
  function hideMsg(){
    var box = $('#lfc-quest-msg');
    if(box) box.style.display = 'none';
  }

  function openQuest(){
    ensureModal();

    var overlay = $('#lfc-quest-overlay');
    if(!overlay) return;

    hideMsg();

    var art = getArtworkSnapshot();
    var line = esc(art.title) + (art.meta ? (' · ' + esc(art.meta)) : '');
    var artLineEl = $('#lfc-quest-artline');
    if(artLineEl) artLineEl.textContent = line;

    var savedGroup = '';
    try{ savedGroup = localStorage.getItem(KEY_GROUP) || ''; }catch(e){}
    if(!savedGroup) savedGroup = 'adult';

    buildGroupButtons(savedGroup);
    buildQuestions(savedGroup);

    // show
    overlay.style.display = 'block';
    overlay.style.pointerEvents = 'auto';

    // wire save
    var saveBtn = $('#lfc-quest-save');
    if(saveBtn && !saveBtn.__bound){
      saveBtn.__bound = true;
      saveBtn.addEventListener('click', function(){
        hideMsg();

        var group = 'adult';
        try{ group = localStorage.getItem(KEY_GROUP) || 'adult'; }catch(e){}

        var resp = collectResponses();
        if(!resp) return;

        // ultra-light validation: require at least Q1 selected
        if(!resp.first_impression){
          showMsg('Pick one option for Question 1.');
          return;
        }

        var art2 = getArtworkSnapshot();
        var card = {
          id: 'c_' + Math.random().toString(36).slice(2) + Date.now().toString(36),
          createdAt: Date.now(),
          group: group,
          chapter: 1,
          level: 1,
          artworkTitle: art2.title,
          artworkMeta: art2.meta,
          artworkImg: art2.img,
          responses: resp
        };

        var list = readCards();
        list.push(card);
        writeCards(list);

        toast('Judgment Card saved');

        // close
        var ov = $('#lfc-quest-overlay');
        if(ov){
          ov.style.display = 'none';
          ov.style.pointerEvents = 'none';
        }

        // If blueprint is open, refresh it (works with your earlier renderer)
        try{
          var bp = $('#blueprint');
          if(bp && bp.classList.contains('active')){
            // your bp renderer runs on interval, but we nudge it
            if(typeof window.startBlueprint === 'function') window.startBlueprint();
          }
        }catch(e){}
      }, true);
    }
  }

  // --- English-only cleanup (micro-patch)
  // Replace Chinese onboarding tip text if it exists in any earlier patch leftovers.
  function enforceEnglish(){
    var tip = $('#onboarding-tip');
    if(tip && /[\u4e00-\u9fff]/.test(tip.textContent||'')){
      tip.textContent = 'Rotate: drag · Move: WASD/Arrows · Elevator: right · Click artwork to chat · Return to Walk';
    }
    var err = $('#lab-email-error');
    if(err && /[\u4e00-\u9fff]/.test(err.textContent||'')){
      err.textContent = 'Email is required so we can contact you.';
    }
  }

  // ensure button exists whenever panel becomes active
  setInterval(function(){
    try{
      var p = $('#ai-panel');
      if(p && p.classList.contains('active')){
        ensureQuestButton();
      }
      enforceEnglish();
    }catch(e){}
  }, 400);

  // also expose for debugging if you ever want to call it manually
  window.openThinkingQuest = openQuest;

})();
/* ===========================
   LFC Thinking Quest - Chapter 1 Level 2 (Choice & Change)
   - Adds a Level chooser when clicking "Thinking Quest"
   - Level 2 is locked until Level 1 exists for the current artwork
   - Saves a Judgment Card (chapter:1, level:2) into localStorage lfc_cards_v1
   - Does NOT touch Gemini / AI logic
   =========================== */
(function(){
  'use strict';
  function $(s, r){ return (r||document).querySelector(s); }
  function esc(s){ return String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

  var KEY_CARDS = 'lfc_cards_v1';
  var KEY_GROUP = 'lfc_user_group_v1';

  function readCards(){
    try{ return JSON.parse(localStorage.getItem(KEY_CARDS) || '[]'); }catch(e){ return []; }
  }
  function writeCards(list){
    try{ localStorage.setItem(KEY_CARDS, JSON.stringify(list||[])); }catch(e){}
  }

  function getArtworkSnapshot(){
    var title = ($('#ai-title') && $('#ai-title').textContent) ? $('#ai-title').textContent.trim() : 'Untitled';
    var meta  = ($('#ai-meta') && $('#ai-meta').textContent) ? $('#ai-meta').textContent.trim() : '';
    var imgEl = $('#ai-img');
    var img   = imgEl && imgEl.src ? imgEl.src : '';
    return { title:title, meta:meta, img:img };
  }

  function toast(msg){
    var t = $('#teleport-toast');
    if(!t){
      t = document.createElement('div');
      t.id = 'teleport-toast';
      t.style.position = 'fixed';
      t.style.top = '18px';
      t.style.left = '50%';
      t.style.transform = 'translateX(-50%) translateY(-18px)';
      t.style.background = 'rgba(30, 58, 138, 0.92)';
      t.style.color = '#fff';
      t.style.padding = '10px 18px';
      t.style.borderRadius = '50px';
      t.style.fontSize = '11px';
      t.style.fontWeight = '800';
      t.style.letterSpacing = '1px';
      t.style.textTransform = 'uppercase';
      t.style.opacity = '0';
      t.style.pointerEvents = 'none';
      t.style.zIndex = '9100';
      t.style.boxShadow = '0 10px 30px rgba(30,58,138,0.35)';
      t.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('visible');
    clearTimeout(window.__LFC_TOAST2_TIMER);
    window.__LFC_TOAST2_TIMER = setTimeout(function(){ t.classList.remove('visible'); }, 1400);
  }

  // English-only micro cleanup (in case earlier Chinese strings survive somewhere)
  function enforceEnglish(){
    var tip = $('#onboarding-tip');
    if(tip && /[\u4e00-\u9fff]/.test(tip.textContent||'')){
      tip.textContent = 'Rotate: drag · Move: WASD/Arrows · Elevator: right · Click artwork to chat · Return to Walk';
    }
    var err = $('#lab-email-error');
    if(err && /[\u4e00-\u9fff]/.test(err.textContent||'')){
      err.textContent = 'Email is required so we can contact you.';
    }
  }

  /* ---------------------------------
     Level Chooser Overlay
  --------------------------------- */
  function ensureChooser(){
    if($('#lfc-level-overlay')) return;

    var ov = document.createElement('div');
    ov.id = 'lfc-level-overlay';
    ov.style.position = 'fixed';
    ov.style.inset = '0';
    ov.style.background = 'rgba(15, 23, 42, 0.35)';
    ov.style.backdropFilter = 'blur(10px)';
    ov.style.zIndex = '9250';
    ov.style.display = 'none';
    ov.style.pointerEvents = 'none';

    var card = document.createElement('div');
    card.style.position = 'absolute';
    card.style.top = '50%';
    card.style.left = '50%';
    card.style.transform = 'translate(-50%, -50%)';
    card.style.width = '92%';
    card.style.maxWidth = '620px';
    card.style.background = 'rgba(255,255,255,0.94)';
    card.style.border = '1px solid rgba(226,232,240,1)';
    card.style.borderRadius = '20px';
    card.style.boxShadow = '0 30px 60px rgba(0,0,0,0.18)';
    card.style.padding = '18px';
    card.style.fontFamily = 'Montserrat, sans-serif';
    card.style.color = '#0f172a';

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
        <div>
          <div style="font-size:10px; font-weight:900; letter-spacing:2px; text-transform:uppercase; color:#1e3a8a;">
            THINKING QUEST
          </div>
          <div style="margin-top:6px; font-size:14px; font-weight:900;">Choose a Level</div>
          <div style="margin-top:6px; font-size:11px; font-weight:700; color:#64748b; line-height:1.6;" id="lfc-level-artline"></div>
        </div>
        <div id="lfc-level-close" style="font-size:22px; font-weight:900; color:#1e3a8a; cursor:pointer; padding:6px 10px;">×</div>
      </div>

      <div style="margin-top:14px; border-top:1px solid #e2e8f0; padding-top:14px; display:flex; gap:10px; flex-wrap:wrap;">
        <button class="reg-btn" id="lfc-go-l1" type="button" style="padding:12px 14px; font-size:10px;">Level 1 · Observation</button>
        <button class="reg-btn" id="lfc-go-l2" type="button" style="padding:12px 14px; font-size:10px;">Level 2 · Choice & Change</button>
      </div>

      <div id="lfc-level-msg" style="display:none; margin-top:12px; padding:10px 12px; border-radius:12px; background:#f1f5f9; border:1px solid #e2e8f0; font-size:11px; font-weight:800; letter-spacing:1px; text-transform:uppercase; color:#334155;"></div>
    `;

    ov.appendChild(card);
    document.body.appendChild(ov);

    function close(){
      ov.style.display = 'none';
      ov.style.pointerEvents = 'none';
    }
    $('#lfc-level-close').addEventListener('click', close, true);
    ov.addEventListener('click', function(e){ if(e.target === ov) close(); }, true);
  }

  function showChooser(){
    ensureChooser();
    var ov = $('#lfc-level-overlay');
    if(!ov) return;

    var art = getArtworkSnapshot();
    var line = esc(art.title) + (art.meta ? (' · ' + esc(art.meta)) : '');
    var artLine = $('#lfc-level-artline');
    if(artLine) artLine.textContent = line;

    var msg = $('#lfc-level-msg');
    if(msg) msg.style.display = 'none';

    // lock logic: need at least one Level 1 for this artwork title
    var cards = readCards();
    var hasL1This = cards.some(function(c){
      return c && c.chapter === 1 && c.level === 1 && (c.artworkTitle||'') === art.title;
    });

    var btnL2 = $('#lfc-go-l2');
    if(btnL2){
      btnL2.style.opacity = hasL1This ? '1' : '0.45';
      btnL2.style.pointerEvents = hasL1This ? 'auto' : 'auto'; // still clickable to show message
    }

    // bind buttons (single-bind)
    var btnL1 = $('#lfc-go-l1');
    if(btnL1 && !btnL1.__bound){
      btnL1.__bound = true;
      btnL1.addEventListener('click', function(){
        // close chooser then open existing Level 1 modal
        ov.style.display = 'none'; ov.style.pointerEvents = 'none';
        if(typeof window.openThinkingQuest === 'function'){
          window.openThinkingQuest(); // this is Level 1 from your previous patch
        }else{
          toast('Level 1 not available');
        }
      }, true);
    }

    if(btnL2 && !btnL2.__bound){
      btnL2.__bound = true;
      btnL2.addEventListener('click', function(){
        var art2 = getArtworkSnapshot();
        var cards2 = readCards();
        var ok = cards2.some(function(c){
          return c && c.chapter === 1 && c.level === 1 && (c.artworkTitle||'') === art2.title;
        });
        if(!ok){
          var m = $('#lfc-level-msg');
          if(m){
            m.textContent = 'Complete Level 1 for this artwork first.';
            m.style.display = 'block';
          }
          return;
        }
        ov.style.display = 'none'; ov.style.pointerEvents = 'none';
        openLevel2();
      }, true);
    }

    ov.style.display = 'block';
    ov.style.pointerEvents = 'auto';
  }

  /* ---------------------------------
     Level 2 Overlay (Choice & Change)
  --------------------------------- */
  function ensureL2(){
    if($('#lfc-l2-overlay')) return;

    var ov = document.createElement('div');
    ov.id = 'lfc-l2-overlay';
    ov.style.position = 'fixed';
    ov.style.inset = '0';
    ov.style.background = 'rgba(15, 23, 42, 0.35)';
    ov.style.backdropFilter = 'blur(10px)';
    ov.style.zIndex = '9300';
    ov.style.display = 'none';
    ov.style.pointerEvents = 'none';

    var card = document.createElement('div');
    card.style.position = 'absolute';
    card.style.top = '50%';
    card.style.left = '50%';
    card.style.transform = 'translate(-50%, -50%)';
    card.style.width = '92%';
    card.style.maxWidth = '720px';
    card.style.background = 'rgba(255,255,255,0.94)';
    card.style.border = '1px solid rgba(226,232,240,1)';
    card.style.borderRadius = '20px';
    card.style.boxShadow = '0 30px 60px rgba(0,0,0,0.18)';
    card.style.padding = '18px';
    card.style.fontFamily = 'Montserrat, sans-serif';
    card.style.color = '#0f172a';

    card.innerHTML = `
      <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:10px;">
        <div>
          <div style="font-size:10px; font-weight:900; letter-spacing:2px; text-transform:uppercase; color:#1e3a8a;">
            LFC THINKING QUEST
          </div>
          <div style="margin-top:6px; font-size:14px; font-weight:900;">
            Chapter 1 · Level 2 (Choice & Change)
          </div>
          <div style="margin-top:6px; font-size:11px; font-weight:700; color:#64748b; line-height:1.6;" id="lfc-l2-artline"></div>
        </div>
        <div id="lfc-l2-close" style="font-size:22px; font-weight:900; color:#1e3a8a; cursor:pointer; padding:6px 10px;">×</div>
      </div>

      <div style="margin-top:14px; border-top:1px solid #e2e8f0; padding-top:14px;">
        <div style="font-size:10px; font-weight:900; letter-spacing:2px; text-transform:uppercase; color:#1e3a8a;">Level 2</div>

        <div style="margin-top:10px; padding:12px; border:1px solid #e2e8f0; border-radius:16px; background:#fff;">
          <div style="font-size:10px; font-weight:900; letter-spacing:2px; text-transform:uppercase; color:#64748b;">1) Choose one change</div>
          <div style="margin-top:6px; font-size:13px; font-weight:800; color:#0f172a;">If you could change ONE thing, what would it be?</div>
          <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;" id="lfc-l2-q1"></div>
        </div>

        <div style="margin-top:10px; padding:12px; border:1px solid #e2e8f0; border-radius:16px; background:#fff;">
          <div style="font-size:10px; font-weight:900; letter-spacing:2px; text-transform:uppercase; color:#64748b;">2) Predict the impact</div>
          <div style="margin-top:6px; font-size:13px; font-weight:800; color:#0f172a;">What would your change do to the work?</div>
          <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;" id="lfc-l2-q2"></div>
        </div>

        <div style="margin-top:10px; padding:12px; border:1px solid #e2e8f0; border-radius:16px; background:#fff;">
          <div style="font-size:10px; font-weight:900; letter-spacing:2px; text-transform:uppercase; color:#64748b;">3) Optional (why)</div>
          <div style="margin-top:6px; font-size:13px; font-weight:800; color:#0f172a;">One sentence: why that change?</div>
          <textarea id="lfc-l2-text" class="lab-input" rows="3" placeholder="Keep it short. No essays. You have a life." style="margin-top:10px;"></textarea>
        </div>
      </div>

      <div style="margin-top:14px; display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap;">
        <button class="reg-btn" id="lfc-l2-back" type="button" style="padding:10px 14px; font-size:10px;">Back</button>
        <button class="reg-btn selected" id="lfc-l2-save" type="button" style="padding:10px 14px; font-size:10px;">Save Card</button>
      </div>

      <div id="lfc-l2-msg" style="display:none; margin-top:10px; padding:10px 12px; border-radius:12px; background:#f1f5f9; border:1px solid #e2e8f0; font-size:11px; font-weight:800; letter-spacing:1px; text-transform:uppercase; color:#334155;"></div>
    `;

    ov.appendChild(card);
    document.body.appendChild(ov);

    function close(){
      ov.style.display = 'none';
      ov.style.pointerEvents = 'none';
    }
    $('#lfc-l2-close').addEventListener('click', close, true);

    $('#lfc-l2-back').addEventListener('click', function(){
      close();
      showChooser();
    }, true);

    ov.addEventListener('click', function(e){ if(e.target === ov) close(); }, true);
  }

  function setOptGroup(container, qid, options){
    container.innerHTML = options.map(function(o){
      return `<button type="button" class="reg-btn lfc-l2-opt" data-q="${esc(qid)}" data-v="${esc(o)}" style="padding:10px 12px; font-size:10px;">${esc(o)}</button>`;
    }).join('');

    container.querySelectorAll('.lfc-l2-opt').forEach(function(btn){
      btn.addEventListener('click', function(){
        var id = btn.getAttribute('data-q');
        container.querySelectorAll('.lfc-l2-opt[data-q="'+id+'"]').forEach(function(b){ b.classList.remove('selected'); });
        btn.classList.add('selected');
      }, true);
    });
  }

  function openLevel2(){
    ensureL2();
    var ov = $('#lfc-l2-overlay');
    if(!ov) return;

    var art = getArtworkSnapshot();
    var line = esc(art.title) + (art.meta ? (' · ' + esc(art.meta)) : '');
    var artLine = $('#lfc-l2-artline');
    if(artLine) artLine.textContent = line;

    var group = 'adult';
    try{ group = localStorage.getItem(KEY_GROUP) || 'adult'; }catch(e){}

    var q1Opts;
    var q2Opts;

    if(group === 'teen'){
      q1Opts = ['Color', 'Lighting', 'One key detail', 'Background/setting'];
      q2Opts = ['Clearer meaning', 'Stronger mood', 'More drama', 'More confusing (maybe interesting)'];
    }else if(group === 'early'){
      q1Opts = ['Composition', 'Color palette', 'Scale', 'Title/text'];
      q2Opts = ['Shifts the story', 'Changes the message', 'Changes the emotion', 'Changes how viewers behave'];
    }else if(group === 'pro'){
      q1Opts = ['Medium/material', 'Display/context', 'Formal structure', 'Conceptual framing'];
      q2Opts = ['Alters interpretation', 'Alters power/ethics', 'Alters discourse context', 'Alters market reading'];
    }else{
      q1Opts = ['Composition', 'Color', 'Scale', 'Subject emphasis'];
      q2Opts = ['Clearer meaning', 'Deeper mood', 'More tension', 'More calm/space'];
    }

    setOptGroup($('#lfc-l2-q1'), 'change_one', q1Opts);
    setOptGroup($('#lfc-l2-q2'), 'impact', q2Opts);

    var msg = $('#lfc-l2-msg');
    if(msg) msg.style.display = 'none';

    ov.style.display = 'block';
    ov.style.pointerEvents = 'auto';

    var saveBtn = $('#lfc-l2-save');
    if(saveBtn && !saveBtn.__bound){
      saveBtn.__bound = true;
      saveBtn.addEventListener('click', function(){
        var area = $('#lfc-l2-overlay');
        var sel1 = area ? area.querySelector('.lfc-l2-opt.selected[data-q="change_one"]') : null;
        var sel2 = area ? area.querySelector('.lfc-l2-opt.selected[data-q="impact"]') : null;
        var txt = $('#lfc-l2-text') ? ($('#lfc-l2-text').value||'').trim() : '';

        if(msg) msg.style.display = 'none';

        if(!sel1){
          if(msg){ msg.textContent = 'Pick one option for Question 1.'; msg.style.display = 'block'; }
          return;
        }
        if(!sel2){
          if(msg){ msg.textContent = 'Pick one option for Question 2.'; msg.style.display = 'block'; }
          return;
        }

        var art2 = getArtworkSnapshot();
        var group2 = 'adult';
        try{ group2 = localStorage.getItem(KEY_GROUP) || 'adult'; }catch(e){}

        var card = {
          id: 'c_' + Math.random().toString(36).slice(2) + Date.now().toString(36),
          createdAt: Date.now(),
          group: group2,
          chapter: 1,
          level: 2,
          artworkTitle: art2.title,
          artworkMeta: art2.meta,
          artworkImg: art2.img,
          responses: {
            change_one: sel1.getAttribute('data-v') || '',
            impact: sel2.getAttribute('data-v') || '',
            why: txt
          }
        };

        var list = readCards();
        list.push(card);
        writeCards(list);

        toast('Judgment Card saved');

        ov.style.display = 'none';
        ov.style.pointerEvents = 'none';

        // Refresh Journey if open
        try{
          var bp = $('#blueprint');
          if(bp && bp.classList.contains('active')){
            if(typeof window.startBlueprint === 'function') window.startBlueprint();
          }
        }catch(e){}
      }, true);
    }
  }

  /* ---------------------------------
     Hijack "Thinking Quest" click to open chooser
     (We do NOT rely on editing your previous patch)
  --------------------------------- */
  function hijackQuestButton(){
    var btn = $('#btn-thinking-quest');
    if(!btn || btn.__l2_hijacked) return;
    btn.__l2_hijacked = true;

    btn.addEventListener('click', function(ev){
      // capture the click and open chooser
      try{
        ev.preventDefault();
        ev.stopPropagation();
        if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      }catch(e){}
      showChooser();
    }, true);
  }

  setInterval(function(){
    try{
      enforceEnglish();
      var p = $('#ai-panel');
      if(p && p.classList.contains('active')){
        hijackQuestButton();
      }
    }catch(e){}
  }, 350);

})();
/* ===========================
   LFC My Journey - Chapter 1 Milestones
   - Reads lfc_cards_v1
   - Computes Chapter 1 status
   - Injects human-readable progress into Blueprint
   =========================== */
(function(){
  'use strict';
  var KEY = 'lfc_cards_v1';

  function read(){
    try{ return JSON.parse(localStorage.getItem(KEY) || '[]'); }catch(e){ return []; }
  }

  function computeChapter1(cards){
    var c1 = cards.filter(c => c.chapter === 1);
    var byArtwork = {};
    c1.forEach(c => {
      byArtwork[c.artworkTitle] = byArtwork[c.artworkTitle] || {};
      byArtwork[c.artworkTitle][c.level] = true;
    });

    var l1Count = c1.filter(c => c.level === 1).length;
    var l2Count = c1.filter(c => c.level === 2).length;

    var completedArtworks = Object.values(byArtwork)
      .filter(v => v[1] && v[2]).length;

    var status = 'Observer I';
    if (l1Count >= 1 && l2Count >= 1) status = 'Decision Maker I';
    if (completedArtworks >= 3) status = 'Critical Viewer (Chapter 1)';

    return {
      status,
      l1Count,
      l2Count,
      completedArtworks
    };
  }

  function inject(){
    var bp = document.getElementById('bp-desc');
    if(!bp) return;

    var cards = read();
    if(!cards.length){
      bp.textContent = 'Your journey will appear here once you begin exploring artworks.';
      return;
    }

    var c1 = computeChapter1(cards);

    bp.innerHTML = `
      <strong>Current Focus</strong><br>
      ${c1.status}<br><br>
      You have practiced:<br>
      • Observation: ${c1.l1Count} time(s)<br>
      • Making choices: ${c1.l2Count} time(s)
    `;
  }

  var _startBlueprint = window.startBlueprint;
  if(typeof _startBlueprint === 'function'){
    window.startBlueprint = function(){
      _startBlueprint.apply(this, arguments);
      setTimeout(inject, 50);
    };
  }
})();
/* ===========================
   Judgment Card Naming System
   - Adds title + summary to each card
   =========================== */
(function(){
  'use strict';

  function generateTitle(card, history){
    if(card.level === 1){
      var sameArtworkCount = history.filter(c =>
        c.level === 1 && c.artworkTitle === card.artworkTitle
      ).length;

      if(sameArtworkCount === 0) return 'First Pause';
      if(sameArtworkCount === 1) return 'Returning Gaze';
      return 'Learning to Stay';
    }

    if(card.level === 2){
      if(card.answers && card.answers.reason){
        return 'Reasoned Choice';
      }
      return 'Making a Stand';
    }

    return 'Judgment Recorded';
  }

  function generateSummary(card){
    if(card.level === 1){
      return 'You paused and stayed with an artwork instead of rushing past it.';
    }
    if(card.level === 2){
      return 'You made a conscious choice and reflected on why it mattered to you.';
    }
    return 'You reflected on an artwork.';
  }

  window.enrichJudgmentCard = function(card){
    var history;
    try{
      history = JSON.parse(localStorage.getItem('lfc_cards_v1') || '[]');
    }catch(e){
      history = [];
    }

    card.title = generateTitle(card, history);
    card.summary = generateSummary(card);
    return card;
  };
})();
/* ===========================
   My Journey: Render Judgment Cards (Read-only)
   - Adds a clean list into Blueprint panel
   =========================== */
(function(){
  'use strict';

  function loadCards(){
    try { return JSON.parse(localStorage.getItem('lfc_cards_v1') || '[]'); }
    catch(e){ return []; }
  }

  function fmtTime(ts){
    if(!ts) return '';
    try{
      var d = new Date(ts);
      return d.toLocaleString();
    }catch(e){ return ''; }
  }

  function ensureSection(){
    var bpSteps = document.getElementById('bp-steps');
    if(!bpSteps) return null;

    var existing = document.getElementById('bp-judgment-cards');
    if(existing) return existing;

    var wrap = document.createElement('div');
    wrap.id = 'bp-judgment-cards';
    wrap.style.marginTop = '18px';

    // Title row
    var title = document.createElement('div');
    title.textContent = 'Judgment Cards';
    title.style.fontWeight = '900';
    title.style.letterSpacing = '2px';
    title.style.textTransform = 'uppercase';
    title.style.fontSize = '11px';
    title.style.color = '#1e3a8a';
    title.style.marginBottom = '10px';

    // Container
    var list = document.createElement('div');
    list.id = 'bp-judgment-list';
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '10px';

    wrap.appendChild(title);
    wrap.appendChild(list);

    bpSteps.appendChild(wrap);
    return wrap;
  }

  function render(){
    var sec = ensureSection();
    if(!sec) return;

    var list = document.getElementById('bp-judgment-list');
    if(!list) return;

    var cards = loadCards();
    list.innerHTML = '';

    if(!cards.length){
      var empty = document.createElement('div');
      empty.textContent = 'No Judgment Cards yet. Start from any artwork: Thinking Quest.';
      empty.style.fontSize = '12px';
      empty.style.color = '#64748b';
      empty.style.fontWeight = '700';
      empty.style.lineHeight = '1.7';
      list.appendChild(empty);
      return;
    }

    // newest first
    cards.slice().reverse().forEach(function(card){
      var item = document.createElement('div');
      item.style.background = 'rgba(255,255,255,0.9)';
      item.style.border = '1px solid #e2e8f0';
      item.style.borderRadius = '14px';
      item.style.padding = '12px 14px';
      item.style.boxShadow = '0 12px 35px rgba(0,0,0,0.05)';
      item.style.backdropFilter = 'blur(10px)';

      var t = document.createElement('div');
      t.textContent = (card.title || 'Judgment Recorded');
      t.style.fontWeight = '900';
      t.style.fontSize = '12px';
      t.style.letterSpacing = '1px';
      t.style.textTransform = 'uppercase';
      t.style.color = '#1e3a8a';

      var s = document.createElement('div');
      s.textContent = (card.summary || '');
      s.style.marginTop = '6px';
      s.style.fontSize = '13px';
      s.style.lineHeight = '1.75';
      s.style.color = '#64748b';
      s.style.fontWeight = '600';

      var meta = document.createElement('div');
      var art = card.artworkTitle ? card.artworkTitle : 'Artwork';
      var time = fmtTime(card.timestamp);
      meta.textContent = (art + (time ? (' • ' + time) : ''));
      meta.style.marginTop = '8px';
      meta.style.fontSize = '10px';
      meta.style.fontWeight = '800';
      meta.style.letterSpacing = '1px';
      meta.style.textTransform = 'uppercase';
      meta.style.color = '#94a3b8';

      item.appendChild(t);
      if(card.summary) item.appendChild(s);
      item.appendChild(meta);

      list.appendChild(item);
    });
  }

  // Expose a safe refresh hook
  window.refreshJourneyCards = render;

  // Auto-refresh while Blueprint is open
  setInterval(function(){
    try{
      var bp = document.getElementById('blueprint');
      if(bp && bp.classList.contains('active')){
        render();
      }
    }catch(e){}
  }, 500);
})();
