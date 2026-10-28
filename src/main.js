const TEST = /[?&]test/.test(location.search);
function build3D(){
  if (!G3.ok) return;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: $('scene'), antialias: true, powerPreference: 'high-performance' }); }
  catch (e) { G3.ok = false; return; }
  const pr = Math.min(devicePixelRatio || 1, small ? 1.5 : 2);
  renderer.setPixelRatio(pr);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .62;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(lin(0xD8D2C0), 900, 2000);
  const camera = new THREE.PerspectiveCamera(50, 1, .3, 9000);
  const world = new THREE.Group(); scene.add(world);
  Object.assign(G3, { renderer, scene, camera, world, wind: { value: 0 }, zoo: {} });

  // textures
  const DS = small ? 256 : 1024;
  const detailField = tileField(DS, 16, 5);
  const detail = grayTex(detailField, DS, .72, 1.0), detailN = normalTex(detailField, DS, 9);
  const waterField = tileField(DS, 8, 5), waterN = normalTex(waterField, DS, 14);
  G3.detailN = detailN; G3.blob1 = blobGeometry(1, .35);
  G3.barkTex = woodTex(256, 512, '#8B6A43', '60,35,15'); G3.barkTex.wrapS = G3.barkTex.wrapT = THREE.RepeatWrapping; G3.barkTex.repeat.set(1, 4);
  G3.chestWood = woodTex(512, 256, '#7A4A22', '40,20,8');
  const mistTex = softTex('mist'), rayTex = softTex('ray');
  const SURF = makeSurfaces(small ? 256 : 1024); G3.surf = SURF; animalTextures();
  G3.rockGeo = blobGeometry(3, .3);

  // sun & sky
  const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 16), THREE.MathUtils.degToRad(205));
  let sky = null;
  if (THREE.Sky){
    sky = new THREE.Sky(); sky.scale.setScalar(8000);
    const u = sky.material.uniforms; u.turbidity.value = 5.5; u.rayleigh.value = 1.5; u.mieCoefficient.value = .005; u.mieDirectionalG.value = .86; u.sunPosition.value.copy(sunDir);
    const pm = new THREE.PMREMGenerator(renderer), envScene = new THREE.Scene(); envScene.add(sky);
    scene.environment = pm.fromScene(envScene).texture; envScene.remove(sky); scene.add(sky); pm.dispose();
  } else scene.background = lin(0xBFD8E6);
  const hemi = new THREE.HemisphereLight(lin(0xCFE3F2), lin(0x6A5A3C), .35); scene.add(hemi);
  const sun = new THREE.DirectionalLight(lin(0xFFD9A0), 2.4);
  sun.castShadow = true; const ss = small ? 1024 : 4096; sun.shadow.mapSize.set(ss, ss);
  Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 1, far: 420 });
  sun.shadow.bias = -.0004; sun.shadow.normalBias = .04; scene.add(sun, sun.target);

  // the paper map on a wooden table; it peels away like a page
  const mapCanvas = drawMap(); G3.mapCanvas = mapCanvas;
  const mapTex = new THREE.CanvasTexture(mapCanvas); mapTex.encoding = THREE.sRGBEncoding; mapTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const peel = { value: -400 }, peelR = { value: 12 };
  const parchMat = new THREE.MeshBasicMaterial({ map: mapTex, transparent: true, fog: false, toneMapped: false, depthWrite: false, side: THREE.DoubleSide });
  parchMat.onBeforeCompile = sh => {
    sh.uniforms.uPeel = peel; sh.uniforms.uR = peelR;
    sh.vertexShader = 'uniform float uPeel; uniform float uR;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float s = uPeel - transformed.y;
      if (s > 0.0){ float a = s / uR;
        if (a < 3.14159){ transformed.y = uPeel - uR * sin(a); transformed.z = uR * (1.0 - cos(a)); }
        else { transformed.y = uPeel + (s - 3.14159 * uR); transformed.z = 2.0 * uR; } }`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      if (!gl_FrontFacing) diffuseColor.rgb = vec3(.74, .62, .44) * (.94 + .06 * fract(sin(dot(floor(vUv * 300.), vec2(12.9898, 78.233))) * 43758.5453));`);
  };
  const parchment = new THREE.Mesh(new THREE.PlaneGeometry(MAP.x1 - MAP.x0, MAP.z1 - MAP.z0, 60, 84), parchMat);
  parchment.rotation.x = -Math.PI / 2; parchment.position.set((MAP.x0 + MAP.x1) / 2, 1.2, (MAP.z0 + MAP.z1) / 2); parchment.renderOrder = 6;
  const tableTex = woodTex(1024, 1024, '#3A2414', '15,8,3'); tableTex.wrapS = tableTex.wrapT = THREE.RepeatWrapping; tableTex.repeat.set(3, 3);
  const table = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshBasicMaterial({ map: tableTex, transparent: true, fog: false, toneMapped: false, depthWrite: false, color: 0x8a7a6a }));
  table.rotation.x = -Math.PI / 2; table.position.set(0, 1.0, -20); table.renderOrder = 5;
  scene.add(table, parchment);

  // terrain
  const W = MAP.x1 - MAP.x0, D = MAP.z1 - MAP.z0, seg = small ? [150, 210] : [320, 448];
  const tg = new THREE.PlaneGeometry(W, D, seg[0], seg[1]); tg.rotateX(-Math.PI / 2); tg.translate((MAP.x0 + MAP.x1) / 2, 0, (MAP.z0 + MAP.z1) / 2);
  const tp = tg.attributes.position, cols = new Float32Array(tp.count * 3);
  const cSand = new THREE.Color(0xE6CF9A), cWet = new THREE.Color(0xB89C68), cGrass = new THREE.Color(0x5E9A3E), cDeep = new THREE.Color(0x2E6629), cDes = new THREE.Color(0xE3B06A), cDes2 = new THREE.Color(0xCB8E48), cRock = new THREE.Color(0x9A8E7E), cRock2 = new THREE.Color(0x6A6158), cMud = new THREE.Color(0x6B5A3E);
  for (let i = 0; i < tp.count; i++){
    const x = tp.getX(i), z = tp.getZ(i), h = landHeight(x, z), n = fbm(x * .12, z * .12), n2 = fbm(x * .5 + 30, z * .5);
    tp.setY(i, h);
    const dW = desertW(x, z);
    let c = cGrass.clone().lerp(cDeep, n * .8 + n2 * .3).lerp(cDes.clone().lerp(cDes2, n), dW);
    c.lerp(cRock.clone().lerp(cRock2, n), Math.max(smooth(8, 14, h + n2 * 3), smooth(.18, .4, mountW(x, z) + n2 * .1), Math.hypot(x - WF.x, z - WF.z) < 10.5 && h > 5 ? .75 : 0));
    c = cSand.clone().lerp(c, smooth(1.2, 2.4, h + (n2 - .5)));
    if (riverDist(x, z) < 4.2 && h > -1) c.lerp(cMud, .55);
    const ax = x - GORGE.x, az = z - GORGE.z, acr = Math.abs(ax * GORGE.nx + az * GORGE.nz); if (acr < 7 && Math.abs(-ax * GORGE.nz + az * GORGE.nx) < 28) c.lerp(cRock2, smooth(7, 4, acr) * .9);
    if (h < .25) c = cSand.clone().lerp(cWet, smooth(.25, -2.5, h));
    c.convertSRGBToLinear();
    cols[i*3] = c.r; cols[i*3+1] = c.g; cols[i*3+2] = c.b;
  }
  // texture weights per vertex, a softer tint, and contact shadows baked under trees, rocks and ruins
  const spl = new Float32Array(tp.count * 3), white = new THREE.Color(1, 1, 1);
  for (let i = 0; i < tp.count; i++){
    const x = tp.getX(i), z = tp.getZ(i), h = tp.getY(i), n2 = fbm(x * .5 + 30, z * .5), dW = desertW(x, z);
    const ax = x - GORGE.x, az = z - GORGE.z, acr = Math.abs(ax * GORGE.nx + az * GORGE.nz), gorge = acr < 7 && Math.abs(-ax * GORGE.nz + az * GORGE.nx) < 28 ? smooth(7, 4, acr) : 0;
    const rockW = Math.min(1, Math.max(smooth(8, 14, h + n2 * 3), smooth(.18, .4, mountW(x, z) + n2 * .1), gorge, Math.hypot(x - WF.x, z - WF.z) < 10.5 && h > 5 ? .8 : 0));
    const sandW = Math.min(1 - rockW, Math.max(1 - smooth(1.2, 2.4, h + (n2 - .5)), dW, h < .25 ? 1 : 0));
    spl[i*3] = Math.max(0, 1 - rockW - sandW); spl[i*3+1] = sandW; spl[i*3+2] = rockW;
    const c = new THREE.Color(cols[i*3], cols[i*3+1], cols[i*3+2]);
    const tint = white.clone().lerp(c.clone().multiplyScalar(1 / Math.max(.05, (c.r + c.g + c.b) / 3)), .22);
    if (dW > .3) tint.lerp(new THREE.Color(1.1, .9, .7), dW * .6);
    if (h < .2) tint.multiplyScalar(.8);
    cols[i*3] = tint.r; cols[i*3+1] = tint.g; cols[i*3+2] = tint.b;
  }
  const gx = seg[0] + 1, cellX = W / seg[0], cellZ = D / seg[1];
  const darken = (x, z, r, amt) => { const i0 = Math.max(0, Math.floor((x - r - MAP.x0) / cellX)), i1 = Math.min(seg[0], Math.ceil((x + r - MAP.x0) / cellX)), j0 = Math.max(0, Math.floor((z - r - MAP.z0) / cellZ)), j1 = Math.min(seg[1], Math.ceil((z + r - MAP.z0) / cellZ));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++){ const k = j * gx + i, dx = tp.getX(k) - x, dz = tp.getZ(k) - z, f = 1 - amt * Math.exp(-(dx*dx + dz*dz) / (r * r * .35)); cols[k*3] *= f; cols[k*3+1] *= f; cols[k*3+2] *= f; } };
  PLACES.trees.forEach(t => darken(t.x, t.z, 3.2 * t.s, .45));
  PLACES.palms.forEach(p => darken(p.x, p.z, 1.6, .3));
  PLACES.rocks.forEach(p => darken(p.x, p.z, p.s * 1.6, .45));
  PLACES.cacti.forEach(p => darken(p.x, p.z, 1, .3));
  darken(TEMPLE.x, TEMPLE.z, 11, .35);
  tg.setAttribute('color', new THREE.BufferAttribute(cols, 3)); tg.setAttribute('splat', new THREE.BufferAttribute(spl, 3)); tg.computeVertexNormals();
  detail.repeat.set(W / 3, D / 3); detailN.repeat.set(W / 3, D / 3);
  const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: detail, normalMap: detailN, normalScale: new THREE.Vector2(1.6, 1.6), roughness: .95 });
  splatTerrain(terrainMat, SURF, new THREE.Vector2(W / 4, D / 4));
  const terrain = new THREE.Mesh(tg, terrainMat);
  terrain.receiveShadow = true; world.add(terrain);

  // ocean (also fills the river and the gorge floor)
  let water;
  if (THREE.Water){
    water = new THREE.Water(new THREE.PlaneGeometry(2400, 2400), {
      textureWidth: small ? 256 : 512, textureHeight: small ? 256 : 512, waterNormals: waterN,
      sunDirection: sunDir.clone(), sunColor: 0xFFE6B8, waterColor: 0x0B5466, distortionScale: 2.6, fog: true, alpha: .93
    });
    water.material.transparent = true; water.material.uniforms.size.value = 3.2;
  } else water = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), std(0x1E7F94, { roughness: .1, metalness: .2, transparent: true, opacity: .85 }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, .05, -20); world.add(water);
  const foamGeo = new THREE.PlaneGeometry(W, D, 200, 280); foamGeo.rotateX(-Math.PI / 2); foamGeo.translate((MAP.x0 + MAP.x1) / 2, .12, (MAP.z0 + MAP.z1) / 2);
  const fa = new Float32Array(foamGeo.attributes.position.count);
  for (let i = 0; i < fa.length; i++){ const x = foamGeo.attributes.position.getX(i), z = foamGeo.attributes.position.getZ(i), h = landHeight(x, z); fa[i] = riverDist(x, z) < 4 ? 0 : Math.max(0, 1 - Math.abs(h + .2) / .9); }
  foamGeo.setAttribute('foam', new THREE.BufferAttribute(fa, 1));
  const foam = new THREE.Mesh(foamGeo, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uTime: { value: 0 } },
    vertexShader: 'attribute float foam; varying float vF; varying vec2 vP; void main(){ vF = foam; vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'uniform float uTime; varying float vF; varying vec2 vP; void main(){ float w = .5 + .5 * sin(vF * 14. - uTime * 2.2 + sin(vP.x * .3) * 1.5); float a = vF * (.35 + .65 * smoothstep(.55, 1., w)); gl_FragColor = vec4(vec3(1.), a * .8); }' }));
  world.add(foam);
  const flowMat = new THREE.ShaderMaterial(Object.assign({}, FlowShader, { uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false }));
  world.add(new THREE.Mesh(ribbon(RIVER, 3, .14), flowMat));

  // waterfall
  const fg = new THREE.PlaneGeometry(4.6, 13.2, 1, 24), fp = fg.attributes.position;
  for (let i = 0; i < fp.count; i++){ const t = (6.6 - fp.getY(i)) / 13.2; fp.setZ(i, 1.7 * Math.sqrt(Math.max(0, t))); }
  fg.computeVertexNormals();
  const fallMat = new THREE.ShaderMaterial(Object.assign({}, WaterfallShader, { uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  const fall = new THREE.Mesh(fg, fallMat); fall.rotation.y = Math.PI / 2; fall.position.set(FALL_X - .2, 6.3, WF.z); world.add(fall);

  // red route painted on the ground (rides over the bridge)
  const curve = new THREE.CatmullRomCurve3(ROUTE.map(p => V(p[0], 0, p[1]))); G3.curve = curve;
  const N_DASH = 260, dummy = new THREE.Object3D();
  const dashGeo = new THREE.CylinderGeometry(.2, .2, .04, 14); dashGeo.scale(2.4, 1, 1);
  const dashes = new THREE.InstancedMesh(dashGeo, std(0xA3231B, { roughness: .7, emissive: 0x2A0603 }), N_DASH);
  for (let i = 0; i < N_DASH; i++){
    const u = i / (N_DASH - 1), p = curve.getPointAt(u), t = curve.getTangentAt(u);
    dummy.position.set(p.x, Math.max(.15, groundAt(p.x, p.z)) + .06, p.z); dummy.rotation.set(0, Math.atan2(-t.z, t.x), 0); dummy.updateMatrix(); dashes.setMatrixAt(i, dummy.matrix);
  }
  dashes.receiveShadow = true; world.add(dashes);

  // jungle canopy (instanced, swaying)
  const T = PLACES.trees, trunkGeo = new THREE.CylinderGeometry(.18, .34, 1, 10, 1); trunkGeo.translate(0, .5, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, std(0xC8AE90, { roughness: .95, map: G3.barkTex }), T.length);
  const atlas = leafAtlas();
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: atlas, alphaTest: .45, side: THREE.DoubleSide, roughness: .85, envMapIntensity: .25 }); addWind(leafMat, 'leaf');
  const leaves = new THREE.InstancedMesh(foliageCluster(small ? 12 : 22), leafMat, T.length * 4);
  leaves.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: atlas, alphaTest: .45 });
  const gc = [0x5A7A44, 0x6E8E50, 0x4C6C3A, 0x7A9858, 0x648440, 0x48683A].map(c => lin(c));
  T.forEach((t, i) => {
    const th = 4 * t.s + rnd() * 3;
    dummy.position.set(t.x, t.h - .2, t.z); dummy.rotation.set((rnd() - .5) * .15, rnd() * 6, (rnd() - .5) * .15); dummy.scale.set(t.s, th, t.s); dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix);
    for (let k = 0; k < 4; k++){
      const r = (1.3 + rnd() * 1.1) * t.s;
      dummy.position.set(t.x + (rnd() - .5) * 2 * t.s, t.h + th + (k - 1) * .8 * t.s, t.z + (rnd() - .5) * 2 * t.s);
      dummy.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); dummy.scale.set(r, r * (.75 + rnd() * .35), r); dummy.updateMatrix();
      leaves.setMatrixAt(i * 4 + k, dummy.matrix); leaves.setColorAt(i * 4 + k, gc[(rnd() * gc.length) | 0]);
    }
  });
  trunks.castShadow = leaves.castShadow = true; trunks.receiveShadow = leaves.receiveShadow = true;
  world.add(trunks, leaves);

  // grass (wind), ferns, flowers
  const bladeGeo = new THREE.PlaneGeometry(.14, 1, 1, 3); { const p = bladeGeo.attributes.position; for (let i = 0; i < p.count; i++){ const y = p.getY(i) + .5; p.setX(i, p.getX(i) * (1 - y)); p.setZ(i, y * y * .25); p.setY(i, y); } bladeGeo.computeVertexNormals(); }
  const grassMat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: .8 }); addWind(grassMat, 'grass');
  const NG = small ? 5000 : 20000, grass = new THREE.InstancedMesh(bladeGeo, grassMat, NG);
  const grc = [0x4F8F34, 0x6AA845, 0x3E7A2C, 0x86A84A].map(c => lin(c)), dry = [0xC9B070, 0xB59A5A].map(c => lin(c)); let gi = 0;
  for (let i = 0; i < NG * 4 && gi < NG; i++){
    const x = -70 + rnd() * 140, z = -110 + rnd() * 200, h = landHeight(x, z); if (h < .9 || h > 12 || routeDist(x, z) < 1.2) continue;
    const dW = desertW(x, z); if (dW > .5 && rnd() > .08) continue;
    const s = .5 + rnd() * .9; dummy.position.set(x, h - .05, z); dummy.rotation.set((rnd() - .5) * .4, rnd() * 6, (rnd() - .5) * .4); dummy.scale.set(s, s * (h < 1.8 || dW > .5 ? .6 : 1.2), s); dummy.updateMatrix();
    grass.setMatrixAt(gi, dummy.matrix); grass.setColorAt(gi, (h < 1.8 || dW > .5) ? dry[gi % 2] : grc[gi % 4]); gi++;
  }
  grass.count = gi; grass.receiveShadow = true; world.add(grass);
  const ferns = new THREE.InstancedMesh(FROND(), std(0x3F8A35, { side: THREE.DoubleSide, roughness: .7 }), 900); let fi = 0;
  for (let i = 0; i < 6000 && fi < 900; i++){ const x = -60 + rnd() * 80, z = -40 + rnd() * 90, h = landHeight(x, z);
    if (h > 2 && desertW(x, z) < .2 && mountW(x, z) < .3 && routeDist(x, z) > 1.8 && keepClear(x, z)){ const s = .35 + rnd() * .35; for (let k = 0; k < 5 && fi < 900; k++){ dummy.position.set(x, h - .1, z); dummy.rotation.set(-.6 - rnd() * .4, k / 5 * 6.28 + rnd(), 0, 'YXZ'); dummy.scale.set(s, s, s); dummy.updateMatrix(); ferns.setMatrixAt(fi++, dummy.matrix); } } }
  ferns.count = fi; ferns.castShadow = true; ferns.receiveShadow = true; world.add(ferns);
  const flowers = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.09, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .5 }), 260); let fl = 0;
  const fc = [0xE0312B, 0xF2B829, 0xE85A9C, 0xF27A1E].map(c => lin(c));
  for (let i = 0; i < 4000 && fl < 260; i++){ const x = -60 + rnd() * 80, z = -40 + rnd() * 90, h = landHeight(x, z);
    if (h > 2 && desertW(x, z) < .2 && routeDist(x, z) > 1.4){ dummy.position.set(x, h + .3 + rnd() * .4, z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, .6, 1); dummy.updateMatrix(); flowers.setMatrixAt(fl, dummy.matrix); flowers.setColorAt(fl, fc[fl % 4]); fl++; } }
  flowers.count = fl; world.add(flowers);

  // palms, cacti, rocks, bones
  const palms = PLACES.palms.map(p => { const t = palmTree(); t.position.set(p.x, p.h - .2, p.z); t.rotation.y = rnd() * 6; world.add(t); return t; });
  PLACES.cacti.forEach(p => { const c = cactus(); c.position.set(p.x, p.h - .15, p.z); c.rotation.y = rnd() * 6; world.add(c); });
  const rockM = triplanar(SURF.rock, .22, 0xC8BEB0); G3.rockM = rockM;
  PLACES.rocks.forEach(p => { const r = mesh(G3.rockGeo, rockM); r.position.set(p.x, p.h + p.s * .2, p.z); r.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); r.scale.set(p.s, p.s * .7, p.s * (.8 + rnd() * .4)); world.add(r); });
  const boneM = std(0xEFE6D0, { roughness: .6 });
  for (let i = 0; i < 6; i++){ const x = 14 + rnd() * 26, z = -70 + rnd() * 26, h = landHeight(x, z);
    const rib = new THREE.Group(); for (let k = 0; k < 6; k++){ const b = mesh(new THREE.TorusGeometry(.6 - k * .04, .055, 8, 20, Math.PI), boneM); b.position.x = k * .32; b.rotation.y = Math.PI / 2; rib.add(b); }
    const spine = mesh(new THREE.CylinderGeometry(.07, .07, 2, 8), boneM); spine.rotation.z = Math.PI / 2; spine.position.set(.8, .6, 0); rib.add(spine);
    rib.position.set(x, h - .1, z); rib.rotation.y = rnd() * 6; world.add(rib); }
  // boulders lining the falls and the gorge rim
  for (let i = 0; i < 12; i++){ const a = rnd() * Math.PI - Math.PI / 2, r = 6 + rnd() * 3, x = WF.x + Math.cos(a) * r, z = WF.z + Math.sin(a) * r; const s = 1 + rnd() * 1.5;
    const b = mesh(G3.rockGeo, rockM); b.scale.set(s, s * .8, s); b.position.set(x, landHeight(x, z), z); world.add(b); }

  // shipwreck
  const wreck = new THREE.Group(), hullWood = std(0xE8C8A0, { roughness: .9, map: G3.chestWood });
  const hs = new THREE.Shape(); hs.moveTo(-3.2, 1.2); hs.lineTo(3.4, 1.2); hs.quadraticCurveTo(3.2, -.5, 1.6, -1.1); hs.lineTo(-2.2, -1.1); hs.quadraticCurveTo(-3.3, -.4, -3.2, 1.2);
  const hull = new THREE.ExtrudeGeometry(hs, { depth: 2.2, bevelEnabled: true, bevelThickness: .15, bevelSize: .12, bevelSegments: 3, curveSegments: 20 }); hull.translate(0, 0, -1.1);
  wreck.add(mesh(hull, hullWood));
  const mast = mesh(new THREE.CylinderGeometry(.12, .15, 4.5, 12), std(0x5B3A1C)); mast.position.set(.5, 2.8, 0); mast.rotation.z = .5; wreck.add(mast);
  const sgeo = new THREE.PlaneGeometry(1.8, 2.2, 8, 8); { const p = sgeo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 1.5) * .2 + (rnd() - .5) * .05); sgeo.computeVertexNormals(); }
  const sail = mesh(sgeo, std(0xE9DEC4, { side: THREE.DoubleSide, roughness: .95 })); sail.position.set(1.4, 3.3, .1); sail.rotation.set(.2, .3, .5); wreck.add(sail);
  wreck.position.set(-14, .2, 80); wreck.rotation.set(.1, 2.3, .32); world.add(wreck);

  const routeAt = (u, off) => { const p = curve.getPointAt(u), t = curve.getTangentAt(u); const x = p.x - t.z * off, z = p.z + t.x * off; return { x, z, y: groundAt(x, z), t }; };

  // signposts
  [[.07, 'a² + b² = c²', 3.4], [.69, '2, 3, 5, 7, 11 …', 3.6]].forEach(([u, txt, off]) => {
    const r = routeAt(u, off), s = woodSign(txt); s.position.set(r.x, r.y - .1, r.z); s.rotation.y = Math.atan2(-r.t.z, r.t.x) + (off > 0 ? Math.PI / 2 : -Math.PI / 2) + Math.PI; world.add(s); });

  // Fibonacci stones along the trail: they light up as you pass
  const fibs = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144], tablets = [];
  const tabStone = stoneMat(0x958D7C);
  fibs.forEach((n, i) => { const u = .035 + i * .072; if (u > .97) return; const side = i % 2 ? 2.7 : -2.7, r = routeAt(u, side);
    const tb = new THREE.Group(); tb.add(mesh(new THREE.BoxGeometry(1.1, 1.5, .28), tabStone).translateY(.75));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.1), engraved(String(n), { w: 256, h: 256, size: 150, font: '150px "IM Fell English SC", Georgia, serif' })); face.position.set(0, .82, .145); tb.add(face);
    tb.position.set(r.x, r.y - .1, r.z); const back = curve.getPointAt(Math.max(0, u - .03)); tb.lookAt(back.x, r.y, back.z); tb.rotation.z = (rnd() - .5) * .12; world.add(tb);
    tablets.push({ u, mat: face.material }); });

  // ruined columns along the jungle trail, and the monkey on one of them
  const ruins = [[.29, -5.5, false], [.3, 5.5, false], [.315, -6, true], [.37, 6, true], [.4, -5, false], [.41, 5.8, true]];
  ruins.forEach(([u, off, broken]) => { const r = routeAt(u, off), c = buildColumn(broken); c.position.set(r.x, r.y - .3, r.z); c.rotation.set((rnd() - .5) * .08, rnd() * 6, (rnd() - .5) * .08); world.add(c); });
  { const a = routeAt(.29, -5.5), b = routeAt(.3, 5.5); const lintel = mesh(new THREE.BoxGeometry(Math.hypot(a.x - b.x, a.z - b.z) + 1.6, .7, 1.4), stoneMat(0x9A9282));
    lintel.position.set((a.x + b.x) / 2, Math.max(a.y, b.y) + 5.9, (a.z + b.z) / 2); lintel.rotation.y = Math.atan2(-(b.z - a.z), b.x - a.x); world.add(lintel);
    const ins = new THREE.Mesh(new THREE.PlaneGeometry(6, .6), engraved('1, 1, 2, 3, 5, 8, 13, 21 …', { w: 1024, h: 110, size: 80 })); ins.position.copy(lintel.position); ins.rotation.y = lintel.rotation.y;
    const fwd = curve.getTangentAt(.295); ins.position.x -= fwd.x * .72; ins.position.z -= fwd.z * .72; ins.rotation.y = Math.atan2(-fwd.x, -fwd.z) + Math.PI; world.add(ins); G3.lintelMat = ins.material; }
  const fallen = buildColumn(true); { const r = routeAt(.37, 11); fallen.position.set(r.x, r.y + .5, r.z); fallen.rotation.set(0, 1, Math.PI / 2); world.add(fallen); }

  // temple
  const temple = buildTemple(); temple.position.set(TEMPLE.x, TEMPLE.h - .3, TEMPLE.z); world.add(temple);

  // desert obelisks with primes
  [[.66, 9, '2\n3\n5\n7'], [.73, -9.5, '11\n13\n17\n19'], [.8, 9.5, '23\n29\n31\n37']].forEach(([u, off, txt]) => {
    const r = routeAt(u, off), g = new THREE.Group(), st = stoneMat(0xA88B62), h = 8 + rnd() * 2;
    const shaft = mesh(new THREE.CylinderGeometry(.7, 1.1, h, 4, 1), st); shaft.position.y = h / 2; shaft.rotation.y = Math.PI / 4; g.add(shaft);
    const tip = mesh(new THREE.ConeGeometry(.7, 1.4, 4), std(0xE8C35A, { metalness: .9, roughness: .3 })); tip.position.y = h + .7; tip.rotation.y = Math.PI / 4; g.add(tip);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 6), engraved(txt, { w: 192, h: 1152, size: 120, base: '#BFA27A', moss: 0, font: '120px "IM Fell English SC", Georgia, serif' }));
    face.position.set(0, h * .42, .68); face.rotation.x = -.04; g.add(face);
    g.position.set(r.x, r.y - .2, r.z); const p = curve.getPointAt(u); g.lookAt(p.x, g.position.y, p.z); world.add(g);
    face.material.userData.auto = uu => 1.6 * plateau(uu, u - .05, u + .03, .02); });

  // bridge, cave, treasure
  const bridge = buildBridge(); world.add(bridge);
  const hd = V(XPOS.x - 14, 0, XPOS.z + 93).normalize(); G3.hd = hd;
  const cave = buildCave(); cave.scale.setScalar(1.15); { const cx = XPOS.x + hd.x * 8, cz = XPOS.z + hd.z * 8; cave.position.set(cx, landHeight(cx, cz) - 1.2, cz); cave.lookAt(XPOS.x - hd.x * 10, cave.position.y, XPOS.z - hd.z * 10); world.add(cave); }
  const treasure = new THREE.Group(); treasure.visible = false; world.add(treasure);
  const xg = new THREE.Group(); const xm = std(0xA3231B, { roughness: .7, emissive: 0x2A0603 });
  [Math.PI / 4, -Math.PI / 4].forEach(r => { const b = mesh(new THREE.BoxGeometry(5.5, .12, .9), xm); b.rotation.y = r; xg.add(b); });
  xg.position.set(XPOS.x, XH + .06, XPOS.z); treasure.add(xg);
  const chest = buildChest(); chest.position.set(XPOS.x, XH - 2.4, XPOS.z); chest.lookAt(XPOS.x - hd.x * 10, chest.position.y, XPOS.z - hd.z * 10); treasure.add(chest);
  const shovel = new THREE.Group(); shovel.add(mesh(new THREE.CylinderGeometry(.06, .06, 2.4, 8), std(0x6B4422)).translateY(1.2));
  shovel.add(mesh(new THREE.BoxGeometry(.5, .6, .05), std(0x8A8F94, { metalness: .8, roughness: .35 })).translateY(.1));
  shovel.position.set(XPOS.x - hd.z * 3.6, XH, XPOS.z + hd.x * 3.6); shovel.rotation.z = .25; treasure.add(shovel);
  const mound = mesh(G3.blob1, std(0xD8B57A, { roughness: 1 })); mound.scale.set(2.2, .55, 1.6); mound.position.set(XPOS.x + hd.z * 3.4 + hd.x * 1.5, XH, XPOS.z - hd.x * 3.4 + hd.z * 1.5); treasure.add(mound);
  const beams = new THREE.Group(); beams.position.set(XPOS.x, XH + 1.5, XPOS.z); treasure.add(beams);
  for (let i = 0; i < 6; i++){ const b = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 16), new THREE.MeshBasicMaterial({ map: rayTex, color: lin(0xFFC860), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    b.geometry.translate(0, 8, 0); b.rotation.set((rnd() - .5) * .5, i / 6 * Math.PI, (rnd() - .5) * .5); beams.add(b); }
  const NS = 400, sandPos = new Float32Array(NS * 3), sandVel = new Float32Array(NS * 3);
  const sandGeo = new THREE.BufferGeometry(); sandGeo.setAttribute('position', new THREE.BufferAttribute(sandPos, 3));
  const sand = new THREE.Points(sandGeo, new THREE.PointsMaterial({ color: lin(0xD9B77E), size: .18, transparent: true, opacity: 0 })); world.add(sand);

  // floating equations that appear briefly in the air
  const floaters = [[.3, 'φ = (1 + √5) ⁄ 2', V(FALL_X + 4, 16, WF.z)], [.39, 'a² + b² = c²', V(TEMPLE.x + 4, TEMPLE.h + 17, TEMPLE.z)], [.72, '2, 3, 5, 7, 11, 13 …', null], [.9, 'y = a cosh(x ⁄ a)', V(GORGE.x, 9, GORGE.z)], [.97, 'eⁱᶿ = cos θ + i sin θ', V(XPOS.x + hd.x * 4, 15, XPOS.z + hd.z * 4)]].map(([u, txt, p]) => {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 192; const x = c.getContext('2d');
    x.font = 'italic 110px "STIX Two Text", "Times New Roman", serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = '#FFB43A'; x.shadowBlur = 30; x.fillStyle = '#FFE6B0'; x.fillText(txt, 512, 100, 980); x.fillText(txt, 512, 100, 980);
    const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, toneMapped: false, fog: false }));
    s.scale.set(12, 2.25, 1); if (!p){ const r = routeAt(u + .03, 0); p = V(r.x, r.y + 9, r.z); } s.position.copy(p); world.add(s); return { u, s };
  });

  // mist, light shafts, falling leaves, dust
  const mists = [];
  const addMist = (x, z, yOff, s, op) => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTex, transparent: true, depthWrite: false, opacity: op, color: lin(0xF4EEE2) }));
    m.scale.set(s, s * .55, 1); m.position.set(x, groundAt(x, z) + yOff, z); world.add(m); mists.push({ m, x, z, ph: rnd() * 6, op }); };
  for (let i = 0; i < (small ? 14 : 30); i++){ const r = routeAt(.12 + rnd() * .32, (rnd() - .5) * 36); addMist(r.x, r.z, 1 + rnd() * 2, 10 + rnd() * 10, .18); }
  for (let i = 0; i < 12; i++) addMist(FALL_X + 2 + rnd() * 4, WF.z + (rnd() - .5) * 6, .5 + rnd() * 3, 5 + rnd() * 5, .55);
  for (let i = 0; i < 12; i++){ const s = (rnd() - .5) * 40; addMist(GORGE.x - GORGE.nz * s, GORGE.z + GORGE.nx * s, 1 + rnd(), 9 + rnd() * 6, .4); }
  const shafts = [];
  for (let i = 0; i < 10; i++){ const r = routeAt(.14 + i * .028, (i % 2 ? 1 : -1) * (3 + rnd() * 6)); const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 24), new THREE.MeshBasicMaterial({ map: rayTex, color: lin(0xFFE2A8), transparent: true, opacity: .1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    m.geometry.translate(0, 12, 0); m.position.set(r.x, r.y - 1, r.z); m.lookAt(r.x + sunDir.x * 10, r.y - 1 + sunDir.y * 10, r.z + sunDir.z * 10); m.rotateX(Math.PI / 2); world.add(m); shafts.push({ m, ph: rnd() * 6 }); }
  const NL = reduce ? 0 : (small ? 60 : 130), leafG = new THREE.PlaneGeometry(.22, .22); { const uvs = leafG.attributes.uv; for (let i = 0; i < uvs.count; i++) uvs.setXY(i, .3 + uvs.getX(i) * .14, .3 + uvs.getY(i) * .14); }
  const leafFall = new THREE.InstancedMesh(leafG, new THREE.MeshStandardMaterial({ color: 0xffffff, map: atlas, alphaTest: .4, side: THREE.DoubleSide, roughness: .8 }), Math.max(1, NL));
  const leafState = []; const lc = [0xFFFFFF, 0xF0D080, 0xE8A050, 0xC0E090].map(c => lin(c));
  for (let i = 0; i < NL; i++){ leafState.push({ x: 0, y: -999, z: 0, vy: 0, ph: rnd() * 6, s: rnd() * 6 }); leafFall.setColorAt(i, lc[i % 4]); }
  leafFall.count = NL; world.add(leafFall);
  const ND = 300, dustPos = new Float32Array(ND * 3); for (let i = 0; i < ND * 3; i++) dustPos[i] = (rnd() - .5) * 30;
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: lin(0xFFE0A0), size: .07, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); world.add(dust);

  /* wildlife */
  [[-16,74],[-8,76],[0,74],[6,74],[12,72],[20,70]].forEach(([bx, bz]) => {
    const c = crab(), ang = rnd() * 6, ph = rnd() * 6, flee = { x: 0, z: 0 }; world.add(c); G3.zoo.crab = G3.zoo.crab || c;
    G3.anims.push((t, dt) => { const s = Math.sin(t * 1.2 + ph) * 2.5; let x = bx + Math.cos(ang) * s + flee.x, z = bz + Math.sin(ang) * s + flee.z;
      const cp = G3.camera.position, dx = x - cp.x, dz = z - cp.z, d = Math.hypot(dx, dz);
      if (d < 14){ flee.x += dx / d * dt * 4; flee.z += dz / d * dt * 4; x = bx + flee.x; z = bz + flee.z; }
      c.position.set(x, Math.max(.05, landHeight(x, z)), z); c.rotation.y = -ang + Math.PI / 2;
      c.userData.legs.forEach((l, k) => l.rotation.x = Math.sin(t * (d < 14 ? 30 : 14) + k) * .25); c.userData.claws.forEach((f, k) => f.rotation.z = Math.max(0, Math.sin(t * 2.3 + ph + k)) * .5); });
  });
  const tur = turtle(); world.add(tur); G3.zoo.turtle = tur;
  G3.anims.push((t) => { const a = t * .18; tur.position.set(-10 + Math.cos(a) * 16, -.35 + Math.sin(t * .8) * .1, 96 + Math.sin(a) * 8); tur.rotation.y = -a;
    tur.userData.fl.forEach(({ p, z }) => p.rotation.x = Math.sin(t * 2.4) * .5 * z); });
  [[-40, 90, 10, .25], [45, 40, 12, -.2]].forEach(([cx, cz, r, sp]) => { const f = sharkFin(); world.add(f);
    G3.anims.push((t) => { const a = t * sp; f.position.set(cx + Math.cos(a) * r, -.25, cz + Math.sin(a) * r); f.rotation.y = -a + (sp > 0 ? -Math.PI / 2 : Math.PI / 2); }); });
  const gulls = [0, 1, 2, 3].map(() => { const b = bird(0xF4F1EA, 0xDCDDE0, 0xE8A23A, 1.1); world.add(b); return b; });
  gulls.forEach((b, i) => G3.anims.push((t) => { const a = t * (.35 + i * .05) + i * 1.6; b.position.set(6 + Math.cos(a) * (14 + i * 3), 12 + i, 78 + Math.sin(a) * 8); b.rotation.y = -a - Math.PI; b.rotation.z = .3;
    b.userData.wings.forEach(({ p, s }) => p.rotation.x = Math.sin(t * 5 + i) * .35 * s); }));
  // parrots perched on the temple take off as you arrive
  const parrotCols = [[0xD6372A, 0x2E5FC9, 0xF2C230], [0x2E9E4A, 0xE8402E, 0xF2C230], [0xE8B62A, 0x2E7FC9, 0x222222], [0xD6372A, 0x2EA0C9, 0xF2C230]];
  const top = temple.userData.top;
  for (let i = 0; i < 9; i++){ const [b, w, k] = parrotCols[i % 4], p = bird(b, w, k, 1.1); world.add(p); G3.zoo.parrot = G3.zoo.parrot || p;
    const perch = V(TEMPLE.x + (rnd() - .5) * 5, TEMPLE.h - .3 + top + .3, TEMPLE.z + (rnd() - .5) * 5), ph = i * .7, rr = 10 + i * 1.5;
    G3.anims.push((t) => { const f = ease(clamp01((G3.u - .365 - i * .004) / .05));
      if (f <= 0){ p.position.copy(perch); p.rotation.set(0, ph, 0); p.userData.wings.forEach(({ p: wp, s }) => wp.rotation.x = -1.2 * s); return; }
      const a = t * .5 + ph, circ = V(TEMPLE.x + 12 + Math.cos(a) * rr, TEMPLE.h + 18 + Math.sin(t + i) * 2, TEMPLE.z + Math.sin(a) * rr);
      const mid = perch.clone().lerp(circ, f); mid.y += Math.sin(f * Math.PI) * 6;
      p.position.copy(mid); p.rotation.set(0, f < 1 ? Math.atan2(-(circ.z - perch.z), circ.x - perch.x) : -a - Math.PI, .25);
      p.userData.wings.forEach(({ p: wp, s }) => wp.rotation.x = Math.sin(t * 14 + i) * .8 * s); }); }
  const vult = bird(0x3A2E26, 0x2A211B, 0xE9D9B8, 1.8); world.add(vult);
  G3.anims.push((t) => { const a = t * .22; vult.position.set(26 + Math.cos(a) * 16, 26, -66 + Math.sin(a) * 16); vult.rotation.y = -a - Math.PI; vult.rotation.z = .35;
    vult.userData.wings.forEach(({ p, s }) => p.rotation.x = Math.sin(t * 2) * .12 * s); });
  const mk = monkey(); G3.zoo.monkey = mk; { const r = routeAt(.315, -6); mk.position.set(r.x, r.y + 2.6, r.z); mk.lookAt(curve.getPointAt(.28).x, mk.position.y, curve.getPointAt(.28).z); mk.rotateY(-Math.PI / 2); world.add(mk);
    const baseY = mk.position.y; G3.anims.push((t) => { mk.position.y = baseY + Math.abs(Math.sin(t * 3)) * .35; mk.userData.arm.rotation.z = -2.4 + Math.sin(t * 6) * .6; }); }
  const sn = snake(); world.add(sn); G3.zoo.snake = sn.userData.segs[6];
  { const p = curve.getPointAt(.42), t2 = curve.getTangentAt(.42); G3.snake = { x: p.x, z: p.z, nx: -t2.z, nz: t2.x }; }
  G3.anims.push((t) => { const S = G3.snake, segs = sn.userData.segs, n = segs.length;
    for (let i = 0; i < n; i++){ const s = ((t * 1.4) % 14) - 7 - i * .3, w = Math.sin(s * 1.6 + t * 3) * .7;
      const x = S.x + S.nx * s + S.nz * w * .5, z = S.z + S.nz * s - S.nx * w * .5;
      segs[i].position.set(x, landHeight(x, z) + .18, z); if (i) segs[i].lookAt(segs[i - 1].position); }
    segs[0].lookAt(segs[1].position); segs[0].rotateY(Math.PI); sn.userData.tongue.scale.z = Math.sin(t * 9) > .3 ? 1 : .01; });
  for (let i = 0; i < 3; i++){ const cm = camel(); world.add(cm); cm.scale.setScalar(.9); G3.zoo.camel = G3.zoo.camel || cm;
    G3.anims.push((t) => { const s = ((t * 1.6 + i * 4.5) % 46) - 23; const x = 22 + s * .6, z = -64 + s * .8 + i * .6, h = landHeight(x, z);
      cm.position.set(x, h - .1 + Math.abs(Math.sin(t * 3.4)) * .08, z); cm.rotation.y = Math.atan2(-.8, .6);
      cm.userData.legs.forEach(({ p, knee, ph }) => { p.rotation.z = Math.sin(t * 3.4 + ph) * .35; knee.rotation.z = Math.max(0, -Math.sin(t * 3.4 + ph + .8)) * .7; }); }); }
  // the jaguar leaps across the trail (scroll-driven)
  const jag = jaguar(); world.add(jag); jag.scale.setScalar(.95); G3.zoo.jaguar = jag;
  { const p = curve.getPointAt(.27), tt = curve.getTangentAt(.27), n = V(-tt.z, 0, tt.x);
    const S = V(p.x - n.x * 8, 0, p.z - n.z * 8), E = V(p.x + n.x * 9, 0, p.z + n.z * 9);
    const perch = mesh(G3.rockGeo, rockM); perch.scale.set(1.6, 1.1, 1.4); perch.position.set(S.x, landHeight(S.x, S.z) + .4, S.z); world.add(perch);
    const yaw = Math.atan2(-n.z, n.x);
    G3.anims.push((t) => { const u = G3.u, f = clamp01((u - .245) / .04), run = clamp01((u - .287) / .05) * 14;
      jag.visible = u < .37 && u > .16;
      const L = jag.userData.legs, tail = jag.userData.tail;
      if (f <= 0){ jag.position.set(S.x, landHeight(S.x, S.z) + 1.2, S.z); jag.rotation.set(0, yaw, 0); L.forEach((l, k) => l.rotation.z = k < 2 ? -.6 : .6); jag.scale.y = .88; tail.rotation.y = Math.sin(t * 2) * .4; return; }
      jag.scale.y = .95; const q = S.clone().lerp(E, f).addScaledVector(n, run), base = landHeight(q.x, q.z);
      const arc = Math.sin(Math.PI * f) * 4.2 * (f < 1 ? 1 : 0);
      jag.position.set(q.x, Math.max(base, base + arc + (f < 1 ? (1 - f) * 1.2 : 0)), q.z);
      jag.rotation.set(0, yaw, f < 1 ? (.5 - f) * .7 : 0);
      if (f < 1) L.forEach((l, k) => l.rotation.z = k < 2 ? 1.1 : -1.1); else L.forEach((l, k) => l.rotation.z = Math.sin(t * 16 + (k % 2) * Math.PI + (k < 2 ? 0 : 1.5)) * .9);
      tail.rotation.z = -.3 + Math.sin(t * 6) * .2; }); }
  // bats burst from the cave during the finale
  const bats = []; for (let i = 0; i < 22; i++){ const b = bat(); b.visible = false; world.add(b); bats.push({ b, d: V(rnd() - .5, .4 + rnd() * .6, 1).normalize(), sp: 10 + rnd() * 8, ph: rnd() * 6 }); }
  G3.anims.push((t) => { const r = G3.r; const on = r > .06 && r < .45; bats.forEach(({ b, d, sp, ph }, i) => { b.visible = on;
    if (!on) return; const k = (r - .06 - i * .006) * 3.2; if (k < 0){ b.visible = false; return; }
    const dir = V(d.x * 1.6 - hd.x * d.z, d.y, d.x * 1.6 - hd.z * d.z).normalize();
    const o = cave.position.clone().add(V(0, 3, 0)).addScaledVector(dir, k * sp);
    o.y += Math.sin(t * 8 + ph) * .3; b.position.copy(o); b.lookAt(o.clone().add(dir)); b.rotateY(-Math.PI / 2);
    b.userData.wings.forEach(({ p, s }) => p.rotation.x = Math.sin(t * 30 + ph) * 1.1 * s); }); });
  G3.anims.push((t) => palms.forEach((p, i) => { p.userData.crown.rotation.z = Math.sin(t * 1.1 + i) * .05; p.userData.crown.rotation.x = Math.cos(t * .9 + i) * .04; }));
  // clouds
  const ctex = cloudTex();
  for (let i = 0; i < 16; i++){ const cl = new THREE.Group();
    for (let k = 0; k < 6; k++){ const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ctex, transparent: true, depthWrite: false, opacity: .9, color: lin(0xFFF6E8) })); const w = 16 + rnd() * 14; s.scale.set(w, w * .5, 1); s.position.set(k * 6 - 15, rnd() * 3, (rnd() - .5) * 8); cl.add(s); }
    const x0 = -160 + rnd() * 320, z0 = -200 + rnd() * 320, y0 = 50 + rnd() * 22; cl.position.set(x0, y0, z0); world.add(cl);
    G3.anims.push((t) => { cl.position.x = ((x0 + t * 1.6 + 180) % 360) - 180; }); }

  // post-processing: depth of field (desktop) + bloom + film grade + FXAA
  let composer = null, fxaa = null, grade = null, bloom = null, bokeh = null;
  try {
    if (THREE.EffectComposer && THREE.RenderPass && THREE.ShaderPass && THREE.UnrealBloomPass){
      const rt = new THREE.WebGLRenderTarget(innerWidth * pr, innerHeight * pr, { type: THREE.HalfFloatType });
      composer = new THREE.EffectComposer(renderer, rt); composer.setPixelRatio(pr);
      composer.addPass(new THREE.RenderPass(scene, camera));
      if (THREE.BokehPass && !small && !reduce){ bokeh = new THREE.BokehPass(scene, camera, { focus: 20, aperture: .00006, maxblur: .006, width: innerWidth, height: innerHeight }); composer.addPass(bokeh); }
      bloom = new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .32, .6, .92); composer.addPass(bloom);
      grade = new THREE.ShaderPass(GradeShader); composer.addPass(grade);
      if (THREE.FXAAShader){ fxaa = new THREE.ShaderPass(THREE.FXAAShader); composer.addPass(fxaa); }
    }
  } catch (e) { console.warn(e); composer = null; }

  Object.assign(G3, { sky, sun, sunDir, hemi, parchment, peel, table, water, foam, flowMat, fallMat, chest, treasure, beams, sand, sandPos, sandVel, curve, temple, cave, bridge,
    tablets, floaters, mists, shafts, leafFall, leafState, dust, composer, fxaa, grade, bloom, bokeh, pr, burst: [], dim: 0, u: 0, r: 0 });
  buildMini();
  resize3D();
  $('enterBtn').disabled = false; $('loading').hidden = true;
  requestAnimationFrame(frame);
}

