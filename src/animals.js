/* ═════════════ High-detail wildlife (replaces the simple versions above) ═════════════ */
/* sculpted body: a smooth lathe along +x, from tail (x=0) to nose (x=len) */
function lathe(len, prof, segs = 48, radial = 28){
  const pts = []; for (let i = 0; i <= segs; i++){ const t = i / segs; pts.push(new THREE.Vector2(Math.max(.0005, prof(t)), t * len)); }
  const g = new THREE.LatheGeometry(pts, radial); g.rotateZ(-Math.PI / 2); g.computeVertexNormals(); return g;
}
/* tube whose radius tapers from r0 to r1 */
function taperTube(curve, segs, radial, r0, r1){
  const g = new THREE.TubeGeometry(curve, segs, r0, radial, false), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i <= segs; i++){ const c = curve.getPointAt(i / segs), k = (r0 + (r1 - r0) * (i / segs)) / r0;
    for (let j = 0; j <= radial; j++){ const idx = i * (radial + 1) + j; v.fromBufferAttribute(p, idx).sub(c).multiplyScalar(k).add(c); p.setXYZ(idx, v.x, v.y, v.z); } }
  g.computeVertexNormals(); return g;
}
function eyeBall(r, iris = 0x2A1A0A){
  const g = new THREE.Group();
  g.add(mesh(new THREE.SphereGeometry(r, 18, 14), std(0xEFE6D2, { roughness: .25 }), false));
  const ir = mesh(new THREE.SphereGeometry(r * .7, 18, 14), std(iris, { roughness: .15 }), false); ir.position.x = r * .42; g.add(ir);
  const pu = mesh(new THREE.SphereGeometry(r * .42, 14, 10), std(0x050403, { roughness: .05 }), false); pu.position.x = r * .66; g.add(pu);
  const hl = new THREE.Mesh(new THREE.SphereGeometry(r * .14, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff })); hl.position.set(r * .9, r * .32, r * .18); g.add(hl);
  return g;
}
/* grayscale detail textures shared by every animal (tinted by material colour) */
function grayCanvas(S, draw){ const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'); g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, S, S); draw(g, S); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; }
function animalTextures(){
  if (G3.animTex) return G3.animTex;
  const S = small ? 256 : 512;
  const feather = grayCanvas(S, (g, S) => { const w = S / 10, h = S / 14;
    for (let r = 0; r < 16; r++) for (let c = 0; c < 11; c++){ const x = c * w + (r % 2) * w / 2, y = r * h;
      const gr = g.createLinearGradient(x, y - h, x, y + h * .4); gr.addColorStop(0, '#e6e6e6'); gr.addColorStop(.8, '#bdbdbd'); gr.addColorStop(1, '#8a8a8a');
      g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, w * .55, h * 1.15, 0, 0, Math.PI); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + h); g.stroke(); } });
  const fur = grayCanvas(S, (g, S) => { for (let i = 0; i < S * 26; i++){ const x = rnd() * S, y = rnd() * S, l = 3 + rnd() * 7, a = Math.PI / 2 + (rnd() - .5) * .5, v = 150 + rnd() * 105;
      g.strokeStyle = `rgba(${v},${v},${v},.5)`; g.lineWidth = .8 + rnd(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); } });
  const scales = grayCanvas(S, (g, S) => { const w = S / 16;
    for (let r = 0; r < 34; r++) for (let c = 0; c < 18; c++){ const x = c * w + (r % 2) * w / 2, y = r * w * .5;
      const gr = g.createRadialGradient(x, y - w * .1, 0, x, y, w * .62); gr.addColorStop(0, '#f2f2f2'); gr.addColorStop(.75, '#b4b4b4'); gr.addColorStop(1, '#6a6a6a');
      g.fillStyle = gr; g.beginPath(); g.moveTo(x, y - w * .5); g.lineTo(x + w * .5, y); g.lineTo(x, y + w * .5); g.lineTo(x - w * .5, y); g.closePath(); g.fill(); } });
  const shell = grayCanvas(S, (g, S) => { const R = S / 6;
    for (let r = -1; r < 5; r++) for (let c = -1; c < 5; c++){ const x = c * R * 1.5, y = r * R * 1.73 + (c % 2) * R * .86;
      const gr = g.createRadialGradient(x, y, 0, x, y, R); gr.addColorStop(0, '#f0f0f0'); gr.addColorStop(.6, '#c0c0c0'); gr.addColorStop(.93, '#8c8c8c'); gr.addColorStop(1, '#3c3c3c');
      g.fillStyle = gr; g.beginPath(); for (let k = 0; k < 6; k++){ const a = k / 6 * Math.PI * 2; g.lineTo(x + Math.cos(a) * R * .97, y + Math.sin(a) * R * .97); } g.closePath(); g.fill();
      g.strokeStyle = 'rgba(70,70,70,.35)'; g.lineWidth = 1.5; for (let q = .35; q < .95; q += .2){ g.beginPath(); for (let k = 0; k <= 6; k++){ const a = k / 6 * Math.PI * 2; g.lineTo(x + Math.cos(a) * R * q, y + Math.sin(a) * R * q); } g.stroke(); } } });
  const speck = grayCanvas(S, (g, S) => { for (let i = 0; i < S * 6; i++){ const v = rnd() < .5 ? 90 : 240; g.fillStyle = `rgba(${v},${v},${v},${rnd() * .4})`; g.beginPath(); g.arc(rnd() * S, rnd() * S, .6 + rnd() * 2.4, 0, 7); g.fill(); } });
  G3.animTex = { feather, fur, scales, shell, speck };
  return G3.animTex;
}
const furMat = (color, o = {}) => std(color, Object.assign({ map: animalTextures().fur, roughness: .9 }, o));
const glossy = (color, map, o = {}) => { const m = new THREE.MeshPhysicalMaterial(Object.assign({ color: lin(color), roughness: .38, clearcoat: .8, clearcoatRoughness: .25, map }, o)); return m; };

