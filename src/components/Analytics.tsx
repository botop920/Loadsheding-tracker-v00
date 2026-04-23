import React from 'react';
import { SheddingData } from '../data';
import { BarChart2, MapPin, Building2, Clock, Zap, AlertCircle, TrendingUp } from 'lucide-react';

interface AnalyticsProps {
  data: SheddingData[];
}

const toBanglaNum = (num: number | string) => {
  const bn = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return num.toString().replace(/\d/g, d => bn[parseInt(d)]);
};

export default function Analytics({ data }: AnalyticsProps) {
  if (!data || data.length === 0) return null;

  const totalAreas = data.length;
  const totalOffices = new Set(data.map(d => d.Office)).size;
  
  const allSheddingCounts = data.map(d => d["shedding hours"].length);
  const totalSheddingHours = allSheddingCounts.reduce((a, b) => a + b, 0);
  const avgShedding = (totalSheddingHours / totalAreas).toFixed(1);

  const maxShedding = Math.max(...allSheddingCounts);
  const minShedding = Math.min(...allSheddingCounts);

  const maxLocations = data.filter(d => d["shedding hours"].length === maxShedding).map(d => d["Upokendro name"] || d.Office);
  const minLocations = data.filter(d => d["shedding hours"].length === minShedding).map(d => d["Upokendro name"] || d.Office);

  // Peak shedding hour calculation
  const hourCounts: { [key: string]: number } = {};
  data.forEach(d => {
    d["shedding hours"].forEach(h => {
      hourCounts[h] = (hourCounts[h] || 0) + 1;
    });
  });

  const sortedHours = Object.entries(hourCounts).sort((a, b) => b[1] - a[1]);
  const peakHour = sortedHours[0]?.[0] || 'N/A';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
          <MapPin className="h-6 w-6" />
        </div>
        <div>
          <div className="text-sm font-medium text-neutral-500">মোট এলাকা</div>
          <div className="text-2xl font-bold text-neutral-900">{toBanglaNum(totalAreas)} টি</div>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
          <Building2 className="h-6 w-6" />
        </div>
        <div>
          <div className="text-sm font-medium text-neutral-500">মোট অফিস</div>
          <div className="text-2xl font-bold text-neutral-900">{toBanglaNum(totalOffices)} টি</div>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
          <Clock className="h-6 w-6" />
        </div>
        <div>
          <div className="text-sm font-medium text-neutral-500">গড় লোডশেডিং</div>
          <div className="text-2xl font-bold text-neutral-900">{toBanglaNum(avgShedding)} ঘণ্টা</div>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-red-50 rounded-xl text-red-600">
          <TrendingUp className="h-6 w-6" />
        </div>
        <div>
          <div className="text-sm font-medium text-neutral-500">পিক আওয়ার</div>
          <div className="text-[15px] font-bold text-neutral-900">{peakHour}</div>
        </div>
      </div>

      <div className="md:col-span-2 bg-gradient-to-br from-red-50 to-amber-50 p-5 rounded-2xl border border-red-100 shadow-sm">
        <div className="flex items-center gap-2 text-red-700 font-bold mb-3">
          <AlertCircle className="h-5 w-5" />
          সর্বোচ্চ লোডশেডিং এলাকা ({toBanglaNum(maxShedding)} ঘণ্টা)
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from(new Set(maxLocations)).slice(0, 5).map((loc, i) => (
            <span key={i} className="px-3 py-1 bg-white/60 border border-red-200 text-red-800 text-xs font-bold rounded-lg">{loc}</span>
          ))}
          {maxLocations.length > 5 && <span className="text-xs text-red-600 font-bold self-center">আরও {toBanglaNum(maxLocations.length - 5)} টি...</span>}
        </div>
      </div>

      <div className="md:col-span-2 bg-gradient-to-br from-emerald-50 to-teal-50 p-5 rounded-2xl border border-emerald-100 shadow-sm">
        <div className="flex items-center gap-2 text-emerald-700 font-bold mb-3">
          <TrendingUp className="h-5 w-5 rotate-180" />
          সর্বনিম্ন লোডশেডিং এলাকা ({toBanglaNum(minShedding)} ঘণ্টা)
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from(new Set(minLocations)).slice(0, 5).map((loc, i) => (
            <span key={i} className="px-3 py-1 bg-white/60 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-lg">{loc}</span>
          ))}
          {minLocations.length > 5 && <span className="text-xs text-emerald-600 font-bold self-center">আরও {toBanglaNum(minLocations.length - 5)} টি...</span>}
        </div>
      </div>
    </div>
  );
}