/* mini map */
let miniBase;
function buildMini(){
  const c = $('mini');
  miniBase = document.createElement('canvas'); miniBase.width = c.width; miniBase.height = c.height;
  miniBase.getContext('2d').drawImage(G3.mapCanvas, 0, 0, c.width, c.height);
}
function drawMini(u){
  const c = $('mini'), g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); g.drawImage(miniBase, 0, 0);
  const p = G3.curve.getPointAt(Math.min(1, Math.max(0, u)));
  const x = (p.x - MAP.x0) / (MAP.x1 - MAP.x0) * c.width, y = (p.z - MAP.z0) / (MAP.z1 - MAP.z0) * c.height;
  g.fillStyle = '#A3231B'; g.strokeStyle = '#F4E6C3'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); g.stroke();
}

/* Scroll → dive, journey progress, finale progress */
let stops = [];
function computeStops(){
  const at = el => Math.max(0, el.offsetTop + el.offsetHeight / 2 - innerHeight / 2);
  const intro = $('intro'); G3.diveEnd = intro.offsetTop + intro.offsetHeight - innerHeight * .6;
  stops = [{ s: 0, u: 0 }, { s: G3.diveEnd, u: 0 }];
  document.querySelectorAll('.chapter[data-u]').forEach(el => stops.push({ s: at(el), u: +el.dataset.u }));
  stops.push({ s: $('finale').offsetTop, u: 1 });
}
const ease = f => f * f * (3 - 2 * f);
const easeIO = f => f < .5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2;
const clamp01 = v => Math.max(0, Math.min(1, v));
let sy = 0;   // smoothed scroll position that drives every animation
function scrollU(y = sy){
  for (let i = 0; i < stops.length - 1; i++){ const a = stops[i], b = stops[i + 1]; if (y <= b.s) return a.u + (b.u - a.u) * ease(clamp01((y - a.s) / Math.max(1, b.s - a.s))); }
  return 1;
}
function scrollForU(u){ let lo = 0, hi = stops[stops.length - 1].s; for (let k = 0; k < 40; k++){ const m = (lo + hi) / 2; if (scrollU(m) < u) lo = m; else hi = m; } return hi; }
function finaleR(){ const f = $('finale'); return clamp01((sy - f.offsetTop) / Math.max(1, f.offsetHeight - innerHeight)); }
function resize3D(){
  computeStops();
  if (!G3.ok || !G3.renderer) return;
  G3.renderer.setSize(innerWidth, innerHeight, false);
  G3.camera.aspect = innerWidth / innerHeight; G3.camera.fov = innerWidth < innerHeight ? 62 : 50; G3.camera.updateProjectionMatrix();
  if (G3.composer){ G3.composer.setSize(innerWidth, innerHeight); if (G3.bloom) G3.bloom.setSize(innerWidth, innerHeight);
    if (G3.fxaa) G3.fxaa.material.uniforms.resolution.value.set(1 / (innerWidth * G3.pr), 1 / (innerHeight * G3.pr)); }
}
addEventListener('resize', resize3D);

