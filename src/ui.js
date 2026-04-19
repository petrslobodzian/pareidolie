/**
 * UI & Annotation System for Pareidolia Lab
 */
import { generateAbstractSVG } from './geometry.js';

export class UI {
  constructor(state, engine) {
    this.state = state;
    this.engine = engine;
    this.initControls();
    this.initAnnotations();
    this.syncUI();
    
    // Subscribe to state changes to keep UI in sync
    this.state.subscribe(() => this.syncUI());
  }
  
  initControls() {
    const bindRange = (id, key) => {
      const el = document.getElementById(id);
      const val = document.querySelector(`#${id}-val`);
      el.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        this.state.update({ [key]: value });
        if (val) val.textContent = value.toFixed(2);
      });
    };
    
    bindRange('scale', 'noiseScale');
    bindRange('octaves', 'noiseOctaves');
    bindRange('contrast', 'contrast');
    bindRange('speed', 'speed');
    bindRange('bias', 'biasStrength');
    bindRange('coverage', 'cloudCoverage');
    bindRange('density', 'cloudDensity');
    
    document.getElementById('seed-input').addEventListener('change', (e) => {
      this.state.update({ seed: e.target.value });
    });
    
    document.getElementById('random-seed').addEventListener('click', () => {
      this.state.randomizeSeed();
    });
    
    document.getElementById('play-pause').addEventListener('click', () => {
      this.state.update({ running: !this.state.running });
    });
    
    document.getElementById('raw-toggle').addEventListener('click', () => {
      this.state.update({ rawMode: !this.state.rawMode });
    });
    
    document.getElementById('snapshot').addEventListener('click', () => {
      this.engine.snapshot();
    });
    
    document.getElementById('clear-annotations').addEventListener('click', () => {
      if (confirm('Clear all annotations for this seed?')) {
        this.state.update({ annotations: [] });
      }
    });
  }
  
  initAnnotations() {
    const svg = document.getElementById('annotation-svg');
    let isDrawing = false;
    let startPoint = { x: 0, y: 0 };
    let currentRect = null;
    
    svg.addEventListener('mousedown', (e) => {
      const rect = svg.getBoundingClientRect();
      startPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      isDrawing = true;
      
      currentRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      currentRect.setAttribute('class', 'annotation-rect');
      svg.appendChild(currentRect);
    });
    
    svg.addEventListener('mousemove', (e) => {
      if (!isDrawing) return;
      const rect = svg.getBoundingClientRect();
      const currentPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      
      const x = Math.min(startPoint.x, currentPoint.x);
      const y = Math.min(startPoint.y, currentPoint.y);
      const width = Math.abs(startPoint.x - currentPoint.x);
      const height = Math.abs(startPoint.y - currentPoint.y);
      
      currentRect.setAttribute('x', x);
      currentRect.setAttribute('y', y);
      currentRect.setAttribute('width', width);
      currentRect.setAttribute('height', height);
    });
    
    svg.addEventListener('mouseup', (e) => {
      if (!isDrawing) return;
      isDrawing = false;
      
      const rect = {
          id: Date.now(),
          x: parseFloat(currentRect.getAttribute('x')),
          y: parseFloat(currentRect.getAttribute('y')),
          width: parseFloat(currentRect.getAttribute('width')),
          height: parseFloat(currentRect.getAttribute('height')),
          label: 'Finding...'
      };
      
      this.state.update({ 
          annotations: [...this.state.annotations, rect] 
      });
      
      if (currentRect) currentRect.remove();
      this.renderAnnotations();
      
      // Focus the newly created annotation's input
      setTimeout(() => {
        const list = document.getElementById('annotations-list');
        const lastInput = list.querySelector('div:last-child input');
        if (lastInput) lastInput.focus();
      }, 100);
    });
    
    window.addEventListener('resize', () => this.renderAnnotations());
  }
  
  renderAnnotations() {
    const svg = document.getElementById('annotation-svg');
    const list = document.getElementById('annotations-list');
    const section = document.getElementById('annotations-section');
    
    // Clear existing
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    while (list.firstChild) list.removeChild(list.firstChild);
    
    if (this.state.annotations.length > 0) {
      section.style.display = 'flex';
    } else {
      section.style.display = 'none';
    }
    
    this.state.annotations.forEach((ann, index) => {
      // Render SVG
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('class', 'annotation-rect');
      rect.setAttribute('x', ann.x);
      rect.setAttribute('y', ann.y);
      rect.setAttribute('width', ann.width);
      rect.setAttribute('height', ann.height);
      
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('class', 'annotation-label');
      text.setAttribute('x', ann.x);
      text.setAttribute('y', ann.y - 5);
      text.textContent = ann.label;
      
      g.appendChild(rect);
      g.appendChild(text);
      svg.appendChild(g);
      
      // Render Sidebar Item
      const item = document.createElement('div');
      item.className = 'discovery-item';
      
      const thumb = document.createElement('div');
      thumb.className = 'discovery-thumb';
      if (ann.svg) {
        thumb.innerHTML = ann.svg;
      } else {
        thumb.innerHTML = '<span style="font-size: 0.6rem; color: var(--text-muted);">?</span>';
      }

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'discovery-input';
      input.value = ann.label;
      input.placeholder = "Name discovery...";
      
      input.addEventListener('change', (e) => {
        const label = e.target.value;
        const pixelData = this.engine.getPixelData(ann.x, ann.y, ann.width, ann.height);
        const svg = generateAbstractSVG(pixelData, label);
        
        const newAnns = [...this.state.annotations];
        newAnns[index].label = label;
        newAnns[index].svg = svg;
        this.state.update({ annotations: newAnns });
        
        // Automatic Download
        this.downloadSVG(svg, label);
      });
      
      const delBtn = document.createElement('button');
      delBtn.innerHTML = '&times;';
      delBtn.className = 'discovery-delete';
      delBtn.title = 'Delete discovery';
      delBtn.onclick = () => {
        const newAnns = this.state.annotations.filter((_, i) => i !== index);
        this.state.update({ annotations: newAnns });
      };
      
      item.appendChild(thumb);
      item.appendChild(input);
      item.appendChild(delBtn);
      list.appendChild(item);
    });
  }

  /**
   * Automatically triggers a download for the generated SVG
   */
  downloadSVG(svg, label) {
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeLabel = label.toLowerCase().replace(/[^a-z0-9]/g, '-');
    link.href = url;
    link.download = `discovery-${safeLabel}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  
  syncUI() {
    document.getElementById('seed-input').value = this.state.seed;
    document.getElementById('play-pause').textContent = this.state.running ? 'Pause' : 'Play';
    document.getElementById('raw-toggle').textContent = this.state.rawMode ? 'Raw' : 'Biased';
    
    // Sync ranges
    const syncInput = (id, val) => {
      const el = document.getElementById(id);
      el.value = val;
      const display = document.getElementById(`${id}-val`);
      if (display) display.textContent = val.toFixed(2);
    };
    
    syncInput('scale', this.state.noiseScale);
    syncInput('octaves', this.state.noiseOctaves);
    syncInput('contrast', this.state.contrast);
    syncInput('speed', this.state.speed);
    syncInput('bias', this.state.biasStrength);
    syncInput('coverage', this.state.cloudCoverage);
    syncInput('density', this.state.cloudDensity);
    
    this.renderAnnotations();
  }
}
