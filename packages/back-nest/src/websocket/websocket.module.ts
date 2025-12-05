import { Module } from '@nestjs/common';
import { TimerGateway } from './timer/timer.gateway';

@Module({
  providers: [TimerGateway],
  exports: [TimerGateway],
})
export class WebsocketModule {}
