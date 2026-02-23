// ==========================================
// 4. THREE.JS SCENE
// ==========================================
const container = document.getElementById("canvas-container");
const scene = new THREE.Scene();
const skyColor = new THREE.Color(0xf0f9ff);
scene.background = skyColor;
scene.fog = new THREE.Fog(skyColor, 15, 140);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
      window.scene = scene;
      window.camera = camera;
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
// 7. INTERACTION & CAMERA MOVEMENT
// ==========================================

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

  // Record visit for My Journey
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
