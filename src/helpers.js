/* ═════════════ 3D world (physically based) ═════════════ */
const G3 = { ok: !!window.THREE, anims: [] };
const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
addEventListener('pointermove', e => { mouse.tx = e.clientX / innerWidth * 2 - 1; mouse.ty = e.clientY / innerHeight * 2 - 1; });

const lin = c => new THREE.Color(c).convertSRGBToLinear();
function std(color, o = {}){
  const opts = Object.assign({ roughness: .8, metalness: 0 }, o);
  if (typeof opts.emissive === 'number') opts.emissive = lin(opts.emissive);
  return new THREE.MeshStandardMaterial(Object.assign(opts, { color: lin(color) }));
}
function mesh(geo, mat, cast = true){ const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; return m; }

/* Tileable procedural textures (detail, normals, water) */
function tileNoise(x, y, P){ const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf*xf*(3-2*xf), v = yf*yf*(3-2*yf);
  const h = (a, b) => hash(((a % P) + P) % P, ((b % P) + P) % P);
  const a = h(xi, yi), b = h(xi+1, yi), c = h(xi, yi+1), d = h(xi+1, yi+1); return a + (b-a)*u + (c-a)*v + (a-b-c+d)*u*v; }
function tileField(size, P, oct){ const f = new Float32Array(size * size);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++){ let s = 0, a = .5, fr = 1; for (let o = 0; o < oct; o++){ s += a * tileNoise(i / size * P * fr, j / size * P * fr, P * fr); fr *= 2; a *= .5; } f[j*size+i] = s; }
  return f; }
function normalTex(field, size, strength){
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'), img = g.createImageData(size, size);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++){
    const L = field[j*size + (i + size - 1) % size], R = field[j*size + (i + 1) % size], U = field[((j + size - 1) % size)*size + i], D = field[((j + 1) % size)*size + i];
    let nx = (L - R) * strength, ny = (U - D) * strength, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const o = (j*size + i) * 4; img.data[o] = (nx * .5 + .5) * 255; img.data[o+1] = (ny * .5 + .5) * 255; img.data[o+2] = (nz * .5 + .5) * 255; img.data[o+3] = 255;
  }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function grayTex(field, size, lo, hi){
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'), img = g.createImageData(size, size);
  for (let k = 0; k < field.length; k++){ const v = (lo + (hi - lo) * field[k]) * 255; img.data[k*4] = img.data[k*4+1] = img.data[k*4+2] = v; img.data[k*4+3] = 255; }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function woodTex(w, h, base, dark){
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < h / 3; i++){ g.strokeStyle = `rgba(${dark},${.05 + rnd() * .18})`; g.lineWidth = .6 + rnd() * 2.2; g.beginPath(); const y = rnd() * h; g.moveTo(0, y);
    for (let x = 0; x <= w; x += w / 8) g.lineTo(x, y + Math.sin(x * .01 + i) * 6 + (rnd() - .5) * 3); g.stroke(); }
  for (let k = 0; k < 6; k++){ const x = rnd() * w, y = rnd() * h; g.strokeStyle = `rgba(${dark},.35)`; for (let r = 4; r < 26; r += 4){ g.beginPath(); g.ellipse(x, y, r * 2.4, r, 0, 0, 7); g.stroke(); } }
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
}

function woodSign(text){
  const c = document.createElement('canvas'); c.width = 768; c.height = 240; const g = c.getContext('2d');
  g.fillStyle = '#9A6634'; g.fillRect(0, 0, 768, 240);
  for (let i = 0; i < 40; i++){ g.strokeStyle = `rgba(60,30,10,${.12 + rnd() * .2})`; g.lineWidth = 1 + rnd() * 2.5; g.beginPath(); const y = rnd() * 240; g.moveTo(0, y); g.bezierCurveTo(250, y + 10 * (rnd() - .5), 500, y + 10 * (rnd() - .5), 768, y); g.stroke(); }
  g.font = 'italic 92px "STIX Two Text", "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(255,220,170,.25)'; g.fillText(text, 386, 128, 720); g.fillStyle = '#26130A'; g.fillText(text, 384, 125, 720);
  const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 8;
  const s = new THREE.Group(), wood = std(0x7A4D26, { roughness: .9 });
  const post = mesh(new THREE.CylinderGeometry(.16, .2, 4.4, 10), wood); post.position.y = 2.2; s.add(post);
  const plank = mesh(new THREE.BoxGeometry(3.4, 1.05, .16), wood); plank.position.y = 3.6; s.add(plank);
  const faceM = new THREE.MeshStandardMaterial({ map: tex, roughness: .85 });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 1.0), faceM); face.position.set(0, 3.6, .085); s.add(face);
  const back = face.clone(); back.rotation.y = Math.PI; back.position.z = -.085; s.add(back);
  return s;
}

