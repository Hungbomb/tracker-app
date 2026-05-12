import React, { useState, useEffect, useMemo } from 'react';
import {
  Check, Plus, X, Trophy, Clock, Zap, Flame,
  ChevronLeft, ChevronRight, Sparkles, Edit3, Trash2,
  Download, Upload, Settings
} from 'lucide-react';
import { supabase } from './supabaseClient';

/* ============================================================
 * 初始資料 - 首次登入時遷移到 Supabase
 * ============================================================ */

const INITIAL_EXERCISE = [
  '2026-01-03','2026-01-05','2026-01-08','2026-01-09','2026-01-11',
  '2026-01-14','2026-01-16','2026-01-18','2026-01-19','2026-01-22',
  '2026-01-23','2026-01-24','2026-01-26','2026-01-29','2026-01-30',
  '2026-02-01','2026-02-02','2026-02-03','2026-02-06','2026-02-07',
  '2026-02-09','2026-02-11','2026-02-12','2026-02-13',
  '2026-03-04','2026-03-06','2026-03-17','2026-03-19','2026-03-26',
  '2026-03-28','2026-03-31',
  '2026-04-02','2026-04-04','2026-04-06','2026-04-09','2026-04-10',
  '2026-04-11','2026-04-13','2026-04-14','2026-04-17','2026-04-21',
  '2026-04-23','2026-04-24','2026-04-28','2026-04-29',
  '2026-05-02','2026-05-04','2026-05-06','2026-05-07','2026-05-10'
];

const INITIAL_PUNCH = {
  '2026-05-06': new Date(2026, 4, 6, 12, 3).toISOString(),
  '2026-05-07': new Date(2026, 4, 7, 13, 51).toISOString(),
  '2026-05-11': new Date(2026, 4, 11, 14, 46).toISOString(),
};

const MILESTONES = [25, 50, 75, 100, 125, 150];
const WORK_HOURS_MS = 4 * 60 * 60 * 1000;
const MONTHLY_TARGET = 12;

const STORAGE_PUNCH = 'tracker:punch-data';
const STORAGE_EXERCISE = 'tracker:exercise-data';
const STORAGE_INITIALIZED = 'tracker:initialized-v1';

const dateKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const todayKey = () => dateKey(new Date());
const formatHM = (d) => d.toLocaleTimeString('zh-TW', {hour:'2-digit', minute:'2-digit', hour12:false});

/* ============================================================
 * LocalStorage 快取層（同時作為離線備份）
 * ============================================================ */

const storage = {
  get(key) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : null;
    } catch (e) {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {}
  },
};

function loadLocalData() {
  if (!storage.get(STORAGE_INITIALIZED)) {
    storage.set(STORAGE_PUNCH, INITIAL_PUNCH);
    storage.set(STORAGE_EXERCISE, INITIAL_EXERCISE);
    storage.set(STORAGE_INITIALIZED, true);
    return { punch: INITIAL_PUNCH, exercise: INITIAL_EXERCISE };
  }
  return {
    punch: storage.get(STORAGE_PUNCH) || {},
    exercise: storage.get(STORAGE_EXERCISE) || [],
  };
}

function LoadingScreen({ text }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="text-zinc-500 font-mono text-xs tracking-[0.4em]">{text}</div>
    </div>
  );
}

/* ============================================================
 * Main App
 * ============================================================ */