function V(x = 0, y = 0, z = 0){ return new THREE.Vector3(x, y, z); }

/* Camera choreography along the trail: framing changes per set piece */
function journeyShot(u, out){
  const g = G3, cu = Math.min(.985, Math.max(0, u)), p = g.curve.getPointAt(cu), tg = g.curve.getTangentAt(cu).add(g.curve.getTangentAt(Math.min(1, cu + .02))).normalize();
  const back = 19 - 6 * plateau(u, .25, .29, .03) - 4 * plateau(u, .37, .44, .03) + 3 * plateau(u, .64, .84, .04) - 12.5 * plateau(u, .885, .925, .015) - 5 * plateau(u, .95, 1.1, .02);
  const height = 10 - 5 * plateau(u, .25, .29, .03) - 3 * plateau(u, .37, .44, .03) + 3 * plateau(u, .64, .84, .04) - 7.5 * plateau(u, .885, .925, .015) - 3 * plateau(u, .95, 1.1, .02);
  const L = G3.routeLen || (G3.routeLen = g.curve.getLength()), cb = g.curve.getPointAt(Math.max(0, cu - back / L)), behind = cu - back / L;
  const pos = behind >= 0 ? V(cb.x, 0, cb.z) : V(p.x - tg.x * back, 0, p.z - tg.z * back);
  const onBridge = plateau(u, .885, .925, .015);
  pos.y = (onBridge > .5 ? groundAt(pos.x, pos.z) : Math.max(groundAt(p.x, p.z), groundAt(pos.x, pos.z))) + height;
  const ah = g.curve.getPointAt(Math.min(1, cu + .05)); let look = V(ah.x, groundAt(ah.x, ah.z) + 2, ah.z);
  const poi = (target, w) => { if (w > 0) look.lerp(target, w); };
  poi(V(-14, 1.5, 84), plateau(u, -.1, .04, .03) * .55);
  poi(V(FALL_X + 1, 7, WF.z), plateau(u, .26, .335, .03) * .7);
  poi(V(TEMPLE.x, TEMPLE.h + g.temple.userData.top + 1, TEMPLE.z), plateau(u, .37, .44, .03) * .6);
  poi(g.cave.position.clone().add(V(0, 3, 0)), plateau(u, .94, 1.1, .02) * .5);
  out.pos = pos; out.look = look;
  return out;
}
function finaleShot(r, out){
  const X = V(XPOS.x, XH, XPOS.z), hd = G3.hd, side = V(-hd.z, 0, hd.x);
  const keys = [
    [0,   X.clone().addScaledVector(hd, -20).add(V(0, 8, 0)),                      X.clone().add(V(0, 3.5, 0)).addScaledVector(hd, 5)],
    [.3,  X.clone().addScaledVector(hd, -12).addScaledVector(side, 3).add(V(0, 4.6, 0)), X.clone().add(V(0, 1.6, 0))],
    [.58, X.clone().addScaledVector(hd, -7.5).addScaledVector(side, -2).add(V(0, 3.8, 0)), X.clone().add(V(0, 2.2, 0))],
    [1,   X.clone().addScaledVector(hd, -12).addScaledVector(side, 2).add(V(0, 6, 0)),  X.clone().add(V(0, 4.6, 0)).addScaledVector(hd, 2)]];
  let i = 0; while (i < keys.length - 2 && r > keys[i + 1][0]) i++;
  const a = keys[i], b = keys[i + 1], f = ease(clamp01((r - a[0]) / (b[0] - a[0])));
  out.pos = a[1].clone().lerp(b[1], f); out.pos.y = Math.max(out.pos.y, groundAt(out.pos.x, out.pos.z) + 2.5); out.look = a[2].clone().lerp(b[2], f); return out;
}

