/**
 * UI & Annotation System for Pareidolia Lab
 */
import { generateDiscoverySVG } from './geometry.js';

export class UI {
  constructor(state, engine) {
    this.state = state;
    this.engine = engine;
    this.pendingDiscovery = null;

    this.initControls();
    this.initAnnotations();
    this.initModal();
    this.syncUI();

    this.state.subscribe(() => this.syncUI());
  }

  initControls() {
    document.getElementById('random-seed').addEventListener('click', () => {
      this.state.randomizeSeed();
    });

    document.getElementById('play-pause').addEventListener('click', () => {
      this.state.update({ running: !this.state.running });
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
        x: parseFloat(currentRect.getAttribute('x')),
        y: parseFloat(currentRect.getAttribute('y')),
        width: parseFloat(currentRect.getAttribute('width')),
        height: parseFloat(currentRect.getAttribute('height'))
      };

      if (currentRect) currentRect.remove();

      // Minimal selection check
      if (rect.width < 10 || rect.height < 10) return;

      this.openDiscoveryModal(rect);
    });
  }

  initModal() {
    const modal = document.getElementById('discovery-modal');
    const closeBtn = document.getElementById('close-modal');
    const saveBtn = document.getElementById('save-discovery');
    const rotateBtn = document.getElementById('rotate-left');
    const nameInput = document.getElementById('discovery-name');

    closeBtn.onclick = () => {
      modal.style.display = 'none';
      this.pendingDiscovery = null;
    };

    saveBtn.onclick = () => {
      const label = nameInput.value || 'Unnamed Discovery';
      this.saveDiscovery(label);
      modal.style.display = 'none';
    };

    rotateBtn.onclick = () => {
      if (!this.pendingDiscovery) return;
      this.pendingDiscovery.rotation = (this.pendingDiscovery.rotation + 90) % 360;
      this.updateModalViews();
    };

    nameInput.onkeydown = (e) => {
      if (e.key === 'Enter') saveBtn.click();
    };
  }

  openDiscoveryModal(rect) {
    const modal = document.getElementById('discovery-modal');
    const nameInput = document.getElementById('discovery-name');

    // Capture Original Render & Pixel Data
    const originalDataURL = this.engine.getRegionDataURL(rect.x, rect.y, rect.width, rect.height);
    const pixelData = this.engine.getPixelData(rect.x, rect.y, rect.width, rect.height);

    this.pendingDiscovery = {
      rect,
      pixelData,
      originalDataURL,
      rotation: 0
    };

    this.updateModalViews();

    // Reset Input
    nameInput.value = '';
    modal.style.display = 'flex';
    nameInput.focus();
  }

  updateModalViews() {
    if (!this.pendingDiscovery) return;
    const { originalDataURL, pixelData, rect, rotation } = this.pendingDiscovery;
    const originalView = document.getElementById('original-view');
    const outlineView = document.getElementById('outline-view');

    // Update Original View (CSS Rotation)
    originalView.innerHTML = `<img src="${originalDataURL}" style="transform: rotate(${-rotation}deg)" />`;

    // Update Outline View (Regenerated rotated SVG)
    const contourSVG = generateDiscoverySVG(pixelData, 'preview', rect.width, rect.height, rotation);
    outlineView.innerHTML = contourSVG;
  }

  saveDiscovery(label) {
    if (!this.pendingDiscovery) return;
    const { rect, pixelData, rotation } = this.pendingDiscovery;
    const svg = generateDiscoverySVG(pixelData, label, rect.width, rect.height, rotation);

    // Download logic
    this.downloadSVG(svg, label);
    this.pendingDiscovery = null;
  }

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
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  syncUI() {
    const playIcon = document.getElementById('play-icon');
    const pauseIcon = document.getElementById('pause-icon');

    if (this.state.running) {
      playIcon.style.display = 'none';
      pauseIcon.style.display = 'block';
    } else {
      playIcon.style.display = 'block';
      pauseIcon.style.display = 'none';
    }
  }
}