/* Vegetation */
function blobGeometry(detail = 2, amt = .28){
  const g = new THREE.IcosahedronGeometry(1, detail), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++){ v.fromBufferAttribute(p, i); const n = vnoise(v.x * 2.2 + 9, v.y * 2.2 + v.z * 1.7); v.multiplyScalar(1 + (n - .5) * amt * 2); p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return g;
}
function frondGeometry(){
  const pos = [], L = 3.8, n = 14;
  const sp = t => [0, -t * t * 1.7 + t * .3, t * L];
  for (let i = 0; i < n; i++){
    const t0 = i / n, t1 = (i + 1) / n, a = sp(t0), b = sp(t1), w = .95 * Math.sin(Math.PI * Math.min(1, t0 * 1.15 + .05));
    for (const s of [-1, 1]){ const tip = [a[0] + s * w, a[1] - .22, a[2] + .35]; pos.push(...a, ...(s > 0 ? b : tip), ...(s > 0 ? tip : b)); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
}
const FROND = () => (G3._frond || (G3._frond = frondGeometry()));
function palmTree(){
  const g = new THREE.Group(), bark = std(0xE8D2B0, { roughness: .95, map: G3.barkTex }), leafMat = std(0x3F8F38, { side: THREE.DoubleSide, roughness: .7 });
  const lean = .9 + rnd() * 1.4, hgt = 6 + rnd() * 2.5;
  const curve = new THREE.CatmullRomCurve3([V(0, 0, 0), V(lean * .2, hgt * .4, 0), V(lean * .7, hgt * .75, 0), V(lean, hgt, 0)]);
  g.add(mesh(new THREE.TubeGeometry(curve, 24, .24, 10), bark));
  for (let k = 1; k < 13; k++){ const p = curve.getPointAt(k / 13); const r = mesh(new THREE.TorusGeometry(.25, .045, 6, 14), bark); r.position.copy(p); r.rotation.x = Math.PI / 2; g.add(r); }
  const crown = new THREE.Group(); crown.position.copy(curve.getPointAt(1)); g.add(crown);
  for (let k = 0; k < 10; k++){ const f = mesh(FROND(), leafMat); f.rotation.order = 'YXZ'; f.rotation.y = k / 10 * Math.PI * 2 + rnd() * .3; f.rotation.x = -.15 - rnd() * .35; crown.add(f); }
  const nut = std(0x4A3018, { roughness: .6 });
  for (let k = 0; k < 4; k++){ const co = mesh(new THREE.SphereGeometry(.2, 12, 10), nut); co.position.set(Math.cos(k * 1.6) * .3, -.25, Math.sin(k * 1.6) * .3); crown.add(co); }
  g.userData.crown = crown; return g;
}
function cactus(){
  const g = new THREE.Group(), m = std(0x4C8A3A, { roughness: .65 }), h = 2 + rnd() * 2.4;
  const ribbed = (r, len) => { const geo = new THREE.CylinderGeometry(r, r * 1.05, len, 16, 4), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++){ const a = Math.atan2(p.getZ(i), p.getX(i)), k = 1 + .08 * Math.cos(a * 8); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } geo.computeVertexNormals(); return geo; };
  const tr = mesh(ribbed(.36, h), m); tr.position.y = h / 2; g.add(tr);
  const top = mesh(new THREE.SphereGeometry(.36, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), m); top.position.y = h; g.add(top);
  [-1, 1].forEach(s => { if (rnd() < .8){ const ay = h * (.35 + rnd() * .3), arm = new THREE.Group();
    const a1 = mesh(ribbed(.22, .8), m); a1.rotation.z = Math.PI / 2; a1.position.x = s * .5; arm.add(a1);
    const a2 = mesh(ribbed(.22, 1.2), m); a2.position.set(s * .9, .5, 0); arm.add(a2);
    const a3 = mesh(new THREE.SphereGeometry(.22, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), m); a3.position.set(s * .9, 1.1, 0); arm.add(a3);
    arm.position.y = ay; g.add(arm); } });
  if (rnd() < .4){ const fl = mesh(new THREE.SphereGeometry(.14, 10, 8), std(0xE85A8A)); fl.position.y = h + .3; g.add(fl); }
  return g;
}

/* Animals */
function crab(){
  const g = new THREE.Group(), red = std(0xD4502E, { roughness: .45 }), dark = std(0x8E2A16, { roughness: .5 });
  const b = mesh(new THREE.SphereGeometry(.55, 20, 14), red); b.scale.set(1, .45, .78); b.position.y = .35; g.add(b);
  const legs = [];
  for (let s of [-1, 1]) for (let i = 0; i < 3; i++){
    const leg = new THREE.Group(); leg.position.set((i - 1) * .3, .3, s * .38);
    const l = mesh(new THREE.CylinderGeometry(.045, .03, .6, 8), dark); l.rotation.x = Math.PI / 2 + s * .6; l.position.z = s * .26; l.position.y = -.08; leg.add(l); g.add(leg); legs.push(leg);
  }
  for (let s of [-1, 1]){
    const claw = mesh(new THREE.SphereGeometry(.22, 14, 10), red); claw.scale.set(1.4, .8, .9); claw.position.set(.72, .42, s * .32); g.add(claw);
    const stalk = mesh(new THREE.CylinderGeometry(.025, .025, .25, 6), dark); stalk.position.set(.4, .62, s * .14); g.add(stalk);
    const eye = mesh(new THREE.SphereGeometry(.065, 10, 8), std(0x111111, { roughness: .2 })); eye.position.set(.4, .76, s * .14); g.add(eye);
  }
  g.userData.legs = legs; return g;
}
function turtle(){
  const g = new THREE.Group(), shell = std(0x4D6E36, { roughness: .45 }), skin = std(0x8DA66B, { roughness: .6 });
  const sg = new THREE.SphereGeometry(1.2, 24, 16), p = sg.attributes.position;
  for (let i = 0; i < p.count; i++){ const x = p.getX(i), z = p.getZ(i); const plate = Math.abs(Math.sin(x * 4) * Math.sin(z * 4)) * .05; p.setY(i, p.getY(i) * (1 + plate)); }
  sg.computeVertexNormals();
  const s = mesh(sg, shell); s.scale.set(1.3, .42, 1); g.add(s);
  const h = mesh(new THREE.SphereGeometry(.38, 16, 12), skin); h.scale.set(1.3, .9, .9); h.position.set(1.75, .05, 0); g.add(h);
  const fl = [];
  [[.7, 1], [.7, -1], [-.9, 1], [-.9, -1]].forEach(([x, z]) => { const pv = new THREE.Group(); pv.position.set(x, 0, z * .9); const f = mesh(new THREE.SphereGeometry(.5, 14, 10), skin); f.scale.set(.6, .12, 1.1); f.position.z = z * .5; pv.add(f); g.add(pv); fl.push({ p: pv, z }); });
  g.userData.fl = fl; return g;
}
function sharkFin(){
  const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(1.6, 0); s.quadraticCurveTo(.4, .6, -.3, 1.7); s.lineTo(0, 0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: .12, bevelEnabled: true, bevelThickness: .05, bevelSize: .05, bevelSegments: 3, curveSegments: 16 }); geo.translate(-.6, 0, -.06);
  return mesh(geo, std(0x56656E, { roughness: .35 }));
}
function bird(body, wing, beakCol, size = 1){
  const g = new THREE.Group(), bm = std(body, { roughness: .6 }), wm = std(wing, { roughness: .6, side: THREE.DoubleSide });
  const b = mesh(new THREE.SphereGeometry(.32, 18, 12), bm); b.scale.set(1.7, .9, .9); g.add(b);
  const h = mesh(new THREE.SphereGeometry(.24, 16, 12), bm); h.position.set(.55, .15, 0); g.add(h);
  const beak = mesh(new THREE.ConeGeometry(.09, .3, 12), std(beakCol, { roughness: .4 })); beak.rotation.z = -Math.PI / 2; beak.position.set(.82, .1, 0); g.add(beak);
  for (const s of [-1, 1]){ const e = mesh(new THREE.SphereGeometry(.04, 8, 6), std(0x111111, { roughness: .1 })); e.position.set(.68, .22, s * .14); g.add(e); }
  const tail = mesh(new THREE.ConeGeometry(.16, .9, 4), wm); tail.rotation.z = Math.PI / 2; tail.scale.z = .3; tail.position.set(-.85, -.05, 0); g.add(tail);
  const wings = [];
  for (let s of [-1, 1]){ const p = new THREE.Group();
    const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.quadraticCurveTo(.35, s * .9, -.1, s * 1.6); shape.lineTo(-.45, s * 1.1); shape.quadraticCurveTo(-.45, s * .4, -.3, 0);
    const wg = new THREE.ShapeGeometry(shape, 12); wg.rotateX(Math.PI / 2); const w = mesh(wg, wm); p.add(w); g.add(p); wings.push({ p, s }); }
  g.scale.setScalar(size); g.userData.wings = wings; return g;
}
function monkey(){
  const g = new THREE.Group(), fur = std(0x6B4424, { roughness: .9 }), face = std(0xD9B48A, { roughness: .7 });
  const b = mesh(new THREE.SphereGeometry(.55, 20, 14), fur); b.scale.set(.9, 1.1, .8); b.position.y = .7; g.add(b);
  const h = mesh(new THREE.SphereGeometry(.38, 20, 14), fur); h.position.y = 1.55; g.add(h);
  const f = mesh(new THREE.SphereGeometry(.26, 16, 12), face); f.position.set(.22, 1.5, 0); f.scale.set(.6, .9, 1); g.add(f);
  for (let s of [-1, 1]){ const e = mesh(new THREE.SphereGeometry(.14, 12, 10), face); e.position.set(0, 1.6, s * .38); g.add(e);
    const eye = mesh(new THREE.SphereGeometry(.045, 8, 6), std(0x111111, { roughness: .1 })); eye.position.set(.36, 1.6, s * .09); g.add(eye); }
  const arm = new THREE.Group(); arm.position.set(0, 1.05, -.42); const a = mesh(new THREE.CylinderGeometry(.09, .08, .8, 10), fur); a.position.y = .4; arm.add(a); g.add(arm);
  const arm2 = mesh(new THREE.CylinderGeometry(.09, .08, .8, 10), fur); arm2.position.set(.2, .8, .42); arm2.rotation.x = .5; g.add(arm2);
  const tailPts = [[-.4,.3,0],[-.9,.2,0],[-1.2,.6,0],[-1.1,1.1,0],[-.8,1.2,0]].map(p => V(...p));
  g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tailPts), 30, .07, 8), fur));
  g.userData.arm = arm; return g;
}
function snake(){
  const g = new THREE.Group(), segs = [], n = 30;
  const a = std(0x4F7F2E, { roughness: .35 }), b = std(0xC9A632, { roughness: .35 });
  for (let i = 0; i < n; i++){ const r = .26 * (1 - i / n * .75) + .04; const s = mesh(new THREE.SphereGeometry(r, 14, 10), i % 5 < 3 ? a : b); s.scale.set(1.3, .8, 1); g.add(s); segs.push(s); }
  for (let k of [-1, 1]){ const e = mesh(new THREE.SphereGeometry(.05, 8, 6), std(0x111111, { roughness: .1 })); e.position.set(.18, .14, k * .12); segs[0].add(e); }
  g.userData.segs = segs; return g;
}
function camel(){
  const g = new THREE.Group(), fur = std(0xC79A5C, { roughness: .95 }), dark = std(0x8E6A3B, { roughness: .95 });
  const b = mesh(new THREE.SphereGeometry(1, 24, 16), fur); b.scale.set(1.35, .62, .6); b.position.y = 2.25; g.add(b);
  const hump = mesh(new THREE.SphereGeometry(.65, 20, 14), fur); hump.position.set(-.1, 2.75, 0); hump.scale.set(1.2, 1, .9); g.add(hump);
  const neck = mesh(new THREE.CylinderGeometry(.2, .32, 1.7, 12), fur); neck.position.set(1.45, 2.85, 0); neck.rotation.z = -.6; g.add(neck);
  const head = mesh(new THREE.SphereGeometry(.3, 16, 12), fur); head.scale.set(1.6, .8, .8); head.position.set(2.05, 3.55, 0); g.add(head);
  for (const s of [-1, 1]){ const ear = mesh(new THREE.ConeGeometry(.06, .2, 6), dark); ear.position.set(1.85, 3.78, s * .14); g.add(ear); }
  const legs = [];
  [[.85, .3], [.85, -.3], [-.85, .3], [-.85, -.3]].forEach(([x, z], i) => { const p = new THREE.Group(); p.position.set(x, 1.95, z); const l = mesh(new THREE.CylinderGeometry(.13, .09, 1.9, 10), dark); l.position.y = -.95; p.add(l); g.add(p); legs.push({ p, ph: i % 3 === 0 ? 0 : Math.PI }); });
  const blanket = mesh(new THREE.BoxGeometry(1.1, .06, 1.25), std(0xA3231B, { roughness: .9 })); blanket.position.set(.55, 2.62, 0); g.add(blanket);
  g.userData.legs = legs; return g;
}

