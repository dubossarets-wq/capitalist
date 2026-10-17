import type { ThemeId } from '../../shared/types';

export interface ThemeDef {
  id: ThemeId;
  name: string;
  description: string;
  pageBg: string;
  boardBase: string;
  boardSide: string;
  grout: string;
  cellBg: string;
  cellBg2: string;
  cellText: string;
  cornerBg: string;
  cornerBg2: string;
  accent: string;
  accent2: string;
  center1: string;
  center2: string;
  logoFill: [string, string];
  logoStroke: string;
  priceBg: string;
  priceText: string;
  table: 'wood' | 'asphalt' | 'meadow';
  tableColor: string;
  hemiSky: number;
  hemiGround: number;
  sunColor: number;
  sunIntensity: number;
  ambient: number;
  exposure: number;
}

export const THEMES: Record<ThemeId, ThemeDef> = {
  classic: {
    id: 'classic',
    name: 'Классический',
    description: 'Тёплое дерево, кремовые клетки и золото',
    pageBg: 'radial-gradient(ellipse at 50% 30%, #3d6fd8 0%, #23338f 45%, #120f45 100%)',
    boardBase: '#0f6b4a',
    boardSide: '#6b3e1f',
    grout: '#0b4a33',
    cellBg: '#fff6e0',
    cellBg2: '#f6e3b8',
    cellText: '#2b1d0e',
    cornerBg: '#fff2cf',
    cornerBg2: '#f4d98f',
    accent: '#e53935',
    accent2: '#1e88e5',
    center1: '#2fb37a',
    center2: '#0b6a45',
    logoFill: ['#fff6b0', '#ffb300'],
    logoStroke: '#7a2e00',
    priceBg: '#ffffff',
    priceText: '#2b1d0e',
    table: 'wood',
    tableColor: '#8a5a33',
    hemiSky: 0xfff4e0,
    hemiGround: 0x4a3020,
    sunColor: 0xfff1d6,
    sunIntensity: 2.6,
    ambient: 0.35,
    exposure: 1.05,
  },
  city: {
    id: 'city',
    name: 'Современный город',
    description: 'Неоновые огни, небоскрёбы и ночной мегаполис',
    pageBg: 'radial-gradient(ellipse at 50% 20%, #5a2ca8 0%, #1b1150 50%, #05051a 100%)',
    boardBase: '#141b3c',
    boardSide: '#0b0f24',
    grout: '#0a0e22',
    cellBg: '#22305e',
    cellBg2: '#18224a',
    cellText: '#eaf6ff',
    cornerBg: '#2a1f5e',
    cornerBg2: '#1a1440',
    accent: '#00e5ff',
    accent2: '#ff3df2',
    center1: '#2a2470',
    center2: '#0c0b2c',
    logoFill: ['#7df9ff', '#ff4fd8'],
    logoStroke: '#0a0630',
    priceBg: '#0d1433',
    priceText: '#7df9ff',
    table: 'asphalt',
    tableColor: '#1a1d2b',
    hemiSky: 0x9ab8ff,
    hemiGround: 0x221133,
    sunColor: 0xc9d6ff,
    sunIntensity: 2.0,
    ambient: 0.45,
    exposure: 1.15,
  },
  fairy: {
    id: 'fairy',
    name: 'Сказочный',
    description: 'Пастельные цвета, грибы, замки и волшебный лес',
    pageBg: 'radial-gradient(ellipse at 50% 25%, #ffd1f0 0%, #b98cff 45%, #5a3fb8 100%)',
    boardBase: '#8e5bd8',
    boardSide: '#5b3496',
    grout: '#7a48c4',
    cellBg: '#fff4fb',
    cellBg2: '#ffe0f2',
    cellText: '#4a2370',
    cornerBg: '#fff0c8',
    cornerBg2: '#ffd2ec',
    accent: '#ff7ac6',
    accent2: '#7c4dff',
    center1: '#9be7a7',
    center2: '#3fae6a',
    logoFill: ['#fff7ff', '#ff9de0'],
    logoStroke: '#6a2aa8',
    priceBg: '#ffffff',
    priceText: '#5b2a8a',
    table: 'meadow',
    tableColor: '#6fcf7a',
    hemiSky: 0xfff0ff,
    hemiGround: 0x4f8a4a,
    sunColor: 0xfff2e6,
    sunIntensity: 2.4,
    ambient: 0.45,
    exposure: 1.05,
  },
};
