const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uVig: { value: .9 }, uTime: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uVig, uTime; varying vec2 vUv;
    vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - .055, step(.0031308, c)); }
    float rand(vec2 co){ return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec3 c = toSRGB(max(texture2D(tDiffuse, vUv).rgb, 0.0));
      float l = dot(c, vec3(.299, .587, .114));
      c = mix(vec3(l), c, 1.1);
      c = (c - .5) * 1.05 + .5;
      c *= vec3(1.03, 1.0, .95);
      float d = distance(vUv, vec2(.5));
      c *= mix(1.0, smoothstep(.9, .3, d), uVig);
      c += (rand(vUv + uTime) - .5) * .018;
      gl_FragColor = vec4(c, 1.0);
    }`
};

