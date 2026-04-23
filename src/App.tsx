/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Search, Heart, MapPin, Clock, Zap, Filter, AlertTriangle, ChevronDown, ChevronUp, Home, Info, X, FileJson, Shield, BarChart2 } from 'lucide-react';
import { SheddingData } from './data';
import { supabase } from './supabase';
import AdminPanel from './AdminPanel';
import Analytics from './components/Analytics';

const parseBanglaHour = (timeStr: string) => {
  let enStr = "";
  for (let i = 0; i < timeStr.length; i++) {
    const code = timeStr.charCodeAt(i);
    if (code >= 2534 && code <= 2543) {
      enStr += (code - 2534).toString();
    } else if (code >= 1632 && code <= 1641) {
      enStr += (code - 1632).toString();
    } else if (code >= 1776 && code <= 1785) {
      enStr += (code - 1776).toString();
    } else {
      enStr += timeStr[i];
    }
  }
  
  const match = enStr.match(/(\d{1,2}):(\d{1,2})\s*-\s*(\d{1,2}):(\d{1,2})/);
  if (match) {
    return {
      startHour: parseInt(match[1], 10),
      startMin: parseInt(match[2], 10),
      endHour: parseInt(match[3], 10),
      endMin: parseInt(match[4], 10),
    };
  }
  return null;
};

const toBangla12H = (hour: number) => {
  let h12 = hour % 12;
  if (h12 === 0) h12 = 12;
  return h12.toString().split('').map(d => '০১২৩৪৫৬৭৮৯'[parseInt(d, 10)]).join('');
};

const getBanglaPeriod = (hour: number) => {
  if (hour >= 4 && hour < 6) return 'ভোর';
  if (hour >= 6 && hour < 12) return 'সকাল';
  if (hour >= 12 && hour < 15) return 'দুপুর';
  if (hour >= 15 && hour < 18) return 'বিকেল';
  if (hour >= 18 && hour < 20) return 'সন্ধ্যা';
  return 'রাত';
};

const toBanglaNum = (num: number) => {
  return num.toString().split('').map(d => '০১২৩৪৫৬৭৮৯'[parseInt(d, 10)]).join('');
};

const formatReadableTime = (timeStr: string) => {
  const parsed = parseBanglaHour(timeStr);
  if (!parsed) return timeStr;
  
  const { startHour, startMin, endHour, endMin } = parsed;
  const period = getBanglaPeriod(startHour);
  const start12 = toBangla12H(startHour);
  const end12 = toBangla12H(endHour === 24 ? 0 : endHour);
  
  const formatMin = (min: number) => min > 0 ? `:${toBanglaNum(min).padStart(2, '০')}` : '';
  
  return `${period} ${start12}${formatMin(startMin)}-${end12}${formatMin(endMin)}`;
};

function useCurrentTime() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return time;
}

function TimeSlotPill({ timeStr, currentTime }: { timeStr: string, currentTime: Date, key?: any }) {
  const parsed = parseBanglaHour(timeStr);
  const formattedStr = formatReadableTime(timeStr);
  
  if (!parsed) {
    return <span className="bg-neutral-100 text-neutral-800 text-[11px] font-bold px-2 py-1 rounded-md border border-neutral-200">{formattedStr}</span>;
  }
  
  const startMins = parsed.startHour * 60 + parsed.startMin;
  const endMins = (parsed.endHour === 24 ? 24 * 60 : parsed.endHour * 60) + parsed.endMin;
  
  const currentTotalMins = currentTime.getHours() * 60 + currentTime.getMinutes();
  const currentTotalSecs = currentTotalMins * 60 + currentTime.getSeconds();
  const endTotalSecs = endMins * 60;
  
  let status = 'future';
  if (currentTotalMins >= endMins) {
    status = 'past';
  } else if (currentTotalMins >= startMins && currentTotalMins < endMins) {
    status = 'active';
  }
  
  if (status === 'past') {
    return (
      <span className="bg-emerald-50 text-emerald-700 text-[11px] font-bold px-2 py-1 rounded-md border border-emerald-200 flex items-center gap-1 opacity-75">
        ✅ {formattedStr}
      </span>
    );
  }
  
  if (status === 'active') {
    const remainTotalSecs = endTotalSecs - currentTotalSecs;
    const rMins = Math.floor(remainTotalSecs / 60);
    const rSecs = remainTotalSecs % 60;
    
    const rMinsBn = toBanglaNum(rMins);
    const rSecsBn = toBanglaNum(rSecs);
    const padSecsBn = rSecs < 10 ? '০' + rSecsBn : rSecsBn;
    
    return (
      <span className="bg-red-500 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-md border border-red-600 shadow-md flex items-center gap-1.5 animate-pulse order-first">
        ⚡ চলছে (আর {rMinsBn}:{padSecsBn} মি.)
      </span>
    );
  }
  
  const diffMins = startMins - currentTotalMins;
  if (diffMins <= 30) {
    return (
      <span className="bg-red-100 text-red-800 text-[11px] font-bold px-2 py-1 rounded-md border border-red-300 flex items-center gap-1 shadow-sm">
        🔥 {formattedStr} (আসন্ন)
      </span>
    );
  } else if (diffMins <= 60) {
    return (
      <span className="bg-orange-100 text-orange-800 text-[11px] font-bold px-2 py-1 rounded-md border border-orange-300 flex items-center gap-1">
        ⏳ {formattedStr}
      </span>
    );
  } else {
    return (
      <span className="bg-yellow-50 text-yellow-800 text-[11px] font-bold px-2 py-1 rounded-md border border-yellow-200 flex items-center gap-1 opacity-90">
        🕒 {formattedStr}
      </span>
    );
  }
}

