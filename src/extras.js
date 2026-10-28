/* ═════════════ Set pieces: ruins, falls, bridge, cave, wildlife, atmosphere ═════════════ */
const GOLD_GLOW = () => lin(0xFFB43A);
const glowMats = [];   // engraved stones whose inscriptions light up

/* Carved stone with an inscription; returns a material whose emissive map is the glowing inscription */
function engraved(text, { w = 1024, h = 256, size = 120, base = '#8F887A', moss = .25, font } = {}){
  const f = font || `italic ${size}px "STIX Two Text", "Times New Roman", serif`;
  const a = document.createElement('canvas'); a.width = w; a.height = h; const g = a.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < w * h / 60; i++){ const v = rnd(); g.fillStyle = v < .5 ? `rgba(40,35,28,${rnd() * .18})` : `rgba(255,250,235,${rnd() * .12})`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1 + rnd() * 3); }
  for (let i = 0; i < 10; i++){ const x = rnd() * w, y = rnd() * h, r = 30 + rnd() * 120, gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rnd() < moss ? 'rgba(70,95,40,.45)' : 'rgba(40,32,24,.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  g.strokeStyle = 'rgba(30,26,20,.35)'; g.lineWidth = 2; for (let i = 0; i < 5; i++){ g.beginPath(); let x = rnd() * w, y = rnd() * h; g.moveTo(x, y); for (let k = 0; k < 6; k++){ x += (rnd() - .5) * 60; y += rnd() * 30; g.lineTo(x, y); } g.stroke(); }
  const lines = String(text).split('\n'), ly = i => h * (i + 1) / (lines.length + 1);
  g.font = f; g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((l, i) => { g.fillStyle = 'rgba(255,248,230,.35)'; g.fillText(l, w / 2 + 2, ly(i) + 3, w * .92);
    g.fillStyle = 'rgba(28,22,16,.85)'; g.fillText(l, w / 2, ly(i), w * .92); });
  const e = document.createElement('canvas'); e.width = w; e.height = h; const ge = e.getContext('2d');
  ge.fillStyle = '#000'; ge.fillRect(0, 0, w, h); ge.font = f; ge.textAlign = 'center'; ge.textBaseline = 'middle';
  ge.shadowColor = '#FFB43A'; ge.shadowBlur = 24; ge.fillStyle = '#FFD27A'; lines.forEach((l, i) => { ge.fillText(l, w / 2, ly(i), w * .92); ge.fillText(l, w / 2, ly(i), w * .92); });
  const map = new THREE.CanvasTexture(a); map.encoding = THREE.sRGBEncoding; map.anisotropy = 8;
  const em = new THREE.CanvasTexture(e); em.encoding = THREE.sRGBEncoding;
  const m = new THREE.MeshStandardMaterial({ map, emissiveMap: em, emissive: GOLD_GLOW(), emissiveIntensity: 0, roughness: .92 });
  glowMats.push(m); return m;
}
function stoneMat(color = 0x8F887A){ return triplanar(G3.surf.brick, .3, new THREE.Color(color).lerp(new THREE.Color(0xFFFFFF), .55).getHex()); }

