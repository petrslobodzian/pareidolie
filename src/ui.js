/**
 * UI & Annotation System for Pareidolia Lab
 */

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
      
      // Auto-focus the last annotation label in the list if we add one?
      // For now, just render and let user edit later.
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
      item.style.cssText = 'display: flex; gap: 8px; align-items: center;';
      
      const input = document.createElement('input');
      input.type = 'text';
      input.value = ann.label;
      input.style.cssText = 'flex-grow: 1; padding: 4px 8px; font-size: 0.8rem;';
      input.addEventListener('change', (e) => {
        const newAnns = [...this.state.annotations];
        newAnns[index].label = e.target.value;
        this.state.update({ annotations: newAnns });
      });
      
      const delBtn = document.createElement('button');
      delBtn.textContent = '×';
      delBtn.className = 'btn';
      delBtn.style.cssText = 'padding: 4px 8px; color: var(--danger);';
      delBtn.onclick = () => {
        const newAnns = this.state.annotations.filter((_, i) => i !== index);
        this.state.update({ annotations: newAnns });
      };
      
      item.appendChild(input);
      item.appendChild(delBtn);
      list.appendChild(item);
    });
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