export default function App() {
  const [tab, setTab] = useState('punch');
  const [punchData, setPunchData] = useState({});
  const [exerciseData, setExerciseData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [toast, setToast] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (tab !== 'punch') return;
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [tab]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const [{ data: punchRows, error: pe }, { data: exerciseRows, error: ee }] = await Promise.all([
          supabase.from('punch_records').select('date, punch_time'),
          supabase.from('exercise_records').select('date'),
        ]);
        if (pe || ee) throw pe || ee;

        const punch = {};
        (punchRows || []).forEach(r => { punch[r.date] = r.punch_time; });
        const exercise = (exerciseRows || []).map(r => r.date).sort();

        if (Object.keys(punch).length === 0 && exercise.length === 0) {
          const { punch: localPunch, exercise: localExercise } = loadLocalData();
          if (Object.keys(localPunch).length) {
            await supabase.from('punch_records').upsert(
              Object.entries(localPunch).map(([date, punch_time]) => ({ date, punch_time })),
              { onConflict: 'date' }
            );
            Object.assign(punch, localPunch);
          }
          if (localExercise.length) {
            await supabase.from('exercise_records').upsert(
              localExercise.map(date => ({ date })),
              { onConflict: 'date' }
            );
            exercise.push(...localExercise);
            exercise.sort();
          }
        }

        if (mounted) {
          setPunchData(punch);
          setExerciseData(exercise);
          storage.set(STORAGE_PUNCH, punch);
          storage.set(STORAGE_EXERCISE, exercise);
        }
      } catch (err) {
        console.error('Supabase load error, falling back to localStorage', err);
        const { punch, exercise } = loadLocalData();
        if (mounted) {
          setPunchData(punch);
          setExerciseData(exercise);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => { mounted = false; };
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const updatePunch = async (newData) => {
    const oldData = punchData;
    setPunchData(newData);
    storage.set(STORAGE_PUNCH, newData);

    try {
      const oldDates = new Set(Object.keys(oldData));
      const newDates = new Set(Object.keys(newData));
      const toUpsert = [...newDates].filter(d => newData[d] !== oldData[d]);
      if (toUpsert.length) {
        await supabase.from('punch_records').upsert(
          toUpsert.map(date => ({ date, punch_time: newData[date] })),
          { onConflict: 'date' }
        );
      }
      const toDelete = [...oldDates].filter(d => !newDates.has(d));
      if (toDelete.length) {
        await supabase.from('punch_records').delete().in('date', toDelete);
      }
    } catch (err) {
      console.error('Supabase punch sync error', err);
    }
  };

  const updateExercise = async (newData) => {
    const oldData = exerciseData;
    setExerciseData(newData);
    storage.set(STORAGE_EXERCISE, newData);

    try {
      const oldSet = new Set(oldData);
      const toInsert = newData.filter(d => !oldSet.has(d));
      if (toInsert.length) {
        await supabase.from('exercise_records').upsert(
          toInsert.map(date => ({ date })),
          { onConflict: 'date' }
        );
      }
      const newSet = new Set(newData);
      const toDelete = oldData.filter(d => !newSet.has(d));
      if (toDelete.length) {
        await supabase.from('exercise_records').delete().in('date', toDelete);
      }
    } catch (err) {
      console.error('Supabase exercise sync error', err);
    }
  };

  if (loading) return <LoadingScreen text="SYNCING···" />;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 relative">
        <div className="fixed inset-0 scan-bg pointer-events-none" />
        <div className="fixed inset-x-0 top-0 h-64 bg-gradient-to-b from-lime-500/5 to-transparent pointer-events-none" />

        {toast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-zinc-800 border border-lime-400/40 px-4 py-2 text-sm text-lime-400 font-mono slide-down max-w-[90vw]">
            {toast}
          </div>
        )}

        {showSettings && (
          <SettingsModal
            punchData={punchData}
            exerciseData={exerciseData}
            onClose={() => setShowSettings(false)}
            onImport={(d) => {
              if (d.punch) updatePunch(d.punch);
              if (d.exercise) updateExercise(d.exercise);
            }}
            showToast={showToast}
          />
        )}

        <div className="relative max-w-md mx-auto px-5 pt-7 pb-12">
          <header className="mb-7 flex items-end justify-between">
            <div>
              <div className="text-[10px] tracking-[0.35em] text-lime-400 font-mono mb-1.5">
                ◆ DAILY · OPS
              </div>
              <h1 className="text-3xl font-display font-extrabold">控制台</h1>
            </div>
            <div className="flex items-start gap-3">
              <div className="text-right">
                <div className="text-[10px] text-zinc-600 font-mono tracking-wider">{dateKey(now)}</div>
                <div className="text-sm text-zinc-400 font-mono mt-0.5">{formatHM(now)}</div>
              </div>
              <button
                onClick={() => setShowSettings(true)}
                className="text-zinc-500 hover:text-lime-400 p-1 transition-colors"
              >
                <Settings size={16} />
              </button>
            </div>
          </header>

          <div className="flex gap-1 mb-6 bg-zinc-900/60 border border-zinc-800 p-1">
            <TabBtn active={tab==='punch'} onClick={()=>setTab('punch')}>
              <Clock size={14} /> 打卡
            </TabBtn>
            <TabBtn active={tab==='exercise'} onClick={()=>setTab('exercise')}>
              <Flame size={14} /> 運動
            </TabBtn>
          </div>

          {tab === 'punch'
            ? <PunchView now={now} data={punchData} onUpdate={updatePunch} showToast={showToast} />
            : <ExerciseView now={now} data={exerciseData} onUpdate={updateExercise} showToast={showToast} />
          }

          <footer className="mt-12 text-center">
            <div className="text-[9px] tracking-[0.3em] text-zinc-700 font-mono">
              SUPABASE · SYNCED · {now.getFullYear()}
            </div>
          </footer>
        </div>
      </div>
  );
}

/* ========================= SETTINGS ========================= */