/* Stepped jungle temple with inscriptions and a floating golden dodecahedron */
function buildTemple(){
  const g = new THREE.Group(), stone = stoneMat(0x8C8572), mossy = stoneMat(0x6F7A55);
  const tiers = [[15, 2.4], [11.5, 2.2], [8.2, 2.1], [5.4, 3.2]]; let y = 0;
  const texts = ['a² + b² = c²', 'Fₙ = Fₙ₋₁ + Fₙ₋₂', 'φ² = φ + 1'];
  tiers.forEach(([w, h], i) => {
    const b = mesh(new THREE.BoxGeometry(w, h, w), i % 2 ? mossy : stone); b.position.y = y + h / 2; g.add(b);
    if (i < 3){ const p = new THREE.Mesh(new THREE.PlaneGeometry(w * .7, h * .78), engraved(texts[i], { size: 132 })); p.position.set(w / 2 + .02, y + h / 2, 0); p.rotation.y = Math.PI / 2; g.add(p); }
    y += h;
  });
  // stairs up the front (+x)
  for (let k = 0; k < 18; k++){ const st = mesh(new THREE.BoxGeometry(.9, .5, 3), stone); st.position.set(7.5 - k * .42 + .4, .25 + k * .5, 0); if (st.position.x > 1.4) g.add(st); }
  // shrine doorway (dark)
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.2), new THREE.MeshBasicMaterial({ color: 0x050302 })); door.position.set(2.72, y - 3.2 + 1.1, 0); door.rotation.y = Math.PI / 2; g.add(door);
  // broken corners and moss lumps
  for (let i = 0; i < 16; i++){ const m = mesh(G3.blob1, std(0x4D6B33, { roughness: 1 })); const t = tiers[i % 3]; const s = .5 + rnd() * .7;
    m.scale.set(s, s * .5, s); m.position.set((rnd() < .5 ? -1 : 1) * t[0] / 2, tiers.slice(0, i % 3 + 1).reduce((a, b) => a + b[1], 0), (rnd() - .5) * t[0]); g.add(m); }
  // hanging vines
  const vineM = std(0x3D6B2A, { roughness: .9 });
  for (let i = 0; i < 12; i++){ const x = (rnd() - .5) * 10, z = (rnd() - .5) * 10, top = 6 + rnd() * 3;
    const c = new THREE.CatmullRomCurve3([V(x, top, z), V(x + .3, top - 2, z + .2), V(x - .2, top - 4 - rnd() * 2, z)]);
    g.add(mesh(new THREE.TubeGeometry(c, 12, .05, 5), vineM)); }
  // golden geometry above the shrine
  const art = new THREE.Group(); art.position.y = y + 3.2;
  const goldM = std(0xF2C14E, { metalness: 1, roughness: .25, emissive: 0x5A3A00, emissiveIntensity: .6 });
  const dode = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.DodecahedronGeometry(1.5)), new THREE.LineBasicMaterial({ color: lin(0xFFD27A) }));
  art.add(dode, mesh(new THREE.IcosahedronGeometry(.55, 0), goldM));
  const ring = mesh(new THREE.TorusGeometry(2.2, .06, 8, 64), goldM); ring.rotation.x = Math.PI / 2; art.add(ring);
  const ring2 = mesh(new THREE.TorusGeometry(2.2, .05, 8, 64), goldM); art.add(ring2);
  const glow = new THREE.PointLight(lin(0xFFC060), 0, 14, 2); art.add(glow);
  g.add(art); g.userData = { art, glow, ring, ring2, dode, top: y };
  return g;
}
function buildColumn(broken){
  const g = new THREE.Group(), stone = stoneMat(0x9A9282), h = broken ? 2 + rnd() * 2.5 : 5;
  const geo = new THREE.CylinderGeometry(.55, .6, h, 20, 4), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++){ const a = Math.atan2(p.getZ(i), p.getX(i)), k = 1 - .05 * Math.max(0, Math.cos(a * 12)); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
  geo.computeVertexNormals();
  const c = mesh(geo, stone); c.position.y = h / 2 + .4; g.add(c);
  const base = mesh(new THREE.BoxGeometry(1.6, .4, 1.6), stone); base.position.y = .2; g.add(base);
  if (!broken){ const cap = mesh(new THREE.BoxGeometry(1.6, .4, 1.6), stone); cap.position.y = h + .6; g.add(cap); }
  return g;
}

