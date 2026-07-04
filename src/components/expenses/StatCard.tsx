/**
 * Small reusable stat tile used across the Overview and Analytics tabs.
 */

interface StatCardProps {
  label: string;
  value: string;
  gradientFrom: string;
  gradientTo: string;
  textColor: string;
  subtext?: string;
}

export function StatCard({ label, value, gradientFrom, gradientTo, textColor, subtext }: StatCardProps) {
  return (
    <div className={`text-center p-3 bg-gradient-to-br ${gradientFrom} ${gradientTo} rounded-xl`}>
      <span className={`text-lg font-bold ${textColor} block truncate`}>{value}</span>
      <span className={`text-xs ${textColor} font-medium opacity-80`}>{label}</span>
      {subtext && <p className="text-[10px] text-slate-500 mt-0.5">{subtext}</p>}
    </div>
  );
}