/* Feather card for wings and tails */
function featherGeo(L, W){
  const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(W, L * .25, W * .55, L * .85); s.quadraticCurveTo(0, L * 1.05, -W * .4, L * .8); s.quadraticCurveTo(-W * .7, L * .3, 0, 0);
  const g = new THREE.ShapeGeometry(s, 10); g.rotateX(Math.PI / 2); return g;  // points along +z
}
function bird(body, wing, beakCol, size = 1){
  const T = animalTextures(), g = new THREE.Group();
  const bm = std(body, { map: T.feather, roughness: .75 }), wm = std(wing, { map: T.feather, roughness: .75, side: THREE.DoubleSide });
  const tipCol = beakCol === 0xF2C230 ? 0xF2C230 : wing, tm = std(tipCol, { roughness: .75, side: THREE.DoubleSide, map: T.feather });
  const torso = mesh(lathe(1.25, t => .3 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), .75) * (t > .7 ? .82 : 1)), bm); torso.geometry.translate(-.7, 0, 0); torso.scale.set(1, .95, .9); g.add(torso);
  const head = mesh(new THREE.SphereGeometry(.24, 28, 20), bm); head.scale.set(1.1, 1, .95); head.position.set(.58, .16, 0); g.add(head);
  const bg = new THREE.ConeGeometry(.085, .3, 18, 6); bg.rotateZ(-Math.PI / 2); { const p = bg.attributes.position; for (let i = 0; i < p.count; i++){ const x = p.getX(i) + .15; p.setY(i, p.getY(i) - x * x * .9); } bg.computeVertexNormals(); }
  const beak = mesh(bg, std(beakCol, { roughness: .35 })); beak.position.set(.84, .14, 0); g.add(beak);
  for (const s of [-1, 1]){ const e = eyeBall(.055, 0x3A2508); e.position.set(.7, .23, s * .15); e.rotation.y = -s * .9; g.add(e); }
  // tail feathers
  for (let k = 0; k < 5; k++){ const f = mesh(featherGeo(1.0 + (k === 2 ? .25 : 0), .14), k % 2 ? tm : wm); f.rotation.set(0, -Math.PI / 2 + (k - 2) * .1, 0); f.position.set(-.62, -.02 + k * .004, (k - 2) * .03); g.add(f); }
  // wings: fanned flight feathers on a pivot
  const wings = [];
  for (let s of [-1, 1]){ const p = new THREE.Group(); p.position.set(.05, .1, s * .2);
    for (let k = 0; k < 8; k++){ const L = .7 + k * .09, f = mesh(featherGeo(L, .16), k > 4 ? tm : wm); f.rotation.set(0, (-.15 - k * .09) * s * -1 + (s < 0 ? Math.PI : 0), 0);
      if (s < 0) f.scale.z = 1; f.position.set(-k * .045, 0, 0); p.add(f); }
    const cov = mesh(new THREE.SphereGeometry(.22, 16, 10), bm); cov.scale.set(1.5, .25, 1.7); cov.position.z = s * .2; p.add(cov);
    g.add(p); wings.push({ p, s }); }
  for (const s of [-1, 1]){ const leg = mesh(new THREE.CylinderGeometry(.025, .02, .18, 6), std(0x4A4038)); leg.position.set(-.05, -.3, s * .08); g.add(leg); }
  g.scale.setScalar(size); g.userData.wings = wings; return g;
}
function bat(){
  const g = new THREE.Group(), fur = furMat(0x2A211B), mem = std(0x3A2A22, { side: THREE.DoubleSide, roughness: .55 });
  const b = mesh(lathe(.6, t => .14 * Math.pow(Math.sin(Math.PI * t), .7)), fur); b.geometry.translate(-.3, 0, 0); g.add(b);
  const h = mesh(new THREE.SphereGeometry(.1, 16, 12), fur); h.position.x = .33; g.add(h);
  for (const s of [-1, 1]){ const ear = mesh(new THREE.ConeGeometry(.04, .12, 8), fur); ear.position.set(.32, .1, s * .05); g.add(ear); }
  const wings = [];
  for (const s of [-1, 1]){ const p = new THREE.Group(); p.position.z = s * .08;
    // membrane drawn directly in the horizontal plane: finger tips with scalloped edges
    const tips = [[.12, .05], [.06, .95], [-.1, .8], [-.22, .62], [-.3, .3], [-.2, .02]], pos = [];
    for (let k = 0; k < tips.length - 1; k++){ const a0 = tips[k], a1 = tips[k + 1]; pos.push(0, 0, 0, a0[0], 0, a0[1] * s, a1[0], 0, a1[1] * s); }
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); wg.computeVertexNormals();
    p.add(mesh(wg, mem));
    for (const [tx, tz] of tips.slice(1, 5)){ const bone = mesh(new THREE.CylinderGeometry(.008, .012, 1, 5), fur, false); const L = Math.hypot(tx, tz); bone.scale.y = L; bone.position.set(tx / 2, .005, tz * s / 2); bone.rotation.set(Math.PI / 2, 0, 0); bone.lookAt(tx, .005, tz * s); bone.rotateX(Math.PI / 2); p.add(bone); }
    g.add(p); wings.push({ p, s }); }
  g.userData.wings = wings; return g;
}
function crab(){
  const T = animalTextures(), g = new THREE.Group(), shellM = glossy(0xD4502E, T.speck), dark = glossy(0xA83A1E, T.speck, { roughness: .45 }), tipM = std(0x2A1208, { roughness: .4 });
  const cg = new THREE.SphereGeometry(.6, 40, 24); { const p = cg.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++){ v.fromBufferAttribute(p, i); const n = vnoise(v.x * 6 + 3, v.z * 6) * .05; v.multiplyScalar(1 + n); if (v.y < 0) v.y *= .5; p.setXYZ(i, v.x, v.y, v.z); } cg.computeVertexNormals(); }
  const shell = mesh(cg, shellM); shell.scale.set(1.15, .46, .95); shell.position.y = .42; g.add(shell);
  const legs = [];
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++){
    const hip = new THREE.Group(); hip.position.set(.25 - i * .22, .36, s * .45); hip.rotation.y = s * (.2 - i * .25) * -1;
    const up = mesh(taperTube(new THREE.CatmullRomCurve3([V(0, 0, 0), V(0, .18, s * .3), V(0, .22, s * .45)]), 10, 8, .055, .045), dark); hip.add(up);
    const lo = mesh(taperTube(new THREE.CatmullRomCurve3([V(0, .22, s * .45), V(0, .05, s * .62), V(0, -.33, s * .72)]), 12, 8, .045, .012), dark); hip.add(lo);
    g.add(hip); legs.push(hip); }
  const claws = [];
  for (const s of [-1, 1]){ const arm = new THREE.Group(); arm.position.set(.55, .42, s * .3);
    arm.add(mesh(taperTube(new THREE.CatmullRomCurve3([V(0, 0, 0), V(.25, .08, s * .18), V(.42, .12, s * .2)]), 10, 8, .07, .08), dark));
    const palm = mesh(lathe(.42, t => .14 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.1)), .6)), shellM); palm.position.set(.42, .12, s * .2); palm.scale.set(1, .8, .65); arm.add(palm);
    const fixed = mesh(new THREE.ConeGeometry(.05, .26, 10), tipM); fixed.rotation.z = -Math.PI / 2; fixed.position.set(.92, .15, s * .2); arm.add(fixed);
    const finger = new THREE.Group(); finger.position.set(.75, .08, s * .2); const fm = mesh(new THREE.ConeGeometry(.045, .26, 10), tipM); fm.rotation.z = -Math.PI / 2 - .25; fm.position.x = .13; finger.add(fm); arm.add(finger);
    g.add(arm); claws.push(finger); }
  for (const s of [-1, 1]){ const st = mesh(new THREE.CylinderGeometry(.022, .028, .26, 8), dark); st.position.set(.48, .66, s * .12); st.rotation.z = -.25; g.add(st);
    const e = eyeBall(.055, 0x111111); e.position.set(.52, .81, s * .12); g.add(e); }
  g.userData = { legs, claws }; return g;
}
function turtle(){
  const T = animalTextures(), g = new THREE.Group(), shellM = glossy(0x5E6E36, T.shell, { roughness: .45, clearcoat: .6 }), skin = std(0x8DA66B, { map: T.scales, roughness: .6 });
  const sg = new THREE.SphereGeometry(1.2, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2); sg.scale(1.3, .5, 1.05);
  const s = mesh(sg, shellM); g.add(s);
  const pl = mesh(new THREE.CircleGeometry(1.2, 40), std(0xD8C890, { roughness: .7 })); pl.rotation.x = Math.PI / 2; pl.scale.set(1.25, 1, 1); pl.position.y = -.02; g.add(pl);
  const head = mesh(lathe(1.0, t => t < .55 ? .2 : .28 * Math.pow(Math.sin(Math.PI * Math.min(1, (t - .3) / .7)), .55)), skin); head.position.set(1.15, .05, 0); g.add(head);
  for (const k of [-1, 1]){ const e = eyeBall(.06, 0x1A1208); e.position.set(1.95, .16, k * .17); e.rotation.y = -k * .8; g.add(e); }
  const fl = [];
  const flipper = (L, W) => { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(W, L * .3, W * .3, L); sh.quadraticCurveTo(-W * .1, L * .6, -W * .35, 0); const geo = new THREE.ExtrudeGeometry(sh, { depth: .05, bevelEnabled: true, bevelThickness: .03, bevelSize: .03, bevelSegments: 3, curveSegments: 16 }); geo.rotateX(Math.PI / 2); return geo; };
  [[.75, 1, 1.25], [.75, -1, 1.25], [-.95, 1, .7], [-.95, -1, .7]].forEach(([x, z, L]) => { const p = new THREE.Group(); p.position.set(x, -.05, z * .95);
    const f = mesh(flipper(L, .55), skin); f.rotation.y = z > 0 ? 0 : Math.PI; f.scale.z = z; p.add(f); g.add(p); fl.push({ p, z }); });
  g.userData.fl = fl; return g;
}
function monkey(){
  const T = animalTextures(), g = new THREE.Group(), fur = furMat(0x6B4424), face = std(0xD9B48A, { roughness: .6 });
  const torso = mesh(lathe(1.1, t => .42 * Math.pow(Math.sin(Math.PI * t), .6) * (1 - t * .25)), fur); torso.rotation.z = Math.PI / 2; torso.position.y = .25; g.add(torso);
  const belly = mesh(new THREE.SphereGeometry(.3, 20, 14), face); belly.scale.set(.5, 1.1, .9); belly.position.set(.22, .7, 0); g.add(belly);
  const head = mesh(new THREE.SphereGeometry(.34, 32, 24), fur); head.position.y = 1.55; g.add(head);
  const mask = mesh(new THREE.SphereGeometry(.27, 28, 20), face); mask.scale.set(.55, .9, 1); mask.position.set(.2, 1.53, 0); g.add(mask);
  const muzzle = mesh(new THREE.SphereGeometry(.15, 20, 14), face); muzzle.scale.set(.9, .7, 1.1); muzzle.position.set(.36, 1.43, 0); g.add(muzzle);
  for (const s of [-1, 1]){ const ear = mesh(new THREE.TorusGeometry(.09, .045, 10, 16), face); ear.position.set(0, 1.62, s * .34); ear.rotation.y = Math.PI / 2; g.add(ear);
    const e = eyeBall(.055, 0x2A1608); e.position.set(.36, 1.62, s * .1); e.rotation.y = -s * .3; g.add(e);
    const nos = mesh(new THREE.SphereGeometry(.018, 8, 6), std(0x2A1A10)); nos.position.set(.5, 1.46, s * .035); g.add(nos); }
  const limb = (a, b, r0, r1) => mesh(taperTube(new THREE.CatmullRomCurve3([a, a.clone().lerp(b, .5).add(V(.04, 0, 0)), b]), 10, 10, r0, r1), fur);
  const arm = new THREE.Group(); arm.position.set(0, 1.1, -.4); arm.add(limb(V(0, 0, 0), V(0, .45, -.05), .1, .08), limb(V(0, .45, -.05), V(.05, .85, 0), .08, .06));
  const hand = mesh(new THREE.SphereGeometry(.08, 12, 10), face); hand.position.set(.05, .9, 0); arm.add(hand); g.add(arm);
  g.add(limb(V(0, 1.1, .4), V(.25, .7, .45), .1, .08), limb(V(.25, .7, .45), V(.4, .45, .3), .08, .06));
  for (const s of [-1, 1]) g.add(limb(V(0, .35, s * .25), V(.45, .3, s * .3), .14, .1), limb(V(.45, .3, s * .3), V(.4, 0, s * .32), .1, .07));
  const tc = new THREE.CatmullRomCurve3([V(-.35, .25, 0), V(-.9, .15, 0), V(-1.25, .55, 0), V(-1.15, 1.05, 0), V(-.82, 1.12, 0), V(-.75, .9, 0)]);
  g.add(mesh(taperTube(tc, 48, 10, .07, .025), fur));
  g.userData.arm = arm; return g;
}
function snake(){
  const T = animalTextures(), g = new THREE.Group(), segs = [], n = 30;
  for (let i = 0; i < n; i++){ const s = new THREE.Object3D(); g.add(s); segs.push(s); }
  const R = 12, rings = n, pos = new Float32Array(rings * (R + 1) * 3), uv = new Float32Array(rings * (R + 1) * 2), idx = [];
  for (let i = 0; i < rings; i++) for (let j = 0; j <= R; j++){ uv[(i * (R + 1) + j) * 2] = j / R; uv[(i * (R + 1) + j) * 2 + 1] = i / 3; }
  for (let i = 0; i < rings - 1; i++) for (let j = 0; j < R; j++){ const a = i * (R + 1) + j, b = a + R + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx);
  const skin = glossy(0x5E8A34, T.scales, { roughness: .35, clearcoat: 1 });
  const body = new THREE.Mesh(geo, skin); body.castShadow = true; body.frustumCulled = false; g.add(body);
  const t = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), side = new THREE.Vector3(), nrm = new THREE.Vector3();
  body.onBeforeRender = () => {
    for (let i = 0; i < rings; i++){ const p = segs[i].position, q = segs[Math.min(rings - 1, i + 1)].position, pr = segs[Math.max(0, i - 1)].position;
      t.subVectors(pr, q).normalize(); side.crossVectors(t, up).normalize(); nrm.crossVectors(side, t).normalize();
      const f = i / (rings - 1), r = (i < 2 ? .16 + i * .05 : .27 * (1 - f * .85)) + .02;
      for (let j = 0; j <= R; j++){ const a = j / R * Math.PI * 2, cx = Math.cos(a) * r, cy = Math.sin(a) * r * .8, o = (i * (R + 1) + j) * 3;
        pos[o] = p.x + side.x * cx + nrm.x * cy; pos[o + 1] = p.y + side.y * cx + nrm.y * cy + .02; pos[o + 2] = p.z + side.z * cx + nrm.z * cy; } }
    geo.attributes.position.needsUpdate = true; geo.computeVertexNormals();
  };
  // head rides on segs[0] (which the animation points forward along +z)
  const headG = lathe(.5, x => .2 * Math.pow(Math.sin(Math.PI * Math.min(1, x * .95 + .05)), .45) * (1 - x * .35)); headG.rotateY(-Math.PI / 2); headG.translate(0, 0, -.05); headG.scale(1.15, .7, 1);
  const head = mesh(headG, skin); segs[0].add(head);
  for (const k of [-1, 1]){ const e = eyeBall(.045, 0xC8A020); e.position.set(k * .12, .07, .28); e.rotation.y = Math.PI / 2 * -k * .6 - Math.PI / 2 * 0; segs[0].add(e); }
  const tongue = mesh(new THREE.BoxGeometry(.015, .01, .22), std(0xB0203A)); tongue.position.set(0, -.02, .55); segs[0].add(tongue); g.userData.tongue = tongue;
  g.userData.segs = segs; return g;
}
function camel(){
  const g = new THREE.Group(), fur = furMat(0xC79A5C), dark = furMat(0x9E7442), hoof = std(0x3A2A1A, { roughness: .6 });
  const bg = lathe(2.7, t => .62 * Math.pow(Math.sin(Math.PI * t), .55) * (1 + .12 * Math.sin(Math.PI * t))), p = bg.attributes.position, nv = bg.attributes.normal;
  for (let i = 0; i < p.count; i++){ const x = p.getX(i), up = Math.max(0, nv.getY(i)); p.setY(i, p.getY(i) + 1.0 * Math.exp(-Math.pow((x - 1.25) / .45, 2)) * Math.pow(up, 1.5)); }
  bg.computeVertexNormals(); bg.translate(-1.3, 0, 0); const body = mesh(bg, fur); body.scale.set(1, .95, .82); body.position.y = 2.3; g.add(body);
  const neck = mesh(taperTube(new THREE.CatmullRomCurve3([V(1.1, 2.35, 0), V(1.55, 2.3, 0), V(1.85, 2.8, 0), V(1.95, 3.45, 0)]), 24, 14, .3, .17), fur); g.add(neck);
  const head = mesh(lathe(.85, t => .22 * Math.pow(Math.sin(Math.PI * Math.min(1, t * .9 + .1)), .5) * (1 - t * .3)), fur); head.position.set(1.85, 3.5, 0); head.rotation.z = -.15; g.add(head);
  for (const s of [-1, 1]){ const ear = mesh(new THREE.ConeGeometry(.05, .18, 8), dark); ear.position.set(1.9, 3.75, s * .12); g.add(ear);
    const e = eyeBall(.05, 0x1A1008); e.position.set(2.2, 3.62, s * .16); e.rotation.y = -s * .7; g.add(e); }
  const legs = [];
  [[.85, .32], [.85, -.32], [-.85, .32], [-.85, -.32]].forEach(([x, z], i) => { const hip = new THREE.Group(); hip.position.set(x, 2.05, z);
    hip.add(mesh(taperTube(new THREE.CatmullRomCurve3([V(0, .1, 0), V(0, -.5, 0), V(0, -.95, 0)]), 10, 10, .2, .11), fur));
    const knee = new THREE.Group(); knee.position.y = -.95;
    knee.add(mesh(new THREE.SphereGeometry(.12, 12, 10), dark), mesh(taperTube(new THREE.CatmullRomCurve3([V(0, 0, 0), V(0, -.5, 0), V(0, -.95, 0)]), 10, 10, .1, .085), dark));
    const hf = mesh(new THREE.CylinderGeometry(.16, .18, .1, 16), hoof); hf.position.y = -1.0; knee.add(hf); hip.add(knee);
    g.add(hip); legs.push({ p: hip, knee, ph: i % 3 === 0 ? 0 : Math.PI }); });
  const tail = mesh(taperTube(new THREE.CatmullRomCurve3([V(-1.35, 2.5, 0), V(-1.5, 2.1, 0), V(-1.5, 1.6, 0)]), 12, 8, .06, .03), dark); g.add(tail);
  const blanket = mesh(new THREE.BoxGeometry(1.0, .05, 1.25), std(0xA3231B, { roughness: .9 })); blanket.position.set(.55, 2.92, 0); blanket.rotation.z = -.1; g.add(blanket);
  g.userData.legs = legs; return g;
}
function jaguar(){
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#E0A84E'); gr.addColorStop(.45, '#C98A34'); gr.addColorStop(.55, '#C98A34'); gr.addColorStop(1, '#E0A84E'); x.fillStyle = gr; x.fillRect(0, 0, 1024, 512);
  const belly = x.createLinearGradient(0, 380, 0, 512); belly.addColorStop(0, 'rgba(242,226,194,0)'); belly.addColorStop(1, 'rgba(242,226,194,1)'); x.fillStyle = belly; x.fillRect(0, 380, 1024, 132);
  for (let i = 0; i < 4000; i++){ const v = rnd() < .5 ? 'rgba(90,50,10,.12)' : 'rgba(255,230,180,.1)'; x.strokeStyle = v; x.beginPath(); const px = rnd() * 1024, py = rnd() * 512; x.moveTo(px, py); x.lineTo(px + 2, py + 6); x.stroke(); }
  for (let i = 0; i < 260; i++){ const px = rnd() * 1024, py = 30 + rnd() * 440, r = 6 + rnd() * 10; x.fillStyle = 'rgba(150,90,30,.55)'; x.beginPath(); x.arc(px, py, r * .7, 0, 7); x.fill();
    x.strokeStyle = 'rgba(25,15,8,.92)'; x.lineWidth = 3 + rnd() * 2; for (let k = 0; k < 4; k++){ const a0 = k * 1.6 + rnd() * .5; x.beginPath(); x.arc(px, py, r, a0, a0 + 1.1); x.stroke(); } }
  const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 8;
  const coat = new THREE.MeshStandardMaterial({ map: tex, roughness: .85 }), cream = std(0xEADBB8, { roughness: .8 }), nose = std(0x3A2418, { roughness: .4 });
  const g = new THREE.Group();
  const body = mesh(lathe(2.5, t => .5 * Math.pow(Math.sin(Math.PI * t), .55) * (.85 + .2 * t)), coat); body.geometry.translate(-1.3, 0, 0); body.scale.set(1, .95, .8); body.position.y = 1.1; g.add(body);
  const head = mesh(lathe(.95, t => .36 * Math.pow(Math.sin(Math.PI * Math.min(1, t * .92 + .08)), .5) * (1 - t * .25)), coat); head.position.set(1.05, 1.42, 0); head.rotation.z = -.12; g.add(head);
  const muzzle = mesh(new THREE.SphereGeometry(.17, 20, 14), cream); muzzle.scale.set(1, .75, 1.1); muzzle.position.set(1.88, 1.3, 0); g.add(muzzle);
  const nz = mesh(new THREE.SphereGeometry(.06, 12, 8), nose); nz.position.set(2.0, 1.37, 0); g.add(nz);
  for (const s of [-1, 1]){ const ear = mesh(new THREE.SphereGeometry(.11, 14, 10), coat); ear.scale.set(.5, 1, 1); ear.position.set(1.4, 1.78, s * .22); g.add(ear);
    const e = eyeBall(.055, 0xC8A020); e.position.set(1.83, 1.52, s * .15); e.rotation.y = -s * .55; g.add(e); }
  const legs = [];
  [[.85, .27, 1], [.85, -.27, 1], [-.85, .27, 0], [-.85, -.27, 0]].forEach(([lx, lz, front]) => { const p = new THREE.Group(); p.position.set(lx, 1.15, lz);
    p.add(mesh(taperTube(new THREE.CatmullRomCurve3([V(0, 0, 0), V(front ? .05 : -.08, -.45, 0), V(0, -.75, 0)]), 10, 12, .2, .12), coat));
    p.add(mesh(taperTube(new THREE.CatmullRomCurve3([V(0, -.75, 0), V(0, -1.0, 0), V(.05, -1.1, 0)]), 8, 10, .11, .1), coat));
    const paw = mesh(new THREE.SphereGeometry(.14, 14, 10), cream); paw.scale.set(1.3, .55, 1); paw.position.set(.1, -1.12, 0); p.add(paw);
    g.add(p); legs.push(p); });
  const tail = new THREE.Group(); tail.position.set(-1.25, 1.15, 0);
  tail.add(mesh(taperTube(new THREE.CatmullRomCurve3([V(0, 0, 0), V(-.6, -.25, 0), V(-1.2, -.1, 0), V(-1.65, .35, 0)]), 32, 10, .1, .045), coat));
  g.add(tail); g.userData = { legs, tail };
  return g;
}