/* Waterfall sheet + spray */
const WaterfallShader = {
  uniforms: { uTime: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: `uniform float uTime; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
    float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
    void main(){
      vec2 p = vec2(vUv.x * 9., vUv.y * 3. + uTime * 2.6);
      float s = n(p) * .6 + n(p * 2.3 + 4.) * .4;
      float streak = smoothstep(.35, .9, s);
      float edge = smoothstep(0., .12, vUv.x) * smoothstep(1., .88, vUv.x);
      float foam = smoothstep(.25, 0., vUv.y);
      vec3 col = mix(vec3(.55,.75,.8), vec3(1.), streak * .8 + foam);
      gl_FragColor = vec4(col, edge * (.45 + streak * .5 + foam * .4));
    }`
};
const FlowShader = {
  uniforms: { uTime: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: `uniform float uTime; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
    float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
    void main(){
      float s = n(vec2(vUv.x * 2.2 - uTime * 1.4, vUv.y * 6.)) * .65 + n(vec2(vUv.x * 5. - uTime * 2.2, vUv.y * 13.)) * .35;
      float a = smoothstep(.6, .85, s) * smoothstep(0., .25, vUv.y) * smoothstep(1., .75, vUv.y);
      gl_FragColor = vec4(vec3(1.), a * .55);
    }`
};
function ribbon(points, width, yOff){
  const curve = new THREE.CatmullRomCurve3(points.map(p => V(p[0], 0, p[1]))), N = 120, pos = [], uv = [], idx = [], L = curve.getLength();
  for (let i = 0; i <= N; i++){ const u = i / N, p = curve.getPointAt(u), t = curve.getTangentAt(u), nx = -t.z, nz = t.x;
    for (const s of [0, 1]){ const off = (s - .5) * width; pos.push(p.x + nx * off, yOff, p.z + nz * off); uv.push(u * L / 6, s); } }
  for (let i = 0; i < N; i++){ const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/* Rope bridge across the gorge */
function buildBridge(){
  const g = new THREE.Group(), wood = std(0xE8C8A0, { roughness: .9, map: G3.chestWood }), rope = std(0xB89A62, { roughness: 1 });
  const [ax, az] = BRIDGE.a, [bx, bz] = BRIDGE.b, dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz), ang = Math.atan2(-dz, dx), nx = -dz / L, nz = dx / L;
  const planks = [];
  const deckAt = t => bridgeDeck(ax + dx * t, az + dz * t);
  for (let i = 0; i <= 30; i++){ const t = i / 30, pl = mesh(new THREE.BoxGeometry(.38, .08, 2.1), wood);
    pl.position.set(ax + dx * t, deckAt(Math.min(.999, Math.max(.001, t))) - .04, az + dz * t); pl.rotation.set((rnd() - .5) * .05, ang, (rnd() - .5) * .08); g.add(pl); planks.push(pl); }
  for (const side of [-1, 1]) for (const hgt of [1.1, .05]){
    const pts = []; for (let i = 0; i <= 30; i++){ const t = i / 30; pts.push(V(ax + dx * t + nx * 1.05 * side, deckAt(Math.min(.999, Math.max(.001, t))) + hgt + (hgt > 1 ? .3 * Math.sin(Math.PI * t) : 0), az + dz * t + nz * 1.05 * side)); }
    g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, .045, 6), rope, false));
    if (hgt > 1) for (let i = 0; i <= 30; i += 2){ const p = pts[i], v = mesh(new THREE.CylinderGeometry(.02, .02, 1.15, 4), rope, false); v.position.set(p.x, p.y - .55, p.z); g.add(v); }
  }
  for (const [px, pz, t] of [[ax, az, 0], [bx, bz, 1]]) for (const side of [-1, 1]){
    const post = mesh(new THREE.CylinderGeometry(.14, .17, 2.4, 10), wood); post.position.set(px + nx * 1.05 * side, deckAt(t ? .999 : .001) + .9, pz + nz * 1.05 * side); g.add(post); }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, .7), engraved('y = a cosh(x ⁄ a)', { size: 110, base: '#8A6A44', moss: 0 }));
  sign.position.set(ax - dx / L * .6 + nx * 2.3, deckAt(.001) + 1.4, az - dz / L * .6 + nz * 2.3); sign.lookAt(ax - dx * 2, sign.position.y, az - dz * 2); g.add(sign);
  g.userData = { planks };
  return g;
}

