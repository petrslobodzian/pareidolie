import { state } from './state.js?v=2';
import { VisualEngine } from './engine.js?v=2';
import { UI } from './ui.js?v=2';
import { AI } from './ai.js?v=2';

/**
 * App Initialization
 */
document.addEventListener('DOMContentLoaded', () => {
  const canvasContainer = document.getElementById('canvas-container');
  
  // Initialize AI in the background
  const ai = new AI();

  // Initialize Visual Engine
  const engine = new VisualEngine(canvasContainer, state);
  
  // Initialize UI Controller
  const ui = new UI(state, engine, ai);
  
  // Load initial annotations for the current seed
  state.loadAnnotations();
  
  console.log('Pareidolia Lab Elite initialized.');
});