let camLook, camUp, last = performance.now() / 1000, frameNo = 0, quizU = 0, sandStarted = false, coinsStarted = false, slowFrames = 0, quality = 2;
const shot = {};
function frame(nowMs){
  const t = nowMs / 1000, dt = Math.min(.05, t - last); last = t; frameNo++;
  const g = G3, cam = g.camera, T = t * (reduce ? .4 : 1);
  mouse.x += (mouse.tx - mouse.x) * .05; mouse.y += (mouse.ty - mouse.y) * .05;
  const journeying = state === 'browse' || state === 'gate' || state === 'won' || state === 'revealed';
  sy += (scrollY - sy) * (TEST ? 1 : 1 - Math.exp(-dt * 5.5)); if (Math.abs(scrollY - sy) < .3) sy = scrollY;

  // 1 · the paper map peels away while the land rises out of it
  const dv = journeying ? clamp01(sy / Math.max(1, G3.diveEnd)) : 1;
  const grow = easeIO(clamp01((dv - .14) / .6));
  g.world.scale.y = Math.max(.002, grow); g.world.visible = dv > .02;
  g.peel.value = -150 + easeIO(clamp01((dv - .1) / .68)) * (280 + Math.PI * 12 + 30);
  g.parchment.position.y = 1.2 + easeIO(clamp01(dv / .25)) * 3;
  const paperA = 1 - easeIO(clamp01((dv - .6) / .32)); g.parchment.material.opacity = paperA; g.parchment.visible = paperA > .01;
  g.table.material.opacity = 1 - easeIO(clamp01((dv - .08) / .45)); g.table.visible = g.table.material.opacity > .01;
  g.scene.fog.near = 900 - 820 * grow; g.scene.fog.far = 2000 - 1640 * grow;
  body.classList.toggle('deep', dv > .6);
  if (g.grade){ g.grade.uniforms.uTime.value = t % 10; g.grade.uniforms.uVig.value = .9 - grow * .35; }

  // 2 · journey progress
  const su = scrollU();
  if (state === 'browse' && dv >= 1 && su >= CONFIG.triggerAt){ quizU = CONFIG.triggerAt; startQuiz(); }
  g.u = journeying ? su : quizU;
  g.r = (state === 'won' || state === 'revealed') ? finaleR() : 0;
  const u = g.u, r = g.r;

  if (g.world.visible){
    g.wind.value = T;
    if (g.water.material.uniforms && g.water.material.uniforms.time) g.water.material.uniforms.time.value = T * .55;
    g.foam.material.uniforms.uTime.value = T; g.flowMat.uniforms.uTime.value = T; g.fallMat.uniforms.uTime.value = T;
    g.anims.forEach(f => f(T, dt));
    // inscriptions: Fibonacci stones glow as you pass; temple and cave writing glows near them
    g.tablets.forEach(tb => { const d = u - tb.u; tb.mat.emissiveIntensity = d > -.03 ? (d < .04 ? 2.4 : .9) * clamp01((d + .03) / .02) : 0; });
    const tUp = plateau(u, .34, .46, .03); g.temple.children.forEach(c => { if (c.material && c.material.emissiveMap) c.material.emissiveIntensity = 1.8 * tUp; });
    if (G3.lintelMat) G3.lintelMat.emissiveIntensity = 2 * plateau(u, .26, .33, .02);
    glowMats.forEach(m => { if (m.userData.auto) m.emissiveIntensity = m.userData.auto(u); });
    const art = g.temple.userData; art.art.rotation.y += dt * .4; art.dode.rotation.x += dt * .3; art.ring.rotation.z += dt * .6; art.ring2.rotation.y -= dt * .5; art.glow.intensity = 3 * tUp;
    g.floaters.forEach(fl => { fl.s.material.opacity = plateau(u, fl.u - .035, fl.u + .03, .025) * .95; fl.s.position.y += Math.sin(T + fl.u * 10) * .004; });
    g.mists.forEach(m => { m.m.position.x = m.x + Math.sin(T * .1 + m.ph) * 2; m.m.material.opacity = m.op * (.7 + .3 * Math.sin(T * .3 + m.ph)); });
    g.shafts.forEach(s => s.m.material.opacity = (.07 + .05 * Math.sin(T * .5 + s.ph)) * (1 - plateau(u, .5, 1.2, .05)));
    // falling leaves around the camera in the jungle
    const jungle = plateau(u, .1, .44, .04), cp = cam.position;
    for (let i = 0; i < g.leafState.length; i++){ const L = g.leafState[i];
      if (L.y < groundAt(L.x, L.z) || Math.abs(L.x - cp.x) > 26 || Math.abs(L.z - cp.z) > 26){ if (rnd() < jungle * .1){ L.x = cp.x + (rnd() - .5) * 40; L.z = cp.z + (rnd() - .5) * 40; L.y = groundAt(L.x, L.z) + 9 + rnd() * 6; L.vy = .8 + rnd() * .8; } else { L.y = -999; } }
      else { L.y -= L.vy * dt; L.x += Math.sin(T * 1.3 + L.ph) * dt * .8; L.z += Math.cos(T + L.ph) * dt * .5; }
      dummyM.position.set(L.x, L.y, L.z); dummyM.rotation.set(T * 2 + L.ph, L.s + T, Math.sin(T * 3 + L.ph)); dummyM.scale.setScalar(L.y > -900 ? 1 : 0); dummyM.updateMatrix(); g.leafFall.setMatrixAt(i, dummyM.matrix); }
    g.leafFall.instanceMatrix.needsUpdate = true;
    // dust motes in the desert, the cave and the finale
    g.dust.position.copy(cp); g.dust.rotation.y += dt * .05; g.dust.material.opacity = Math.max(plateau(u, .62, .85, .04) * .5, r > 0 ? .8 : 0, plateau(u, .94, 1.1, .02) * .6);
  }

  // 3 · camera
  const aspect = innerWidth / innerHeight, th = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
  const coverH = Math.max(140 / th, 100 / (th * aspect)) * .92;
  const heroPos = V(mouse.x * 6, coverH, (MAP.z0 + MAP.z1) / 2 + mouse.y * 6), heroLook = V(0, 0, (MAP.z0 + MAP.z1) / 2), heroUp = V(0, 0, -1);
  journeyShot(u, shot);
  let pos = shot.pos.clone(), look = shot.look.clone(), up = V(0, 1, 0), rate = 4.2;
  pos.x += mouse.x * 1.5; pos.y -= mouse.y * 1.2;
  if (r > 0){ finaleShot(r, shot); const b = ease(clamp01(r / .05)); pos.lerp(shot.pos, b); look.lerp(shot.look, b); }
  if (state === 'closed'){ pos.add(V(0, 18, 0)); rate = 1.2; }
  else if (dv < 1){
    // a single smooth arc: straight down over the map → high oblique view over the beach → behind the explorer
    const e = easeIO(clamp01((dv - .05) / .95)), s0 = g.curve.getPointAt(0);
    const mid = V(s0.x * .5, coverH * .38, s0.z + 60), midLook = V(s0.x * .6, 0, s0.z - 30);
    const qb = (a, b, c, t) => a.clone().multiplyScalar((1 - t) * (1 - t)).add(b.clone().multiplyScalar(2 * (1 - t) * t)).add(c.clone().multiplyScalar(t * t));
    pos = qb(heroPos, mid, pos, e); look = qb(heroLook, midLook, look, e);
    up = heroUp.clone().lerp(up, easeIO(clamp01((dv - .08) / .55))).normalize(); rate = 6; }
  if (!camLook){ cam.position.copy(pos); camLook = look.clone(); camUp = up.clone(); }
  if (TEST && window.__cam){ const c = window.__cam(); if (c){ pos = c.pos; look = c.look; } }
  const k = TEST ? 1 : 1 - Math.exp(-dt * rate);
  cam.position.lerp(pos, k); camLook.lerp(look, k); camUp.lerp(up, TEST ? 1 : 1 - Math.exp(-dt * 6)).normalize();
  if (lowTime && !reduce){ cam.position.x += (Math.random() - .5) * .15; cam.position.y += (Math.random() - .5) * .15; }
  cam.up.copy(camUp); cam.lookAt(camLook);
  if (g.bokeh) g.bokeh.uniforms.focus.value = cam.position.distanceTo(camLook);

  // sun follows the view so shadows stay sharp
  const focus = camLook.clone(); focus.y = Math.min(focus.y, 20);
  g.sun.position.copy(focus).addScaledVector(g.sunDir, 200); g.sun.target.position.copy(focus);
  g.dim += ((state === 'closed' ? 1 : 0) - g.dim) * .03;
  g.sun.intensity = 2.4 * (1 - g.dim) * (1 - .35 * plateau(r, .12, 1.2, .2)); g.hemi.intensity = .35 * (1 - g.dim * .8);
  g.renderer.toneMappingExposure = .62 * (1 - g.dim * .7);

  // 4 · the treasure reveal, timed to scroll (only reachable after the right answer)
  const ch = g.chest.userData, cv = g.cave.userData;
  const torch = ease(clamp01((r - .04) / .14)) * (r > 0 ? 1 : 0);
  cv.torches.forEach(({ flame, light }, i) => { const fl = .85 + .15 * Math.sin(T * 17 + i * 3) * Math.sin(T * 7.3 + i); flame.material.opacity = torch * .9; flame.scale.set(1, fl * 1.1, 1); light.intensity = torch * 3.5 * fl; });
  cv.band.material.opacity = Math.max(plateau(u, .93, 1.2, .03) * .55, torch);
  g.treasure.visible = r > .26;
  if (r > .26 && !sandStarted){ sandStarted = true; sprayStart(); }
  if (r < .2) sandStarted = false;
  const rise = ease(clamp01((r - .28) / .2));
  g.chest.position.y = XH - 2.4 + rise * 2.55; g.chest.rotation.z = (1 - rise) * Math.sin(T * 30) * .04 * (rise > 0 ? 1 : 0);
  const open = ease(clamp01((r - .5) / .18));
  ch.pivot.rotation.x = -1.9 * open; ch.light.intensity = open * (4 + Math.sin(T * 6) * .5);
  g.beams.children.forEach((b, i) => { b.material.opacity = open * (.18 + .08 * Math.sin(T * 1.7 + i)); });
  g.beams.rotation.y += dt * .15;
  if (open > .5 && !coinsStarted && state === 'won'){ coinsStarted = true; treasureBurst(); }
  if (state === 'won' || state === 'revealed'){ const show = r > .78; if (show && $('win').hidden) showWinCard(); if (!show && !$('win').hidden){ $('win').hidden = true; } if (show) state = 'revealed'; else if (state === 'revealed') state = 'won'; }
  updateSpray(dt);
  g.burst.forEach(c => { c.v.y -= dt * 14; c.position.addScaledVector(c.v, dt); const gy = landHeight(c.position.x, c.position.z) + .05;
    if (c.position.y < gy){ c.position.y = gy; c.v.multiplyScalar(.35); c.v.y = Math.abs(c.v.y) * .4; } c.rotation.x += c.spin * dt; c.rotation.z += c.spin * dt * .6; });

  if (frameNo % 3 === 0 && body.classList.contains('deep')) drawMini(u);

  const hp = Math.min(1, sy / innerHeight), tw = $('titleWrap');
  if (tw) tw.style.transform = `translateZ(${-hp * 500}px) rotateX(${mouse.y * -6}deg) rotateY(${mouse.x * 9}deg)`;
  if (tw) tw.style.opacity = 1 - hp * 1.6;

  // adaptive quality: drop depth of field, then resolution, if frames are slow
  if (state !== 'gate' && !TEST){ slowFrames = dt > 1 / 32 ? slowFrames + 1 : Math.max(0, slowFrames - 2);
    if (slowFrames > 90 && quality > 0){ slowFrames = 0; quality--;
      if (quality === 1 && g.bokeh){ g.bokeh.enabled = false; }
      else { g.pr = 1; g.renderer.setPixelRatio(1); if (g.composer) g.composer.setPixelRatio(1); resize3D(); } } }

  if (g.composer) g.composer.render(); else g.renderer.render(g.scene, cam);
  requestAnimationFrame(frame);
}
const dummyM = window.THREE ? new THREE.Object3D() : null;

