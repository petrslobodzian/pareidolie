import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

// Ensure it loads weights from CDN
env.allowLocalModels = false;

export class AI {
  constructor() {
    this.status = 'initializing';
    this.classifier = null;
    this.onReadyCallbacks = [];
    this.loadModel();
  }

  async loadModel() {
    try {
      this.classifier = await pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32');
      this.status = 'ready';
      console.log("CLIP Model loaded successfully.");
      this.onReadyCallbacks.forEach(cb => cb());
      this.onReadyCallbacks = [];
    } catch (e) {
      console.error("Failed to load CLIP model:", e);
      this.status = 'error';
    }
  }

  onReady(callback) {
    if (this.status === 'ready') {
      callback();
    } else if (this.status === 'initializing') {
      this.onReadyCallbacks.push(callback);
    }
  }

  async analyzeMatch(imageURL, label) {
    if (this.status !== 'ready' || !this.classifier) {
      throw new Error("Model is not ready yet. Please wait a moment.");
    }

    // Generic fallbacks to contrast against the user's highly specific label
    const candidateLabels = [
      label,
      "a cloud",
      "a random shape",
      "abstract noise",
      "a blurry patch of smoke"
    ];

    const results = await this.classifier(imageURL, candidateLabels);
    
    const userResult = results.find(r => r.label === label);
    if (userResult) {
      // The score is a softmax probability (0 to 1)
      return Math.round(userResult.score * 100);
    }
    
    return 0;
  }
}
