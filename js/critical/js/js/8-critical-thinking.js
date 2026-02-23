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
    
    // ✅ Supabase Guard applied here!
    try {
      if (typeof supabaseClient !== 'undefined' && supabaseClient) {
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
      saveBtn.addEventListener('click', async function(){ // ✅ FIX: made async for Supabase wait
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
        
        // ✅ Supabase Guard applied here!
        try {
          if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            await supabaseClient.from('judgment_cards').insert([{
              user_id: (window.LFC_VISITOR && window.LFC_VISITOR.id) ? window.LFC_VISITOR.id : 'unknown',
              artwork_id: art2.title,
              level: 1,
              first_choice: resp.first_impression || '',
              second_choice: resp.time_spent || '',
              sentence: resp.one_sentence || '',
              created_at: new Date().toISOString()
            }]);
          }
        } catch(err) { console.warn('[LFC] Supabase save failed:', err); }
        
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
      saveBtn.addEventListener('click', async function(){ // ✅ FIX: made async for Supabase wait
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
        
        // ✅ Supabase Guard applied here!
        try {
          if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            await supabaseClient.from('judgment_cards').insert([{
              user_id: (window.LFC_VISITOR && window.LFC_VISITOR.id) ? window.LFC_VISITOR.id : 'unknown',
              artwork_id: art2.title,
              level: 2,
              first_choice: card.responses.change_one || '',
              second_choice: card.responses.impact || '',
              sentence: card.responses.why || '',
              created_at: new Date().toISOString()
            }]);
          }
        } catch(err) { console.warn('[LFC] Supabase save failed:', err); }
        
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
