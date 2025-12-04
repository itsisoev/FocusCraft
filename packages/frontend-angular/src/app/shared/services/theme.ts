import {Injectable, Renderer2, RendererFactory2, signal} from '@angular/core';
import {TypeTheme} from '../types/theme.type';
import {
  THEMES,
  DEFAULT_THEME,
  DEFAULT_LIGHT_THEME,
  DEFAULT_DARK_THEME,
  getThemeById,
  isDarkTheme
} from '../constants/themes.const';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private renderer: Renderer2;
  private currentTheme = signal<TypeTheme>(DEFAULT_THEME);

  constructor(rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
    this.loadTheme();
  }

  setTheme(theme: TypeTheme): void {
    this.currentTheme.set(theme);
    this.renderer.setAttribute(document.body, 'data-theme', theme);
    localStorage.setItem('focuscraft-theme', theme);

    window.dispatchEvent(new CustomEvent('themeChanged', {
      detail: {theme}
    }));
  }

  getTheme(): TypeTheme {
    return this.currentTheme();
  }

  getThemes() {
    return THEMES;
  }

  private loadTheme(): void {
    const savedTheme = localStorage.getItem('focuscraft-theme') as TypeTheme;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    const theme = savedTheme || (prefersDark ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME);
    this.setTheme(theme);
  }

  toggleDarkLight(): void {
    const newTheme = isDarkTheme(this.currentTheme())
      ? DEFAULT_LIGHT_THEME
      : DEFAULT_DARK_THEME;
    this.setTheme(newTheme);
  }

  getCurrentThemeConfig() {
    return getThemeById(this.currentTheme());
  }

  isCurrentThemeDark(): boolean {
    return isDarkTheme(this.currentTheme());
  }
}
