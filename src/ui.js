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

    document.getElementById('night-mode-toggle').addEventListener('click', () => {
      this.state.update({ nightMode: !this.state.nightMode });
    });

    document.getElementById('help-btn').addEventListener('click', () => {
      this.runTutorial();
    });

    // Wind Controls
    document.getElementById('wind-up').addEventListener('click', () => {
      this.state.update({ windY: 0.1, windX: 0.0 });
    });
    document.getElementById('wind-down').addEventListener('click', () => {
      this.state.update({ windY: -0.1, windX: 0.0 });
    });
    document.getElementById('wind-left').addEventListener('click', () => {
      this.state.update({ windX: 0.1, windY: 0.0 });
    });
    document.getElementById('wind-right').addEventListener('click', () => {
      this.state.update({ windX: -0.1, windY: 0.0 });
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
    const threshInc = document.getElementById('threshold-inc');
    const threshDec = document.getElementById('threshold-dec');
    const closeX = document.getElementById('modal-close-x');

    const closeAll = () => {
      modal.style.display = 'none';
      this.pendingDiscovery = null;
    };

    closeBtn.onclick = closeAll;
    closeX.onclick = closeAll;

    saveBtn.onclick = () => {
      const label = nameInput.value || 'Unnamed Discovery';
      this.saveDiscovery(label);
      closeAll();
    };

    rotateBtn.onclick = () => {
      if (!this.pendingDiscovery) return;
      this.pendingDiscovery.rotation = (this.pendingDiscovery.rotation + 90) % 360;
      this.updateModalViews();
    };

    threshInc.onclick = () => {
      if (!this.pendingDiscovery) return;
      this.pendingDiscovery.threshold = Math.max(0.1, this.pendingDiscovery.threshold - 0.05);
      this.updateModalViews();
    };

    threshDec.onclick = () => {
      if (!this.pendingDiscovery) return;
      this.pendingDiscovery.threshold = Math.min(0.9, this.pendingDiscovery.threshold + 0.05);
      this.updateModalViews();
    };

    nameInput.onkeydown = (e) => {
      if (e.key === 'Enter') saveBtn.click();
    };
  }

  openDiscoveryModal(rect, isTutorial = false) {
    const modal = document.getElementById('discovery-modal');
    const nameInput = document.getElementById('discovery-name');
    const header = modal.querySelector('.modal-header h2');

    // Capture Original Render & Pixel Data
    const originalDataURL = this.engine.getRegionDataURL(rect.x, rect.y, rect.width, rect.height);
    const pixelData = this.engine.getPixelData(rect.x, rect.y, rect.width, rect.height);

    this.pendingDiscovery = {
      rect,
      pixelData,
      originalDataURL,
      rotation: 0,
      threshold: 0.5
    };

    this.updateModalViews();

    // Reset Input
    nameInput.value = isTutorial ? 'Your Discovery' : '';
    modal.style.display = 'flex';
    nameInput.focus();

    // Reset Header
    header.innerText = 'New Discovery';

    // Auto-close and Countdown if tutorial
    if (isTutorial) {
      let count = 3;
      header.innerText = `Demo will close in ${count}...`;

      const countdown = setInterval(() => {
        count--;
        if (count > 0) {
          header.innerText = `Demo will close in ${count}...`;
        } else {
          clearInterval(countdown);
        }
      }, 1000);

      this.tutorialTimeout = setTimeout(() => {
        if (modal.style.display === 'flex') {
          modal.style.display = 'none';
          this.pendingDiscovery = null;
        }
        clearInterval(countdown);
      }, 3000);
    }
  }

  updateModalViews() {
    if (!this.pendingDiscovery) return;
    const { originalDataURL, pixelData, rect, rotation, threshold } = this.pendingDiscovery;
    const originalView = document.getElementById('original-view');
    const contourPreview = document.getElementById('contour-preview');

    // Update Original View (CSS Rotation)
    originalView.innerHTML = `<img src="${originalDataURL}" style="transform: rotate(${-rotation}deg)" />`;

    // Update Outline View (Regenerated rotated SVG with custom threshold)
    const contourSVG = generateDiscoverySVG(pixelData, 'preview', rect.width, rect.height, rotation, threshold);
    contourPreview.innerHTML = contourSVG;
    contourPreview.className = 'view-canvas'; // Ensure class is maintained
  }

  saveDiscovery(label) {
    if (!this.pendingDiscovery) return;
    const { rect, pixelData, rotation, threshold, originalDataURL } = this.pendingDiscovery;

    // Generate the final contour SVG for the composite
    const contourSVG = generateDiscoverySVG(pixelData, label, rect.width, rect.height, rotation, threshold);

    // Generate the A4 Report
    this.downloadDiscoveryReport(originalDataURL, contourSVG, label, rotation);

    this.pendingDiscovery = null;
  }

  async downloadDiscoveryReport(originalURL, contourSVG, label, rotation) {
    // A4 Landscape at 300 DPI
    const W = 3508;
    const H = 2480;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // 1. Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    // 2. Load Images
    const [imgOriginal, imgContour] = await Promise.all([
      this.loadImage(originalURL),
      this.loadSVGImage(contourSVG)
    ]);

    // 3. Layout Calculations
    const margin = 200;
    const innerW = W - margin * 2;
    const innerH = H - margin * 3; // Extra space for text at bottom
    const boxW = (innerW - 100) / 2;
    const boxH = innerH;

    // 4. Draw Original (Left)
    ctx.save();
    const centerX = margin + boxW / 2;
    const centerY = margin + boxH / 2;
    ctx.translate(centerX, centerY);
    ctx.rotate((rotation * Math.PI) / 180);

    const scaleO = Math.min(boxW / imgOriginal.width, boxH / imgOriginal.height);
    const dwo = imgOriginal.width * scaleO;
    const dho = imgOriginal.height * scaleO;
    ctx.drawImage(imgOriginal, -dwo / 2, -dho / 2, dwo, dho);
    ctx.restore();

    // 5. Draw Contour (Right)
    const contourX = margin + boxW + 100;
    const scaleC = Math.min(boxW / imgContour.width, boxH / imgContour.height);
    const dwc = imgContour.width * scaleC;
    const dhc = imgContour.height * scaleC;
    ctx.drawImage(imgContour, contourX + (boxW - dwc) / 2, margin + (boxH - dhc) / 2, dwc, dhc);

    // 6. Draw Label (Bottom Center)
    ctx.fillStyle = '#03486B';
    ctx.font = 'bold 80px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label.toUpperCase(), W / 2, H - 150);

    // 7. Download
    const dataURL = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    const safeLabel = label.toLowerCase().replace(/[^a-z0-9]/g, '-');
    link.href = dataURL;
    link.download = `discovery-report-${safeLabel}.png`;
    link.click();
  }

  loadImage(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = url;
    });
  }

  loadSVGImage(svgString) {
    return new Promise((resolve) => {
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.src = url;
    });
  }

  runTutorial() {
    if (this.tutorialTimeout) clearTimeout(this.tutorialTimeout);
    const group = document.getElementById('tutorial-group');
    const cursor = document.getElementById('ghost-cursor');
    const rect = document.getElementById('ghost-rect');

    group.style.opacity = '1';

    // 1. Center the demo in the viewport
    const endW = 240;
    const endH = 240;
    const svg = document.getElementById('annotation-svg');
    const svgW = svg.clientWidth;
    const svgH = svg.clientHeight;

    const startX = (svgW - endW) / 2;
    const startY = (svgH - endH) / 2;

    cursor.setAttribute('cx', startX);
    cursor.setAttribute('cy', startY);
    rect.setAttribute('x', startX);
    rect.setAttribute('y', startY);
    rect.setAttribute('width', 0);
    rect.setAttribute('height', 0);

    // Sequence
    setTimeout(() => {
      // 2. Pulse (Click)
      cursor.style.transform = 'scale(1.3)';

      setTimeout(() => {
        // 3. Drag to bottom-right precisely
        let startTime = null;
        const duration = 1500;

        const animateDrag = (time) => {
          if (!startTime) startTime = time;
          const progress = Math.min((time - startTime) / duration, 1.0);

          const currentW = endW * progress;
          const currentH = endH * progress;

          rect.setAttribute('width', currentW);
          rect.setAttribute('height', currentH);

          // Force exact bottom-right alignment
          const targetX = startX + currentW;
          const targetY = startY + currentH;
          cursor.setAttribute('cx', targetX);
          cursor.setAttribute('cy', targetY);

          if (progress < 1.0) {
            requestAnimationFrame(animateDrag);
          } else {
            // 4. Finish
            setTimeout(() => {
              group.style.opacity = '0';
              cursor.style.transform = 'scale(1)';
              this.openDiscoveryModal({ x: startX, y: startY, width: endW, height: endH }, true);
            }, 400);
          }
        };
        requestAnimationFrame(animateDrag);
      }, 400);
    }, 500);
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

    // Toggle Night Mode Icons and Body Class
    const sunIcon = document.getElementById('sun-icon');
    const moonIcon = document.getElementById('moon-icon');
    if (this.state.nightMode) {
      document.body.classList.add('night-mode');
      sunIcon.style.display = 'none';
      moonIcon.style.display = 'block';
    } else {
      document.body.classList.remove('night-mode');
      sunIcon.style.display = 'block';
      moonIcon.style.display = 'none';
    }
  }
}
