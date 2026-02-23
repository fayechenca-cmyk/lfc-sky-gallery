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
