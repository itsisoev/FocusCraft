import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

export interface TimerSession {
  sessionId: string;
  timerId: string;
  method: 'pomodoro' | 'shortBreak' | 'longBreak';
  duration: number; // в секундах
  timeLeft: number; // в секундах
  isRunning: boolean;
  startTime?: Date;
  participants: string[]; // socket.id участников
}

export interface TimerState {
  sessionId: string;
  timerId: string;
  method: 'pomodoro' | 'shortBreak' | 'longBreak';
  minutes: number;
  seconds: number;
  isRunning: boolean;
  progress: number; // 0-100
}

@WebSocketGateway({
  cors: {
    origin: 'http://localhost:4200',
    credentials: true,
  },
  namespace: '/timer',
  transports: ['websocket', 'polling'],
})
export class TimerGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TimerGateway.name);

  // Хранилище активных сессий таймера
  private activeSessions: Map<string, TimerSession> = new Map();

  // Таймеры для каждой сессии
  private sessionTimers: Map<string, NodeJS.Timeout> = new Map();

  // Карта socket.id -> sessionId
  private socketToSession: Map<string, string> = new Map();

  // Подключение клиента
  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    client.emit('connected', { message: 'Connected to timer server' });
  }

  // Отключение клиента
  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    // Удаляем клиента из сессии
    const sessionId = this.socketToSession.get(client.id);
    if (sessionId) {
      this.leaveSession(client, sessionId);
    }

    this.socketToSession.delete(client.id);
  }

  // Создание новой сессии таймера
  @SubscribeMessage('createSession')
  handleCreateSession(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      method: 'pomodoro' | 'shortBreak' | 'longBreak';
      duration: number; // в минутах
    },
  ) {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timerId = `timer_${Date.now()}`;

    const durationInSeconds = data.duration * 60;

    const session: TimerSession = {
      sessionId,
      timerId,
      method: data.method,
      duration: durationInSeconds,
      timeLeft: durationInSeconds,
      isRunning: false,
      participants: [client.id],
    };

    this.activeSessions.set(sessionId, session);
    this.socketToSession.set(client.id, sessionId);

    client.join(sessionId);

    this.logger.log(`Session created: ${sessionId} by ${client.id}`);

    // Отправляем состояние всем в сессии
    this.emitSessionState(sessionId);

    return {
      sessionId,
      timerId,
      message: 'Session created successfully',
    };
  }

  // Присоединение к существующей сессии
  @SubscribeMessage('joinSession')
  handleJoinSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ) {
    const session = this.activeSessions.get(data.sessionId);

    if (!session) {
      return { error: 'Session not found' };
    }

    // Добавляем клиента в сессию
    if (!session.participants.includes(client.id)) {
      session.participants.push(client.id);
    }

    this.socketToSession.set(client.id, data.sessionId);
    client.join(data.sessionId);

    this.logger.log(`Client ${client.id} joined session ${data.sessionId}`);

    // Отправляем текущее состояние новому участнику
    client.emit('timerState', this.getTimerState(session));

    // Обновляем состояние для всех
    this.emitSessionState(data.sessionId);

    return {
      sessionId: data.sessionId,
      message: 'Joined session successfully',
    };
  }

  // Старт таймера
  @SubscribeMessage('startTimer')
  handleStartTimer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ) {
    const session = this.activeSessions.get(data.sessionId);

    if (!session) {
      return { error: 'Session not found' };
    }

    if (session.isRunning) {
      return { error: 'Timer is already running' };
    }

    session.isRunning = true;
    session.startTime = new Date();

    // Запускаем таймер
    this.startSessionTimer(data.sessionId);

    this.logger.log(`Timer started for session: ${data.sessionId}`);
    this.emitSessionState(data.sessionId);

    return { message: 'Timer started' };
  }

  // Пауза таймера
  @SubscribeMessage('pauseTimer')
  handlePauseTimer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ) {
    const session = this.activeSessions.get(data.sessionId);

    if (!session) {
      return { error: 'Session not found' };
    }

    if (!session.isRunning) {
      return { error: 'Timer is not running' };
    }

    session.isRunning = false;

    // Останавливаем таймер
    this.stopSessionTimer(data.sessionId);

    // Обновляем оставшееся время
    if (session.startTime) {
      const elapsedSeconds = Math.floor(
        (new Date().getTime() - session.startTime.getTime()) / 1000,
      );
      session.timeLeft = Math.max(0, session.timeLeft - elapsedSeconds);
      session.startTime = undefined;
    }

    this.logger.log(`Timer paused for session: ${data.sessionId}`);
    this.emitSessionState(data.sessionId);

    return { message: 'Timer paused' };
  }

  // Сброс таймера
  @SubscribeMessage('resetTimer')
  handleResetTimer(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      sessionId: string;
      duration?: number; // опционально, новая длительность в минутах
    },
  ) {
    const session = this.activeSessions.get(data.sessionId);

    if (!session) {
      return { error: 'Session not found' };
    }

    // Останавливаем таймер если запущен
    if (session.isRunning) {
      this.stopSessionTimer(data.sessionId);
      session.isRunning = false;
    }

    // Обновляем длительность если указана
    if (data.duration) {
      session.duration = data.duration * 60;
    }

    // Сбрасываем время
    session.timeLeft = session.duration;
    session.startTime = undefined;

    this.logger.log(`Timer reset for session: ${data.sessionId}`);
    this.emitSessionState(data.sessionId);

    return { message: 'Timer reset' };
  }

  // Переключение метода (pomodoro/shortBreak/longBreak)
  @SubscribeMessage('switchMethod')
  handleSwitchMethod(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      sessionId: string;
      method: 'pomodoro' | 'shortBreak' | 'longBreak';
      duration: number; // в минутах
    },
  ) {
    const session = this.activeSessions.get(data.sessionId);

    if (!session) {
      return { error: 'Session not found' };
    }

    // Останавливаем текущий таймер
    if (session.isRunning) {
      this.stopSessionTimer(data.sessionId);
      session.isRunning = false;
    }

    // Обновляем метод и время
    session.method = data.method;
    session.duration = data.duration * 60;
    session.timeLeft = session.duration;
    session.startTime = undefined;

    this.logger.log(
      `Method switched to ${data.method} for session: ${data.sessionId}`,
    );
    this.emitSessionState(data.sessionId);

    return { message: 'Method switched' };
  }

  // Выход из сессии
  @SubscribeMessage('leaveSession')
  handleLeaveSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ) {
    this.leaveSession(client, data.sessionId);

    return { message: 'Left session' };
  }

  // Получение состояния сессии
  @SubscribeMessage('getState')
  handleGetState(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ) {
    const session = this.activeSessions.get(data.sessionId);

    if (!session) {
      return { error: 'Session not found' };
    }

    return this.getTimerState(session);
  }

  // Приватные методы
  private startSessionTimer(sessionId: string) {
    const session = this.activeSessions.get(sessionId);

    if (!session || !session.isRunning) return;

    // Очищаем старый таймер если есть
    if (this.sessionTimers.has(sessionId)) {
      clearInterval(this.sessionTimers.get(sessionId));
    }

    const timer = setInterval(() => {
      const updatedSession = this.activeSessions.get(sessionId);

      if (!updatedSession || !updatedSession.isRunning) {
        clearInterval(timer);
        return;
      }

      // Обновляем оставшееся время
      if (updatedSession.startTime) {
        const elapsedSeconds = Math.floor(
          (new Date().getTime() - updatedSession.startTime.getTime()) / 1000,
        );
        updatedSession.timeLeft = Math.max(
          0,
          updatedSession.duration - elapsedSeconds,
        );

        // Если время вышло
        if (updatedSession.timeLeft <= 0) {
          updatedSession.isRunning = false;
          updatedSession.timeLeft = 0;
          clearInterval(timer);
          this.sessionTimers.delete(sessionId);

          // Отправляем событие завершения
          this.server.to(sessionId).emit('timerComplete', {
            sessionId,
            method: updatedSession.method,
            completedAt: new Date(),
          });

          this.logger.log(`Timer completed for session: ${sessionId}`);
        }

        // Отправляем обновленное состояние
        this.emitSessionState(sessionId);
      }
    }, 1000); // Обновляем каждую секунду

    this.sessionTimers.set(sessionId, timer);
  }

  private stopSessionTimer(sessionId: string) {
    if (this.sessionTimers.has(sessionId)) {
      clearInterval(this.sessionTimers.get(sessionId));
      this.sessionTimers.delete(sessionId);
    }
  }

  private leaveSession(client: Socket, sessionId: string) {
    const session = this.activeSessions.get(sessionId);

    if (session) {
      // Удаляем клиента из участников
      session.participants = session.participants.filter(
        (id) => id !== client.id,
      );

      // Если не осталось участников, удаляем сессию
      if (session.participants.length === 0) {
        this.activeSessions.delete(sessionId);
        this.stopSessionTimer(sessionId);
        this.logger.log(`Session ${sessionId} deleted (no participants)`);
      } else {
        // Обновляем состояние для оставшихся участников
        this.emitSessionState(sessionId);
      }
    }

    client.leave(sessionId);
    this.socketToSession.delete(client.id);

    this.logger.log(`Client ${client.id} left session ${sessionId}`);
  }

  private emitSessionState(sessionId: string) {
    const session = this.activeSessions.get(sessionId);

    if (session) {
      const state = this.getTimerState(session);
      this.server.to(sessionId).emit('timerState', state);
    }
  }

  private getTimerState(session: TimerSession): TimerState {
    const minutes = Math.floor(session.timeLeft / 60);
    const seconds = session.timeLeft % 60;
    const progress =
      ((session.duration - session.timeLeft) / session.duration) * 100;

    return {
      sessionId: session.sessionId,
      timerId: session.timerId,
      method: session.method,
      minutes,
      seconds,
      isRunning: session.isRunning,
      progress,
    };
  }

  // Получение списка активных сессий (для админа/отладки)
  @SubscribeMessage('getActiveSessions')
  handleGetActiveSessions() {
    const sessions = Array.from(this.activeSessions.values()).map(
      (session) => ({
        sessionId: session.sessionId,
        method: session.method,
        participants: session.participants.length,
        isRunning: session.isRunning,
        timeLeft: session.timeLeft,
      }),
    );

    return { sessions };
  }
}
