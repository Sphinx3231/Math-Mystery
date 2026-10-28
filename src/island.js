/* ═════════════ The island (shared by the paper map and the 3D world) ═════════════ */
function hash(x, y){ let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967295; }
function vnoise(x, y){ const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf*xf*(3-2*xf), v = yf*yf*(3-2*yf);
  const a = hash(xi, yi), b = hash(xi+1, yi), c = hash(xi, yi+1), d = hash(xi+1, yi+1); return a + (b-a)*u + (c-a)*v + (a-b-c+d)*u*v; }
function fbm(x, y){ let s = 0, a = .5, f = 1; for (let i = 0; i < 4; i++){ s += a * vnoise(x*f, y*f); f *= 2; a *= .5; } return s; }
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const plateau = (u, a, b, e) => smooth(a - e, a, u) * (1 - smooth(b, b + e, u));
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

const MAP = { x0: -100, x1: 100, z0: -160, z1: 120 };
const XPOS = { x: 5, z: -100 }, XH = 5.5;
const ROUTE = [[6,73],[4,58],[-16,30],[-33,4],[-24,-22],[6,-38],[30,-56],[30,-78],[14,-93],[5,-100]];
const WF = { x: -47, z: 15 }, FALL_X = -38.6;                       // waterfall plateau and its cliff edge
const TEMPLE = { x: -46, z: -10, h: 4.5 };                          // jungle temple clearing
const GORGE = { x: 22, z: -86, nx: -.73, nz: -.68 };                // gorge centre; n = route direction across it
const RIVER = [[-35,15],[-37,24],[-46,33],[-58,41],[-72,48]];       // falls pool → west coast
const BRIDGE = { a: [GORGE.x - GORGE.nx * 7.5, GORGE.z - GORGE.nz * 7.5], b: [GORGE.x + GORGE.nx * 7.5, GORGE.z + GORGE.nz * 7.5] };

const desertW = (x, z) => smooth(-6, 10, x) * smooth(-24, -40, z) * (1 - smooth(-82, -92, z));
const mountW = (x, z) => Math.exp(-((x+22)**2 + (z+97)**2) / 420);
const islandD = (x, z) => Math.hypot(x/72, (z+20)/112) + (fbm(x*.035+7.3, z*.035-2.1) - .47) * .24;
function segDist(x, z, a, b){ const dx = b[0]-a[0], dz = b[1]-a[1], t = Math.max(0, Math.min(1, ((x-a[0])*dx + (z-a[1])*dz) / (dx*dx + dz*dz))); return Math.hypot(x-a[0]-dx*t, z-a[1]-dz*t); }
function riverDist(x, z){ let m = 1e9; for (let i = 0; i < RIVER.length - 1; i++) m = Math.min(m, segDist(x, z, RIVER[i], RIVER[i+1])); return m; }
function landHeight(x, z){
  const d = islandD(x, z), mask = 1 - smooth(.82, 1.0, d), n = fbm(x*.05, z*.05), dW = desertW(x, z), mW = mountW(x, z);
  let h = 1.8 + n * 7;
  h = h * (1 - dW) + dW * (1.6 + 2.6 * (Math.sin(x*.21 + z*.09) * .5 + .5) + n * 1.5);
  const coast = smooth(.64, .86, d); h = h * (1 - coast) + 1.0 * coast;
  h += mW * 30 * (.75 + n * .5);
  h += 10 * (1 - smooth(6.5, 9.5, Math.hypot(x - WF.x, z - WF.z)));
  const dt = Math.hypot(x - TEMPLE.x, z - TEMPLE.z), ft = Math.exp(-dt*dt / 160); h = h * (1 - ft) + TEMPLE.h * ft;
  const dx = Math.hypot(x - XPOS.x, z - XPOS.z), px = Math.exp(-dx*dx / 200); h = h * (1 - px) + XH * px;
  h = h * mask - 6 * (1 - mask);
  h -= (h + 1.2) * (1 - smooth(1.6, 3.4, riverDist(x, z)));
  const ax = x - GORGE.x, az = z - GORGE.z, across = Math.abs(ax * GORGE.nx + az * GORGE.nz), along = Math.abs(-ax * GORGE.nz + az * GORGE.nx);
  const gm = (1 - smooth(3, 6.5, across)) * (1 - smooth(20, 30, along)); h = h * (1 - gm) - 3 * gm;
  return h;
}
/* the rope bridge deck, so the trail and camera can cross the gorge */
let BRIDGE_H = null;
function bridgeDeck(x, z){
  if (!BRIDGE_H) BRIDGE_H = [landHeight(...BRIDGE.a) + .15, landHeight(...BRIDGE.b) + .15];
  const [ax, az] = BRIDGE.a, dx = BRIDGE.b[0] - ax, dz = BRIDGE.b[1] - az, L2 = dx*dx + dz*dz;
  const t = ((x - ax) * dx + (z - az) * dz) / L2; if (t < 0 || t > 1) return -1e9;
  const off = Math.abs((x - ax) * dz - (z - az) * dx) / Math.sqrt(L2); if (off > 1.3) return -1e9;
  return BRIDGE_H[0] + (BRIDGE_H[1] - BRIDGE_H[0]) * t - .9 * Math.sin(Math.PI * t);
}
const groundAt = (x, z) => Math.max(landHeight(x, z), bridgeDeck(x, z));

