import { Injectable, signal, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import {environment} from '../../../../environments/environment.development';


export type TimerMethod = 'pomodoro' | 'shortBreak' | 'longBreak';

export interface TimerState {
  sessionId: string;
  timerId: string;
  method: TimerMethod;
  minutes: number;
  seconds: number;
  isRunning: boolean;
  progress: number;
}

@Injectable({
  providedIn: 'root'
})
export class TimerSocketService implements OnDestroy {
  private socket: Socket;

  currentState = signal<TimerState | null>(null);
  isRunning = signal(false);
  minutes = signal(25);
  seconds = signal(0);
  progress = signal(0);
  currentMethod = signal<TimerMethod>('pomodoro');

  connected = signal(false);
  loading = signal(false);

  constructor() {
    this.socket = io(environment.socketUrl + "/timer", {
      transports: ['websocket'],
      autoConnect: true
    });

    this.setupListeners();
  }

  private setupListeners(): void {
    this.socket.on('connect', () => {
      console.log('Connected to timer server');
      this.connected.set(true);
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from timer server');
      this.connected.set(false);
    });

    this.socket.on('timerStateUpdate', (state: TimerState) => {
      console.log('Timer state updated:', state);
      this.currentState.set(state);
      this.isRunning.set(state.isRunning);
      this.minutes.set(state.minutes);
      this.seconds.set(state.seconds);
      this.progress.set(state.progress);
      this.currentMethod.set(state.method);
      this.loading.set(false);
    });

    this.socket.on('timerStarted', (data) => {
      console.log('Timer started:', data);
      this.loading.set(false);
    });

    this.socket.on('timerPaused', (data) => {
      console.log('Timer paused:', data);
      this.loading.set(false);
    });

    this.socket.on('timerReset', (data) => {
      console.log('Timer reset:', data);
      this.loading.set(false);
    });

    this.socket.on('timerCompleted', () => {
      console.log('Timer completed');
      this.playCompletionSound();
      this.loading.set(false);
    });

    this.socket.on('error', (error: string) => {
      console.error('Socket error:', error);
      this.loading.set(false);
    });
  }

  async createSession(method: TimerMethod = 'pomodoro', duration: number = 25): Promise<string> {
    return new Promise((resolve, reject) => {
      this.socket.emit('createSession', { method, duration }, (response: any) => {
        if (response.error) {
          reject(response.error);
        } else {
          resolve(response.sessionId);
        }
      });
    });
  }

  async joinSession(sessionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.emit('joinSession', { sessionId }, (response: any) => {
        if (response.error) {
          reject(response.error);
        } else {
          resolve();
        }
      });
    });
  }

  startTimer(sessionId: string): void {
    this.socket.emit('startTimer', { sessionId });
    this.loading.set(true);
  }

  pauseTimer(sessionId: string): void {
    this.socket.emit('pauseTimer', { sessionId });
    this.loading.set(true);
  }

  resetTimer(sessionId: string, duration?: number): void {
    this.socket.emit('resetTimer', { sessionId, duration });
    this.loading.set(true);
  }

  switchMethod(sessionId: string, method: TimerMethod, duration: number): void {
    this.socket.emit('switchMethod', { sessionId, method, duration });
    this.loading.set(true);
  }

  leaveSession(sessionId: string): void {
    this.socket.emit('leaveSession', { sessionId });
    this.currentState.set(null);
  }

  async getState(sessionId: string): Promise<TimerState> {
    return new Promise((resolve, reject) => {
      this.socket.emit('getState', { sessionId }, (response: any) => {
        if (response.error) {
          reject(response.error);
        } else {
          resolve(response);
        }
      });
    });
  }

  async getActiveSessions(): Promise<any> {
    return new Promise((resolve) => {
      this.socket.emit('getActiveSessions', {}, (response: any) => {
        resolve(response);
      });
    });
  }

  private playCompletionSound(): void {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 1);
    } catch (e) {
      console.log('🔔 Timer completed!');
    }
  }

  ngOnDestroy(): void {
    this.socket.disconnect();
  }
}
