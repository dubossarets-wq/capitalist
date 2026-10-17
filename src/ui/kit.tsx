// Базовые игровые элементы интерфейса
import type { ReactNode, CSSProperties } from 'react';
import { Icon } from './Icon';
import { sound } from '../audio/sound';

export type BtnColor = 'gold' | 'green' | 'blue' | 'purple' | 'red' | 'orange' | 'pink' | 'teal' | 'gray' | 'dark';

export function GameButton(props: {
  children?: ReactNode;
  icon?: string;
  sub?: ReactNode;
  color?: BtnColor;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  onClick?: () => void;
  disabled?: boolean;
  pulse?: boolean;
  block?: boolean;
  center?: boolean;
  round?: boolean;
  badge?: ReactNode;
  title?: string;
  style?: CSSProperties;
  silent?: boolean;
}) {
  const { children, icon, sub, color = 'gold', size = 'md', onClick, disabled, pulse, block, center, round, badge, title, style, silent } = props;
  const cls = ['g-btn', color === 'gold' ? '' : color, size !== 'md' ? size : '', pulse ? 'pulse' : '', block ? 'block' : '', center ? 'center' : '', round ? 'round' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <button
      className={cls}
      disabled={disabled}
      title={title}
      style={style}
      onPointerEnter={() => !disabled && sound.play('hover')}
      onClick={() => {
        if (disabled) return;
        if (!silent) sound.play('click');
        onClick?.();
      }}
    >
      <span className="g-btn__face">
        {icon && <Icon name={icon} />}
        {(children || sub) && (
          <span className="g-btn__label">
            {children && <span>{children}</span>}
            {sub && <span className="g-btn__sub">{sub}</span>}
          </span>
        )}
      </span>
      {badge != null && badge !== 0 && badge !== false && <span className="badge">{badge}</span>}
    </button>
  );
}

export function Window(props: { title?: ReactNode; children: ReactNode; onClose?: () => void; className?: string; style?: CSSProperties }) {
  return (
    <div className={`g-window ${props.title ? 'has-title' : ''} ${props.className ?? ''}`} style={props.style}>
      {props.title && <div className="g-window__title">{props.title}</div>}
      {props.onClose && (
        <div className="g-window__close">
          <GameButton round color="red" size="sm" icon="close" onClick={props.onClose} />
        </div>
      )}
      {props.children}
    </div>
  );
}

export function Modal(props: { title?: ReactNode; children: ReactNode; onClose?: () => void; width?: string; clear?: boolean; className?: string }) {
  return (
    <div
      className={`modal-backdrop ${props.clear ? 'clear' : ''}`}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget && props.onClose) props.onClose();
      }}
    >
      <Window title={props.title} onClose={props.onClose} className={`modal ${props.className ?? ''}`} style={{ width: props.width }}>
        <div className="modal-body">{props.children}</div>
      </Window>
    </div>
  );
}

export function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      className={`g-toggle ${value ? 'on' : ''}`}
      disabled={disabled}
      onClick={() => {
        sound.play('pop');
        onChange(!value);
      }}
      aria-pressed={value}
    />
  );
}

export function Range(props: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; disabled?: boolean }) {
  const p = ((props.value - props.min) / (props.max - props.min)) * 100;
  return (
    <input
      className="g-range"
      type="range"
      min={props.min}
      max={props.max}
      step={props.step ?? 1}
      value={props.value}
      disabled={props.disabled}
      style={{ ['--p' as any]: `${p}%` }}
      onChange={(e) => props.onChange(Number(e.target.value))}
    />
  );
}

export function Stepper(props: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; format?: (v: number) => string; disabled?: boolean }) {
  const step = props.step ?? 1;
  const fmt = props.format ?? ((v: number) => String(v));
  return (
    <div className="stepper">
      <GameButton round size="sm" color="purple" icon="minus" disabled={props.disabled || props.value <= props.min} onClick={() => props.onChange(Math.max(props.min, +(props.value - step).toFixed(2)))} />
      <div className="stepper__val">{fmt(props.value)}</div>
      <GameButton round size="sm" color="purple" icon="plus" disabled={props.disabled || props.value >= props.max} onClick={() => props.onChange(Math.min(props.max, +(props.value + step).toFixed(2)))} />
    </div>
  );
}

export function Segmented<T extends string | number>(props: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <div className="segmented">
      {props.options.map((o) => (
        <button
          key={String(o.value)}
          className={`chip-btn ${o.value === props.value ? 'active' : ''}`}
          disabled={props.disabled}
          onClick={() => {
            sound.play('click');
            props.onChange(o.value);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SettingRow(props: { icon?: string; title: ReactNode; desc?: ReactNode; children?: ReactNode }) {
  return (
    <div className="setting-row">
      {props.icon && <Icon name={props.icon} />}
      <div className="setting-row__text">
        <div className="setting-row__title">{props.title}</div>
        {props.desc && <div className="setting-row__desc">{props.desc}</div>}
      </div>
      {props.children}
    </div>
  );
}

export function Tabs<T extends string>(props: { value: T; tabs: { id: T; label: string; icon?: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="tabs">
      {props.tabs.map((t) => (
        <button
          key={t.id}
          className={`tab ${t.id === props.value ? 'active' : ''}`}
          onClick={() => {
            sound.play('click');
            props.onChange(t.id);
          }}
        >
          {t.icon && <Icon name={t.icon} />}
          {t.label}
        </button>
      ))}
    </div>
  );
}

export const money = (n: number) => `$${Math.round(n).toLocaleString('ru-RU')}`;
