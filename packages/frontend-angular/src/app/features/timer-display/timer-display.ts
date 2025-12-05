import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {UiButton} from '../../shared/ui-components/ui-button/ui-button';

@Component({
  selector: 'features-timer-display',
  imports: [
    UiButton,
  ],
  templateUrl: './timer-display.html',
  styleUrl: './timer-display.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimerDisplay {

}
