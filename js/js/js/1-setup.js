// ===== Supabase Init (FIXED with Safety Net) =====
const SUPABASE_URL = "https://rudztwseatwayhztbarj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1ZHp0d3NlYXR3YXloenRiYXJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NTQyOTYsImV4cCI6MjA4NjUzMDI5Nn0.YrPIS26glb-N5JIKspFuzdtp-t32qXAtLoDHwTbLVtk";

let supabaseClient = null;
try {
  if (window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    console.warn("Supabase library not loaded.");
  }
} catch (e) {
  console.error("Failed to initialize Supabase:", e);
}

// ==========================================
// 1. CONFIGURATION & DATA STRUCTURE
// ==========================================
const AI_ENDPOINT = "https://lfc-ai-gateway.fayechenca.workers.dev/chat";
const PREMIUM_CONTACT_URL = "https://www.feiteamart.com/contact";

let userProfile = { role: [], goal: [], ageGroup: "", interests: [] };
let intentScores = { technique: 0, history: 0, market: 0, theory: 0 };
let questionCount = 0;
let discoveryProgress = 0;
let userID = localStorage.getItem("lfc_uid") || "guest_" + Date.now();
localStorage.setItem("lfc_uid", userID);

let aiPersona = localStorage.getItem("lfc_ai_persona") || "docent"; 
let journeyLog = [];           
let visitedArtworks = [];      
let pinnedArtworks = [];       

const LEARNING_PATHS = {
  technique: {
    title: "The Material Observer", focus: "Technique & Process",
    reason: "Your profile suggests a focus on making and process.",
    learn: ["Impasto & Texture Guide", "The Chemistry of Pigments", "Brushwork Analysis"],
    practice: "Zoom in on one brushstroke. Sketch its direction.", reflect: "How does the material change the feeling?", next: "Sculpture Floor (Floor 4)"
  },
  history: {
    title: "The Contextual Historian", focus: "Time & Context",
    reason: "Your profile suggests a focus on history and era.",
    learn: ["Timeline of this Era", "Artist Biography", "World Context"],
    practice: "Find one other artist from this same year.", reflect: "Why did the artist make this *then* and not now?", next: "Contemporary Lens (Floor 12)"
  },
  market: {
    title: "The Strategic Collector", focus: "Value & Provenance",
    reason: "Your profile suggests a focus on the art market and value.",
    learn: ["Auction Results 2024", "Valuation Strategy", "Edition Strategy"],
    practice: "Estimate the primary market price vs. secondary market.", reflect: "What drives the value of this piece?", next: "The Atrium (Manifesto)"
  },
  theory: {
    title: "The Critical Thinker", focus: "Meaning & Philosophy",
    reason: "Your profile suggests a focus on concepts and meaning.",
    learn: ["Semiotics in Art", "Conceptual Manifesto", "Visual Philosophy"],
    practice: "Write one sentence that explains the 'Invisible Meaning'.", reflect: "Is the idea more important than the visual?", next: "Installation Floor (Floor 5)"
  },
  general: {
    title: "The Open Observer", focus: "General Appreciation",
    reason: "You are exploring broadly.",
    learn: ["How to Look at Art", "Slow Looking Guide"],
    practice: "Spend 3 minutes looking at one corner.", reflect: "What stands out the most?", next: "Painting Floor (Floor 1)"
  }
};

const ATRIUM_CONFIG = {
  videoLink: "https://www.youtube.com/watch?v=ooi2V2Fp2-k", videoThumb: "https://img.youtube.com/vi/ooi2V2Fp2-k/maxresdefault.jpg",
  title: "LFC Sky Artspace", subtitle: "Learning From Collections", tagline: "From Viewing to Knowing.",
  desc: "LFC Sky Artspace is a collection-led art education system.", method: "Collection-to-Creation Framework", steps: "Visit → Analyze → Create"
};

const FLOORS = [
  { id: 0, name: "The Atrium", type: "reception" }, { id: 1, name: "Painting / Fine Art", type: "fineart" },
  { id: 2, name: "Print", type: "standard" }, { id: 3, name: "Photography", type: "standard" },
  { id: 4, name: "Sculpture", type: "sculpture" }, { id: 5, name: "Installation", type: "sculpture" },
  { id: 6, name: "Ceramics", type: "standard" }, { id: 7, name: "Design", type: "standard" },
  { id: 8, name: "Animation", type: "standard" }, { id: 9, name: "Film / Video", type: "darkroom" },
  { id: 10, name: "Performance", type: "standard" }, { id: 11, name: "Sketch", type: "standard" },
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

let chatHistory = []; 
let currentOpenArt = null;
const interactables = [];
let isInputLocked = false;
let isSending = false;

// ==========================================
// 1.1 JOURNEY HELPERS
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
  visitedArtworks.push({ title: art.title || "Untitled", artist: art.artist || "Unknown", year: art.year || "—", floor: art.floor ?? "Gallery", ts: Date.now() });
  if (visitedArtworks.length > 80) visitedArtworks.shift();
}
function recordPin(art) {
  if (!art) return;
  const already = pinnedArtworks.find(a => a.title === art.title && a.artist === art.artist);
  if (already) return;
  pinnedArtworks.push({ title: art.title || "Untitled", artist: art.artist || "Unknown", year: art.year || "—", floor: art.floor ?? "Gallery", ts: Date.now() });
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
    addChatMsg("ai", "Curator mode enabled. Deeper theory, context, and curatorial logic. (Premium guidance style.)");
  } else {
    addChatMsg("ai", "Docent mode enabled. Friendly guidance, accessible interpretation, and learning prompts.");
  }
};

