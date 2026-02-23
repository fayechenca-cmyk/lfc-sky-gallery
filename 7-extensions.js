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