function Timeline({ sheddingHoursList, currentTime }: { sheddingHoursList: string[], currentTime: Date }) {
  const currentHour = currentTime.getHours();
  const sheddingSet = new Set<number>();
  
  sheddingHoursList.forEach(t => {
     const p = parseBanglaHour(t);
     if (p && !isNaN(p.startHour)) {
        sheddingSet.add(p.startHour);
     }
  });

  return (
    <div className="mt-4 border border-neutral-200 rounded-xl p-4 bg-neutral-50/50">
      <div className="flex w-full h-8 rounded-md overflow-visible ring-1 ring-black/5 shadow-sm">
        {Array.from({length: 24}).map((_, i) => {
          const isCurrent = i === currentHour;
          return (
            <div 
              key={i} 
              className={`relative flex-1 h-full border-r border-white/40 last:border-r-0 transition-opacity hover:opacity-80 
                ${sheddingSet.has(i) ? 'bg-red-500' : 'bg-emerald-500'}
                ${isCurrent ? 'ring-y-2 ring-white z-10 scale-y-110' : 'first:rounded-l-md last:rounded-r-md'}
              `} 
              title={`${getBanglaPeriod(i)} ${toBangla12H(i)} - ${toBangla12H(i+1 === 24 ? 0 : i+1)}: ${sheddingSet.has(i) ? 'লোডশেডিং' : 'বিদ্যুৎ আছে'}`}
            >
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-600 rounded-full shadow border border-white z-20 animate-bounce"></div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-neutral-400 mt-2 font-medium px-0.5">
         <span>রাত ১২</span>
         <span>ভোর ৬</span>
         <span>দুপুর ১২</span>
         <span>সন্ধ্যা ৬</span>
         <span>রাত ১২</span>
      </div>

      <div className="flex gap-4 justify-center items-center mt-4 text-[11px] sm:text-xs font-bold tracking-wide">
         <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50/80 px-2 py-1 rounded border border-emerald-100">
           <div className="w-2.5 h-2.5 bg-emerald-500 rounded-sm shadow-sm ring-1 ring-black/5"></div>
           বিদ্যুৎ {toBanglaNum(24 - sheddingSet.size)} ঘন্টা
         </div>
         <div className="flex items-center gap-1.5 text-red-700 bg-red-50/80 px-2 py-1 rounded border border-red-100">
           <div className="w-2.5 h-2.5 bg-red-500 rounded-sm shadow-sm ring-1 ring-black/5"></div>
           লোডশেডিং {toBanglaNum(sheddingSet.size)} ঘন্টা
         </div>
      </div>
    </div>
  );
}

export default function App() {
  const currentTime = useCurrentTime();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOffice, setSelectedOffice] = useState<string>('all');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [appData, setAppData] = useState<SheddingData[]>([]);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminId, setAdminId] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isAdminView, setIsAdminView] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [editingItem, setEditingItem] = useState<SheddingData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeHoursSet, setActiveHoursSet] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedFavs = localStorage.getItem('loadSheddingFavorites');
    if (savedFavs) {
      try { setFavorites(JSON.parse(savedFavs)); } catch (e) {}
    }
  }, []);

  const fetchSupabaseData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('shedding_data')
        .select('*')
        .order('id', { ascending: false });
      if (error) throw error;
      if (data) setAppData(data);
    } catch (e: any) {
      console.error("Supabase fetch error:", e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSupabaseData();
  }, []);

  const toggleFavorite = (id: string) => {
    setFavorites(prev => {
      const newFavs = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id];
      localStorage.setItem('loadSheddingFavorites', JSON.stringify(newFavs));
      return newFavs;
    });
  };

  const offices = useMemo(() => Array.from(new Set(appData.map(item => item.Office).filter(Boolean))).sort() as string[], [appData]);

  const filteredData = appData.filter(item => {
    const matchesSearch = item["elakar nam"].toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item["Upokendro name"].toLowerCase().includes(searchTerm.toLowerCase());
    const matchesOffice = selectedOffice === 'all' || item.Office === selectedOffice;
    const matchesFavorites = !showFavoritesOnly || favorites.includes(item.id);
    return matchesSearch && matchesOffice && matchesFavorites;
  });

  useEffect(() => {
    if (editingItem) {
      const hoursSet = new Set<number>();
      editingItem["shedding hours"].forEach(t => {
        const hp = t.split('-')[0].split(':')[0];
        const engHourStr = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'].reduce((a,c,i)=>a.replace(new RegExp(c,"g"), String(i)), hp);
        const hr = parseInt(engHourStr, 10);
        if (!isNaN(hr)) hoursSet.add(hr === 24 ? 0 : hr);
      });
      setActiveHoursSet(hoursSet);
    }
  }, [editingItem]);

  const toggleHour = (hour: number) => {
    const newSet = new Set(activeHoursSet);
    if (newSet.has(hour)) newSet.delete(hour);
    else newSet.add(hour);
    setActiveHoursSet(newSet);
  };

  const handleUserSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setIsSubmitting(true);
    const hoursArray = Array.from(activeHoursSet).sort((a: number, b: number) => a - b).map((hr: number) => {
      const h1Str = hr < 10 ? '০' + hr.toString() : hr.toString();
      const nextHr = hr === 23 ? 24 : hr + 1;
      const h2Str = nextHr < 10 ? '০' + nextHr.toString() : nextHr.toString();
      const toBangla = (s: string) => [...s].map(c => '০১২৩৪৫৬৭৮৯'[parseInt(c)] || c).join('');
      return `${toBangla(h1Str)}:০০-${toBangla(h2Str)}:০০`;
    });
    const updated = { ...editingItem, "shedding hours": hoursArray };
    try {
      const { error } = await supabase.from('shedding_data').update({
        "elakar nam": updated["elakar nam"],
        "shedding hours": updated["shedding hours"]
      }).eq('id', updated.id);
      if (error) alert('ডাটাবেজে সেভ করতে সমস্যা হয়েছে: ' + error.message);
      else {
        setAppData(prev => prev.map(p => p.id === updated.id ? updated : p));
        setEditingItem(null);
      }
    } catch(err) {
      console.error(err);
    }
    setIsSubmitting(false);
  };

  if (isAdminView) {
    return (
      <div className="fixed inset-0 z-[100] bg-white overflow-y-auto">
        <AdminPanel appData={appData} setAppData={setAppData} onClose={() => setIsAdminView(false)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
      <header className="bg-amber-500 text-neutral-900 shadow-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Zap className="h-8 w-8 fill-neutral-900" />
            <h1 className="text-2xl font-bold tracking-tight">লোডশেডিং ট্র্যাকার</h1>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            <button onClick={() => setShowAnalytics(!showAnalytics)} className={`flex items-center whitespace-nowrap gap-2 px-4 py-2 rounded-full font-bold transition-colors ${showAnalytics ? 'bg-neutral-900 text-amber-500' : 'bg-amber-400/50 hover:bg-amber-400 text-neutral-900'}`}>
              <BarChart2 className="h-5 w-5" /> এনালাইটিক্স
            </button>
            <button onClick={() => setShowAdminLogin(true)} className="p-2 sm:p-2.5 rounded-full bg-neutral-900 text-neutral-200 hover:text-amber-500 transition-colors shadow-sm">
              <Shield className="h-5 w-5" />
            </button>
            <button onClick={() => setShowFavoritesOnly(!showFavoritesOnly)} className={`flex items-center whitespace-nowrap gap-2 px-4 py-2 rounded-full font-bold transition-colors ${showFavoritesOnly ? 'bg-neutral-900 text-amber-500' : 'bg-amber-400/50 hover:bg-amber-400 text-neutral-900'}`}>
              <Home className={`h-5 w-5 ${showFavoritesOnly ? 'fill-amber-500' : ''}`} /> নিজ এলাকা ({favorites.length})
            </button>
          </div>
        </div>
      </header>

      <div className="bg-amber-50 border-b border-amber-100 py-3 px-4">
        <div className="max-w-5xl mx-auto flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <span className="bg-amber-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">গুরুত্বপূর্ণ</span>
          </div>
          <p className="text-amber-900 text-xs sm:text-[13px] font-medium leading-relaxed">
            এটি পল্লী বিদ্যুৎ-এর অফিসিয়াল ওয়েবসাইট নয়। নিচের তথ্যগুলো পল্লী বিদ্যুৎ-এর অরিজিনাল নোটিশ থেকে AI দ্বারা এক্সট্রাক্ট করা হয়েছে, যা ১০০% নির্ভুল না-ও হতে পারে। সঠিক তথ্যের জন্য দয়া করে অরিজিনাল নোটিশ বা তাদের অফিসিয়াল পেজ দেখুন।
          </p>
        </div>
      </div>

      {showAnalytics && (
        <div className="max-w-5xl mx-auto px-4 mt-8">
          <div className="flex items-center gap-2 mb-4 text-neutral-800">
            <BarChart2 className="h-6 w-6 text-amber-500" />
            <h2 className="text-xl font-bold">লোডশেডিং পরিসংখ্যান</h2>
          </div>
          <Analytics data={appData} />
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-neutral-200 mb-8 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400" />
            <input type="text" placeholder="এলাকা বা উপকেন্দ্র খুঁজুন..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-neutral-100 border-transparent focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none rounded-xl transition-all" />
          </div>
          <div className="relative md:w-64">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400" />
            <select value={selectedOffice} onChange={(e) => setSelectedOffice(e.target.value)} className="w-full pl-11 pr-10 py-3 bg-neutral-100 border-transparent focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none rounded-xl appearance-none transition-all">
              <option value="all">সব জোনাল অফিস</option>
              {offices.map(office => <option key={office} value={office}>{office}</option>)}
            </select>
          </div>
        </div>

        <div className="mb-4 text-neutral-500 font-medium"><p>{toBanglaNum(filteredData.length)} টি এলাকা পাওয়া গেছে</p></div>

        {filteredData.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
            {filteredData.map((item) => (
              <SheddingCard key={item.id} item={item} isFavorite={favorites.includes(item.id)} onToggleFavorite={() => toggleFavorite(item.id)} currentTime={currentTime} onEdit={() => setEditingItem(item)} />
            ))}
          </div>
        ) : (
          !loading && (
            <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center flex flex-col items-center">
              <AlertTriangle className="h-12 w-12 text-amber-500 mb-4 opacity-80" />
              <h3 className="text-xl font-bold text-neutral-900 mb-2">কোনো তথ্য পাওয়া যায়নি</h3>
              <p className="text-neutral-500">অন্য কোনো এলাকার নাম দিয়ে খুঁজুন অথবা ফিল্টার পরিবর্তন করুন।</p>
            </div>
          )
        )}
      </main>

      {showAdminLogin && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">অ্যাডমিন লগইন</h2>
                <button onClick={() => setShowAdminLogin(false)} className="bg-neutral-100 p-2 rounded-full hover:bg-red-100"><X className="w-5 h-5"/></button>
              </div>
              <input type="text" placeholder="ইউজার আইডি..." value={adminId} onChange={e => setAdminId(e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 p-3 rounded-lg mb-3" />
              <input type="password" placeholder="পার্সওয়ার্ড..." value={adminPass} onChange={e => setAdminPass(e.target.value)} className="w-full bg-neutral-50 border border-neutral-200 p-3 rounded-lg mb-4" />
              {loginError && <p className="text-red-500 text-sm mb-4 font-bold">{loginError}</p>}
              <button 
                onClick={async () => {
                  setLoginError('');
                  if (adminId === 'admin' && adminPass === '1234') {
                    setShowAdminLogin(false); setIsAdminView(true); setAdminId(''); setAdminPass(''); return;
                  }
                  try {
                    const { data, error } = await supabase.from('admins').select('*').eq('username', adminId).eq('password', adminPass).single();
                    if (data) { setShowAdminLogin(false); setIsAdminView(true); setAdminId(''); setAdminPass(''); }
                    else setLoginError('ভুল আইডি বা পাসওয়ার্ড!');
                  } catch (err) { setLoginError('লগইন সমস্যা!'); }
                }}
                className="w-full bg-neutral-900 text-amber-500 font-bold p-3 rounded-lg"
              >লগইন</button>
           </div>
        </div>
      )}

      {editingItem && !isAdminView && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">তথ্য হালনাগাদ করুন</h2>
              <button onClick={() => setEditingItem(null)} className="p-2 bg-neutral-100 rounded-full"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleUserSave} className="space-y-5">
              <label className="block font-bold">এলাকা: <textarea value={editingItem["elakar nam"]} onChange={e => setEditingItem({...editingItem, "elakar nam": e.target.value})} className="w-full mt-1 p-3 bg-neutral-50 border rounded-lg h-24 resize-none" /></label>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {Array.from({length: 24}).map((_, i) => (
                  <button key={i} type="button" onClick={() => toggleHour(i)} className={`p-2 rounded-lg text-xs font-bold ${activeHoursSet.has(i) ? 'bg-red-500 text-white' : 'bg-neutral-100'}`}>
                    {toBanglaNum(i)}-{toBanglaNum(i+1 === 24 ? 24 : i+1)}
                  </button>
                ))}
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full bg-amber-500 py-3 rounded-xl font-bold">{isSubmitting ? 'সেভ হচ্ছে...' : 'সেভ করুন'}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SheddingCard({ item, isFavorite, onToggleFavorite, currentTime, onEdit }: { item: SheddingData, isFavorite: boolean, onToggleFavorite: () => void, currentTime: Date, onEdit: () => void, key?: any }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const totalLoadShedding = item["shedding hours"].length;
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm flex flex-col h-full">
      <div className="p-5 bg-neutral-50 border-b flex justify-between items-start">
        <div><div className="text-xs font-bold text-amber-600 mb-1">{item.Office}</div><h3 className="font-bold text-lg">{item["Upokendro name"]}</h3></div>
        <div className="flex flex-col gap-2">
          <button onClick={onToggleFavorite} className={`p-2 rounded-full ${isFavorite ? 'text-amber-600' : 'text-neutral-400'}`}><Home className={`h-6 w-6 ${isFavorite ? 'fill-amber-600' : ''}`} /></button>
          <button onClick={onEdit} className="p-2 rounded-full text-neutral-400 hover:text-blue-600"><Shield className="h-5 w-5" /></button>
        </div>
      </div>
      <div className="p-5 flex-1 flex flex-col">
        {item.feeder_no && <div className="mb-3"><span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 w-fit"><Zap className="h-3 w-3" /> {item.feeder_no}</span></div>}
        <div className="flex gap-3 mb-4"><MapPin className="h-5 w-5 text-neutral-400 shrink-0" /><p className="text-sm">{item["elakar nam"]}</p></div>
        <div className="mt-auto">
          <div className="flex justify-between items-center mb-3"><div className="flex items-center gap-2 font-semibold"><Clock className="h-4 w-4 text-amber-500" /> সূচি</div>{totalLoadShedding > 0 && <span className="text-xs font-bold bg-red-50 text-red-600 px-2 py-1 rounded">মোট: {toBanglaNum(totalLoadShedding)} ঘণ্টা</span>}</div>
          <div className={`flex flex-wrap gap-2 overflow-hidden ${!isExpanded ? 'max-h-[85px]' : ''}`}>{item["shedding hours"].map((t, idx) => <TimeSlotPill key={idx} timeStr={t} currentTime={currentTime} />)}</div>
          {isExpanded && <Timeline sheddingHoursList={item["shedding hours"]} currentTime={currentTime} />}
          <button onClick={() => setIsExpanded(!isExpanded)} className="mt-4 w-full py-2 bg-neutral-50 border rounded-lg text-xs font-bold flex items-center justify-center gap-1">{isExpanded ? <>সংক্ষিপ্ত <ChevronUp className="h-4 w-4"/></> : <>বিস্তারিত <ChevronDown className="h-4 w-4"/></>}</button>
        </div>
      </div>
      <div className="px-5 py-3 bg-neutral-50 border-t text-xs flex justify-between items-center"><span>লোড: {item.mw} MW</span>{item.original_pdf && <div className="text-indigo-600 truncate max-w-[100px]">{item.original_pdf}</div>}</div>
    </div>
  );
}
