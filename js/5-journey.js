// ==========================================
// 7.3 MY JOURNEY (AI-GENERATED UPGRADE)
// ==========================================
function getWinningInterest() {
  let maxScore = 0;
  let interest = "general";
  for (const [key, val] of Object.entries(intentScores)) {
    if (val > maxScore) { maxScore = val; interest = key; }
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
  const visitedList = visitedArtworks.slice(-20).map(a => `- ${a.title} — ${a.artist} (${a.year}) [Floor: ${floorNameById(a.floor)}]`).join("\n");
  const pinnedList = pinnedArtworks.slice(-20).map(a => `- ${a.title} — ${a.artist} (${a.year})`).join("\n");
  const transcript = buildJourneyTranscript(80);
  const courseList = (CATALOG.products || []).filter(p => p.type === "course").map(p => `- ${p.id}: ${p.title} (tag=${p.tag})`).join("\n");

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

  const systemInstruction = "You are a precise education+curation engine. You must not invent facts about specific real artworks. Use the transcript and user data. Return JSON only.";

  const d = await callGeminiLikeGateway({ message: prompt, history: [], art: { title: "My Journey", artist: "LFC System", year: "—", floor: "Blueprint" }, userProfile: userProfile, systemInstruction: systemInstruction });
  const raw = cleanPossiblyJsonReply(d.reply);
  const parsed = tryParseJsonFromText(raw);
  if (!parsed) throw new Error("Journey JSON parse failed");
  return parsed;
}

async function startBlueprint() {
  document.getElementById("blueprint").classList.add("active");
  const container = document.getElementById("bp-products");
  container.innerHTML = "<h3 style='text-align:center; color:var(--blue);'>Curating your journey...</h3>";

  const desc = document.getElementById("bp-desc");
  const steps = document.getElementById("bp-steps");
  if (desc) desc.innerHTML = "";
  if (steps) steps.innerHTML = "";

  const trailHtml = renderTrailBlock();

  try {
    const report = await generateJourneyReport();
    const interest = report.recommendedTrack || getWinningInterest();
    const pathData = LEARNING_PATHS[interest] || LEARNING_PATHS.general;
    const recommendedCourse = pickCourseByIdOrTag(report.recommendedClassId, interest);
    const courseTitle = recommendedCourse ? recommendedCourse.title : "Custom Curriculum Design";
    const courseDesc = recommendedCourse ? recommendedCourse.desc : "We don’t have a perfect pre-made match yet. Work with a mentor to build your personalized syllabus.";
    const courseUrl = recommendedCourse ? recommendedCourse.url : PREMIUM_CONTACT_URL;

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
    const curatorQ = report.curatorUpgrade && Array.isArray(report.curatorUpgrade.suggestedQuestions) ? report.curatorUpgrade.suggestedQuestions : [];

    const curatorUpgradeBlock = `
      <div style="margin-top:1.5rem; padding:1rem; border:1px solid #e2e8f0; border-radius:12px; background:#f8fafc;">
        <div style="font-size:10px; letter-spacing:2px; text-transform:uppercase; color:var(--gray); margin-bottom:8px;">Curator Upgrade</div>
        <div style="font-size:13px; color:#475569; margin-bottom:10px;">
          ${toSafeText(report.curatorUpgrade && report.curatorUpgrade.why ? report.curatorUpgrade.why : "Curator mode offers deeper analysis, structure, and professional-level guidance.")}
        </div>
        ${curatorQ.length ? `<ul style="padding-left:18px; margin:0; font-size:13px; color:#475569;">${curatorQ.map(q => `<li style="margin:6px 0;">${q}</li>`).join("")}</ul>` : ""}
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
          ${keywords.length ? `<div style="margin-bottom:1rem;"><strong style="font-size:11px; text-transform:uppercase; color:var(--blue);">Keywords Captured</strong><div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:10px;">${keywords.map(k => `<span style="font-size:10px; padding:6px 10px; border-radius:999px; background:#fff; border:1px solid #e2e8f0; color:#475569; font-weight:700;">${k}</span>`).join("")}</div></div>` : ""}
          ${themes.length ? `<div style="margin-bottom:1rem;"><strong style="font-size:11px; text-transform:uppercase; color:var(--blue);">Themes</strong><ul style="padding-left:18px; margin:10px 0 0; font-size:13px; color:#475569;">${themes.map(t => `<li style="margin-bottom:6px;">${t}</li>`).join("")}</ul></div>` : ""}
          <div style="margin-top:1.5rem; padding-top:1.5rem; border-top:1px solid #e2e8f0;">
            <strong style="font-size:12px; color:var(--blue);">Your Track: ${pathData.title}</strong>
            <p style="font-size:13px; margin:8px 0; color:#475569;">${toSafeText(report.whyThisTrack || pathData.reason)}</p>
            <div style="margin-top:1rem;"><strong style="font-size:11px; text-transform:uppercase; color:var(--blue);">Practice Plan</strong><ul style="padding-left:18px; margin:10px 0 0; font-size:13px; color:#475569;">${(practice.length ? practice : pathData.learn).map(x => `<li style="margin-bottom:6px;">${x}</li>`).join("")}</ul></div>
            <div style="margin-top:1rem;"><strong style="font-size:11px; text-transform:uppercase; color:var(--blue);">Reflection</strong><ul style="padding-left:18px; margin:10px 0 0; font-size:13px; color:#475569;">${(reflection.length ? reflection : [pathData.reflect]).map(x => `<li style="margin-bottom:6px;">${x}</li>`).join("")}</ul></div>
            <div style="margin-top:1rem;"><strong style="font-size:11px; text-transform:uppercase; color:var(--blue);">Next Steps</strong><ul style="padding-left:18px; margin:10px 0 0; font-size:13px; color:#475569;">${(nextSteps.length ? nextSteps : [pathData.practice, `Next: ${pathData.next}`]).map(x => `<li style="margin-bottom:6px;">${x}</li>`).join("")}</ul></div>
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
                ${report.recommendedClassWhy ? `<p style="font-size:11px; color:#475569; margin:10px 0 0; line-height:1.6;"><strong style="color:var(--blue);">Why:</strong> ${toSafeText(report.recommendedClassWhy)}</p>` : ""}
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
    ? `<ul style="padding-left:18px; margin:10px 0 0; font-size:13px; color:#475569;">${visited.map(v => `<li style="margin-bottom:6px;"><strong>${toSafeText(v.title)}</strong> <span style="color:#64748b;">— ${toSafeText(v.artist)} • ${toSafeText(v.year)} • ${floorNameById(v.floor)}</span></li>`).join("")}</ul>`
    : `<div style="font-size:13px; color:#64748b; margin-top:10px;">No artworks visited yet. Click an artwork to start a trail.</div>`;

  const pinnedHtml = pinned.length
    ? `<div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:10px;">${pinned.map(p => `<span style="font-size:10px; padding:6px 10px; border-radius:999px; background:#fff; border:1px solid #e2e8f0; color:#475569; font-weight:700;">📌 ${toSafeText(p.title)}</span>`).join("")}</div>`
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
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:1rem;"><div style="text-transform:uppercase; font-size:10px; letter-spacing:2px; color:var(--gray); margin-bottom:6px;">Visited Trail</div>${visitedHtml}</div>
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:1rem;"><div style="text-transform:uppercase; font-size:10px; letter-spacing:2px; color:var(--gray); margin-bottom:6px;">Pinned</div>${pinnedHtml}</div>
      </div>
    </div>
  `;
}

function renderFallbackBlueprint() {
  let maxScore = 0; let interest = "general";
  for (const [key, val] of Object.entries(intentScores)) { if (val > maxScore) { maxScore = val; interest = key; } }
  if (maxScore === 0 && userProfile.interests.length > 0) {
    const k = userProfile.interests;
    if (k.includes("Art Market") || k.includes("Understand Collecting/Market")) interest = "market";
    else if (k.includes("History") || k.includes("Impressionism") || k.includes("Learn Art History")) interest = "history";
    else if (k.includes("Painting") || k.includes("Sculpture") || k.includes("Learn Techniques")) interest = "technique";
    else if (k.includes("Philosophy") || k.includes("Social Themes") || k.includes("Explore Meaning & Ideas")) interest = "theory";
  }
  const pathData = LEARNING_PATHS[interest] || LEARNING_PATHS.general;
  let recommendedCourse = null; if (CATALOG.products) { recommendedCourse = CATALOG.products.find(p => p.type === "course" && p.tag === interest); }
  let courseTitle = recommendedCourse ? recommendedCourse.title : "Custom Curriculum Design";
  let courseDesc = recommendedCourse ? recommendedCourse.desc : "We don't have a pre-made class for this specific interest yet. Work with a mentor to build your own personalized syllabus.";
  let courseUrl = recommendedCourse ? recommendedCourse.url : PREMIUM_CONTACT_URL;
  let premiumHtml = "";
  if (CATALOG.products) {
    const premiums = CATALOG.products.filter(p => p.type === "premium");
    premiums.forEach(p => { premiumHtml += `<div class="plan-card" style="padding:1rem; margin:0; border:1px solid #cbd5e1;"><strong style="color:var(--blue);">${p.title}</strong><div style="font-size:11px; color:#64748b; margin:4px 0;">${p.desc}</div><button class="plan-btn" style="padding:8px; margin-top:8px; font-size:10px; background:#fff; color:var(--blue); border:1px solid var(--blue);" onclick="window.open('${p.url}', '_blank')">Book Session ($${p.price})</button></div>`; });
  }

  return `
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:2rem; width:100%; margin-top:1.5rem;">
      <div style="background:#f8fafc; padding:2rem; border-radius:16px; border:1px solid #e2e8f0;">
        <h2 style="color:var(--blue); font-size:1.8rem; margin:0 0 5px 0;">LFC Discovery Method</h2>
        <div style="text-transform:uppercase; font-size:10px; letter-spacing:2px; color:var(--ok); font-weight:700; margin-bottom:1.5rem;">YOUR PERSONAL GUIDE</div>
        <div style="margin-bottom:1rem;"><strong style="font-size:12px; color:var(--blue);">Observation Focus: ${pathData.focus}</strong><p style="font-size:13px; margin:5px 0; color:#475569;">${pathData.reason}</p></div>
        <div style="margin-bottom:1rem;"><strong style="font-size:11px; text-transform:uppercase; color:var(--blue);">1. Practice</strong><ul style="padding-left:20px; font-size:13px; color:#475569;">${Array.isArray(pathData.learn) ? pathData.learn.map(l => `<li style="margin-bottom:5px;">${l}</li>`).join("") : ""}</ul><p style="font-size:13px; margin:5px 0;">${pathData.practice}</p></div>
        <div style="margin-bottom:1rem;"><strong style="font-size:11px; text-transform:uppercase; color:var(--blue);">2. Reflect</strong><p style="font-size:13px; margin:5px 0;">${pathData.reflect}</p></div>
      </div>
      <div style="background:#fff; padding:2rem; border-radius:16px; border:1px solid #e2e8f0; position:relative; overflow:hidden;">
        <div style="position:absolute; top:0; right:0; background:var(--blue); color:#fff; font-size:9px; padding:5px 10px; border-radius:0 0 0 8px; font-weight:700;">BACKSTAGE</div>
        <div style="margin-bottom:2rem; padding-bottom:1.5rem; border-bottom:1px solid #e2e8f0;">
          <div style="text-transform:uppercase; font-size:10px; letter-spacing:2px; color:var(--gray); margin-bottom:10px;">Recommended Class</div>
          <div style="display:flex; align-items:center; gap:15px;"><div style="flex:1;"><strong style="color:var(--blue); font-size:1.1rem;">${courseTitle}</strong><p style="font-size:11px; color:#64748b; margin:5px 0;">${courseDesc}</p></div><button class="plan-btn" style="width:auto; padding:10px 20px; font-size:11px;" onclick="window.open('${courseUrl}', '_blank')">View Options</button></div>
        </div>
        <div style="text-transform:uppercase; font-size:10px; letter-spacing:2px; color:var(--gray); margin-bottom:10px;">Ask an Expert</div>
        <div style="display:flex; flex-direction:column; gap:10px;">${premiumHtml}</div>
      </div>
    </div>
  `;
}

window.startBlueprint = startBlueprint;

function closeBlueprint() {
  const bp = document.getElementById("blueprint");
  if (bp) bp.classList.remove("active");
}
window.closeBlueprint = closeBlueprint;