function buildChest(){
  const g = new THREE.Group(), wood = std(0xF0D0A8, { roughness: .8, map: G3.chestWood }), band = std(0xD9A83A, { metalness: .9, roughness: .3 });
  const box = mesh(new THREE.BoxGeometry(2.6, 1.5, 1.7), wood); box.position.y = .75; g.add(box);
  [-1, 1].forEach(s => { const b = mesh(new THREE.BoxGeometry(.16, 1.56, 1.76), band); b.position.set(s * .9, .75, 0); g.add(b); });
  const lock = mesh(new THREE.BoxGeometry(.35, .42, .1), band); lock.position.set(0, 1.25, .88); g.add(lock);
  const coinM = std(0xF0C24A, { metalness: 1, roughness: .22, emissive: 0x3A2600 });
  const coins = new THREE.InstancedMesh(new THREE.CylinderGeometry(.2, .2, .05, 16), coinM, 90), d = new THREE.Object3D();
  for (let i = 0; i < 90; i++){ d.position.set((rnd() - .5) * 2.2, 1.42 + rnd() * .3, (rnd() - .5) * 1.4); d.rotation.set(rnd() * .8, rnd() * 6, rnd() * .8); d.updateMatrix(); coins.setMatrixAt(i, d.matrix); }
  g.add(coins);
  const gems = [0xC0182A, 0x1F9A5A, 0x2650C8]; for (let i = 0; i < 6; i++){ const gm = mesh(new THREE.OctahedronGeometry(.16), std(gems[i % 3], { metalness: .1, roughness: .05 })); gm.position.set((rnd() - .5) * 1.8, 1.65, (rnd() - .5) * 1.1); g.add(gm); }
  const pivot = new THREE.Group(); pivot.position.set(0, 1.5, -.85);
  const lidGeo = new THREE.CylinderGeometry(.85, .85, 2.6, 32, 1, false, 0, Math.PI); lidGeo.rotateZ(Math.PI / 2); lidGeo.rotateX(Math.PI / 2); lidGeo.translate(0, 0, .85);
  pivot.add(mesh(lidGeo, wood));
  [-1, 1].forEach(s => { const bg = new THREE.CylinderGeometry(.88, .88, .16, 32, 1, false, 0, Math.PI); bg.rotateZ(Math.PI / 2); bg.rotateX(Math.PI / 2); bg.translate(s * .9, 0, .85); pivot.add(mesh(bg, band)); });
  g.add(pivot);
  const light = new THREE.PointLight(0xFFC060, 0, 22, 2); light.position.set(0, 2.6, 0); g.add(light);
  g.userData = { pivot, light };
  return g;
}

