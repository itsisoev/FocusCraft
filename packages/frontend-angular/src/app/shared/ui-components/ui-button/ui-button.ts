import {ChangeDetectionStrategy, Component, inject, input, output} from '@angular/core';
import {ThemeService} from '../../services/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'ui-button',
  standalone: true,
  imports: [],
  templateUrl: './ui-button.html',
  styleUrl: './ui-button.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiButton {
  private themeService = inject(ThemeService);

  variant = input<ButtonVariant>('primary');
  size = input<ButtonSize>('md');
  disabled = input(false);
  loading = input(false);
  fullWidth = input(false);
  type = input<'button' | 'submit' | 'reset'>('button');

  clicked = output<MouseEvent>()

  get buttonClasses(): string {
    return [
      'button',
      `button--${this.variant()}`,
      `button--${this.size()}`,
      this.disabled() && 'button--disabled',
      this.loading() && 'button--loading',
      this.fullWidth() && 'button--full-width',
    ].filter(Boolean).join(' ');
  }

  onClick(event: MouseEvent) {
    if (!this.disabled() && !this.loading()) {
      this.clicked.emit(event);
    }
  }
}