function sprayStart(){
  const P = G3.sandPos, Vv = G3.sandVel;
  for (let i = 0; i < P.length / 3; i++){ P[i*3] = XPOS.x + (Math.random() - .5) * 2; P[i*3+1] = XH; P[i*3+2] = XPOS.z + (Math.random() - .5) * 2;
    const a = Math.random() * 6.28, s = 1 + Math.random() * 5; Vv[i*3] = Math.cos(a) * s; Vv[i*3+1] = 5 + Math.random() * 9; Vv[i*3+2] = Math.sin(a) * s; }
  G3.sand.material.opacity = 1;
}
function updateSpray(dt){
  if (G3.sand.material.opacity <= 0) return;
  const P = G3.sandPos, Vv = G3.sandVel;
  for (let i = 0; i < P.length / 3; i++){ Vv[i*3+1] -= 18 * dt; P[i*3] += Vv[i*3] * dt; P[i*3+1] = Math.max(XH, P[i*3+1] + Vv[i*3+1] * dt); P[i*3+2] += Vv[i*3+2] * dt; }
  G3.sand.geometry.attributes.position.needsUpdate = true;
  G3.sand.material.opacity = Math.max(0, G3.sand.material.opacity - dt * .25);
}
function treasureBurst(){
  if (!G3.ok || reduce) return;
  const coin = new THREE.CylinderGeometry(.3, .3, .06, 24), gem = new THREE.OctahedronGeometry(.28);
  const gold = std(0xF0C24A, { metalness: 1, roughness: .2, emissive: 0x3A2600 }), ruby = std(0xC0182A, { roughness: .05, metalness: .1 }), emer = std(0x1F9A5A, { roughness: .05, metalness: .1 });
  for (let i = 0; i < 140; i++){
    const kind = i % 6, m = new THREE.Mesh(kind < 4 ? coin : gem, kind < 4 ? gold : kind === 4 ? ruby : emer); m.castShadow = true;
    m.position.set(XPOS.x, XH + 1.9, XPOS.z);
    const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 5;
    m.v = new THREE.Vector3(Math.cos(a) * s, 9 + Math.random() * 8, Math.sin(a) * s); m.spin = (Math.random() - .5) * 14;
    G3.world.add(m); G3.burst.push(m);
  }
}

