import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  OnDestroy,
  OnInit,
  inject,
  effect
} from '@angular/core';
import {UiButton} from '../../shared/ui-components/ui-button/ui-button';
import {CommonModule} from '@angular/common';
import {TimerSocketService, TimerMethod} from '../../shared/services/timer/timer-socket.service';

@Component({
  selector: 'features-timer-display',
  standalone: true,
  imports: [
    CommonModule,
    UiButton,
  ],
  templateUrl: './timer-display.html',
  styleUrl: './timer-display.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimerDisplay implements OnInit, OnDestroy {
  private timerSocketService = inject(TimerSocketService);

  useWebSocket = signal<boolean>(false);

  sessionId = signal<string | null>(null);
  isRunning = signal(false);
  minutes = signal(25);
  seconds = signal(0);
  currentMethod = signal<TimerMethod>('pomodoro');
  progress = signal(0);

  isLoading = signal(false);
  isConnected = signal(false);

  displayMinutes = computed(() => this.padNumber(this.minutes()));
  displaySeconds = computed(() => this.padNumber(this.seconds()));

  buttonText = computed(() => this.isRunning() ? 'Pause' : 'Start');
  buttonVariant = computed(() => this.isRunning() ? 'secondary' : 'primary');

  private localTimerInterval: any = null;
  private webSocketEffects: any[] = [];

  constructor() {
    this.setupWebSocketEffects();
  }

  async ngOnInit() {
    console.log('TimerDisplay initialized');
    const savedMode = localStorage.getItem('timer_mode');
    const savedSessionId = localStorage.getItem('timer_session_id');

    console.log('Saved mode:', savedMode, 'Session ID:', savedSessionId);

    if (savedMode === 'websocket') {
      this.useWebSocket.set(true);

      if (savedSessionId) {
        try {
          console.log('Trying to join saved session:', savedSessionId);
          await this.timerSocketService.joinSession(savedSessionId);
          this.sessionId.set(savedSessionId);
          console.log('Successfully joined saved session');
        } catch (error) {
          console.log('Could not join saved session, creating new one:', error);
          await this.createNewSession();
        }
      } else {
        await this.initWebSocketConnection();
      }
    }
  }

  private async initWebSocketConnection(): Promise<void> {
    try {
      console.log('Initializing WebSocket connection...');

      console.log('Looking for active sessions...');
      const activeSessions = await this.timerSocketService.getActiveSessions();
      console.log('Found active sessions:', activeSessions);

      if (activeSessions.sessions && activeSessions.sessions.length > 0) {
        const sessionId = activeSessions.sessions[0].sessionId;
        console.log('Joining existing session:', sessionId);
        await this.timerSocketService.joinSession(sessionId);
        this.sessionId.set(sessionId);
        localStorage.setItem('timer_session_id', sessionId);
        console.log('Joined existing session:', sessionId);
      } else {
        await this.createNewSession();
      }

      this.useWebSocket.set(true);
      localStorage.setItem('timer_mode', 'websocket');
      console.log('WebSocket mode activated');
    } catch (error) {
      console.error('Failed to initialize WebSocket connection:', error);
      this.useWebSocket.set(false);
      localStorage.setItem('timer_mode', 'local');
      localStorage.removeItem('timer_session_id');
      console.log('Falling back to local mode');
    }
  }

  private async createNewSession(): Promise<void> {
    console.log('Creating new session...');
    const sessionId = await this.timerSocketService.createSession('pomodoro', 25);
    this.sessionId.set(sessionId);
    localStorage.setItem('timer_session_id', sessionId);
    console.log('Created new session:', sessionId);
  }

  private setupWebSocketEffects(): void {
    const connectionEffect = effect(() => {
      if (this.useWebSocket()) {
        const connected = this.timerSocketService.connected();
        this.isConnected.set(connected);
      }
    });

    const loadingEffect = effect(() => {
      if (this.useWebSocket()) {
        const loading = this.timerSocketService.loading();
        this.isLoading.set(loading);
      }
    });

    const stateEffect = effect(() => {
      if (this.useWebSocket()) {
        const state = this.timerSocketService.currentState();
        if (state) {
          this.sessionId.set(state.sessionId);
          this.isRunning.set(state.isRunning);
          this.minutes.set(state.minutes);
          this.seconds.set(state.seconds);
          this.currentMethod.set(state.method);
          this.progress.set(state.progress);
          this.updateProgressCircle();
        }
      }
    });

    const isRunningEffect = effect(() => {
      if (this.useWebSocket()) {
        const running = this.timerSocketService.isRunning();
        this.isRunning.set(running);
      }
    });

    const minutesEffect = effect(() => {
      if (this.useWebSocket()) {
        const minutes = this.timerSocketService.minutes();
        this.minutes.set(minutes);
        this.updateProgressCircle();
      }
    });

    const secondsEffect = effect(() => {
      if (this.useWebSocket()) {
        const seconds = this.timerSocketService.seconds();
        this.seconds.set(seconds);
        this.updateProgressCircle();
      }
    });

    const methodEffect = effect(() => {
      if (this.useWebSocket()) {
        const method = this.timerSocketService.currentMethod();
        this.currentMethod.set(method);
      }
    });

    const progressEffect = effect(() => {
      if (this.useWebSocket()) {
        const progress = this.timerSocketService.progress();
        this.progress.set(progress);
      }
    });

    this.webSocketEffects = [
      connectionEffect, loadingEffect, stateEffect,
      isRunningEffect, minutesEffect, secondsEffect,
      methodEffect, progressEffect
    ];
  }

  async toggleConnectionMode(): Promise<void> {
    if (this.useWebSocket()) {
      if (this.sessionId()) {
        this.timerSocketService.leaveSession(this.sessionId()!);
      }
      this.pauseLocalTimer();
      this.resetLocalTimer();
      this.useWebSocket.set(false);
      localStorage.setItem('timer_mode', 'local');
      console.log('Switched to local mode');
    } else {
      await this.initWebSocketConnection();
    }
  }

  toggleTimer(): void {
    if (this.useWebSocket() && this.sessionId()) {
      if (this.isRunning()) {
        this.timerSocketService.pauseTimer(this.sessionId()!);
      } else {
        this.timerSocketService.startTimer(this.sessionId()!);
      }
    } else {
      if (this.isRunning()) {
        this.pauseLocalTimer();
      } else {
        this.startLocalTimer();
      }
    }
  }

  resetTimer(): void {
    if (this.useWebSocket() && this.sessionId()) {
      const duration = this.getDurationForMethod(this.currentMethod());
      this.timerSocketService.resetTimer(this.sessionId()!, duration);
    } else {
      this.pauseLocalTimer();
      this.resetLocalTimer();
    }
  }

  finishTimer(): void {
    if (this.useWebSocket() && this.sessionId()) {
      this.timerSocketService.resetTimer(this.sessionId()!, 0);
    } else {
      this.pauseLocalTimer();
      this.minutes.set(0);
      this.seconds.set(0);
      this.updateProgressCircle();
    }
  }

  switchMethod(method: TimerMethod): void {
    const duration = this.getDurationForMethod(method);

    if (this.useWebSocket() && this.sessionId()) {
      this.timerSocketService.switchMethod(this.sessionId()!, method, duration);
    } else {
      this.pauseLocalTimer();
      this.currentMethod.set(method);
      this.minutes.set(duration);
      this.seconds.set(0);
      this.updateProgressCircle();
    }
  }

  private startLocalTimer(): void {
    if (this.isRunning()) return;

    this.isRunning.set(true);

    this.localTimerInterval = setInterval(() => {
      let newSeconds = this.seconds() - 1;
      let newMinutes = this.minutes();

      if (newSeconds < 0) {
        if (newMinutes > 0) {
          newMinutes--;
          newSeconds = 59;
        } else {
          this.pauseLocalTimer();
          this.playCompletionSound();
          return;
        }
      }

      this.seconds.set(newSeconds);
      this.minutes.set(newMinutes);
      this.updateProgressCircle();
    }, 1000);

    console.log('Local timer started');
  }

  private pauseLocalTimer(): void {
    this.isRunning.set(false);

    if (this.localTimerInterval) {
      clearInterval(this.localTimerInterval);
      this.localTimerInterval = null;
    }

    console.log('Local timer paused');
  }

  private resetLocalTimer(): void {
    const duration = this.getDurationForMethod(this.currentMethod());
    this.minutes.set(duration);
    this.seconds.set(0);
    this.updateProgressCircle();

    console.log('Local timer reset');
  }

  private padNumber(num: number): string {
    return num.toString().padStart(2, '0');
  }

  private getDurationForMethod(method: TimerMethod): number {
    switch (method) {
      case 'pomodoro':
        return 25;
      case 'shortBreak':
        return 5;
      case 'longBreak':
        return 15;
      default:
        return 25;
    }
  }

  private updateProgressCircle(): void {
    const progressCircle = document.querySelector('.timer__progress-fill') as SVGElement;

    if (progressCircle) {
      const totalSeconds = this.getDurationForMethod(this.currentMethod()) * 60;
      const remainingSeconds = this.minutes() * 60 + this.seconds();
      const progress = ((totalSeconds - remainingSeconds) / totalSeconds) * 100;
      const radius = 150;
      const circumference = 2 * Math.PI * radius;
      const offset = circumference - (progress / 100) * circumference;

      progressCircle.style.strokeDashoffset = offset.toString();
      this.progress.set(progress);
    }
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

      console.log('🔔 Timer completed!');
    } catch (e) {
      console.log('Timer completed!');
    }
  }

  ngOnDestroy(): void {
    this.pauseLocalTimer();

    this.webSocketEffects.forEach(effect => effect.destroy());

    if (this.useWebSocket() && this.sessionId()) {
      this.timerSocketService.leaveSession(this.sessionId()!);
    }
  }
}
