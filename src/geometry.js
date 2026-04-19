export function generateAbstractSVG(pixelData, label) {
  if (!pixelData) return '';
  
  const { data, width, height } = pixelData;
  const gridSize = 32; // Higher resolution for better shape matching
  const cellW = width / gridSize;
  const cellH = height / gridSize;
  
  const grid = new Float32Array(gridSize * gridSize);
  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      let brightness = 0;
      let count = 0;
      
      for (let py = Math.floor(gy * cellH); py < Math.floor((gy + 1) * cellH); py++) {
        for (let px = Math.floor(gx * cellW); px < Math.floor((gx + 1) * cellW); px++) {
          const idx = (py * width + px) * 4;
          if (idx < data.length) {
            brightness += (data[idx] + data[idx+1] + data[idx+2]) / 3;
            count++;
          }
        }
      }
      grid[gy * gridSize + gx] = count > 0 ? brightness / count / 255 : 0;
    }
  }
  
  // Personality hash
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = ((hash << 5) - hash) + label.charCodeAt(i);
    hash |= 0;
  }
  
  const hue = Math.abs(hash % 360);
  const primaryColor = `hsla(${hue}, 85%, 70%, 0.9)`;
  const secondaryColor = `hsla(${(hue + 30) % 360}, 60%, 50%, 0.3)`;
  
  const background = `<rect width="100" height="100" fill="hsla(${hue}, 40%, 10%, 0.4)" rx="8" />`;
  
  let elements = '';
  
  // 1. Generate a "Metaball" or "Blob" path by combining cloudy cells
  const threshold = 0.45;
  let pathD = "";
  
  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      const val = grid[gy * gridSize + gx];
      if (val > threshold) {
        const x = (gx / gridSize) * 100;
        const y = ((gridSize - 1 - gy) / gridSize) * 100;
        const size = (100 / gridSize) * 1.2; // Overlap for merging
        pathD += `M${x},${y} h${size} v${size} h-${size}z `;
      }
    }
  }

  // 2. Inner Detail Path (Higher threshold)
  let innerPathD = "";
  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      if (grid[gy * gridSize + gx] > 0.7) {
        const x = (gx / gridSize) * 100 + 1;
        const y = ((gridSize - 1 - gy) / gridSize) * 100 + 1;
        const size = (100 / gridSize) * 0.8;
        innerPathD += `M${x},${y} h${size} v${size} h-${size}z `;
      }
    }
  }

  elements += `<path d="${pathD}" fill="${primaryColor}" />`;
  elements += `<path d="${innerPathD}" fill="white" opacity="0.3" />`;
  
  // 3. Abstract "Discovery Accent"
  const lineCount = 3 + (Math.abs(hash) % 4);
  for (let i = 0; i < lineCount; i++) {
    const x1 = Math.abs((hash >> i) % 100);
    const y1 = Math.abs((hash >> (i+2)) % 100);
    const x2 = x1 + ((hash >> (i+4)) % 20) - 10;
    const y2 = y1 + ((hash >> (i+6)) % 20) - 10;
    elements += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${secondaryColor}" stroke-width="0.5" />`;
  }
  
  return `
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%;">
      <defs>
        <filter id="gooey">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9" result="goo" />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
        <filter id="outline">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9" result="goo" />
          <feMorphology operator="dilate" radius="0.5" in="goo" result="dilated" />
          <feComposite in="dilated" in2="goo" operator="out" />
        </filter>
      </defs>
      ${background}
      
      <!-- Isolated Outline Path -->
      <g filter="url(#outline)" opacity="0.6">
        <path d="${pathD}" fill="white" />
      </g>
      
      <!-- Main Organic Shape -->
      <g filter="url(#gooey)">
        ${elements}
      </g>
    </svg>
  `;
}
