import React from 'react';
import { ArrowRight, Users } from 'lucide-react';

export function Wave({ color = '#93c5fd' }) {
  return (
    <svg
      viewBox="0 0 300 34"
      preserveAspectRatio="none"
      className="pointer-events-none absolute bottom-0 left-0 h-[30px] w-full"
    >
      <path
        d="M0 22 C 40 8, 70 30, 110 20 S 180 6, 220 18 S 270 28, 300 16 L300 34 L0 34 Z"
        fill={color}
        opacity="0.45"
      />
      <path
        d="M0 26 C 50 16, 90 32, 140 24 S 210 14, 260 24 S 290 28, 300 22 L300 34 L0 34 Z"
        fill={color}
        opacity="0.75"
      />
    </svg>
  );
}

const tones = {
  blue: {
    iconBg: '#eff6ff',
    iconColor: '#2563eb',
    wave: '#93c5fd',
    arrowBg: '#eff6ff',
    arrowColor: '#2563eb',
  },
  emerald: {
    iconBg: '#ecfdf5',
    iconColor: '#059669',
    wave: '#a7f3d0',
    arrowBg: '#ecfdf5',
    arrowColor: '#059669',
  },
  amber: {
    iconBg: '#fffbeb',
    iconColor: '#d97706',
    wave: '#fde68a',
    arrowBg: '#fffbeb',
    arrowColor: '#d97706',
  },
  purple: {
    iconBg: '#f5f3ff',
    iconColor: '#7c3aed',
    wave: '#ddd6fe',
    arrowBg: '#f5f3ff',
    arrowColor: '#7c3aed',
  },
  rose: {
    iconBg: '#fff1f2',
    iconColor: '#e11d48',
    wave: '#fecdd3',
    arrowBg: '#fff1f2',
    arrowColor: '#e11d48',
  },
  indigo: {
    iconBg: '#eef2ff',
    iconColor: '#4f46e5',
    wave: '#c7d2fe',
    arrowBg: '#eef2ff',
    arrowColor: '#4f46e5',
  },
  sky: {
    iconBg: '#f0f9ff',
    iconColor: '#0284c7',
    wave: '#bae6fd',
    arrowBg: '#f0f9ff',
    arrowColor: '#0284c7',
  },
  teal: {
    iconBg: '#f0fdfa',
    iconColor: '#0d9488',
    wave: '#99f6e4',
    arrowBg: '#f0fdfa',
    arrowColor: '#0d9488',
  },
  orange: {
    iconBg: '#fff7ed',
    iconColor: '#ea580c',
    wave: '#fed7aa',
    arrowBg: '#fff7ed',
    arrowColor: '#ea580c',
  },
  cyan: {
    iconBg: '#ecfeff',
    iconColor: '#0891b2',
    wave: '#a5f3fc',
    arrowBg: '#ecfeff',
    arrowColor: '#0891b2',
  },
  slate: {
    iconBg: '#f8fafc',
    iconColor: '#475569',
    wave: '#cbd5e1',
    arrowBg: '#f8fafc',
    arrowColor: '#475569',
  },
};

tones.green = tones.emerald;
tones.red = tones.rose;
tones.yellow = tones.amber;
tones.violet = tones.purple;
tones.gray = tones.slate;

export default function KpiCard({
  label,
  title,
  value,
  icon: Icon,
  symbol,
  tone = 'blue',
  color,
  sub,
  subtext,
  subtitle,
  trend,
  unit,
  onClick,
  className = '',
  children,
  badgeBg,
  iconBg: customIconBg,
  iconColor: customIconColor,
  wave: customWave,
  arrowBg: customArrowBg,
  arrowColor: customArrowColor,
}) {
  const selectedTone = tone || color || 'blue';
  const palette = tones[selectedTone] || tones.blue;
  const cardLabel = label || title || '';
  const secondaryText = sub || subtext || subtitle;
  const iconBg = customIconBg || badgeBg || palette.iconBg;
  const iconColor = customIconColor || palette.iconColor;
  const wave = customWave || palette.wave;
  const arrowBg = customArrowBg || palette.arrowBg;
  const arrowColor = customArrowColor || palette.arrowColor;

  return (
    <article
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`group relative min-w-0 overflow-hidden rounded-xl border border-[#e2eaf5] bg-white p-4 pb-9 shadow-[0_1px_2px_rgba(16,42,82,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
        onClick ? 'cursor-pointer select-none' : ''
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg transition-transform duration-200 group-hover:scale-105"
            style={{ background: iconBg, color: iconColor }}
          >
            {Icon ? (
              <Icon size={19} strokeWidth={2.1} aria-hidden="true" />
            ) : symbol ? (
              <span className="text-base font-extrabold">{symbol}</span>
            ) : (
              <Users size={19} strokeWidth={2.1} />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1 truncate">
              <strong className="block truncate text-[16px] sm:text-[18px] font-extrabold tracking-tight text-[#17294e]">
                {value}
              </strong>
              {unit && <span className="text-xs font-semibold text-slate-500">{unit}</span>}
            </div>
            <p className="truncate text-[11px] font-medium text-slate-500 mt-0.5" title={cardLabel}>
              {cardLabel}
            </p>
            {trend && (
              <p className="mt-1 flex items-center gap-1 text-[10.5px] font-semibold text-emerald-600">
                <span className="inline-block">↗</span> {trend}
              </p>
            )}
            {!trend && secondaryText && (
              <p className="mt-0.5 truncate text-[10.5px] font-medium text-slate-400" title={secondaryText}>
                {secondaryText}
              </p>
            )}
            {children}
          </div>
        </div>
        <span
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full border transition-transform duration-200 group-hover:scale-110"
          style={{ background: arrowBg, borderColor: '#e2eaf5', color: arrowColor }}
        >
          <ArrowRight size={12} />
        </span>
      </div>
      <Wave color={wave} />
    </article>
  );
}
