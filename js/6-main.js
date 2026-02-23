// ==========================================
// 8. INIT & BINDINGS
// ==========================================
document.getElementById("send-btn").onclick = sendChat;
document.getElementById("user-input").onkeypress = e => {
  if (e.key === "Enter") sendChat();
};

window.showRegistration = showRegistration;
window.toggleKeyword = toggleInterest;
window.completeRegistration = completeRegistration;
window.toggleRole = toggleRole;
window.toggleAge = toggleAge;
window.toggleGoal = toggleGoal;
window.toggleInterest = toggleInterest;
window.skipRegistration = skipRegistration;
window.exitFocus = exitFocus;

window.addEventListener("load", () => {
  if (loadProgress()) {
    console.log("Welcome back, " + userID);
  }
  
  // Load artworks data
  fetch("artworks.json")
    .then(r => r.json())
    .then(d => {
      if (d.floors) Object.values(d.floors).forEach(f => f.items.forEach(i => ART_DATA.push(i)));
      else ART_DATA = d;
      buildGallery();
    })
    .catch(() => buildGallery());
});

window.addEventListener("DOMContentLoaded", () => {
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

  updateAIModeUI();
});

// ==========================================
// 9. LIGHTBOX MODAL
// ==========================================
window.openLightbox = function(src) {
  const modal = document.getElementById("lightbox-modal");
  const img = document.getElementById("lightbox-img");
  if (modal && img) {
    img.src = src;
    modal.classList.add("active");
  }
};
window.closeLightbox = function() {
  const modal = document.getElementById("lightbox-modal");
  if (modal) modal.classList.remove("active");
};
