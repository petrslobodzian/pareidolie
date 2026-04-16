import { state } from './state.js';
import { VisualEngine } from './engine.js';
import { UI } from './ui.js';

/**
 * App Initialization
 */
document.addEventListener('DOMContentLoaded', () => {
  const canvasContainer = document.getElementById('canvas-container');
  
  // Initialize Visual Engine
  const engine = new VisualEngine(canvasContainer, state);
  
  // Initialize UI Controller
  const ui = new UI(state, engine);
  
  // Load initial annotations for the current seed
  state.loadAnnotations();
  
  console.log('Pareidolia Lab Elite initialized.');
});
