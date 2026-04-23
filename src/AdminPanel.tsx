import React, { useState, useMemo, useRef } from 'react';
import { ArrowLeft, Edit2, Trash2, Plus, Save, X, Shield, Search, FileJson, Sparkles, UploadCloud, BarChart2, Filter, ChevronDown } from 'lucide-react';
import { SheddingData } from './data';
import { supabase } from './supabase';
import { GoogleGenAI } from '@google/genai';
import Analytics from './components/Analytics';

const toBn = (num: number) => num.toString().padStart(2, '0').split('').map(d => '০১২৩৪৫৬৭৮৯'[parseInt(d, 10)]).join('');

const parseBanglaHourToNum = (timeStr: string) => {
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
  const match = enStr.match(/(\d{1,2}):\d{1,2}/);
  if (match) return parseInt(match[1], 10);
  return -1;
};

interface AdminPanelProps {
  appData: SheddingData[];
  setAppData: React.Dispatch<React.SetStateAction<SheddingData[]>>;
  onClose: () => void;
}

export default function AdminPanel({ appData, setAppData, onClose }: AdminPanelProps) {
  const [editingItem, setEditingItem] = useState<Partial<SheddingData> | null>(null);
  const [isJsonMode, setIsJsonMode] = useState(false);
  const [isAiMode, setIsAiMode] = useState(false);
  const [aiFiles, setAiFiles] = useState<File[]>([]);
  const [aiPreviewUrls, setAiPreviewUrls] = useState<string[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [jsonText, setJsonText] = useState('');
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [jsonError, setJsonError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOffice, setSelectedOffice] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const offices = useMemo(() => {
    return Array.from(new Set(appData.map(d => d.Office).filter(Boolean))).sort() as string[];
  }, [appData]);

  const filteredData = appData.filter(item => {
    const matchesSearch = !searchTerm || (
      item.Office?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item["Upokendro name"]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item["elakar nam"]?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const matchesOffice = selectedOffice === 'all' || item.Office === selectedOffice;
    return matchesSearch && matchesOffice;
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setIsSubmitting(true);
    
    let hoursArray = editingItem["shedding hours"] || [];
    // Already maintained as array of strings via UI
    if (typeof hoursArray === 'string') {
      hoursArray = (hoursArray as string).split(',').map((s: string) => s.trim()).filter(Boolean);
    }

    const payload = {
      ...editingItem,
      "shedding hours": hoursArray,
      id: editingItem.id || `custom-${Date.now()}`
    } as SheddingData;

    // 1. Optimistic Update - Update UI immediately
    setAppData(prev => {
      const filtered = prev.filter(p => p.id !== payload.id);
      return [payload, ...filtered];
    });
    
    // 2. Save locally as fallback
    try {
      const existingStr = localStorage.getItem('customSheddingData') || '[]';
      const existing = JSON.parse(existingStr);
      const filteredEx = existing.filter((p: any) => p.id !== payload.id);
      localStorage.setItem('customSheddingData', JSON.stringify([payload, ...filteredEx]));
    } catch(e) {}

    setEditingItem(null);
    setIsSubmitting(false);

    // 3. Sync with Supabase in the background
    supabase.from('shedding_data').upsert(payload, { onConflict: 'id' }).then(({ error }) => {
      if (error) {
         console.error('Background Sync Error saving data:', error);
      }
    });
  }

  const handleJsonSubmit = async () => {
    setJsonError('');
    if (!jsonText.trim()) {
      setJsonError('দয়া করে JSON ডেটা ইনপুট দিন।');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const parsed = JSON.parse(jsonText);
      const newItems: SheddingData[] = Array.isArray(parsed) ? parsed : [parsed];
      
      const isValid = newItems.every(item => item.Office && item["Upokendro name"] && item["elakar nam"] && Array.isArray(item["shedding hours"]));
      if (!isValid) throw new Error("Invalid structure");
      
      const processedItems = newItems.map(item => ({
        ...item,
        id: item.id || `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        mw: item.mw || "N/A",
        feeder_no: item.feeder_no || "N/A"
      }));

      const { error } = await supabase.from('shedding_data').upsert(processedItems, { onConflict: 'id' });
      
      if (error) {
         setJsonError('Supabase error: ' + error.message);
      } else {
         setAppData(prev => {
           const existingIds = new Set(prev.map(p => p.id));
           // Update existing and append new ones
           const filtered = prev.filter(p => !processedItems.find(newIt => newIt.id === p.id));
           return [...processedItems, ...filtered];
         });
         setJsonText('');
         setIsJsonMode(false);
         alert('সফলভাবে JSON ডেটা যুক্ত করা হয়েছে!');
      }
    } catch(e) {
      setJsonError('JSON ডেটা সঠিক নয়! সঠিক ফরমেট ব্যবহার করুন।');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      setAiFiles(prev => [...prev, ...files]);
      
      files.forEach(file => {
        if (file.type.startsWith('image/')) {
          setAiPreviewUrls(prev => [...prev, URL.createObjectURL(file)]);
        }
      });
    }
  };

  const handleAiExtract = async () => {
    if (aiFiles.length === 0) return;
    setIsExtracting(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      let allExtracted: any[] = [];

      for (const file of aiFiles) {
        const fileReader = new FileReader();
        const base64DataPromise = new Promise<string>((resolve, reject) => {
          fileReader.onload = () => {
            const result = fileReader.result as string;
            const base64Data = result.split(',')[1];
            resolve(base64Data);
          };
          fileReader.onerror = reject;
          fileReader.readAsDataURL(file);
        });

        const base64Data = await base64DataPromise;

        const prompt = `Extract the load-shedding routine from this document/image. 
CRITICAL INSTRUCTION ON FINDING TIMES:
1. The table has a header row with columns representing hourly time slots (e.g., 01:00-02:00, 02:00-03:00 ... 23:00-24:00).
2. Each row below represents a specific area/substation/feeder.
3. Look at the grid cells for each row under the time columns.
4. A BLACK FILLED BOX or heavily shaded cell under a specific time column means LOAD SHEDDING for that time.
5. An EMPTY or WHITE BOX means electricity is available (DO NOT include this time).
6. For each row, vertically align the black boxes with the time slot column headers directly above them. Add ONLY the time slots matching the black boxes to the "shedding hours" array. DO NOT guess or randomize times.

Maintain the exact area names, substations, offices, and load shedding hours precisely with 100% accuracy. Extract the "feeder no" (ফিডার নং) if available. Ensure all Bengali text is kept as is. Return the result strictly as a valid JSON array of objects. Do not wrap in markdown tags like \`\`\`json, just output the raw json array.

Format requirements:
[
  {
    "Office": "অফিসের নাম",
    "Upokendro name": "উপকেন্দ্রের নাম",
    "feeder_no": "ফিডারের নাম বা নং (না থাকলে N/A)",
    "elakar nam": "এলাকার নামগুলি কমা দিযে",
    "shedding hours": ["০১:০০-০২:০০", "১৫:০০-১৬:০০"],
    "mw": "লোড মেগাওয়াটে (যেমন: ২.৫, না থাকলে N/A)",
    "original_pdf": "পিডিএফ বা ছবির ফাইলের নাম (না থাকলে ফাঁকা রাখুন)"
  }
]`;

        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [
            {
              role: "user",
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: file.type,
                    data: base64Data
                  }
                }
              ]
            }
          ],
          config: { thinkingConfig: { thinkingLevel: "HIGH" as any } }
        });

        const draftJson = response.text || "[]";
        
        const agenticPrompt = `You are a meticulous Data QA and Correction AI. 
I am sending you the original load-shedding schedule image/document along with a draft JSON array of the extracted data.
The draft data was extracted by another AI and often incorrectly randomizes or misreads the shedding times. Your goal is to review the draft against the image line-by-line and correct any mistakes.

CRITICAL TABLE STRUCTURE CHECK:
- Look at the top row: there are columns showing time slots (1:00-2:00, 2:00-3:00, etc.).
- For EVERY row, trace vertically down from EACH time column header.
- If the structural box intersecting that row and column is BLACK or DARK FILLED, that time MUST be in "shedding hours".
- If the box is EMPTY or WHITE, that time MUST NOT be in "shedding hours".
- The previous AI hallucinates times. Strictly rely on visual vertical alignment.

Specific things to check and fix:
1. "Black Box" Load Shedding Hours: Re-verify every single black cell's column alignment.
2. Bengali Text Accuracy: Check for spelling mistakes or missing words in "Upokendro name", "feeder_no", and "elakar nam".
3. Feeder Numbers: Ensure the feeder number is extracted exactly as it appears.
4. Completeness: Ensure no rows from the image were skipped.

Draft JSON Data: 
${draftJson}

Return the final, 100% correct JSON array. Do not output markdown code blocks formatting, just output the raw json array. Follow the exact same schema.`;

        const verificationResponse = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [
            {
              role: "user",
              parts: [
                { text: agenticPrompt },
                {
                  inlineData: {
                    mimeType: file.type,
                    data: base64Data
                  }
                }
              ]
            }
          ],
          config: { thinkingConfig: { thinkingLevel: "HIGH" as any } }
        });

        let extractedJson = verificationResponse.text || "[]";
        extractedJson = extractedJson.trim();
        if (extractedJson.startsWith('```json')) {
           extractedJson = extractedJson.replace(/^```json\n/, '').replace(/\n```$/, '');
        } else if (extractedJson.startsWith('```')) {
           extractedJson = extractedJson.replace(/^```\n/, '').replace(/\n```$/, '');
        }

        try {
          const parsed = JSON.parse(extractedJson);
          if (Array.isArray(parsed)) {
            allExtracted = [...allExtracted, ...parsed];
          }
        } catch(e) {
          console.error("JSON parse error for file", file.name, e);
        }
      }

      setJsonText(JSON.stringify(allExtracted, null, 2));
      setIsAiMode(false);
      setIsJsonMode(true);
    } catch (e: any) {
      alert('তথ্য এক্সট্রাক্ট করতে সমস্যা হয়েছে: ' + e.message);
    } finally {
      setIsExtracting(false);
    }
  };

  const currentHoursList = useMemo(() => {
    return Array.isArray(editingItem?.["shedding hours"]) ? editingItem?.["shedding hours"] : [];
  }, [editingItem]);

  const activeHoursSet = useMemo(() => {
    return new Set(currentHoursList.map(h => parseBanglaHourToNum(h)).filter(h => h !== -1));
  }, [currentHoursList]);

  const toggleHour = (hourIndex: number) => {
    if (!editingItem) return;
    const newSet = new Set(activeHoursSet);
    if (newSet.has(hourIndex)) {
      newSet.delete(hourIndex);
    } else {
      newSet.add(hourIndex);
    }
    
    const newHoursArray = Array.from(newSet).sort((a: number, b: number) => a - b).map((h: number) => {
      const startBn = toBn(h);
      const endBn = toBn(h + 1 === 24 ? 24 : h + 1);
      return `${startBn}:০০-${endBn}:০০`;
    });
    
    setEditingItem({...editingItem, "shedding hours": newHoursArray});
  };

  if (isAiMode) {
    return (
      <div className="min-h-screen bg-neutral-100 flex flex-col font-sans">
        <header className="bg-white border-b border-neutral-200 px-4 py-4 flex items-center justify-between sticky top-0 z-10">
          <h2 className="text-xl font-bold flex items-center gap-2 text-neutral-800">
            <Sparkles className="h-6 w-6 text-amber-500" /> এআই মাল্টি-এক্সট্রাক্টর
          </h2>
          <button onClick={() => setIsAiMode(false)} className="p-2 bg-neutral-100 hover:bg-neutral-200 rounded-full transition">
            <X className="h-5 w-5" />
          </button>
        </header>

        <main className="max-w-2xl w-full mx-auto p-4 md:p-8 flex-1">
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 flex flex-col gap-6">
            <div className="text-center pb-4 border-b border-neutral-100">
              <h3 className="text-lg font-bold text-neutral-800 mb-2">একাধিক লোডশেডিং রুটিন আপলোড করুন</h3>
              <p className="text-sm text-neutral-500">
                আপনি একসাথে একাধিক ছবি বা পিডিএফ আপলোড করতে পারেন। আমাদের এআই সব ফাইল থেকে ডেটা সংগ্রহ করে একটি লিস্ট বানিয়ে দিবে।
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-32 border-2 border-dashed border-amber-300 bg-amber-50 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-amber-100 transition-colors group"
              >
                <UploadCloud className="h-8 w-8 text-amber-500 mb-2 group-hover:-translate-y-1 transition-transform" />
                <span className="font-bold text-amber-700">ফাইলগুলো যোগ করুন</span>
                <span className="text-xs text-amber-600/70 mt-1">JPEG, PNG, PDF সাপোর্টেড</span>
              </div>

              {aiFiles.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-60 overflow-y-auto p-1">
                  {aiFiles.map((file, idx) => (
                    <div key={idx} className="relative group rounded-lg border border-neutral-200 bg-neutral-50 p-2 text-xs truncate">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-neutral-200 rounded flex-shrink-0 flex items-center justify-center">
                          {file.type.startsWith('image/') ? <Sparkles className="h-4 w-4 text-amber-500" /> : <FileJson className="h-4 w-4 text-blue-500" />}
                        </div>
                        <span className="flex-1 truncate">{file.name}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const newFiles = [...aiFiles];
                          newFiles.splice(idx, 1);
                          setAiFiles(newFiles);
                          const newUrls = [...aiPreviewUrls];
                          if (file.type.startsWith('image/')) {
                            const urlIdx = aiPreviewUrls.findIndex(u => u.includes(file.name)); // Note: this is a loose match
                            if (urlIdx !== -1) newUrls.splice(urlIdx, 1);
                          }
                          setAiPreviewUrls(newUrls);
                        }}
                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 shadow hover:scale-110 transition"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*,application/pdf"
                className="hidden"
                multiple
              />
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setAiFiles([]);
                  setAiPreviewUrls([]);
                  setIsAiMode(false);
                }}
                className="px-6 py-3 rounded-xl font-bold bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={handleAiExtract}
                disabled={isExtracting || aiFiles.length === 0}
                className="px-6 py-3 rounded-xl font-bold bg-amber-500 text-neutral-900 hover:bg-amber-400 shadow-md transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto justify-center"
              >
                {isExtracting ? (
                  <><span className="w-5 h-5 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin"></span> প্রসেস হচ্ছে...</>
                ) : (
                  <><Sparkles className="h-4 w-4" /> {toBn(aiFiles.length)} টি ফাইল এক্সট্রাক্ট করুন</>
                )}
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (isJsonMode) {
    return (
      <div className="min-h-screen bg-neutral-100 flex flex-col font-sans">
        <header className="bg-white border-b border-neutral-200 px-4 py-4 flex items-center justify-between sticky top-0 z-10">
          <h2 className="text-xl font-bold flex items-center gap-2 text-neutral-800">
            <FileJson className="h-6 w-6 text-amber-500" /> JSON ইম্পোর্ট
          </h2>
          <button onClick={() => setIsJsonMode(false)} className="p-2 bg-neutral-100 hover:bg-neutral-200 rounded-full transition">
            <X className="h-5 w-5" />
          </button>
        </header>
        
        <main className="max-w-3xl w-full mx-auto p-4 md:p-8 flex-1">
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 flex flex-col gap-4">
             <div>
               <h3 className="font-bold text-neutral-800 mb-2">RAW JSON ইনপুট দিন</h3>
               <p className="text-sm text-neutral-500 mb-4">
                 আপনার Gemini বা অন্য এআই থেকে পাওয়া JSON ডেটা এখানে পেস্ট করুন। এটি একসাথে অনেক ডেটা যোগ করার জন্য দারুণ কাজ করবে।
               </p>
               <textarea 
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  placeholder='[\n  {\n    "Office": "মিরপুর জোনাল",\n    "Upokendro name": "মিরপুর-১",\n    "elakar nam": "এলাকা সমূহ",\n    "shedding hours": ["০১:০০-০২:০০", "০৩:০০-০৪:০০"],\n    "mw": "৫.০"\n  }\n]'
                  className="w-full h-80 bg-neutral-50 border border-neutral-200 rounded-xl p-4 font-mono text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none transition-all placeholder:text-neutral-400 resize-none"
               />
               {jsonError && (
                 <p className="text-red-500 text-sm mt-3 font-bold">{jsonError}</p>
               )}
             </div>
             
             <div className="pt-4 border-t border-neutral-100 flex justify-end gap-3">
              <button 
                type="button"
                onClick={() => setIsJsonMode(false)}
                className="px-6 py-2.5 rounded-xl font-bold bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition"
              >
                বাতিল
              </button>
              <button 
                type="button"
                onClick={handleJsonSubmit}
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl font-bold bg-amber-500 text-neutral-900 hover:bg-amber-400 shadow-md transition flex items-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'সেভ হচ্ছে...' : <><Save className="h-4 w-4" /> সেভ করুন</>}
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (editingItem) {
    return (
      <div className="min-h-screen bg-neutral-100 flex flex-col font-sans">
        <header className="bg-white border-b border-neutral-200 px-4 py-4 flex items-center justify-between sticky top-0 z-10">
          <h2 className="text-xl font-bold flex items-center gap-2 text-neutral-800">
            {editingItem.id ? <Edit2 className="h-5 w-5 text-amber-500" /> : <Plus className="h-5 w-5 text-amber-500" />}
            {editingItem.id ? 'তথ্য পরিবর্তন করুন' : 'নতুন তথ্য তৈরি করুন'}
          </h2>
          <button onClick={() => setEditingItem(null)} className="p-2 bg-neutral-100 hover:bg-neutral-200 rounded-full transition">
            <X className="h-5 w-5" />
          </button>
        </header>

        <main className="max-w-3xl w-full mx-auto p-4 md:p-8 flex-1">
          <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <label className="block">
                <span className="text-neutral-700 font-bold mb-1.5 block">অফিস (জোনাল)</span>
                <input 
                  type="text" 
                  value={editingItem.Office || ''}
                  onChange={e => setEditingItem({...editingItem, Office: e.target.value})}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-2.5 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none"
                  placeholder="যেমন: মিরপুর জোনাল"
                  required
                />
              </label>

              <label className="block">
                <span className="text-neutral-700 font-bold mb-1.5 block">উপকেন্দ্র (Sub-station)</span>
                <input 
                  type="text" 
                  value={editingItem["Upokendro name"] || ''}
                  onChange={e => setEditingItem({...editingItem, "Upokendro name": e.target.value})}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-2.5 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none"
                  placeholder="যেমন: মিরপুর-১"
                  required
                />
              </label>
            </div>

            <label className="block">
              <span className="text-neutral-700 font-bold mb-1.5 block">ফিডার নং (Feeder No)</span>
              <input 
                type="text" 
                value={editingItem.feeder_no || ''}
                onChange={e => setEditingItem({...editingItem, feeder_no: e.target.value})}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-2.5 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none"
                placeholder="যেমন: ফিডার নং - ৩ (না থাকলে ফাঁকা রাখুন)"
              />
            </label>

            <label className="block">
              <span className="text-neutral-700 font-bold mb-1.5 block">এলাকার নামসমূহ</span>
              <textarea 
                value={editingItem["elakar nam"] || ''}
                onChange={e => setEditingItem({...editingItem, "elakar nam": e.target.value})}
                className="w-full h-24 bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-2.5 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none resize-none"
                placeholder="এলাকার নাম কমা দিয়ে লিখুন..."
                required
              />
            </label>

            <label className="block">
              <span className="text-neutral-700 font-bold mb-3 block">সময়সূচি (বক্সে ক্লিক করে লোডশেডিং এর ঘণ্টাগুলো সিলেক্ট করুন)</span>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2.5">
                {Array.from({length: 24}).map((_, i) => {
                  const isActive = activeHoursSet.has(i);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleHour(i)}
                      className={`py-3 px-1 rounded-xl text-xs sm:text-sm font-bold transition-all border-b-4 ${
                        isActive 
                          ? 'bg-red-500 text-white border-red-700 shadow-sm translate-y-[2px]' 
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300'
                      }`}
                    >
                      {toBn(i)}-{toBn(i+1 === 24 ? 24 : i+1)} টা
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-neutral-500 mt-3 font-medium flex gap-4">
                 <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500 rounded-sm inline-block"></span> = লোডশেডিং</span>
                 <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-100 border border-emerald-200 rounded-sm inline-block"></span> = বিদ্যুৎ আছে</span>
              </p>
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <label className="block">
                <span className="text-neutral-700 font-bold mb-1.5 block">লোড ক্যাপাসিটি (MW)</span>
                <input 
                  type="text" 
                  value={editingItem.mw || ''}
                  onChange={e => setEditingItem({...editingItem, mw: e.target.value})}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-2.5 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none"
                  placeholder="যেমন: ৫.৫"
                />
              </label>

              <label className="block">
                <span className="text-neutral-700 font-bold mb-1.5 block">অরিজিনাল নোটিশ (PDF Name/URL)</span>
                <input 
                  type="text" 
                  value={editingItem.original_pdf || ''}
                  onChange={e => setEditingItem({...editingItem, original_pdf: e.target.value})}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-2.5 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none"
                  placeholder="নোটিশের পিডিএফ নাম বা লিংক..."
                />
              </label>
            </div>

            <div className="pt-4 border-t border-neutral-100 flex justify-end gap-3">
              <button 
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-6 py-2.5 rounded-xl font-bold bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition"
              >
                বাতিল
              </button>
              <button 
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl font-bold bg-amber-500 text-neutral-900 hover:bg-amber-400 shadow-md transition flex items-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'সেভ হচ্ছে...' : <><Save className="h-4 w-4" /> সেভ করুন</>}
              </button>
            </div>
          </form>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col font-sans pb-10">
      {/* Header */}
      <header className="bg-neutral-900 text-white shadow-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center w-full md:w-auto gap-3">
            <button onClick={onClose} className="p-2 bg-neutral-800 rounded-full hover:bg-neutral-700 transition" title="ফিরে যান">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6 text-amber-500" /> অ্যাডমিন প্যানেল
            </h1>
          </div>
          
          <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <input 
                  type="text" 
                  placeholder="ডাটা খুঁজুন..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 text-white pl-9 pr-4 py-2 rounded-lg focus:border-amber-500 focus:outline-none placeholder:text-neutral-500 text-sm"
                />
              </div>
              <div className="relative flex-1 md:w-48">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <select
                  value={selectedOffice}
                  onChange={e => setSelectedOffice(e.target.value)}
                  className="w-full bg-neutral-800 border border-neutral-700 text-white pl-9 pr-8 py-2 rounded-lg focus:border-amber-500 focus:outline-none appearance-none text-sm cursor-pointer"
                >
                  <option value="all">সব জোনাল অফিস</option>
                  {offices.map(office => (
                    <option key={office} value={office}>{office}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <ChevronDown className="h-4 w-4 text-neutral-500" />
                </div>
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
               <button 
                onClick={() => setShowAnalytics(!showAnalytics)} 
                className={`flex items-center whitespace-nowrap gap-2 bg-neutral-800 text-neutral-200 font-bold px-3 py-2 rounded-lg hover:bg-neutral-700 transition shadow-sm text-sm border-b-2 ${showAnalytics ? 'border-amber-500' : 'border-transparent'}`}
               >
                 <BarChart2 className="h-4 w-4 text-blue-400" /> এনালাইটিক্স
               </button>
               <button 
                onClick={() => setIsAiMode(true)} 
                className="flex items-center whitespace-nowrap gap-2 bg-neutral-800 text-neutral-200 font-bold px-3 py-2 rounded-lg hover:bg-neutral-700 transition shadow-sm text-sm border-b-2 border-transparent hover:border-amber-500"
               >
                 <Sparkles className="h-4 w-4 text-amber-400" /> এআই ডেটা
               </button>
               <button 
                onClick={() => setIsJsonMode(true)} 
                className="flex items-center whitespace-nowrap gap-2 bg-neutral-800 text-neutral-200 font-bold px-3 py-2 rounded-lg hover:bg-neutral-700 transition shadow-sm text-sm hover:text-emerald-400"
               >
                 <FileJson className="h-4 w-4 text-emerald-400" /> JSON
               </button>
               <button 
                 onClick={() => setEditingItem({})} 
                 className="flex items-center whitespace-nowrap gap-2 bg-amber-500 text-neutral-900 font-bold px-4 py-2 rounded-lg hover:bg-amber-400 transition shadow-sm text-sm"
               >
                 <Plus className="h-4 w-4" /> ডাটা যোগ করুন
               </button>
            </div>
          </div>
        </div>
      </header>

      {showAnalytics && (
        <div className="max-w-6xl mx-auto w-full mt-4 h-auto overflow-hidden">
          <Analytics data={appData} />
        </div>
      )}

      <main className="max-w-6xl w-full mx-auto px-4 py-6 flex-1">
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-neutral-100 text-neutral-600 text-xs uppercase tracking-wider">
                  <th className="px-5 py-4 font-bold">অফিস (Office)</th>
                  <th className="px-5 py-4 font-bold">উপকেন্দ্র (Upokendro)</th>
                  <th className="px-5 py-4 font-bold">ফিডার (Feeder)</th>
                  <th className="px-5 py-4 font-bold">এলাকা (Elaka)</th>
                  <th className="px-5 py-4 font-bold text-center">সময় (Hours)</th>
                  <th className="px-5 py-4 font-bold text-right">এডিট</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredData.map((item) => (
                  <tr key={item.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-5 py-4 text-sm font-medium text-neutral-800">{item.Office}</td>
                    <td className="px-5 py-4 text-sm text-neutral-600 font-bold">{item["Upokendro name"]}</td>
                    <td className="px-5 py-4 text-sm text-neutral-600">{item.feeder_no || '-'}</td>
                    <td className="px-5 py-4 text-sm text-neutral-600 max-w-xs truncate" title={item["elakar nam"]}>{item["elakar nam"]}</td>
                    <td className="px-5 py-4 text-center">
                      <span className="inline-block bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full">
                        {item["shedding hours"].length} টি
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          type="button"
                          onClick={(e) => { 
                            e.preventDefault(); 
                            e.stopPropagation(); 
                            setEditingItem(item); 
                          }}
                          className="flex items-center justify-center p-2.5 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-xl transition-all border border-amber-100 shadow-sm"
                          title="এডিট করুন"
                        >
                          <Edit2 className="h-4.5 w-4.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                
                {filteredData.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-neutral-500">
                      কোনো ডাটা পাওয়া যায়নি।
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
