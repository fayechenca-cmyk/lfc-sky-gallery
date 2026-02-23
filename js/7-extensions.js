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
