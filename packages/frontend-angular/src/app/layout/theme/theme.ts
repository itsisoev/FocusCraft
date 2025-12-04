import {ChangeDetectionStrategy, Component, HostListener, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {ThemeService} from '../../shared/services/theme';
import {Subscription} from 'rxjs';
import {TypeTheme} from '../../shared/types/theme.type';
import {THEMES} from '../../shared/constants/themes.const';

@Component({
  selector: 'layout-theme',
  imports: [],
  templateUrl: './theme.html',
  styleUrl: './theme.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Theme implements OnInit, OnDestroy {
  private readonly themeService = inject(ThemeService)

  isPanelOpen = signal<boolean>(false);
  currentTheme = signal<TypeTheme>('serika-dark');
  currentThemeColor = signal<string>('#1a1a1a');
  isDarkTheme = signal<boolean>(true);

  themes = signal(THEMES);

  private themeSubscription?: Subscription;


  ngOnInit(): void {
    this.currentTheme.set(this.themeService.getTheme());
    this.updateThemeColor();
    this.isDarkTheme.set(this.currentTheme().includes('dark'));

    window.addEventListener('themeChanged', (event: any) => {
      this.currentTheme.set(event.detail.theme);
      this.updateThemeColor();
      this.isDarkTheme.set(this.currentTheme().includes('dark'));
    });
  }

  ngOnDestroy(): void {
    this.themeSubscription?.unsubscribe();
    window.removeEventListener('themeChanged', () => {
    });
  }

  toggleThemePanel(): void {
    this.isPanelOpen.set(!this.isPanelOpen());
  }

  closePanel(): void {
    this.isPanelOpen.set(false);
  }

  selectTheme(theme: TypeTheme): void {
    this.themeService.setTheme(theme);
    this.currentTheme.set(theme);
    this.updateThemeColor();
    this.isDarkTheme.set(theme.includes('dark'));
    this.closePanel();
  }

  toggleDarkMode(): void {
    const newTheme = this.isDarkTheme() ? 'lilac-mist' : 'serika-dark';
    this.selectTheme(newTheme);
  }

  private updateThemeColor(): void {
    const theme = this.themes().find(t => t.id === this.currentTheme());
    this.currentThemeColor.set(theme?.preview || '#1a1a1a');
  }

  getCurrentThemeColor(): string {
    const theme = this.themes().find(t => t.id === this.currentTheme());
    return theme?.preview || '#1a1a1a';
  }


  getIsDarkTheme(): boolean {
    const theme = this.themes().find(t => t.id === this.currentTheme());
    return theme?.group === 'dark';
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isPanelOpen()) {
      this.closePanel();
    }
  }

  @HostListener('document:click', ['$event.target'])
  onClickOutside(target: any): void {
    const clickedInside = target.closest('.theme-container');
    if (!clickedInside && this.isPanelOpen()) {
      this.closePanel();
    }
  }
}