function showFallback(){
  const img = document.createElement('img'); img.id = 'fallbackMap'; img.alt = ''; img.src = drawMap().toDataURL('image/jpeg', .85);
  document.body.insertBefore(img, document.body.firstChild); $('scene').remove();
}
Promise.race([
  Promise.all(document.fonts ? ['italic 40px "IM Fell English"', '40px "IM Fell English SC"', 'italic 40px "STIX Two Text"'].map(f => document.fonts.load(f)) : []),
  new Promise(r => setTimeout(r, 2000))
]).catch(() => {}).then(() => setTimeout(() => {
  try { build3D(); } catch (e) { console.error(e); G3.ok = false; G3.renderer = null; }
  if (!G3.ok || !G3.renderer){ try { showFallback(); } catch (e) {} $('enterBtn').disabled = false; $('loading').hidden = true; }
}, 30));
computeStops();

const io = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('on', e.isIntersecting)), { threshold: .3 });
document.querySelectorAll('.chapter').forEach(c => io.observe(c));
// Without 3D the surprise still pops at the same point in the scroll
addEventListener('scroll', () => { if (!G3.renderer && state === 'browse' && scrollU(scrollY) >= CONFIG.triggerAt) startQuiz(); }, { passive: true });

/* ═════════════ Full screen ═════════════ */
const root = document.documentElement;
const fsSupported = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
const isFull = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
function goFull(){ const f = root.requestFullscreen || root.webkitRequestFullscreen; if (!f) return; try { const r = f.call(root); if (r && r.catch) r.catch(() => {}); } catch (e) {} }
function leaveFull(){ const f = document.exitFullscreen || document.webkitExitFullscreen; if (f && isFull()) { try { const r = f.call(document); if (r && r.catch) r.catch(() => {}); } catch (e) {} } }
['fullscreenchange', 'webkitfullscreenchange'].forEach(ev => document.addEventListener(ev, () => {
  if (state === 'quiz' && fsSupported){
    if (isFull()) wasFull = true;
    else if (wasFull) fail('cheat');            // left full screen during the question
    else $('fsblock').hidden = false;           // never got into full screen: ask once
  }
  setTimeout(resize3D, 100);
}));
$('refsBtn').addEventListener('click', () => { goFull(); $('fsblock').hidden = true; $('answer').focus(); });
$('enterBtn').addEventListener('click', () => {
  audioInit(); goFull(); $('gate').hidden = true;
  body.classList.remove('locked'); body.classList.add('go', 'sailing');
  state = 'browse'; scrollTo(0, 0); computeStops();
});