/* Route as a smooth curve, sampled for clearance checks */
const routeSamples = [];
(function(){
  const pts = ROUTE.map(p => ({ x: p[0], z: p[1] }));
  const cr = (p0, p1, p2, p3, t) => { const t2 = t*t, t3 = t2*t; return .5 * ((2*p1) + (-p0 + p2)*t + (2*p0 - 5*p1 + 4*p2 - p3)*t2 + (-p0 + 3*p1 - 3*p2 + p3)*t3); };
  for (let i = 0; i < pts.length - 1; i++){
    const p0 = pts[Math.max(0, i-1)], p1 = pts[i], p2 = pts[i+1], p3 = pts[Math.min(pts.length-1, i+2)];
    for (let k = 0; k < 30; k++){ const t = k / 30; routeSamples.push({ x: cr(p0.x, p1.x, p2.x, p3.x, t), z: cr(p0.z, p1.z, p2.z, p3.z, t) }); }
  }
  routeSamples.push(pts[pts.length-1]);
})();
const routeDist = (x, z) => { let m = 1e9; for (const p of routeSamples){ const d = (p.x-x)**2 + (p.z-z)**2; if (d < m) m = d; } return Math.sqrt(m); };
const keepClear = (x, z) => Math.hypot(x - TEMPLE.x, z - TEMPLE.z) > 13 && Math.hypot(x - FALL_X, z - WF.z) > 6 && Math.hypot(x - (FALL_X + 9), z - WF.z + 2) > 9 && riverDist(x, z) > 3 && Math.hypot(x - XPOS.x, z - XPOS.z) > 10;

/* Scatter positions shared by the paper map and the world */
const PLACES = { trees: [], palms: [], cacti: [], rocks: [] };
(function(){
  for (let i = 0; i < 12000 && PLACES.trees.length < (small ? 320 : 540); i++){
    const x = -70 + rnd() * 140, z = -110 + rnd() * 190, h = landHeight(x, z);
    if (h > 2 && h < 16 && desertW(x, z) < .2 && mountW(x, z) < .35 && routeDist(x, z) > 7.5 && keepClear(x, z)) PLACES.trees.push({ x, z, h, s: .8 + rnd() * .8 });
  }
  for (let i = 0; i < 6000 && PLACES.palms.length < 34; i++){
    const x = -70 + rnd() * 140, z = -130 + rnd() * 230, h = landHeight(x, z);
    if (h > .5 && h < 2.1 && desertW(x, z) < .3 && routeDist(x, z) > 3 && keepClear(x, z)) PLACES.palms.push({ x, z, h });
  }
  for (let i = 0; i < 4000 && PLACES.cacti.length < 34; i++){
    const x = -2 + rnd() * 70, z = -95 + rnd() * 70, h = landHeight(x, z);
    if (desertW(x, z) > .6 && h > .6 && routeDist(x, z) > 3) PLACES.cacti.push({ x, z, h });
  }
  for (let i = 0; i < 4000 && PLACES.rocks.length < 50; i++){
    const x = -60 + rnd() * 110, z = -125 + rnd() * 90, h = landHeight(x, z);
    if (h > .8 && (mountW(x, z) > .15 || desertW(x, z) > .5) && routeDist(x, z) > 3 && keepClear(x, z)) PLACES.rocks.push({ x, z, h, s: .6 + rnd() * 1.6 });
  }
})();

