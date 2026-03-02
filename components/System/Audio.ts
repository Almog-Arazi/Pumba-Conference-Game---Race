
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


export class AudioController {
  ctx: AudioContext | null = null;
  masterGain: GainNode | null = null;
  bgMusic: HTMLAudioElement | null = null;
  menuMusic: HTMLAudioElement | null = null;
  trafficAmbience: HTMLAudioElement | null = null;
  startSound: HTMLAudioElement | null = null;
  gameOverSound: HTMLAudioElement | null = null;
  private _muted = false;

  constructor() {
    // Lazy initialization
  }

  get isMuted() { return this._muted; }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.4;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    // Background music — Super Mario Bros lofi
    if (!this.bgMusic) {
        this.bgMusic = new Audio('/bg-music.mp3');
        this.bgMusic.loop = true;
        this.bgMusic.volume = 0.18;
        this.bgMusic.preload = 'auto';
    }

    // Menu music — same lofi track for now
    if (!this.menuMusic) {
        this.menuMusic = new Audio('/bg-music.mp3');
        this.menuMusic.loop = true;
        this.menuMusic.volume = 0.12;
        this.menuMusic.preload = 'auto';
    }

    // Traffic ambience — very low volume background layer
    if (!this.trafficAmbience) {
        this.trafficAmbience = new Audio('/traffic-ambience.mp3');
        this.trafficAmbience.loop = true;
        this.trafficAmbience.volume = 0.06;
        this.trafficAmbience.preload = 'auto';
    }

    // Start sound (Mario Kart style)
    if (!this.startSound) {
        this.startSound = new Audio('https://raw.githubusercontent.com/Almog-Arazi/the_losers/main/Mario%20Kart%20Race%20Start%20-%20Sound%20Effect%20(HD).mp3');
        this.startSound.volume = 0.2;
        this.startSound.preload = 'auto';
    }

    // Game over sound
    if (!this.gameOverSound) {
        this.gameOverSound = new Audio('/game-over.mp3');
        this.gameOverSound.volume = 0.5;
        this.gameOverSound.preload = 'auto';
    }
  }

  setMuted(muted: boolean) {
    this._muted = muted;
    const v = muted ? 0 : 1;
    if (this.bgMusic)        this.bgMusic.muted        = muted;
    if (this.menuMusic)      this.menuMusic.muted      = muted;
    if (this.trafficAmbience) this.trafficAmbience.muted = muted;
    if (this.startSound)     this.startSound.muted     = muted;
    if (this.gameOverSound)  this.gameOverSound.muted  = muted;
    if (this.masterGain)     this.masterGain.gain.value = muted ? 0 : 0.4;
    void v; // suppress unused warning
  }

  toggleMute() {
    this.setMuted(!this._muted);
    return this._muted;
  }

  startMenuMusic() {
      if (!this.menuMusic) this.init();
      this.stopMusic();
      if (this.menuMusic) {
          this.menuMusic.currentTime = 0;
          this.menuMusic.play().catch(e => console.warn('Menu music autoplay prevented', e));
      }
  }

  stopMenuMusic() {
      if (this.menuMusic) this.menuMusic.pause();
  }

  startMusic() {
      if (!this.bgMusic) this.init();
      this.stopMenuMusic();
      if (this.bgMusic) {
          this.bgMusic.currentTime = 0;
          this.bgMusic.play().catch(e => console.warn('Background music autoplay prevented', e));
      }
      // Start traffic ambience alongside game music
      if (this.trafficAmbience) {
          this.trafficAmbience.currentTime = 0;
          this.trafficAmbience.play().catch(() => {});
      }
  }

  stopMusic() {
      if (this.bgMusic) this.bgMusic.pause();
      if (this.trafficAmbience) this.trafficAmbience.pause();
  }

  playStartSequence() {
      if (!this.startSound) this.init();
      if (this.startSound) {
          this.startSound.currentTime = 0;
          this.startSound.play().catch(e => console.warn("Start sound failed", e));
      }
  }

  playGameOver() {
      if (!this.gameOverSound) this.init();
      if (this.gameOverSound) {
          this.gameOverSound.currentTime = 0;
          this.gameOverSound.play().catch(e => console.warn("Game over sound failed", e));
      }
  }

  playCoinCollect() {
    if (!this.ctx || !this.masterGain) this.init();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    // High pitch "ding" with slight upward inflection
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(2000, t + 0.1);

    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.15);
  }

  playJump(isDouble = false) {
    if (!this.ctx || !this.masterGain) this.init();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Sine wave for a smooth "whoop" sound
    osc.type = 'sine';
    
    // Pitch shift up for double jump
    const startFreq = isDouble ? 400 : 200;
    const endFreq = isDouble ? 800 : 450;

    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + 0.15);

    // Lower volume for jump as it is a frequent action
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.15);
  }

  playDamage() {
    if (!this.ctx || !this.masterGain) this.init();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    
    // 1. Noise buffer for "crunch/static"
    const bufferSize = this.ctx.sampleRate * 0.3; // 0.3 seconds
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
    // 2. Low oscillator for "thud/impact"
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.exponentialRampToValueAtTime(20, t + 0.3);

    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.6, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.5, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    
    noise.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.3);
    noise.start(t);
    noise.stop(t + 0.3);
  }
}

export const audio = new AudioController();
