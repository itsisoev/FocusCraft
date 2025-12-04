import {TypeTheme} from '../types/theme.type';

export interface ThemeConfig {
  id: TypeTheme;
  name: string;
  preview: string;
  description?: string;
  group: 'dark' | 'light';
}

export const THEMES: ThemeConfig[] = [
  {
    id: 'serika-dark',
    name: 'Serika Dark',
    preview: '#1a1a1a',
    description: 'Темная профессиональная тема для фокуса',
    group: 'dark'
  },
  {
    id: 'iceberg-dark',
    name: 'Iceberg Dark',
    preview: '#0f172a',
    description: 'Холодные темные тона как арктический айсберг',
    group: 'dark'
  },
  {
    id: 'lilac-mist',
    name: 'Lilac Mist',
    preview: '#faf5ff',
    description: 'Нежные лиловые тона для спокойной работы',
    group: 'light'
  },
  {
    id: 'lil-dragon',
    name: 'Lil Dragon',
    preview: '#fef2f2',
    description: 'Драконьи красные и розовые акценты',
    group: 'light'
  },
  {
    id: 'blueberry-light',
    name: 'Blueberry Light',
    preview: '#eff6ff',
    description: 'Свежие ягодные синие оттенки',
    group: 'light'
  },
  {
    id: 'alpine',
    name: 'Alpine',
    preview: '#f0fdf4',
    description: 'Альпийские зеленые тона для чистоты мысли',
    group: 'light'
  },
  {
    id: 'purpleish',
    name: 'Purpleish',
    preview: '#faf5ff',
    description: 'Фиолетовые акценты для креативности',
    group: 'light'
  },
  {
    id: 'bliss',
    name: 'Bliss',
    preview: '#fefce8',
    description: 'Солнечные желтые тона для позитивного настроя',
    group: 'light'
  }
] as const;

export const DEFAULT_THEME: TypeTheme = 'serika-dark';
export const DEFAULT_LIGHT_THEME: TypeTheme = 'lilac-mist';
export const DEFAULT_DARK_THEME: TypeTheme = 'serika-dark';

export function getThemeById(id: TypeTheme): ThemeConfig | undefined {
  return THEMES.find(theme => theme.id === id);
}

export function getThemesByGroup(group: 'dark' | 'light'): ThemeConfig[] {
  return THEMES.filter(theme => theme.group === group);
}

export function isDarkTheme(id: TypeTheme): boolean {
  return getThemeById(id)?.group === 'dark';
}
