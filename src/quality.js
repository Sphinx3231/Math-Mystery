/* ═════════════ Surface quality: procedural photo-style textures, triplanar stone, terrain splatting ═════════════ */
function texFromField(size, fn){
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'), img = g.createImageData(size, size);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++){ const [r, gg, b] = fn(i, j); const o = (j * size + i) * 4; img.data[o] = r; img.data[o+1] = gg; img.data[o+2] = b; img.data[o+3] = 255; }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}
function makeSurfaces(S){
  const n1 = tileField(S, 8, 5), n2 = tileField(S, 32, 3), n3 = tileField(S, 4, 4);
  const at = (f, i, j) => f[((j + S) % S) * S + ((i + S) % S)];
  const grass = texFromField(S, (i, j) => { const a = at(n1, i, j), b = at(n2, i, j), streak = at(n2, i * 3, j);
    const k = .55 + a * .5 + (b - .5) * .45 + (streak - .5) * .3; const dry = smooth(.55, .8, at(n3, i, j));
    return [ (52 + 60 * dry) * k, (96 + 30 * dry) * k, (38 + 20 * dry) * k ]; });
  const sand = texFromField(S, (i, j) => { const a = at(n1, i, j), b = at(n2, i, j), rip = Math.sin((i / S) * Math.PI * 2 * 14 + (j / S) * Math.PI * 2 * 3 + a * 6) * .5 + .5;
    const k = .86 + a * .16 + rip * .07 + (b - .5) * .12; return [228 * k, 204 * k, 152 * k]; });
  const rock = texFromField(S, (i, j) => { const a = at(n1, i, j), b = at(n2, i, j), c = at(n3, i, j);
    const crack = 1 - smooth(.0, .035, Math.abs(a - .5)) * .55, k = (.62 + c * .35 + (b - .5) * .25) * crack;
    return [150 * k, 140 * k, 126 * k]; });
  // ashlar stone blocks with mortar and moss
  const brick = texFromField(S, (i, j) => { const rows = 8, rh = S / rows, row = Math.floor(j / rh), off = (row % 2) * .5, bw = S / 4;
    const bx = (i / bw + off) % 1, by = (j % rh) / rh, id = Math.floor(i / bw + off) + row * 7;
    const mortar = Math.min(smooth(0, .05, bx), smooth(1, .95, bx), smooth(0, .07, by), smooth(1, .93, by));
    const tone = .8 + hash(id, row) * .3, a = at(n1, i, j), b = at(n2, i, j);
    const k = (tone + (a - .5) * .25 + (b - .5) * .18) * (.45 + .55 * mortar), moss = smooth(.62, .8, at(n3, i, j + 40)) * .7;
    return [ (156 - 70 * moss) * k, (146 - 20 * moss) * k, (128 - 70 * moss) * k ]; });
  [grass, sand, rock, brick].forEach(t => t.encoding = THREE.sRGBEncoding);
  return { grass, sand, rock, brick };
}
/* Triplanar mapping in world space: blocks and rock grain never stretch, whatever the mesh */
function triplanar(tex, scale, color = 0xFFFFFF, opts = {}){
  const m = std(color, Object.assign({ roughness: .92 }, opts)); m.normalMap = G3.detailN; m.normalScale = new THREE.Vector2(.8, .8);
  m.onBeforeCompile = sh => {
    sh.uniforms.tTri = { value: tex }; sh.uniforms.uTriScale = { value: scale };
    sh.vertexShader = 'varying vec3 vTriP; varying vec3 vTriN;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
      vec4 triW = modelMatrix * vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        triW = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
      #endif
      vTriP = triW.xyz; vTriN = normalize(mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = 'uniform sampler2D tTri; uniform float uTriScale; varying vec3 vTriP; varying vec3 vTriN;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      vec3 bw = pow(abs(vTriN), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
      vec3 tx = texture2D(tTri, vTriP.zy * uTriScale).rgb, ty = texture2D(tTri, vTriP.xz * uTriScale).rgb, tz = texture2D(tTri, vTriP.xy * uTriScale).rgb;
      diffuseColor.rgb *= pow(tx * bw.x + ty * bw.y + tz * bw.z, vec3(2.2)) * 1.6;`);
  };
  return m;
}
/* Terrain: blend grass / sand / rock textures by per-vertex weights */
function splatTerrain(material, surf, rep){
  material.onBeforeCompile = sh => {
    sh.uniforms.tG = { value: surf.grass }; sh.uniforms.tS = { value: surf.sand }; sh.uniforms.tR = { value: surf.rock }; sh.uniforms.uRep = { value: rep };
    sh.vertexShader = 'attribute vec3 splat; varying vec3 vSplat; varying vec2 vTUv;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vSplat = splat; vTUv = uv;');
    sh.fragmentShader = 'uniform sampler2D tG; uniform sampler2D tS; uniform sampler2D tR; uniform vec2 uRep; varying vec3 vSplat; varying vec2 vTUv;\n' + sh.fragmentShader.replace('#include <map_fragment>', `
      vec2 tuv = vTUv * uRep;
      vec3 g = texture2D(tG, tuv).rgb, s = texture2D(tS, tuv * 1.3).rgb, r = texture2D(tR, tuv * .6).rgb;
      vec3 g2 = texture2D(tG, tuv * .17 + .3).rgb;
      vec3 w = vSplat / max(.0001, vSplat.x + vSplat.y + vSplat.z);
      vec3 surf = pow(g * mix(.8, 1.2, g2.g), vec3(2.2)) * 2.2 * w.x + pow(s, vec3(2.2)) * 1.35 * w.y + pow(r, vec3(2.2)) * 2.0 * w.z;
      diffuseColor.rgb *= surf;`);
  };
}
/* Soft billboard clouds */
function cloudTex(){
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  for (let i = 0; i < 40; i++){ const x = 40 + rnd() * 176, y = 40 + rnd() * 50, r = 18 + rnd() * 30, gr = g.createRadialGradient(x, y, 0, x, y, r);
    const shade = 255 - Math.max(0, y - 60) * 1.6; gr.addColorStop(0, `rgba(${shade},${shade},${shade + 4},.55)`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 128); }
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
}
