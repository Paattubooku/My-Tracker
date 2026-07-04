/**
 * Circular progress indicator for hydration goal
 */

import { useMemo } from 'react';

interface ProgressCircleProps {
  percentage: number;
  todayTotal: number;
  dailyGoal: number;
  size?: number;
}

export function ProgressCircle({
  percentage,
  todayTotal,
  dailyGoal,
  size = 280,
}: ProgressCircleProps) {
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const color = useMemo(() => {
    if (percentage >= 100) return '#10b981'; // emerald-500
    if (percentage >= 75) return '#06b6d4'; // cyan-500
    if (percentage >= 50) return '#3b82f6'; // blue-500
    if (percentage >= 25) return '#8b5cf6'; // violet-500
    return '#f97316'; // orange-500
  }, [percentage]);

  const statusText = useMemo(() => {
    if (percentage >= 100) return '🎉 Goal Reached!';
    if (percentage >= 75) return 'Almost there!';
    if (percentage >= 50) return 'Halfway done';
    if (percentage >= 25) return 'Keep going';
    return "Let's start hydrating!";
  }, [percentage]);

  return (
    <div className="relative flex flex-col items-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-bold text-slate-800">
          {todayTotal.toLocaleString()}
        </span>
        <span className="text-lg text-slate-500">
          / {dailyGoal.toLocaleString()} ml
        </span>
        <span
          className="mt-2 text-sm font-medium px-3 py-1 rounded-full"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {Math.round(percentage)}% • {statusText}
        </span>
      </div>
    </div>
  );
}