/* Cave of Euler: rock arch, glowing ring of symbols, torches */
function buildCave(){
  const g = new THREE.Group(), rock = triplanar(G3.surf.rock, .2, 0xA89E92);
  for (let i = 0; i <= 18; i++){ const a = i / 18 * Math.PI, r = 5.4;
    const b = mesh(G3.rockGeo, rock); const s = .9 + rnd() * .5; b.scale.set(s, s, s * 1.5); b.position.set(Math.cos(a) * r, Math.sin(a) * r * 1.1, 0); b.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); g.add(b); }
  for (let i = 0; i < 14; i++){ const b = mesh(G3.rockGeo, rock), s = 2 + rnd() * 2.5; b.scale.set(s, s * 1.3, s); b.position.set((rnd() < .5 ? -1 : 1) * (8 + rnd() * 5), rnd() * 6, -3 - rnd() * 4); g.add(b); }
  for (let i = 0; i < 8; i++){ const b = mesh(G3.rockGeo, rock), s = 2.5 + rnd() * 2; b.scale.set(s, s, s); b.position.set((rnd() - .5) * 12, 6.5 + rnd() * 3, -2 - rnd() * 3); g.add(b); }
  const back = new THREE.Mesh(new THREE.CircleGeometry(5, 32, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0x030201 })); back.scale.y = 1.1; back.position.set(0, -.2, -2.5); g.add(back);
  const tunnel = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 3, 24, 1, true, -Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ color: 0x1A140F, side: THREE.BackSide, roughness: 1 }));
  tunnel.rotation.x = Math.PI / 2; tunnel.position.z = -1; g.add(tunnel);
  // ring of mathematical symbols around the arch
  const c = document.createElement('canvas'); c.width = 2048; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, 2048, 128); x.font = 'italic 84px "STIX Two Text", "Times New Roman", serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.shadowColor = '#FFB43A'; x.shadowBlur = 20; x.fillStyle = '#FFE0A0';
  x.fillText('eⁱᶿ = cos θ + i sin θ   ✦   e^(iπ) + 1 = 0   ✦   V − E + F = 2', 1024, 66, 2000);
  const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding;
  const band = new THREE.Mesh(new THREE.TorusGeometry(3.6, .38, 2, 96, Math.PI), new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0 }));
  band.scale.z = .05; band.position.z = .6; band.rotation.z = 0; g.add(band);
  // torches
  const torches = [];
  for (const s of [-1, 1]){
    const t = new THREE.Group(); t.position.set(s * 5.4, 0, 1.6);
    t.add(mesh(new THREE.CylinderGeometry(.08, .1, 2.6, 8), std(0x4A2E16)).translateY(1.3));
    const bowl = mesh(new THREE.CylinderGeometry(.35, .2, .35, 12), std(0x3A2A1A, { metalness: .6, roughness: .5 })); bowl.position.y = 2.7; t.add(bowl);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(.28, .9, 12), new THREE.MeshBasicMaterial({ color: lin(0xFFB040), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    flame.position.y = 3.25; t.add(flame);
    const light = new THREE.PointLight(lin(0xFF9A3A), 0, 16, 2); light.position.y = 3.4; t.add(light);
    g.add(t); torches.push({ flame, light });
  }
  g.userData = { band, torches };
  return g;
}

/* A spotted jaguar built from smooth parts, with a rosette texture */
function jaguar(){
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#C98A34'); gr.addColorStop(.55, '#E0A84E'); gr.addColorStop(1, '#F2E2C2'); x.fillStyle = gr; x.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 160; i++){ const px = rnd() * 512, py = rnd() * 190, r = 4 + rnd() * 7; x.strokeStyle = 'rgba(25,15,8,.9)'; x.lineWidth = 2.5 + rnd() * 2;
    x.beginPath(); x.arc(px, py, r, rnd() * 2, rnd() * 2 + 4.5); x.stroke(); x.fillStyle = 'rgba(150,90,30,.5)'; x.beginPath(); x.arc(px, py, r * .6, 0, 7); x.fill(); }
  const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding;
  const fur = new THREE.MeshStandardMaterial({ map: tex, roughness: .85 }), dark = std(0x2A1A0E);
  const g = new THREE.Group();
  const body = mesh(new THREE.SphereGeometry(1, 28, 18), fur); body.scale.set(1.5, .55, .5); body.position.y = 1.1; g.add(body);
  const head = mesh(new THREE.SphereGeometry(.42, 20, 14), fur); head.scale.set(1.15, .9, .95); head.position.set(1.65, 1.35, 0); g.add(head);
  const snout = mesh(new THREE.SphereGeometry(.22, 14, 10), std(0xE9D2A8)); snout.position.set(2.0, 1.25, 0); g.add(snout);
  for (const s of [-1, 1]){ const ear = mesh(new THREE.SphereGeometry(.12, 10, 8), fur); ear.position.set(1.55, 1.7, s * .26); g.add(ear);
    const eye = mesh(new THREE.SphereGeometry(.05, 8, 6), std(0xC8A020, { emissive: 0x302000, roughness: .1 })); eye.position.set(1.98, 1.45, s * .17); g.add(eye); }
  const legs = [];
  [[1.0, .3], [1.0, -.3], [-1.0, .3], [-1.0, -.3]].forEach(([lx, lz]) => { const p = new THREE.Group(); p.position.set(lx, 1.0, lz);
    const l = mesh(new THREE.CylinderGeometry(.14, .11, 1.05, 10), fur); l.position.y = -.5; p.add(l); g.add(p); legs.push(p); });
  const tail = new THREE.Group(); tail.position.set(-1.45, 1.15, 0);
  tail.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0, 0, 0), V(-.7, -.2, 0), V(-1.3, .1, 0), V(-1.7, .5, 0)]), 20, .08, 8), fur));
  g.add(tail); g.userData = { legs, tail };
  return g;
}

