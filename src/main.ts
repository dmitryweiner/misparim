import './style.css';
import { startApp } from './app';
import { registerServiceWorker } from './pwa';
import { browserSpeech } from './speech';
import { browserStorage } from './storage';

startApp({ speech: browserSpeech(), storage: browserStorage(), languages: navigator.languages });
if (import.meta.env.PROD) registerServiceWorker(navigator, window);