/* ═════════════ Lock ═════════════ */
const guard = e => { e.preventDefault(); e.returnValue = ''; };
const stopScroll = e => { if (state === 'quiz' || state === 'closed') e.preventDefault(); };
addEventListener('wheel', stopScroll, { passive: false });
addEventListener('touchmove', stopScroll, { passive: false });
document.addEventListener('contextmenu', e => { if (state === 'quiz' || state === 'closed') e.preventDefault(); });
document.addEventListener('keydown', e => {
  if (state === 'quiz' || state === 'closed'){ const k = (e.key || '').toLowerCase(), mod = e.ctrlKey || e.metaKey;
    if (k === 'f5' || k === 'f11' || (mod && ['r','w','l','t','n','p','s'].includes(k)) || (e.altKey && (k === 'arrowleft' || k === 'arrowright')) || k === 'browserback'){ e.preventDefault(); e.stopPropagation(); }
    if (state === 'quiz' && e.target !== $('answer') && ['arrowdown','arrowup','pagedown','pageup',' ','home','end'].includes(k)) e.preventDefault(); }
}, true);
addEventListener('popstate', () => { if (state === 'quiz' || state === 'closed') history.pushState(null, '', location.href); });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'quiz' && CONFIG.failOnTabLeave) fail('cheat'); });
addEventListener('blur', () => { if (state === 'quiz' && CONFIG.failOnTabLeave) fail('cheat'); });   // switched window or app

