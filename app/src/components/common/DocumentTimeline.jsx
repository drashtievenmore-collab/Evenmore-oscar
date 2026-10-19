import React from 'react';
import { CheckCircle2, Circle, Clock } from 'lucide-react';

function TimelineConnector({ isCompleted, isCurrent, isNextCurrent }) {
  if (isCompleted && isNextCurrent) {
    return (
      <div className="hidden sm:flex items-center justify-center -mt-6 px-1 select-none shrink-0 w-10 sm:w-14">
        <svg className="w-10 sm:w-14 h-7 overflow-visible" viewBox="0 0 54 28">
          <line x1="2" y1="14" x2="44" y2="14" stroke="#fef3c7" strokeWidth="4" strokeLinecap="round" opacity="0.8" />
          <line x1="2" y1="14" x2="44" y2="14" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" />
          <line
            x1="2"
            y1="14"
            x2="44"
            y2="14"
            stroke="#f59e0b"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="6 6"
            className="animate-flow-dash"
          />
          <circle r="3" fill="#b45309">
            <animate attributeName="cx" values="4;44;4" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite" />
          </circle>
          <path
            d="M 36 8 L 46 14 L 36 20"
            fill="none"
            stroke="#d97706"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }

  if (isCurrent) {
    return (
      <div className="hidden sm:flex items-center justify-center -mt-6 px-1 select-none shrink-0 w-10 sm:w-14">
        <svg className="w-10 sm:w-14 h-7 overflow-visible" viewBox="0 0 54 28">
          <line x1="2" y1="14" x2="44" y2="14" stroke="#fef3c7" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
          <line x1="2" y1="14" x2="44" y2="14" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 4" />
          <path
            d="M 36 8 L 46 14 L 36 20"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className="hidden sm:flex items-center justify-center -mt-6 px-1 select-none shrink-0 w-10 sm:w-14">
        <svg className="w-10 sm:w-14 h-7 overflow-visible" viewBox="0 0 54 28">
          <line x1="2" y1="14" x2="44" y2="14" stroke="#10b981" strokeWidth="3" strokeLinecap="round" />
          <path
            d="M 36 8 L 46 14 L 36 20"
            fill="none"
            stroke="#10b981"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }

  return (
    <div className="hidden sm:flex items-center justify-center -mt-6 px-1 select-none shrink-0 w-10 sm:w-14">
      <svg className="w-10 sm:w-14 h-7 overflow-visible" viewBox="0 0 54 28">
        <line x1="2" y1="14" x2="44" y2="14" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 4" />
        <path
          d="M 36 8 L 46 14 L 36 20"
          fill="none"
          stroke="#cbd5e1"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export const DocumentTimeline = ({ steps, onStepClick, className = '' }) => {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-4 shadow-sm overflow-x-auto ${className}`}>
      <style>{`
        @keyframes flowDash {
          to { stroke-dashoffset: -24; }
        }
        .animate-flow-dash {
          animation: flowDash 1.2s linear infinite;
        }
      `}</style>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Document Lifecycle Timeline
        </h4>
        <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
          {steps.length} Stages
        </span>
      </div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 min-w-max">
        {steps.map((step, idx) => {
          const isCompleted = step.status === 'completed';
          const isCurrent = step.status === 'current';
          const isLast = idx === steps.length - 1;
          const nextStep = steps[idx + 1];
          const isNextCurrent = nextStep?.status === 'current';

          return (
            <React.Fragment key={idx}>
              <div
                role={onStepClick ? 'button' : undefined}
                tabIndex={onStepClick ? 0 : undefined}
                onClick={() => onStepClick && onStepClick(step, idx)}
                className={`group flex items-start sm:flex-col sm:items-center gap-2.5 sm:gap-1.5 flex-1 min-w-[95px] max-w-[130px] p-1.5 rounded-xl transition-all ${
                  onStepClick ? 'hover:bg-amber-50/60 cursor-pointer hover:shadow-2xs active:scale-95' : ''
                }`}
                title={onStepClick ? `Click to open Stage: ${step.label}` : undefined}
              >
                <div className="relative flex items-center justify-center">
                  {isCompleted ? (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 border-2 border-emerald-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  ) : isCurrent ? (
                    <div className="w-8 h-8 rounded-full bg-amber-50 border-2 border-amber-500 text-amber-600 flex items-center justify-center animate-pulse ring-4 ring-amber-200/80 group-hover:scale-105 transition-transform">
                      <Clock className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-slate-300 text-slate-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Circle className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>

                <div className="text-left sm:text-center min-w-0 w-full">
                  <p
                    className={`text-[11px] font-bold leading-tight line-clamp-2 transition-colors ${
                      isCompleted ? 'text-emerald-800' : isCurrent ? 'text-amber-800 font-black' : 'text-slate-500'
                    } ${onStepClick ? 'group-hover:text-amber-700' : ''}`}
                  >
                    {step.label}
                  </p>
                  {step.docNumber && (
                    <p className="text-[10.5px] font-mono text-slate-700 font-semibold truncate mt-0.5">
                      {step.docNumber}
                    </p>
                  )}
                  {step.amount !== undefined && step.amount !== null && (
                    <p className="text-[10.5px] font-mono font-bold text-slate-800 mt-0.5">
                      ₹{Number(step.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  )}
                  {step.date && <p className="text-[9.5px] text-slate-400 mt-0.5">{step.date}</p>}
                </div>
              </div>

              {!isLast && (
                <TimelineConnector
                  isCompleted={isCompleted}
                  isCurrent={isCurrent}
                  isNextCurrent={isNextCurrent}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