/* ═════════════ The paper map (canvas) ═════════════ */
const EQS = ['eⁱᶿ = cos θ + i sin θ','a² + b² = c²','φ = (1 + √5) ⁄ 2','∑ 1⁄n² = π²⁄6','V − E + F = 2','∫ e^(−x²) dx = √π','A = πr²','sin²θ + cos²θ = 1'];
const MW = 1200, MH = 1680;
const toPx = (x, z) => [(x - MAP.x0) / (MAP.x1 - MAP.x0) * MW, (z - MAP.z0) / (MAP.z1 - MAP.z0) * MH];
function goldGrad(g, x0, y0, x1, y1){ const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, '#9C6E1E'); gr.addColorStop(.35, '#F3D57A'); gr.addColorStop(.55, '#C8962F'); gr.addColorStop(.8, '#FBE3A0'); gr.addColorStop(1, '#8E6118'); return gr; }
function drawMap(){
  const c = document.createElement('canvas'); c.width = MW; c.height = MH;
  const g = c.getContext('2d');
  const INK = '#3A2312', INK2 = 'rgba(58,35,18,.55)', RED = '#A3231B', RIVERC = 'rgba(46,108,128,.9)';
  // paper, stains, fibres
  g.fillStyle = '#E8D2A0'; g.fillRect(0, 0, MW, MH);
  for (let i = 0; i < 16; i++){
    const x = rnd() * MW, y = rnd() * MH, r = 80 + rnd() * 260, gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${rnd() < .5 ? '255,245,215' : '150,100,40'},${.12 + rnd() * .14})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, MW, MH);
  }
  for (let i = 0; i < 9000; i++){ g.fillStyle = `rgba(90,55,20,${rnd() * .08})`; g.fillRect(rnd() * MW, rnd() * MH, 1 + rnd() * 2, 1 + rnd() * 2); }
  g.lineWidth = .7;
  for (let i = 0; i < 1400; i++){ const x = rnd() * MW, y = rnd() * MH, a = rnd() * 6.28, l = 6 + rnd() * 26;
    g.strokeStyle = rnd() < .5 ? `rgba(110,70,30,${.06 + rnd() * .1})` : `rgba(255,248,225,${.1 + rnd() * .15})`;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + .6) * l * .5, y + Math.sin(a + .6) * l * .5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }

  // land tint from the real terrain
  const GW = 200, GH = 280, cell = MW / GW, H = new Float32Array(GW * GH);
  const sm = document.createElement('canvas'); sm.width = GW; sm.height = GH;
  const sg = sm.getContext('2d'), img = sg.createImageData(GW, GH);
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++){
    const x = MAP.x0 + i + .5, z = MAP.z0 + j + .5, h = landHeight(x, z); H[j * GW + i] = h;
    const o = (j * GW + i) * 4; let r, gg, b, a;
    if (h <= 0){ r = 70; gg = 130; b = 135; a = Math.max(0, 70 - (-h) * 6); }
    else {
      const dW = desertW(x, z);
      if (h < 1.6 && dW < .5){ r = 236; gg = 214; b = 160; a = 120; }
      else { r = 110 + dW * 110; gg = 140 + dW * 40; b = 70 + dW * 10; a = 70 + dW * 30; }
      if (mountW(x, z) > .25 || h > 11){ r = 120; gg = 100; b = 80; a = 90; }
    }
    img.data[o] = r; img.data[o+1] = gg; img.data[o+2] = b; img.data[o+3] = a;
  }
  sg.putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true; g.drawImage(sm, 0, 0, MW, MH);

  // distance to coast (grid BFS) for the inked coastline and ripples
  const D = new Int16Array(GW * GH).fill(-1), q = [];
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) if (H[j*GW+i] > 0){ D[j*GW+i] = 0; q.push(j*GW+i); }
  for (let qi = 0; qi < q.length; qi++){
    const id = q[qi], i = id % GW, j = (id / GW) | 0;
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(([a, b]) => { const ni = i + a, nj = j + b; if (ni >= 0 && nj >= 0 && ni < GW && nj < GH && D[nj*GW+ni] < 0){ D[nj*GW+ni] = D[id] + 1; if (D[id] < 12) q.push(nj*GW+ni); } });
  }
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++){
    const d = D[j*GW+i], px = (i + .5) * cell, py = (j + .5) * cell;
    if (d === 1){ g.fillStyle = INK; g.beginPath(); g.arc(px, py, 2.6, 0, 7); g.fill(); }
    else if (d === 4 && (i + j) % 2 === 0){ g.fillStyle = INK2; g.beginPath(); g.arc(px, py, 1.3, 0, 7); g.fill(); }
    else if (d === 8 && (i + j) % 3 === 0){ g.fillStyle = 'rgba(58,35,18,.32)'; g.beginPath(); g.arc(px, py, 1, 0, 7); g.fill(); }
  }

  // sea waves
  g.strokeStyle = INK2; g.lineWidth = 2;
  for (let i = 0; i < 140; i++){
    const x = rnd() * MW, y = rnd() * MH, gi = Math.floor(x / cell), gj = Math.floor(y / cell);
    if (D[gj*GW+gi] !== -1 && D[gj*GW+gi] < 13) continue;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 1; k <= 3; k++) g.quadraticCurveTo(x + k * 12 - 6, y - 6 * (k % 2 ? 1 : -1), x + k * 12, y);
    g.stroke();
  }

  // river (blue ink), waterfall, gorge
  g.lineCap = 'round'; g.lineJoin = 'round';
  { const rp = []; for (let i = 0; i < RIVER.length - 1; i++) for (let k = 0; k < 20; k++){ const t = k / 20, x = RIVER[i][0] + (RIVER[i+1][0] - RIVER[i][0]) * t, z = RIVER[i][1] + (RIVER[i+1][1] - RIVER[i][1]) * t; if (islandD(x, z) < .9) rp.push(toPx(x, z)); }
    const rpath = new Path2D(); rp.forEach(([x, y], i) => i ? rpath.lineTo(x, y) : rpath.moveTo(x, y));
    g.strokeStyle = INK; g.lineWidth = 12; g.stroke(rpath); g.strokeStyle = RIVERC; g.lineWidth = 8; g.stroke(rpath); }
  { const [fx, fy] = toPx(FALL_X - 2, WF.z); g.strokeStyle = INK; g.lineWidth = 2;
    for (let k = -2; k <= 2; k++){ g.beginPath(); g.moveTo(fx + k * 5, fy - 22); g.quadraticCurveTo(fx + k * 5 + 4, fy - 6, fx + k * 5, fy + 10); g.stroke(); }
    g.beginPath(); g.arc(fx - 10, fy - 4, 34, Math.PI * .6, Math.PI * 1.4); g.stroke(); }
  { const along = [-GORGE.nz, GORGE.nx]; g.strokeStyle = INK2; g.lineWidth = 1.4;
    for (let s = -17; s <= 17; s += 2.4){ for (const side of [-1, 1]){ const x = GORGE.x + along[0] * s + GORGE.nx * 4.5 * side, z = GORGE.z + along[1] * s + GORGE.nz * 4.5 * side;
      const [px, py] = toPx(x, z); g.beginPath(); g.moveTo(px, py); g.lineTo(px - GORGE.nx * 12 * side, py - GORGE.nz * 12 * side); g.stroke(); } } }

  // symbols
  const tree = (x, y, s) => { g.strokeStyle = INK; g.lineWidth = 1.6; g.fillStyle = 'rgba(70,105,45,.75)';
    g.beginPath(); g.moveTo(x, y + 6*s); g.lineTo(x, y + 13*s); g.stroke();
    [[-4,2],[4,2],[0,-3]].forEach(([a, b]) => { g.beginPath(); g.arc(x + a*s, y + b*s, 5.5*s, 0, 7); g.fill(); g.stroke(); }); };
  const palm = (x, y) => { g.strokeStyle = INK; g.lineWidth = 1.8; g.beginPath(); g.moveTo(x, y + 12); g.quadraticCurveTo(x + 4, y + 4, x + 2, y - 4); g.stroke();
    [-1.2,-.5,.3,1,1.6].forEach(a => { g.beginPath(); g.moveTo(x + 2, y - 4); g.quadraticCurveTo(x + 2 + Math.cos(a - 1.57) * 9, y - 10, x + 2 + Math.cos(a - 1.57) * 14 * Math.sign(Math.cos(a - 1.57) || 1), y + 2); g.stroke(); }); };
  const dune = (x, y) => { g.strokeStyle = 'rgba(120,70,20,.7)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y + 12, 14, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); };
  const cactusS = (x, y) => { g.strokeStyle = INK; g.lineWidth = 2.4; g.beginPath(); g.moveTo(x, y + 10); g.lineTo(x, y - 8); g.moveTo(x, y); g.lineTo(x - 5, y); g.lineTo(x - 5, y - 5); g.moveTo(x, y - 2); g.lineTo(x + 5, y - 2); g.lineTo(x + 5, y - 7); g.stroke(); };
  PLACES.trees.forEach((t, i) => { if (i % 3 === 0){ const [x, y] = toPx(t.x, t.z); tree(x, y, .9); } });
  PLACES.palms.forEach(p => { const [x, y] = toPx(p.x, p.z); palm(x, y); });
  for (let i = 0; i < 70; i++){ const x = rnd() * 60, z = -88 + rnd() * 56; if (desertW(x, z) > .7 && landHeight(x, z) > .5){ const [px, py] = toPx(x, z); dune(px, py); } }
  PLACES.cacti.forEach((p, i) => { if (i % 2 === 0){ const [x, y] = toPx(p.x, p.z); cactusS(x, y); } });
  [[-22,-97,1.6],[-34,-90,1],[-12,-108,1.1],[-30,-108,.9]].forEach(([mx, mz, s]) => {
    const [x, y] = toPx(mx, mz); g.fillStyle = 'rgba(140,115,85,.8)'; g.strokeStyle = INK; g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(x - 34*s, y + 22*s); g.lineTo(x, y - 30*s); g.lineTo(x + 34*s, y + 22*s); g.closePath(); g.fill(); g.stroke();
    g.lineWidth = 1.2; for (let k = 0; k < 6; k++){ g.beginPath(); g.moveTo(x + k*4*s, y - 26*s + k*7*s); g.lineTo(x + 6*s + k*4*s, y - 18*s + k*7*s); g.stroke(); }
  });
  // temple (stepped pyramid), obelisks, cave arch
  { const [x, y] = toPx(TEMPLE.x, TEMPLE.z); g.fillStyle = 'rgba(150,135,110,.9)'; g.strokeStyle = INK; g.lineWidth = 2;
    [[44, 12], [32, 11], [20, 10]].forEach(([w, h], k) => { g.beginPath(); g.rect(x - w / 2, y + 10 - (k + 1) * h, w, h); g.fill(); g.stroke(); });
    g.beginPath(); g.rect(x - 5, y - 30, 10, 10); g.fillStyle = INK; g.fill(); }
  [.66, .73, .8].forEach(u => { const p = routeSamples[Math.round(u * (routeSamples.length - 1))]; const [x, y] = toPx(p.x + 6, p.z - 3);
    g.fillStyle = 'rgba(160,130,90,.9)'; g.strokeStyle = INK; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x - 4, y + 12); g.lineTo(x - 3, y - 10); g.lineTo(x, y - 15); g.lineTo(x + 3, y - 10); g.lineTo(x + 4, y + 12); g.closePath(); g.fill(); g.stroke(); });
  { const [x, y] = toPx(XPOS.x - 4, XPOS.z - 5); g.fillStyle = 'rgba(30,18,10,.85)'; g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 16, Math.PI, 0); g.lineTo(x + 16, y + 6); g.lineTo(x - 16, y + 6); g.closePath(); g.fill(); g.stroke(); }

  // labels
  const label = (txt, x, z, size = 34, col = INK, rot = 0) => { const [px, py] = toPx(x, z); g.save(); g.translate(px, py); g.rotate(rot); g.font = `italic ${size}px "IM Fell English", Georgia, serif`; g.fillStyle = col; g.textAlign = 'center'; g.fillText(txt, 0, 0); g.restore(); };
  label('Shipwreck Beach', 34, 82, 32, INK, -.12);
  label('Golden Ratio Falls', -50, 26, 28, INK, -.1);
  label('Temple of Pythagoras', -48, -24, 28, INK, .05);
  label('Desert of Primes', 46, -44, 32, INK, .18);
  label('Catenary Bridge', 44, -100, 26, INK, -.6);
  label('Mount Euler', -38, -122, 30);
  label('Here be integrals', 62, -132, 28, INK2, .1);

  // red route, with gold stars at each stop
  g.strokeStyle = RED; g.lineWidth = 6; g.setLineDash([16, 12]); g.lineCap = 'round';
  g.beginPath(); routeSamples.forEach((p, i) => { const [x, y] = toPx(p.x, p.z); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); g.setLineDash([]);
  const star = (x, y, r) => { g.beginPath(); for (let k = 0; k < 10; k++){ const a = k / 10 * Math.PI * 2 - Math.PI / 2, rr = k % 2 ? r * .45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fillStyle = goldGrad(g, x - r, y - r, x + r, y + r); g.fill(); g.strokeStyle = INK; g.lineWidth = 1.2; g.stroke(); };
  [.3, .39, .72, .905, .965].forEach(u => { const p = routeSamples[Math.round(u * (routeSamples.length - 1))]; const [x, y] = toPx(p.x, p.z); star(x, y, 13); });
  const [xx, xy] = toPx(XPOS.x, XPOS.z); g.strokeStyle = RED; g.lineWidth = 11; g.beginPath(); g.moveTo(xx - 26, xy - 26); g.lineTo(xx + 26, xy + 26); g.moveTo(xx + 26, xy - 26); g.lineTo(xx - 26, xy + 26); g.stroke();
  { const [bx0, by0] = toPx(...BRIDGE.a), [bx1, by1] = toPx(...BRIDGE.b); g.strokeStyle = INK; g.lineWidth = 2;
    const nx = -(by1 - by0), ny = bx1 - bx0, l = Math.hypot(nx, ny);
    for (const s of [-1, 1]){ g.beginPath(); g.moveTo(bx0 + nx / l * 6 * s, by0 + ny / l * 6 * s); g.lineTo(bx1 + nx / l * 6 * s, by1 + ny / l * 6 * s); g.stroke(); }
    for (let k = 0; k <= 8; k++){ const t = k / 8, x = bx0 + (bx1 - bx0) * t, y = by0 + (by1 - by0) * t; g.beginPath(); g.moveTo(x - nx / l * 6, y - ny / l * 6); g.lineTo(x + nx / l * 6, y + ny / l * 6); g.stroke(); } }

  // sea serpent and a little ship
  const [sx, sy] = toPx(60, -145); g.strokeStyle = INK; g.lineWidth = 3; g.fillStyle = 'rgba(70,110,90,.6)';
  for (let k = 0; k < 4; k++){ g.beginPath(); g.arc(sx + k * 34, sy, 13, Math.PI, 0); g.fill(); g.stroke(); }
  g.beginPath(); g.arc(sx - 22, sy - 14, 10, 0, 7); g.fill(); g.stroke();
  const [shx, shy] = toPx(-70, 105); g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(shx - 30, shy); g.lineTo(shx + 30, shy); g.lineTo(shx + 20, shy + 14); g.lineTo(shx - 22, shy + 14); g.closePath(); g.fillStyle = 'rgba(120,75,35,.7)'; g.fill(); g.stroke();
  g.beginPath(); g.moveTo(shx, shy); g.lineTo(shx, shy - 46); g.stroke();
  g.beginPath(); g.moveTo(shx + 3, shy - 42); g.quadraticCurveTo(shx + 26, shy - 26, shx + 3, shy - 8); g.closePath(); g.fillStyle = 'rgba(245,235,210,.9)'; g.fill(); g.stroke();

  // compass rose in gold leaf, with equations wrapped around it
  const [cx, cy] = toPx(-72, -135), R = 92;
  g.save(); g.translate(cx, cy);
  g.strokeStyle = goldGrad(g, -R, -R, R, R); g.lineWidth = 5; g.beginPath(); g.arc(0, 0, R, 0, 7); g.stroke();
  g.strokeStyle = INK; g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, R - 8, 0, 7); g.stroke(); g.beginPath(); g.arc(0, 0, R + 4, 0, 7); g.stroke();
  for (let k = 0; k < 8; k++){
    const a = k / 8 * Math.PI * 2 - Math.PI / 2, len = k % 2 ? R * .55 : R * .95;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a - .2) * 14, Math.sin(a - .2) * 14); g.lineTo(Math.cos(a) * len, Math.sin(a) * len); g.closePath();
    g.fillStyle = k % 2 ? 'rgba(58,35,18,.35)' : (k === 0 ? RED : goldGrad(g, -len, -len, len, len)); g.fill(); g.strokeStyle = INK; g.stroke();
  }
  g.font = '34px "IM Fell English SC", Georgia, serif'; g.fillStyle = RED; g.textAlign = 'center'; g.fillText('N', 0, -R - 14);
  g.font = 'italic 17px "STIX Two Text", "Times New Roman", serif'; g.fillStyle = INK;
  const ring = EQS.join('   ✦   ') + '   ✦   ';
  let ang = -Math.PI / 2 + .25; const rr = R + 34;
  for (const ch of ring){ const w = g.measureText(ch).width; if (ang > Math.PI * 1.5 - .25) break;
    g.save(); g.rotate(ang + Math.PI / 2 + w / 2 / rr); g.fillText(ch, 0, -rr); g.restore(); ang += w / rr; }
  g.restore();

  // cartouche with a gold frame
  const [kx, ky] = toPx(58, 98);
  g.save(); g.translate(kx, ky); g.rotate(-.04);
  g.fillStyle = 'rgba(245,232,200,.88)'; g.strokeStyle = goldGrad(g, -160, -70, 160, 70); g.lineWidth = 6;
  g.beginPath(); g.rect(-160, -70, 320, 140); g.fill(); g.stroke(); g.strokeStyle = INK; g.lineWidth = 1; g.strokeRect(-150, -60, 300, 120);
  g.textAlign = 'center'; g.fillStyle = INK; g.font = '40px "IM Fell English SC", Georgia, serif'; g.fillText('Isla Mathematica', 0, -18);
  g.font = 'italic 22px "STIX Two Text", "Times New Roman", serif'; g.fillStyle = RED; g.fillText('φ = (1 + √5) ⁄ 2      V − E + F = 2', 0, 18);
  g.font = 'italic 20px "IM Fell English", Georgia, serif'; g.fillStyle = INK2; g.fillText('drawn by the Math Club', 0, 46);
  g.restore();

  // fold creases (thirds), each a dark valley with a light ridge
  const crease = (x0, y0, x1, y1) => { const nx = -(y1 - y0), ny = x1 - x0, l = Math.hypot(nx, ny);
    for (const [off, col] of [[-3, 'rgba(90,55,20,.22)'], [0, 'rgba(70,40,12,.28)'], [3, 'rgba(255,248,225,.35)']]){
      g.strokeStyle = col; g.lineWidth = off === 0 ? 2 : 5; g.beginPath(); g.moveTo(x0 + nx / l * off, y0 + ny / l * off); g.lineTo(x1 + nx / l * off, y1 + ny / l * off); g.stroke(); } };
  crease(MW / 3, 0, MW / 3 + 6, MH); crease(MW * 2 / 3, 0, MW * 2 / 3 - 4, MH); crease(0, MH / 2, MW, MH / 2 + 5);

  // burnt, torn edge
  const edge = []; const inset = 26;
  const per = [[inset, inset, MW - inset, inset], [MW - inset, inset, MW - inset, MH - inset], [MW - inset, MH - inset, inset, MH - inset], [inset, MH - inset, inset, inset]];
  per.forEach(([x0, y0, x1, y1]) => { const n = 60; for (let k = 0; k < n; k++){ const t = k / n, j = (vnoise(edge.length * .35, 3.3) - .5) * 34 + (rnd() - .5) * 8;
    const nx = -(y1 - y0), ny = x1 - x0, l = Math.hypot(nx, ny); edge.push([x0 + (x1 - x0) * t + nx / l * j, y0 + (y1 - y0) * t + ny / l * j]); } });
  const path = new Path2D(); edge.forEach(([x, y], i) => i ? path.lineTo(x, y) : path.moveTo(x, y)); path.closePath();
  const vg = g.createRadialGradient(MW / 2, MH / 2, MW * .35, MW / 2, MH / 2, MH * .62); vg.addColorStop(0, 'rgba(90,50,15,0)'); vg.addColorStop(1, 'rgba(90,50,15,.55)');
  g.fillStyle = vg; g.fillRect(0, 0, MW, MH);
  // clip to the torn outline on a fresh canvas, then scorch the edge
  const out = document.createElement('canvas'); out.width = MW; out.height = MH; const o = out.getContext('2d');
  o.save(); o.clip(path); o.drawImage(c, 0, 0);
  o.strokeStyle = 'rgba(55,25,8,.85)'; o.lineWidth = 26; o.filter = 'blur(7px)'; o.stroke(path); o.filter = 'none';
  o.restore();
  o.lineWidth = 3; o.strokeStyle = 'rgba(30,12,4,.95)'; o.stroke(path);
  return out;
}
