import './style.css';
import { startApp } from './app';
import { browserSpeech } from './speech';

startApp({ speech: browserSpeech() });
