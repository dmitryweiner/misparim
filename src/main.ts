import './style.css';
import { startApp } from './app';
import { browserSpeech } from './speech';
import { browserStorage } from './storage';

startApp({ speech: browserSpeech(), storage: browserStorage(), languages: navigator.languages });
