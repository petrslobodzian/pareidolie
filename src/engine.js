import * as THREE from 'https://cdn.skypack.dev/three@0.150.1';

/**
 * Visual Engine: Three.js + GLSL Shaders
 */
export class VisualEngine {
  constructor(container, state) {
    this.container = container;
    this.state = state;
    
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    
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
      uniform bool uRawMode;
      varying vec2 vUv;

      // Deterministic hash based on seed
      float hash(float n) { return fract(sin(n) * 43758.5453123); }
      float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }

      // 2D Simplex Noise
      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

      float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy) );
        vec2 x0 = v -   i + dot(i, C.xx);
        vec2 i1;
        i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289(i);
        vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m ;
        m = m*m ;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        float frequency = 0.0;
        for (int i = 0; i < 8; i++) {
          if (i >= uNoiseOctaves) break;
          value += amplitude * snoise(p);
          p *= 2.0;
          amplitude *= 0.5;
        }
        return value;
      }

      // Domain Warping
      float pattern(vec2 p) {
        vec2 q = vec2( fbm( p + vec2(0.0,0.0) ), fbm( p + vec2(5.2,1.3) ) );
        vec2 r = vec2( fbm( p + 4.0*q + vec2(1.7,9.2) ), fbm( p + 4.0*q + vec2(8.3,2.8) ) );
        return fbm( p + 4.0*r );
      }

      // Bias Injection: Subtle face hints
      float getBias(vec2 p) {
        float b = 0.0;
        // Deterministic sprinkle based on uSeed
        for(int i=0; i<8; i++) {
          float fi = float(i);
          vec2 pos = vec2(hash(uSeed + fi * 123.4), hash(uSeed + fi * 567.8));
          float size = 0.05 + 0.15 * hash(uSeed + fi * 910.1);
          float rot = hash(uSeed + fi * 111.1) * 6.28;
          
          vec2 d = p - pos;
          float cosR = cos(rot); float sinR = sin(rot);
          d = vec2(d.x * cosR - d.y * sinR, d.x * sinR + d.y * cosR);
          
          // Eyes
          float eyeDist = size * 0.4;
          float eyeSize = size * 0.2;
          float e1 = smoothstep(eyeSize, 0.0, length(d - vec2(-eyeDist, 0.0)));
          float e2 = smoothstep(eyeSize, 0.0, length(d - vec2(eyeDist, 0.0)));
          
          // Mouth
          float m = smoothstep(size * 0.5, 0.0, length(d - vec4(0.0, -size*0.3, 0.0, 0.0).xy)) * smoothstep(0.0, 0.1, d.y + size*0.3);
          
          b += (e1 + e2 + m * 0.5) * (0.1 + 0.3 * hash(uSeed + fi));
        }
        return b;
      }

      void main() {
        vec2 p = vUv;
        vec2 p_noise = p * uNoiseScale + uTime * 0.05;
        
        float v = pattern(p_noise);
        v = (v + 1.0) * 0.5; // [0, 1]
        
        // Apply Bias
        if (!uRawMode) {
          float b = getBias(p);
          v = mix(v, clamp(v - b * 0.3, 0.0, 1.0), uBiasStrength);
        }

        // Contrast & Puffy Clouds
        v = clamp((v - 0.5) * uContrast + 0.5, 0.0, 1.0);
        v = pow(v, 1.8);

        // Color Palette
        vec3 skyTop = vec3(0.1, 0.3, 0.5);
        vec3 skyBot = vec3(0.5, 0.7, 0.9);
        vec3 sky = mix(skyTop, skyBot, p.y);
        
        vec3 color = mix(sky, vec3(1.0), v);

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
}