// ==========================================
// 2. CREATOR LAB LOGIC
// ==========================================
const LAB_TERMS = {
  pro: { trigger: "Creator Lab", title: "Project Charter", name: "Project Title", goal: "Strategic Objective", refs: "Reference Board", steps: "Milestones", addStep: "+ Add Milestone", help: "Contact Mentor", submit: "Submit Proposal" },
  explorer: { trigger: "My Backpack", title: "Mission Card", name: "Adventure Name", goal: "My Quest Goal", refs: "Collected Treasures", steps: "Adventure Map", addStep: "+ Next Step", help: "Ask Guide", submit: "Complete Quest" }
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
    document.body.classList.add("theme-pro"); 
    const setText = (id, text) => { const el = document.getElementById(id); if (el) el.innerText = text; };
    setText("lab-trigger-text", terms.trigger); setText("lab-title", terms.title); setText("label-name", terms.name);
    setText("label-goal", terms.goal); setText("label-refs", terms.refs); setText("label-steps", terms.steps);
    const btnAdd = document.getElementById("btn-add-step"); if (btnAdd) btnAdd.innerText = terms.addStep;
    const btnHelp = document.getElementById("btn-help"); if (btnHelp) btnHelp.innerText = terms.help;
    const btnSubmit = document.getElementById("btn-submit"); if (btnSubmit) btnSubmit.innerText = terms.submit;
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
    if (typeof recordPin === "function") recordPin(artData);
    this.projectData.references.push(artData);
    if (!this.refContainer) return;
    const pin = document.createElement("div");
    pin.className = "lab-pin-card";
    const imgUrl = artData.img || "https://placehold.co/100x100/1e3a8a/ffffff?text=ART";
    pin.innerHTML = `<img src="${imgUrl}" class="lab-pin-img"><span>${typeof toSafeText === "function" ? toSafeText(artData.title) : (artData.title || "")}</span>`;
    const emptyState = this.refContainer.querySelector(".lab-empty-state");
    if (emptyState) emptyState.remove();
    this.refContainer.appendChild(pin);
    if (typeof logJourney === "function") {
      logJourney({ ts: Date.now(), type: "pin", title: artData.title, artist: artData.artist, floor: artData.floor ?? "Gallery" });
    }
    if (!this.isOpen) {
      const icon = document.getElementById("lab-trigger-icon");
      if (icon) { icon.innerText = "✨"; setTimeout(() => (icon.innerText = "⚡"), 1000); }
    }
  }
  setupEventListeners() {
    const btnAdd = document.getElementById("btn-add-step");
    if (btnAdd) {
      btnAdd.addEventListener("click", () => {
        if (!this.milestoneList) return;
        const li = document.createElement("li");
        li.className = "lab-milestone-item";
        li.innerHTML = `<input type="checkbox" class="lab-checkbox"> <input type="text" class="lab-input" style="margin:0; padding:6px;" placeholder="New Step...">`;
        this.milestoneList.appendChild(li);
      });
    }
    const btnHelp = document.getElementById("btn-help");
    if (btnHelp) {
      btnHelp.addEventListener("click", () => {
        if (typeof PREMIUM_CONTACT_URL !== "undefined" && PREMIUM_CONTACT_URL) window.open(PREMIUM_CONTACT_URL, "_blank");
        else alert("Contact link is not set yet.");
      });
    }
    const btnSubmit = document.getElementById("btn-submit");
    if (btnSubmit) {
      btnSubmit.addEventListener("click", async () => {
        btnSubmit.disabled = true; btnSubmit.style.opacity = "0.6"; btnSubmit.style.pointerEvents = "none";
        try {
          const nameInput = document.getElementById("project-name-input");
          const projectName = nameInput?.value?.trim() || "Untitled Project";
          const goalInput = document.getElementById("project-goal-input") || document.getElementById("goal-input") || document.getElementById("project-goal");
          const projectGoal = goalInput?.value?.trim() || "";
          const milestones = [...document.querySelectorAll("#lab-milestone-list .lab-milestone-item")]
            .map((li) => {
              const done = li.querySelector(".lab-checkbox")?.checked ?? false;
              const text = li.querySelector('input[type="text"]')?.value?.trim() || "";
              return text ? { done, text } : null;
            }).filter(Boolean);
          const references = Array.isArray(this.projectData?.references) ? this.projectData.references : [];
          const payload = {
            intent_type: "creator_lab_submit", mode: this.user?.ageGroup === "Child" ? "explorer" : "pro",
            age_group: this.user?.ageGroup || "", project_name: projectName, project_goal: projectGoal,
            milestones: JSON.stringify(milestones), references: JSON.stringify(references),
            page_url: location.href, ts: new Date().toISOString(), _subject: `Creator Lab Submission: ${projectName}`,
          };
          const formData = new FormData();
          Object.entries(payload).forEach(([k, v]) => formData.append(k, v));
          const res = await fetch(FORMSPREE_ENDPOINT, { method: "POST", body: formData, headers: { Accept: "application/json" } });
          if (!res.ok) {
            let msg = "Submission failed.";
            try { const data = await res.json(); if (data?.errors?.length) msg = data.errors.map((e) => e.message).join(" | "); } catch {}
            throw new Error(msg);
          }
          if (this.user?.ageGroup === "Child") alert("Quest Complete! Your guide has received your adventure map!");
          else alert(`✅ SUCCESS\n\nProject "${projectName}" has been submitted.\n\nThank you! We'll review it and get back to you if needed.`);
        } catch (err) {
          alert(`❌ Submission failed.\n\n${err?.message || "Unknown error"}`);
        } finally {
          btnSubmit.disabled = false; btnSubmit.style.opacity = ""; btnSubmit.style.pointerEvents = "";
        }
      });
    }
  }
}