/* Soft textures for mist, rays and dust */
function softTex(kind){
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  if (kind === 'ray'){ const gr = g.createLinearGradient(0, 0, 128, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const v = g.createLinearGradient(0, 0, 0, 128); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(.3, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,1)'); g.globalCompositeOperation = 'destination-out'; g.fillStyle = v; g.fillRect(0, 0, 128, 128); }
  else { for (let i = 0; i < 18; i++){ const x = 34 + rnd() * 60, y = 34 + rnd() * 60, r = 20 + rnd() * 34, gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(255,255,255,${kind === 'mist' ? .22 : .9})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); } }
  return new THREE.CanvasTexture(c);
}

/* Wind: sway grass blades and canopy clumps in the vertex shader */
function addWind(material, kind){
  material.onBeforeCompile = sh => {
    sh.uniforms.uWind = G3.wind;
    // foliage cards: light both faces with the same outward normal (no dark undersides)
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal = normal * faceDirection;', ''));
    sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec2 ip = instanceMatrix[3].xz;
      #else
        vec2 ip = vec2(0.);
      #endif
      float ph = uWind * ${kind === 'grass' ? '2.2' : '1.1'} + ip.x * .21 + ip.y * .17;
      ${kind === 'grass' ? 'transformed.x += sin(ph) * .22 * position.y * position.y; transformed.z += cos(ph * .8) * .12 * position.y;'
                         : 'transformed += vec3(sin(ph), sin(ph * 1.3) * .4, cos(ph * .9)) * .05;'}`);
  };
}

/* Realistic foliage: clusters of alpha-tested leaf cards painted on a canvas atlas */
function leafAtlas(){
  const c = document.createElement('canvas'); c.width = c.height = 1024; const sc = 2; const g = c.getContext('2d');
  for (let i = 0; i < 70; i++){
    const x = (30 + rnd() * 452) * sc, y = (30 + rnd() * 452) * sc, a = rnd() * 6.28, L = (38 + rnd() * 40) * sc, W = L * (.32 + rnd() * .12);
    g.save(); g.translate(x, y); g.rotate(a);
    const gr = g.createLinearGradient(-W, 0, W, 0), base = 70 + rnd() * 50;
    gr.addColorStop(0, `rgb(${base * .45},${base * 1.25},${base * .4})`); gr.addColorStop(.5, `rgb(${base * .62},${base * 1.55},${base * .5})`); gr.addColorStop(1, `rgb(${base * .4},${base * 1.1},${base * .35})`);
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, -L / 2); g.quadraticCurveTo(W, -L * .1, 0, L / 2); g.quadraticCurveTo(-W, -L * .1, 0, -L / 2); g.fill();
    g.strokeStyle = 'rgba(210,240,170,.45)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(0, -L / 2 + 3); g.lineTo(0, L / 2 - 2); g.stroke();
    g.lineWidth = .8; for (let k = -3; k <= 3; k++){ if (!k) continue; g.beginPath(); g.moveTo(0, k * L / 9); g.lineTo(Math.sign(k) * W * .55, k * L / 9 - L * .08); g.stroke(); }
    g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
}
function foliageCluster(cards = 16){
  const pos = [], nrm = [], uv = [], idx = [], q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3();
  for (let i = 0; i < cards; i++){
    const c = V((rnd() - .5) * 1.3, (rnd() - .35) * .9, (rnd() - .5) * 1.3), s = .9 + rnd() * .6;
    e.set(rnd() * 3, rnd() * 3, rnd() * 3); q.setFromEuler(e);
    const u0 = (i % 2) * .5, v0 = ((i >> 1) % 2) * .5, base = pos.length / 3;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => { v.set(a * s * .5, b * s * .5, 0).applyQuaternion(q).add(c); pos.push(v.x, v.y, v.z);
      const n = v.clone().normalize(); nrm.push(n.x, n.y + .3, n.z); uv.push(u0 + (a + 1) * .25, v0 + (b + 1) * .25); });
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}