function SettingsModal({ punchData, exerciseData, onClose, onImport, showToast }) {
  const [mode, setMode] = useState('menu');
  const [importText, setImportText] = useState('');
  const [exportText, setExportText] = useState('');

  const handleExport = () => {
    const data = { punch: punchData, exercise: exerciseData };
    setExportText(JSON.stringify(data, null, 2));
    setMode('export');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      showToast('✓ 已複製到剪貼簿');
    } catch (e) {
      const ta = document.getElementById('export-textarea');
      if (ta) { ta.select(); document.execCommand('copy'); showToast('✓ 已複製'); }
    }
  };

  const handleDownload = () => {
    const blob = new Blob([exportText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tracker-backup-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✓ 已下載備份檔');
  };

  const handleImport = () => {
    try {
      const parsed = JSON.parse(importText);
      if (!parsed.punch && !parsed.exercise) {
        showToast('資料格式不對');
        return;
      }
      onImport(parsed);
      showToast('✓ 已匯入');
      onClose();
    } catch (e) {
      showToast('JSON 解析失敗');
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 fade-in" onClick={onClose}>
      <div className="relative bg-zinc-900 border border-zinc-700 max-w-md w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings size={14} className="text-lime-400" />
            <span className="text-sm font-display font-bold">
              {mode === 'menu' && '設定'}
              {mode === 'export' && '匯出資料'}
              {mode === 'import' && '匯入資料'}
            </span>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X size={16} />
          </button>
        </div>

        <div className="p-5">
          {mode === 'menu' && (
            <div className="space-y-2">
              <button onClick={handleExport} className="w-full p-4 border border-zinc-800 hover:border-lime-400/40 hover:bg-lime-950/20 transition-all text-left flex items-center gap-3">
                <Download size={18} className="text-lime-400" />
                <div className="flex-1">
                  <div className="text-sm font-bold">匯出 / 備份資料</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">取得所有資料的 JSON 備份</div>
                </div>
              </button>
              <button onClick={() => setMode('import')} className="w-full p-4 border border-zinc-800 hover:border-amber-400/40 hover:bg-amber-950/20 transition-all text-left flex items-center gap-3">
                <Upload size={18} className="text-amber-400" />
                <div className="flex-1">
                  <div className="text-sm font-bold">匯入資料</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">從備份恢復(會覆蓋目前資料)</div>
                </div>
              </button>

              <div className="pt-3 border-t border-zinc-800 mt-3">
                <div className="text-[10px] text-zinc-500 tracking-wider font-mono mb-2">統計</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-zinc-950/60 border border-zinc-800 p-3 text-center">
                    <div className="text-xl font-display font-extrabold text-lime-400">{Object.keys(punchData).length}</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">打卡天數</div>
                  </div>
                  <div className="bg-zinc-950/60 border border-zinc-800 p-3 text-center">
                    <div className="text-xl font-display font-extrabold text-lime-400">{exerciseData.length}</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">運動天數</div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {mode === 'export' && (
            <div className="space-y-3">
              <div className="text-[11px] text-zinc-400 leading-relaxed">
                這是你目前所有的資料。可以複製整段或下載成檔案保存。
              </div>
              <textarea id="export-textarea" readOnly value={exportText} className="w-full h-56 bg-zinc-950 border border-zinc-800 p-3 text-[11px] font-mono text-zinc-300 resize-none" onFocus={(e) => e.target.select()} />
              <div className="grid grid-cols-2 gap-2">
                <button onClick={handleCopy} className="bg-lime-400 hover:bg-lime-300 text-zinc-950 py-2.5 font-bold text-xs tracking-wider">複製文字</button>
                <button onClick={handleDownload} className="border border-zinc-700 hover:border-lime-400 text-zinc-300 hover:text-lime-400 py-2.5 font-bold text-xs tracking-wider transition-colors">下載 JSON</button>
              </div>
              <button onClick={() => setMode('menu')} className="w-full text-xs text-zinc-500 hover:text-zinc-300 py-2">← 返回</button>
            </div>
          )}

          {mode === 'import' && (
            <div className="space-y-3">
              <div className="text-[11px] text-zinc-400 leading-relaxed">
                把備份 JSON 貼到下方,按「匯入」恢復資料。<br />
                <span className="text-amber-400">⚠ 會覆蓋目前所有資料</span>
              </div>
              <textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder='{ "punch": {...}, "exercise": [...] }' className="w-full h-56 bg-zinc-950 border border-zinc-800 p-3 text-[11px] font-mono text-zinc-300 resize-none placeholder-zinc-700" />
              <button onClick={handleImport} disabled={!importText.trim()} className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-950 py-2.5 font-bold text-xs tracking-wider">確定匯入</button>
              <button onClick={() => setMode('menu')} className="w-full text-xs text-zinc-500 hover:text-zinc-300 py-2">← 返回</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} className={`flex-1 py-2.5 text-sm font-medium tracking-wide transition-all flex items-center justify-center gap-1.5 ${active ? 'bg-lime-400 text-zinc-950 font-bold' : 'text-zinc-500 hover:text-zinc-300'}`}>
      {children}
    </button>
  );
}

/* =========================== PUNCH ============================ */

function PunchView({ now, data, onUpdate, showToast }) {
  const [editing, setEditing] = useState(false);
  const [editTime, setEditTime] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [showAddPunch, setShowAddPunch] = useState(false);
  const [addDate, setAddDate] = useState(todayKey());
  const [addTime, setAddTime] = useState('09:00');
  const [pendingDeleteDate, setPendingDeleteDate] = useState(null);

  const today = todayKey();
  const todayISO = data[today];
  const punchedToday = !!todayISO;

  const checkIn = punchedToday ? new Date(todayISO) : null;
  const leaveTime = checkIn ? new Date(checkIn.getTime() + WORK_HOURS_MS) : null;
  const remainingMs = leaveTime ? leaveTime.getTime() - now.getTime() : 0;
  const canLeave = remainingMs <= 0;

  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const monthDays = Object.keys(data).filter(d => d.startsWith(monthPrefix));
  const monthCount = monthDays.length;
  const remaining = Math.max(0, MONTHLY_TARGET - monthCount);
  const progressPct = Math.min(100, (monthCount / MONTHLY_TARGET) * 100);

  const handlePunch = () => {
    onUpdate({ ...data, [today]: new Date().toISOString() });
    showToast('✓ 打卡成功');
  };

  const handleUnpunch = () => {
    const nd = { ...data };
    delete nd[today];
    onUpdate(nd);
    setConfirmCancel(false);
    showToast('已取消今日打卡');
  };

  const startEdit = () => {
    if (checkIn) setEditTime(formatHM(checkIn));
    setEditing(true);
  };

  const saveEdit = () => {
    const [h, m] = editTime.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) { showToast('時間格式錯誤'); return; }
    const newDate = new Date();
    newDate.setHours(h, m, 0, 0);
    onUpdate({ ...data, [today]: newDate.toISOString() });
    setEditing(false);
    showToast('✓ 已更新時間');
  };

  const handleAddPunch = () => {
    const [h, m] = addTime.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) { showToast('時間格式錯誤'); return; }
    const [yy, mm, dd] = addDate.split('-').map(Number);
    const d = new Date(yy, mm-1, dd, h, m, 0, 0);
    onUpdate({ ...data, [addDate]: d.toISOString() });
    setShowAddPunch(false);
    showToast(`✓ 已補登 ${addDate}`);
  };

  const handleDeleteDate = (date) => {
    const nd = { ...data };
    delete nd[date];
    onUpdate(nd);
    setPendingDeleteDate(null);
    showToast(`已刪除 ${date}`);
  };

  const remHrs = Math.max(0, Math.floor(remainingMs / 3600000));
  const remMins = Math.max(0, Math.floor((remainingMs % 3600000) / 60000));
  const remSecs = Math.max(0, Math.floor((remainingMs % 60000) / 1000));

  const punchHistory = Object.entries(data).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="relative border border-zinc-800 bg-zinc-900/60 backdrop-blur-sm">
        <div className="absolute top-0 right-0 px-2.5 py-1 text-[9px] font-mono tracking-[0.2em] bg-zinc-800/80 text-zinc-400">{today}</div>

        {punchedToday ? (
          <div className="p-5">
            <div className="flex items-center gap-1.5 mb-4 mt-1">
              <div className="w-1.5 h-1.5 bg-lime-400 rounded-full animate-pulse" />
              <span className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-mono">今日已打卡</span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <div className="text-[9px] tracking-[0.25em] text-zinc-500 mb-1.5 font-mono">CHECK-IN</div>
                <div className="flex items-center gap-2">
                  {editing ? (
                    <input type="time" value={editTime} onChange={(e)=>setEditTime(e.target.value)} className="bg-zinc-950 border border-zinc-700 px-2 py-1 text-lg font-mono text-zinc-100 w-24" />
                  ) : (
                    <span className="text-2xl font-mono text-zinc-100">{formatHM(checkIn)}</span>
                  )}
                  {editing ? (
                    <div className="flex gap-1">
                      <button onClick={saveEdit} className="text-[10px] bg-lime-400 text-zinc-950 px-2 py-1 font-bold">存</button>
                      <button onClick={()=>setEditing(false)} className="text-[10px] text-zinc-500 px-1">×</button>
                    </div>
                  ) : (
                    <button onClick={startEdit} className="text-zinc-600 hover:text-lime-400">
                      <Edit3 size={12} />
                    </button>
                  )}
                </div>
              </div>
              <div>
                <div className="text-[9px] tracking-[0.25em] text-zinc-500 mb-1.5 font-mono">LEAVE AT</div>
                <div className={`text-2xl font-mono ${canLeave ? 'text-lime-400' : 'text-amber-400'}`}>{formatHM(leaveTime)}</div>
              </div>
            </div>

            <div className="border-t border-zinc-800 pt-4">
              {canLeave ? (
                <div className="text-center py-3">
                  <div className="text-[9px] tracking-[0.3em] text-lime-400 mb-1.5 font-mono">STATUS · UNLOCKED</div>
                  <div className="text-3xl font-display font-bold text-lime-400">可以下班 ✓</div>
                </div>
              ) : (
                <div className="text-center py-2">
                  <div className="text-[9px] tracking-[0.3em] text-zinc-500 mb-1.5 font-mono">距離下班還有</div>
                  <div className="text-4xl font-mono text-zinc-100 tabular-nums tracking-tight">
                    {String(remHrs).padStart(2,'0')}<span className="text-zinc-700">:</span>{String(remMins).padStart(2,'0')}<span className="text-zinc-700">:</span>{String(remSecs).padStart(2,'0')}
                  </div>
                </div>
              )}
            </div>

            {!confirmCancel ? (
              <button onClick={() => setConfirmCancel(true)} className="w-full mt-4 py-2 text-[11px] text-zinc-500 hover:text-red-400 border border-zinc-800 hover:border-red-900/60 transition-colors tracking-wider">取消今日打卡</button>
            ) : (
              <div className="mt-4 border border-red-900/60 bg-red-950/30 p-3 slide-down">
                <div className="text-xs text-red-300 mb-2 text-center">確定要取消今日打卡?</div>
                <div className="flex gap-2">
                  <button onClick={handleUnpunch} className="flex-1 py-2 bg-red-500 hover:bg-red-400 text-white text-xs font-bold tracking-wider">確定取消</button>
                  <button onClick={() => setConfirmCancel(false)} className="flex-1 py-2 border border-zinc-700 text-zinc-300 text-xs tracking-wider">保留</button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 text-center">
            <div className="text-zinc-400 text-base mb-1">今天還沒打卡</div>
            <div className="text-[10px] text-zinc-600 font-mono tracking-[0.3em]">NOT CHECKED IN</div>
          </div>
        )}
      </div>

      {!punchedToday && (
        <button onClick={handlePunch} className="group relative w-full bg-lime-400 hover:bg-lime-300 active:scale-[0.98] text-zinc-950 font-bold py-7 transition-all overflow-hidden pulse-glow">
          <div className="absolute inset-0 bg-gradient-to-r from-lime-400 via-emerald-300 to-lime-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative flex items-center justify-center gap-2.5">
            <Zap size={22} className="fill-zinc-950" />
            <span className="text-lg tracking-wider font-display">打卡進公司</span>
          </div>
        </button>
      )}

      <div className="border border-zinc-800 bg-zinc-900/60 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[10px] tracking-[0.3em] text-zinc-400 font-mono">補打卡</div>
            <div className="text-[10px] text-zinc-600 mt-0.5">忘記打卡時手動補登</div>
          </div>
          <button onClick={() => setShowAddPunch(!showAddPunch)} className={`w-8 h-8 flex items-center justify-center border transition-all ${showAddPunch ? 'bg-zinc-800 border-zinc-700 text-zinc-300' : 'border-zinc-800 text-zinc-500 hover:text-lime-400 hover:border-lime-900'}`}>
            {showAddPunch ? <X size={14} /> : <Plus size={14} />}
          </button>
        </div>
        {showAddPunch && (
          <div className="pt-3 border-t border-zinc-800 space-y-3 slide-down">
            <div>
              <div className="text-[9px] tracking-[0.25em] text-zinc-500 mb-1 font-mono">日期</div>
              <input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-zinc-100 font-mono" />
            </div>
            <div>
              <div className="text-[9px] tracking-[0.25em] text-zinc-500 mb-1 font-mono">打卡時間</div>
              <input type="time" value={addTime} onChange={(e) => setAddTime(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-zinc-100 font-mono" />
            </div>
            <button onClick={handleAddPunch} className="w-full bg-lime-400 hover:bg-lime-300 text-zinc-950 py-2.5 font-bold text-sm tracking-wider">補登打卡</button>
          </div>
        )}
      </div>

      <div className="border border-zinc-800 bg-zinc-900/60 p-5">
        <div className="flex justify-between items-baseline mb-3">
          <div>
            <div className="text-[9px] tracking-[0.3em] text-zinc-500 font-mono">{monthPrefix}</div>
            <div className="text-sm text-zinc-300 mt-0.5 font-medium">本月出勤目標</div>
          </div>
          <div className="text-right">
            <span className="text-4xl font-mono font-bold text-lime-400">{monthCount}</span>
            <span className="text-zinc-600 font-mono text-lg"> /{MONTHLY_TARGET}</span>
          </div>
        </div>

        <div className="relative h-1.5 bg-zinc-800 mb-3 overflow-hidden">
          <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-lime-400 to-emerald-400 transition-all duration-700" style={{ width: `${progressPct}%` }} />
        </div>

        <div className="flex justify-between text-xs">
          <span className="text-zinc-500 font-mono">{progressPct.toFixed(0)}%</span>
          {remaining === 0 ? (
            <span className="text-lime-400 font-bold">✓ 達成本月目標</span>
          ) : (
            <span className="text-zinc-300">還差 <span className="text-amber-400 font-bold font-mono">{remaining}</span> 天</span>
          )}
        </div>
      </div>

      {punchHistory.length > 0 && (
        <div className="border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-[10px] tracking-[0.3em] text-zinc-400 font-mono">最近紀錄</span>
            <div className="flex-1 h-px bg-zinc-800 ml-2" />
            <span className="text-[10px] font-mono text-zinc-600">{Object.keys(data).length} 天</span>
          </div>
          <div className="space-y-1.5">
            {punchHistory.map(([date, iso]) => {
              const t = new Date(iso);
              const isPending = pendingDeleteDate === date;
              return (
                <div key={date} className={`flex items-center justify-between py-2 px-2.5 border ${isPending ? 'border-red-900/60 bg-red-950/30' : 'border-zinc-800/50 bg-zinc-900/40'}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-zinc-300">{date}</span>
                    <span className="text-xs font-mono text-zinc-500">{formatHM(t)}</span>
                  </div>
                  {isPending ? (
                    <div className="flex gap-1">
                      <button onClick={() => handleDeleteDate(date)} className="text-[10px] bg-red-500 hover:bg-red-400 text-white px-2 py-1 font-bold">刪除</button>
                      <button onClick={() => setPendingDeleteDate(null)} className="text-[10px] text-zinc-400 px-1">×</button>
                    </div>
                  ) : (
                    <button onClick={() => setPendingDeleteDate(date)} className="text-zinc-600 hover:text-red-400 p-1">
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <MonthCalendar now={now} attendedDates={Object.keys(data)} title="出勤紀錄" onCellClick={null} />
    </div>
  );
}

/* ========================= EXERCISE ========================= */

function ExerciseView({ now, data, onUpdate, showToast }) {
  const [showAddDate, setShowAddDate] = useState(false);
  const [customDate, setCustomDate] = useState(todayKey());
  const [confirmRemoveToday, setConfirmRemoveToday] = useState(false);
  const [pendingDeleteDate, setPendingDeleteDate] = useState(null);

  const today = todayKey();
  const set = new Set(data);
  const total = data.length;
  const exercisedToday = set.has(today);

  const nextMilestone = MILESTONES.find(m => m > total) || null;
  const lastMilestone = MILESTONES.slice().reverse().find(m => m <= total) || 0;
  const toNext = nextMilestone ? nextMilestone - total : 0;
  const milestonePct = nextMilestone ? ((total - lastMilestone) / (nextMilestone - lastMilestone)) * 100 : 100;

  const handleLogToday = () => {
    if (set.has(today)) return;
    onUpdate([...data, today].sort());
    showToast('✓ 已登記今日運動');
  };

  const handleRemoveToday = () => {
    onUpdate(data.filter(d => d !== today));
    setConfirmRemoveToday(false);
    showToast('已取消今日運動');
  };

  const handleAddCustom = () => {
    if (set.has(customDate)) { showToast('這天已經登記過了'); return; }
    onUpdate([...data, customDate].sort());
    setShowAddDate(false);
    showToast(`✓ 已補登 ${customDate}`);
  };

  const handleRemoveDate = (date) => {
    onUpdate(data.filter(d => d !== date));
    setPendingDeleteDate(null);
    showToast(`已刪除 ${date}`);
  };

  return (
    <div className="space-y-4">
      <div className="relative border border-zinc-800 bg-zinc-900/60 backdrop-blur-sm overflow-hidden">
        <div className="absolute top-0 right-0 px-2.5 py-1 text-[9px] font-mono tracking-[0.2em] bg-zinc-800/80 text-zinc-400">{now.getFullYear()}</div>
        <div className="absolute -top-20 -right-20 w-56 h-56 bg-lime-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative p-6">
          <div className="text-[9px] tracking-[0.35em] text-zinc-500 font-mono mb-2">TOTAL · DAYS</div>
          <div className="flex items-baseline gap-3 mb-1">
            <span className="text-7xl font-display font-extrabold text-lime-400 leading-none tabular-nums">{total}</span>
            <span className="text-zinc-500 font-mono text-sm">天</span>
          </div>
          <div className="text-xs text-zinc-500 mt-2">已運動 {total} 天 ⚡</div>

          {nextMilestone && (
            <div className="mt-5 pt-5 border-t border-zinc-800">
              <div className="flex justify-between items-baseline text-xs mb-2">
                <span className="text-zinc-500 flex items-center gap-1">
                  <Trophy size={11} className="text-amber-400" />下個成就
                </span>
                <span className="font-mono">
                  <span className="text-amber-400 font-bold">{nextMilestone}</span>
                  <span className="text-zinc-600"> · 還差 </span>
                  <span className="text-zinc-200 font-bold">{toNext}</span>
                </span>
              </div>
              <div className="relative h-1 bg-zinc-800 overflow-hidden">
                <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-700" style={{ width: `${milestonePct}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {!exercisedToday ? (
        <button onClick={handleLogToday} className="group relative w-full bg-lime-400 hover:bg-lime-300 active:scale-[0.98] text-zinc-950 font-bold py-7 transition-all overflow-hidden pulse-glow">
          <div className="absolute inset-0 bg-gradient-to-r from-lime-400 via-emerald-300 to-lime-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative flex items-center justify-center gap-2.5">
            <Flame size={22} className="fill-zinc-950" />
            <span className="text-lg tracking-wider font-display">今天有運動</span>
          </div>
        </button>
      ) : (
        <div className="space-y-2">
          <div className="border border-lime-900/60 bg-gradient-to-r from-lime-950/40 to-emerald-950/30 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-lime-400">
              <div className="w-7 h-7 rounded-full bg-lime-400 text-zinc-950 flex items-center justify-center">
                <Check size={16} strokeWidth={3} />
              </div>
              <div>
                <div className="font-medium">今天已登記運動</div>
                <div className="text-[10px] text-lime-600 font-mono tracking-wider">LOGGED · {today}</div>
              </div>
            </div>
            {!confirmRemoveToday && (
              <button onClick={() => setConfirmRemoveToday(true)} className="text-xs text-zinc-500 hover:text-red-400 px-2 py-1">取消</button>
            )}
          </div>

          {confirmRemoveToday && (
            <div className="border border-red-900/60 bg-red-950/30 p-3 slide-down">
              <div className="text-xs text-red-300 mb-2 text-center">確定要取消今日運動?</div>
              <div className="flex gap-2">
                <button onClick={handleRemoveToday} className="flex-1 py-2 bg-red-500 hover:bg-red-400 text-white text-xs font-bold tracking-wider">確定取消</button>
                <button onClick={() => setConfirmRemoveToday(false)} className="flex-1 py-2 border border-zinc-700 text-zinc-300 text-xs tracking-wider">保留</button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="border border-zinc-800 bg-zinc-900/60 p-5">
        <div className="flex items-center gap-1.5 mb-4">
          <Trophy size={12} className="text-amber-400" />
          <span className="text-[10px] tracking-[0.3em] text-zinc-400 font-mono">ACHIEVEMENTS</span>
          <div className="flex-1 h-px bg-zinc-800 ml-2" />
          <span className="text-[10px] font-mono text-zinc-600">{MILESTONES.filter(m=>total>=m).length}/{MILESTONES.length}</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {MILESTONES.map(m => {
            const unlocked = total >= m;
            const isJustHit = unlocked && total === m;
            return (
              <div key={m} className={`relative aspect-square flex flex-col items-center justify-center border transition-all ${unlocked ? 'border-amber-400/40 bg-gradient-to-br from-amber-950/50 via-amber-900/20 to-zinc-900/40' : 'border-zinc-800 bg-zinc-900/40'}`}>
                {unlocked && (<Sparkles size={9} className={`absolute top-1.5 right-1.5 text-amber-400 ${isJustHit ? 'animate-pulse' : ''}`} />)}
                <div className={`text-xl font-display font-extrabold tabular-nums ${unlocked ? 'shimmer-text' : 'text-zinc-700'}`}>{m}</div>
                <div className={`text-[8px] tracking-[0.2em] mt-0.5 font-mono ${unlocked ? 'text-amber-500/80' : 'text-zinc-700'}`}>{unlocked ? '✓ UNLOCKED' : 'LOCKED'}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border border-zinc-800 bg-zinc-900/60 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[10px] tracking-[0.3em] text-zinc-400 font-mono">補登 / 修正</div>
            <div className="text-[10px] text-zinc-600 mt-0.5">手動加上其他日期</div>
          </div>
          <button onClick={() => setShowAddDate(!showAddDate)} className={`w-8 h-8 flex items-center justify-center border transition-all ${showAddDate ? 'bg-zinc-800 border-zinc-700 text-zinc-300' : 'border-zinc-800 text-zinc-500 hover:text-lime-400 hover:border-lime-900'}`}>
            {showAddDate ? <X size={14} /> : <Plus size={14} />}
          </button>
        </div>
        {showAddDate && (
          <div className="flex gap-2 pt-2 border-t border-zinc-800 slide-down">
            <input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} className="flex-1 bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-zinc-100 font-mono" />
            <button onClick={handleAddCustom} className="bg-lime-400 hover:bg-lime-300 text-zinc-950 px-5 font-bold text-sm tracking-wider">新增</button>
          </div>
        )}
      </div>

      <MonthCalendar now={now} attendedDates={data} title="運動日曆" onCellClick={(date) => setPendingDeleteDate(date)} showHint pendingDeleteDate={pendingDeleteDate} onConfirmDelete={handleRemoveDate} onCancelDelete={() => setPendingDeleteDate(null)} />
    </div>
  );
}

/* ========================= CALENDAR ========================= */

function MonthCalendar({ now, attendedDates, title, onCellClick, showHint, pendingDeleteDate, onConfirmDelete, onCancelDelete }) {
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const { y: year, m: month } = view;
  const monthPrefix = `${year}-${String(month+1).padStart(2,'0')}`;

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month+1, 0);
  const daysInMonth = lastDay.getDate();
  const startWeekday = firstDay.getDay();

  const dates = Array.isArray(attendedDates) ? attendedDates : Object.keys(attendedDates || {});
  const inMonth = useMemo(
    () => dates.filter(d => d.startsWith(monthPrefix)),
    [dates, monthPrefix]
  );
  const attendedSet = useMemo(
    () => new Set(inMonth.map(d => parseInt(d.slice(8)))),
    [inMonth]
  );
  const cells = useMemo(() => {
    const arr = [];
    for (let i = 0; i < startWeekday; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(d);
    return arr;
  }, [year, month, startWeekday, daysInMonth]);

  const goPrev = () => setView(month === 0 ? { y: year-1, m: 11 } : { y: year, m: month-1 });
  const goNext = () => setView(month === 11 ? { y: year+1, m: 0 } : { y: year, m: month+1 });

  return (
    <div className="border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex justify-between items-center mb-1">
        <button onClick={goPrev} className="text-zinc-500 hover:text-lime-400 p-1.5 transition-colors"><ChevronLeft size={16} /></button>
        <div className="text-center">
          <div className="text-[9px] tracking-[0.3em] text-zinc-500 font-mono">{title}</div>
          <div className="font-display font-bold text-base">{year} · {month+1}月</div>
        </div>
        <button onClick={goNext} className="text-zinc-500 hover:text-lime-400 p-1.5 transition-colors"><ChevronRight size={16} /></button>
      </div>
      <div className="text-center text-xs text-zinc-500 mb-4 font-mono">本月 <span className="text-lime-400 font-bold">{inMonth.length}</span> 天</div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {['日','一','二','三','四','五','六'].map((d,i) => (
          <div key={d} className={`text-center text-[10px] py-1 font-mono ${i===0||i===6 ? 'text-zinc-500' : 'text-zinc-600'}`}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const isMarked = attendedSet.has(d);
          const isToday = year === now.getFullYear() && month === now.getMonth() && d === now.getDate();
          const dateStr = `${monthPrefix}-${String(d).padStart(2,'0')}`;
          const isPending = pendingDeleteDate === dateStr;
          const Comp = isMarked && onCellClick ? 'button' : 'div';
          return (
            <Comp key={i} onClick={isMarked && onCellClick ? () => onCellClick(dateStr) : undefined} className={`aspect-square flex items-center justify-center text-xs font-mono transition-all ${isPending ? 'bg-red-500 text-white font-bold animate-pulse' : isMarked ? 'bg-lime-400 text-zinc-950 font-bold hover:bg-red-400' : isToday ? 'bg-zinc-800 text-zinc-100 ring-1 ring-zinc-600' : 'text-zinc-600'}`}>
              {d}
            </Comp>
          );
        })}
      </div>

      {pendingDeleteDate && onConfirmDelete && (
        <div className="mt-3 border border-red-900/60 bg-red-950/30 p-3 slide-down">
          <div className="text-xs text-red-300 mb-2 text-center">刪除 <span className="font-mono font-bold">{pendingDeleteDate}</span>?</div>
          <div className="flex gap-2">
            <button onClick={() => onConfirmDelete(pendingDeleteDate)} className="flex-1 py-2 bg-red-500 hover:bg-red-400 text-white text-xs font-bold tracking-wider">確定刪除</button>
            <button onClick={onCancelDelete} className="flex-1 py-2 border border-zinc-700 text-zinc-300 text-xs tracking-wider">取消</button>
          </div>
        </div>
      )}

      {showHint && inMonth.length > 0 && !pendingDeleteDate && (
        <div className="text-[10px] text-zinc-600 mt-3 text-center font-mono tracking-wider">點擊綠色日期可刪除</div>
      )}
    </div>
  );
}
