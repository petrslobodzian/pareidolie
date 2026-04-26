import * as THREE from 'https://unpkg.com/three@0.150.1/build/three.module.js';

/**
 * Visual Engine: Three.js + GLSL Shaders
 */
export class VisualEngine {
  constructor(container, state) {
    this.container = container;
    this.state = state;

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });

    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    this.setupShader();
    this.setupEvents();
    this.animate();
  }

  setupShader() {
    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      uniform float uTime;
      uniform vec2 uResolution;
      uniform float uSeed;
      uniform float uNoiseScale;
      uniform int uNoiseOctaves;
      uniform float uContrast;
      uniform float uBiasStrength;
      uniform float uCloudCoverage;
      uniform float uCloudDensity;
      uniform bool uRawMode;
      varying vec2 vUv;

      // --- Noise Lib (from Shadertoy 4tdSWr) ---
      #define UI0 1597334673U
      #define UI1 3812015801U
      #define UI2 uvec2(UI0, UI1)
      #define UI3 uvec3(UI0, UI1, 2798796415U)
      #define UIF (1.0 / float(0xffffffffU))

      vec3 hash33(vec3 p) {
        uvec3 q = uvec3(ivec3(p)) * UI3;
        q = (q.x ^ q.y ^ q.z)*UI3;
        return -1. + 2. * vec3(q) * UIF;
      }

      float remap(float x, float a, float b, float c, float d) {
        return (((x - a) / (max(b - a, 0.0001))) * (d - c)) + c;
      }

      float gradientNoise(vec3 x, float freq) {
        vec3 p = floor(x);
        vec3 w = fract(x);
        vec3 u = w * w * w * (w * (w * 6. - 15.) + 10.);
        vec3 ga = hash33(p + vec3(0., 0., 0.));
        vec3 gb = hash33(p + vec3(1., 0., 0.));
        vec3 gc = hash33(p + vec3(0., 1., 0.));
        vec3 gd = hash33(p + vec3(1., 1., 0.));
        vec3 ge = hash33(p + vec3(0., 0., 1.));
        vec3 gf = hash33(p + vec3(1., 0., 1.));
        vec3 gg = hash33(p + vec3(0., 1., 1.));
        vec3 gh = hash33(p + vec3(1., 1., 1.));
        float va = dot(ga, w - vec3(0., 0., 0.));
        float vb = dot(gb, w - vec3(1., 0., 0.));
        float vc = dot(gc, w - vec3(0., 1., 0.));
        float vd = dot(gd, w - vec3(1., 1., 0.));
        float ve = dot(ge, w - vec3(0., 0., 1.));
        float vf = dot(gf, w - vec3(1., 0., 1.));
        float vg = dot(gg, w - vec3(0., 1., 1.));
        float vh = dot(gh, w - vec3(1., 1., 1.));
        return va + u.x * (vb - va) + u.y * (vc - va) + u.z * (ve - va) + 
               u.x * u.y * (va - vb - vc + vd) + u.y * u.z * (va - vc - ve + vg) + 
               u.z * u.x * (va - vb - ve + vf) + u.x * u.y * u.z * (-va + vb + vc - vd + ve - vf - vg + vh);
      }

      float worleyNoise(vec3 uv, float freq) {    
        vec3 id = floor(uv);
        vec3 p = fract(uv);
        float minDist = 10.0;
        for (float x = -1.; x <= 1.; ++x) {
          for(float y = -1.; y <= 1.; ++y) {
            for(float z = -1.; z <= 1.; ++z) {
              vec3 offset = vec3(x, y, z);
              vec3 h = hash33(id + offset) * .5 + .5;
              h += offset;
              vec3 d = p - h;
              minDist = min(minDist, dot(d, d));
            }
          }
        }
        return 1. - minDist;
      }

      float perlinfbm(vec3 p, float freq, int octaves) {
        float G = exp2(-.85);
        float amp = 1.;
        float noise = 0.;
        for (int i = 0; i < 8; ++i) {
          if (i >= octaves) break;
          noise += amp * gradientNoise(p * freq, freq);
          freq *= 2.;
          amp *= G;
        }
        return noise;
      }

      float worleyFbm(vec3 p, float freq) {
        return worleyNoise(p*freq, freq) * .625 +
               worleyNoise(p*freq*2., freq*2.) * .25 +
               worleyNoise(p*freq*4., freq*4.) * .125;
      }

      // --- Bias Injection (Pareidolia Logic) ---
      float hash(float n) { return fract(sin(n) * 43758.5453123); }
      float getBias(vec2 p) {
        float b = 0.0;
        for(int i=0; i<8; i++) {
          float fi = float(i);
          vec2 pos = vec2(hash(uSeed + fi * 123.4), hash(uSeed + fi * 567.8));
          float size = 0.05 + 0.15 * hash(uSeed + fi * 910.1);
          float rot = hash(uSeed + fi * 111.1) * 6.28;
          vec2 d = p - pos;
          float cosR = cos(rot); float sinR = sin(rot);
          d = vec2(d.x * cosR - d.y * sinR, d.x * sinR + d.y * cosR);
          float eyeDist = size * 0.4;
          float eyeSize = size * 0.2;
          float e1 = smoothstep(eyeSize, 0.0, length(d - vec2(-eyeDist, 0.0)));
          float e2 = smoothstep(eyeSize, 0.0, length(d - vec2(eyeDist, 0.0)));
          float m = smoothstep(size * 0.5, 0.0, length(d - vec2(0.0, -size*0.3))) * smoothstep(0.0, 0.1, d.y + size*0.3);
          b += (e1 + e2 + m * 0.5) * (0.1 + 0.3 * hash(uSeed + fi));
        }
        return b;
      }

      void main() {
        vec2 p = vUv;
        vec2 uv = p * uNoiseScale;
        
        // Time-based drift + Seed Offset
        float drift = uTime * 0.05;
        vec3 seedOffset = vec3(uSeed * 100.0, uSeed * 200.0, uSeed * 300.0);
        vec3 p3 = vec3(p * uNoiseScale - drift, drift * 0.2) + seedOffset;
        
        // 1. Generate Perlin-Worley Base
        float pfbm = mix(1., perlinfbm(p3, 4., uNoiseOctaves), .5);
        pfbm = abs(pfbm * 2. - 1.); // billowy
        
        float wfbm_low = worleyFbm(p3, 4.);
        float perlinWorley = clamp(remap(pfbm, 0., 1., wfbm_low, 1.0), 0.0, 1.0);
        
        // 2. Generate Detail Worley
        float wfbm_high = worleyFbm(p3 * 2.0, 8.0);
        
        // 3. Combine into Cloud Shape
        float cloud = clamp(remap(perlinWorley, wfbm_high - 1.0, 1.0, 0.0, 1.0), 0.0, 1.0);
        
        // 4. Coverage & Density Remapping
        float coverage = uCloudCoverage; // 0.0 to 1.0
        cloud = clamp(remap(cloud, 1.0 - coverage, 1.0, 0.0, 1.0), 0.0, 1.0);
        cloud *= uCloudDensity;

        // 5. Inject Pareidolia Bias
        if (!uRawMode) {
          float b = getBias(p);
          // Darken the noise where faces are, but within cloud bounds
          cloud = clamp(cloud - b * uBiasStrength * 0.5, 0.0, 1.0);
        }

        // 6. Contrast & Final Shaping
        float v = pow(clamp((cloud - 0.5) * uContrast + 0.5, 0.0, 1.0), 1.5);

        // 7. Elite Color Palette
        vec3 skyTop = vec3(0.1, 0.25, 0.45);
        vec3 skyBot = vec3(0.3, 0.55, 0.85);
        vec3 sky = mix(skyTop, skyBot, p.y);
        
        vec3 cloudColor = vec3(0.95, 0.98, 1.0);
        vec3 color = mix(sky, cloudColor, v);

        gl_FragColor = vec4(color, 1.0);
      }
    `;

    this.geometry = new THREE.PlaneGeometry(2, 2);
    this.uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2() },
      uSeed: { value: this.hashString(this.state.seed) },
      uNoiseScale: { value: this.state.noiseScale },
      uNoiseOctaves: { value: this.state.noiseOctaves },
      uContrast: { value: this.state.contrast },
      uBiasStrength: { value: this.state.biasStrength },
      uCloudCoverage: { value: this.state.cloudCoverage },
      uCloudDensity: { value: this.state.cloudDensity },
      uRawMode: { value: this.state.rawMode }
    };

    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader,
      fragmentShader
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.scene.add(this.mesh);
  }

  hashString(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(31, h) + str.charCodeAt(i) | 0;
    }
    return Math.abs(h % 100000) / 100000;
  }

  setupEvents() {
    window.addEventListener('resize', () => {
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
      this.uniforms.uResolution.value.set(this.container.clientWidth, this.container.clientHeight);
    });

    this.state.subscribe((s) => {
      this.uniforms.uSeed.value = this.hashString(s.seed);
      this.uniforms.uNoiseScale.value = s.noiseScale;
      this.uniforms.uNoiseOctaves.value = s.noiseOctaves;
      this.uniforms.uContrast.value = s.contrast;
      this.uniforms.uBiasStrength.value = s.biasStrength;
      this.uniforms.uCloudCoverage.value = s.cloudCoverage;
      this.uniforms.uCloudDensity.value = s.cloudDensity;
      this.uniforms.uRawMode.value = s.rawMode;
    });
  }

  animate(time) {
    requestAnimationFrame(this.animate.bind(this));
    if (this.state.running) {
      this.uniforms.uTime.value += this.state.speed * 0.01;
    }
    this.renderer.render(this.scene, this.camera);
  }

  snapshot() {
    const dataUrl = this.renderer.domElement.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `pareidolia-${this.state.seed}.png`;
    link.href = dataUrl;
    link.click();
  }

  /**
   * Extracts pixel data from a specific region
   */
  getPixelData(x, y, width, height) {
    const dpr = window.devicePixelRatio;
    const canvas = this.renderer.domElement;
    const gl = this.renderer.getContext();

    // WebGL coordinates start from bottom-left
    // x, y are in CSS pixels from top-left
    const readX = Math.round(x * dpr);
    const readY = Math.round(canvas.height - (y + height) * dpr);
    const readW = Math.round(width * dpr);
    const readH = Math.round(height * dpr);

    if (readW <= 0 || readH <= 0) return null;

    const pixels = new Uint8Array(readW * readH * 4);
    gl.readPixels(readX, readY, readW, readH, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    return {
      data: pixels,
      width: readW,
      height: readH
    };
  }

  /**
   * Extracts a data URL for a specific region
   */
  getRegionDataURL(x, y, width, height) {
    const dpr = window.devicePixelRatio;
    const canvas = this.renderer.domElement;

    // Create a temporary canvas to hold the region
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width * dpr;
    tempCanvas.height = height * dpr;
    const tempCtx = tempCanvas.getContext('2d');

    // Draw the main canvas into the temp canvas, offsetting to the region
    // Note: WebGL canvas needs preserveDrawingBuffer: true, which is already set
    tempCtx.drawImage(
      canvas,
      x * dpr, y * dpr, width * dpr, height * dpr,
      0, 0, width * dpr, height * dpr
    );

    return tempCanvas.toDataURL('image/png');
  }
}