/* ═════════════ The surprise (midpoint) ═════════════ */
let deadline = 0, raf = 0, wasFull = false, lastTickKey = '';
let actx = null;
function audioInit(){ try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) { actx = null; } }
addEventListener('pointerdown', audioInit, { passive: true }); addEventListener('keydown', audioInit);
function playTick(alt, urgent){
  if (!actx || !CONFIG.tickSound) return;
  const t = actx.currentTime, out = actx.createGain(); out.gain.value = urgent ? 1 : .75; out.connect(actx.destination);
  // bright click of the escapement
  const o = actx.createOscillator(), f = actx.createBiquadFilter(), g = actx.createGain();
  o.type = 'square'; o.frequency.value = (alt ? 1900 : 1450) * (urgent ? 1.2 : 1);
  f.type = 'bandpass'; f.frequency.value = o.frequency.value; f.Q.value = 7;
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.32, t + .003); g.gain.exponentialRampToValueAtTime(.0001, t + .06);
  o.connect(f).connect(g).connect(out); o.start(t); o.stop(t + .08);
  // wooden body of the clock
  const b = actx.createOscillator(), bg = actx.createGain(); b.type = 'sine';
  b.frequency.setValueAtTime(urgent ? 240 : 170, t); b.frequency.exponentialRampToValueAtTime(70, t + .09);
  bg.gain.setValueAtTime(.22, t); bg.gain.exponentialRampToValueAtTime(.0001, t + .11); b.connect(bg).connect(out); b.start(t); b.stop(t + .13);
}
function playBuzz(){
  if (!actx || !CONFIG.tickSound) return;
  const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(70, t + .6);
  g.gain.setValueAtTime(.18, t); g.gain.exponentialRampToValueAtTime(.0001, t + .65); o.connect(g).connect(actx.destination); o.start(t); o.stop(t + .7);
}
// Pick this visit's question from the bank (a reload starts fresh with a new pick)
const BANK = (CONFIG.questions && CONFIG.questions.length) ? CONFIG.questions : [{ question: CONFIG.question || '', answers: CONFIG.answers || [] }];
let currentQ = BANK[Math.floor(Math.random() * BANK.length)];
function startQuiz(){
  if (state !== 'browse') return;
  state = 'quiz';
  const snapY = scrollForU(CONFIG.triggerAt); scrollTo(0, snapY); sy = snapY;
  body.classList.add('locked'); body.classList.remove('sailing');
  history.pushState(null, '', location.href);
  addEventListener('beforeunload', guard);
  $('questionText').innerHTML = currentQ.question;
  const mc = Array.isArray(currentQ.choices) && currentQ.choices.length > 1;
  document.querySelector('.answer-row').hidden = mc; $('choices').hidden = !mc;
  if (mc){
    // shuffle the order on screen; judge by which choice was picked, not its letter
    const order = currentQ.choices.map((c, i) => i).sort(() => Math.random() - .5);
    $('choices').innerHTML = order.map((ci, k) => `<button class="choice" data-i="${ci}"><span class="key">${'ABCDEF'[k]}</span><span>${currentQ.choices[ci]}</span></button>`).join('');
    $('choices').querySelectorAll('.choice').forEach(b => b.addEventListener('click', () => { if (state === 'quiz') (+b.dataset.i === currentQ.correct ? win() : fail('wrong')); }));
  }
  const q = $('quiz'); q.hidden = false; q.classList.add('show');
  setTimeout(() => (mc ? $('choices').querySelector('.choice') : $('answer')).focus({ preventScroll: true }), 350);
  wasFull = isFull();
  if (fsSupported && !wasFull) $('fsblock').hidden = false;
  deadline = performance.now() + CONFIG.seconds * 1000; lastTickKey = '';
  $('rules').textContent = `${CONFIG.seconds} seconds. One try. Leave and you’re out.`;
  audioInit();
  tick();
}
function tick(){
  if (state !== 'quiz') return;
  const left = Math.max(0, deadline - performance.now()), secs = Math.ceil(left / 1000);
  $('timerNum').textContent = secs;
  $('timerBar').style.strokeDashoffset = 1 - left / (CONFIG.seconds * 1000);
  const lowN = Math.min(10, Math.ceil(CONFIG.seconds / 4));
  lowTime = secs <= lowN; $('timer').classList.toggle('low', lowTime);
  // tick every second; twice a second when time is nearly up
  const step = lowTime ? 500 : 1000, n = Math.ceil(left / step), key = step + ':' + n;
  if (key !== lastTickKey && left > 0){ lastTickKey = key; playTick(n % 2 === 1, lowTime); }
  if (left <= 0){ playBuzz(); return fail('time'); }
  raf = requestAnimationFrame(tick);
}
const norm = s => { let v = String(s).toLowerCase().replace(/[−–—]/g, '-').replace(/\s+/g, '');
  v = v.replace(/^(answer|ans)[:=]?/, '').replace(/^[a-z](\*?[a-z])?=/, '');             // "x=6", "m=-2", "xy=21", "x*y=21"
  v = v.replace(/[.!]+$/, '').replace(/(cm²|cm2|cm|metres|meters|metre|meter|m|units?)$/, '').replace(/\.$/, ''); // "2 m", "192 cm²", "6."
  if (/^-?\d+,\d+$/.test(v)) v = v.replace(',', '.');                                     // "1,5" → "1.5"
  return v; };
function submit(){
  if (state !== 'quiz') return;
  const v = $('answer').value;
  if (!norm(v)){ $('msg').textContent = 'Type an answer first.'; const c = $('quizCard'); c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); return; }
  [].concat(currentQ.answers).some(a => norm(a) === norm(v)) ? win() : fail('wrong');
}
$('submitBtn').addEventListener('click', submit);
$('answer').addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
$('answer').addEventListener('input', () => $('msg').textContent = '');

const REASONS = {
  wrong: ['Wrong answer.', 'You’re out. This page is now closed.'],
  time:  ['Time’s up.', 'You’re out. This page is now closed.'],
  left:  ['You left the page.', 'You’re out. This page is now closed.'],
  cheat: ['You have been caught cheating.', 'Please do not re-attempt this.'],
  used:  ['Already attempted.', 'This device has used its one try.']
};
function fail(reason){
  state = 'closed'; lowTime = false; cancelAnimationFrame(raf);
  $('quiz').hidden = true; $('fsblock').hidden = true;
  setTimeout(() => { $('closedTitle').textContent = REASONS[reason][0]; $('closedNote').textContent = REASONS[reason][1]; $('closed').hidden = false; }, 900);
  body.classList.add('locked');
  setTimeout(() => { removeEventListener('beforeunload', guard); leaveFull(); try { window.close(); } catch (e) {} const m = document.querySelector('main'); if (m) m.remove(); }, 2600);
}
function win(){
  lowTime = false; cancelAnimationFrame(raf);
  removeEventListener('beforeunload', guard);
  $('quiz').hidden = true; $('fsblock').hidden = true;
  if (!G3.renderer){ state = 'revealed'; const mn = document.querySelector('main'); if (mn) mn.style.visibility = 'hidden'; showWinCard(); return; }
  state = 'won';
  $('correct').hidden = false;
  body.classList.remove('locked'); body.classList.add('sailing');
  setTimeout(() => { $('correct').hidden = true; }, 2600);
}
function showWinCard(){
  $('winTitle').innerHTML = CONFIG.successTitle.split(' ').map((w, i) => `<span class="w" style="--i:${i}">${w}</span>`).join(' ');
  $('win').hidden = false;
}
// Every reload starts completely fresh: clear anything an older version of this page saved
try { localStorage.removeItem('mathclub-cheat'); localStorage.removeItem('mathclub-attempt'); } catch (e) {}
</script>
</body>
</html>
