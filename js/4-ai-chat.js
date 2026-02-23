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

  addChatMsg("user", txt);

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

  chatHistory.push({ role: "user", parts: [{ text: txt }] });

  try {
    const artPayload = currentOpenArt
      ? { title: currentOpenArt.title, artist: currentOpenArt.artist, year: currentOpenArt.year, medium: currentOpenArt.medium, floor: currentOpenArt.floor ?? "Gallery" }
      : { title: "Unknown" };

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

    const thinkEl = document.getElementById(thinkId);
    if (thinkEl) thinkEl.remove();

    let replyText = d.reply;
    replyText = cleanPossiblyJsonReply(replyText);

    const parsed = tryParseJsonFromText(replyText);
    if (parsed && parsed.reply) replyText = parsed.reply;

    addChatMsg("ai", replyText);
    chatHistory.push({ role: "model", parts: [{ text: replyText }] });

    logJourney({
      ts: Date.now(),
      type: "chat",
      role: "model",
      persona: aiPersona,
      art: currentOpenArt ? { title: currentOpenArt.title, artist: currentOpenArt.artist, year: currentOpenArt.year, floor: currentOpenArt.floor } : null,
      text: replyText
    });

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
  d.style.cssText = "font-size:10px; color:#64748b; text-align:center; margin:5px 0; text-transform:uppercase; letter-spacing:1px; opacity:0.8;";
  d.innerHTML = `✦ Noted: Focus on <strong>${type}</strong>`;
  document.getElementById("chat-stream").appendChild(d);
}

function sendDataBeacon() {
  console.log("📡 DATA BEACON SENT:", { session: "user_" + Date.now(), interests: intentScores, questions: questionCount });
}

function openAI(data) {
  document.getElementById("ai-panel").classList.add("active");
  if (data.texture) document.getElementById("ai-img").src = "https://placehold.co/800x600/1e3a8a/ffffff?text=LFC+Info";
  else document.getElementById("ai-img").src = data.img;

  document.getElementById("ai-title").innerText = data.title;
  
  const artist = data.artist || "Unknown";
  const year = data.year || "—";
  const medium = data.medium || "Mixed Media";
  document.getElementById("ai-meta").innerText = `${artist} • ${year} • ${medium}`;

  chatHistory = [];
  questionCount = 0;
  document.getElementById("chat-stream").innerHTML = "";

  updateAIModeUI();

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
