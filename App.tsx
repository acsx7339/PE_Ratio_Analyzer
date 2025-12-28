
import React, { useState, useCallback, useMemo } from 'react';
import { scanFinancialStocks, scanMarketStatus, fetchMarketNews } from './services/geminiService';
import { ScannerResult, MarketResult, NewsItem } from './types';

const PriceLevelGauge: React.FC<{ level: number }> = ({ level }) => {
  const percentage = Math.min(Math.max(level, 0), 100);
  return (
    <div className="w-full mt-2">
      <div className="flex justify-between text-[9px] font-bold text-slate-400 mb-1">
        <span>崩盤 (0%)</span>
        <span className="text-blue-500 font-black">季線支撐區 (50-70%)</span>
        <span>過熱 (100%)</span>
      </div>
      <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex relative border border-slate-200">
        <div className="h-full bg-emerald-500/30" style={{ width: '25%' }}></div>
        <div className="h-full bg-slate-200" style={{ width: '25%' }}></div>
        <div className="h-full bg-blue-500/40 border-x border-white/40" style={{ width: '20%' }}></div>
        <div className="h-full bg-slate-200" style={{ width: '5%' }}></div>
        <div className="h-full bg-rose-400/40" style={{ width: '25%' }}></div>
        <div 
          className="absolute top-0 bottom-0 w-2.5 bg-slate-900 border-x-2 border-white shadow-xl transition-all duration-1000 z-10"
          style={{ left: `${percentage}%`, transform: 'translateX(-50%)' }}
        ></div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  // New view 'dashboard' is the default
  const [view, setView] = useState<'dashboard' | 'scanner' | 'market' | 'longTerm' | 'news'>('dashboard');
  
  // Loading states for each section
  const [financialLoading, setFinancialLoading] = useState(false);
  const [marketLoading, setMarketLoading] = useState(false);
  const [longTermLoading, setLongTermLoading] = useState(false);
  const [newsLoading, setNewsLoading] = useState(false);
  
  // New: Specifically track if the GLOBAL scan button was clicked
  const [globalLoading, setGlobalLoading] = useState(false);
  
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Separate results for Financial Scan and Long Term (Broad Market) Scan
  const [financialResults, setFinancialResults] = useState<ScannerResult[] | null>(null);
  const [longTermResults, setLongTermResults] = useState<ScannerResult[] | null>(null);
  const [marketResults, setMarketResults] = useState<MarketResult[] | null>(null);
  const [newsResults, setNewsResults] = useState<NewsItem[] | null>(null);

  // Helper to check if any task is running (to disable buttons)
  const isAnyScanning = financialLoading || marketLoading || longTermLoading || newsLoading;

  // Sorted Financial Results
  const sortedFinancialResults = useMemo(() => {
    if (!financialResults) return null;
    return [...financialResults].sort((a, b) => {
      if (a.isGreenZone && !b.isGreenZone) return -1;
      if (!a.isGreenZone && b.isGreenZone) return 1;
      return (b.roe || 0) - (a.roe || 0);
    });
  }, [financialResults]);

  // Filtered Long Term Results (using the Broad Market results)
  const filteredLongTermTargets = useMemo(() => {
    // Strategy: Must be flagged as LongTermInvest AND Retail chips must be decreasing
    return longTermResults?.filter(s => s.isLongTermInvest && s.retailCountCurrent < s.retailCountPrevious) || [];
  }, [longTermResults]);

  // --- Individual Actions ---
  
  const handleFinancialScan = useCallback(async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setFinancialLoading(true);
    try {
      const data = await scanFinancialStocks(false);
      setFinancialResults(data);
    } catch (e) {
      console.error("Financial scan failed", e);
    } finally {
      setFinancialLoading(false);
    }
  }, []);

  const handleMarketScan = useCallback(async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setMarketLoading(true);
    try {
      const marketData = await scanMarketStatus();
      setMarketResults(marketData);
    } catch (e) {
      console.error("Market scan failed", e);
    } finally {
      setMarketLoading(false);
    }
  }, []);

  const handleLongTermScan = useCallback(async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setLongTermLoading(true);
    try {
      const longTermData = await scanFinancialStocks(true);
      setLongTermResults(longTermData);
    } catch (e) {
      console.error("Long term scan failed", e);
    } finally {
      setLongTermLoading(false);
    }
  }, []);

  const handleNewsScan = useCallback(async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setNewsLoading(true);
    try {
      const newsData = await fetchMarketNews();
      setNewsResults(newsData);
    } catch (e) {
      console.error("News fetch failed", e);
    } finally {
      setNewsLoading(false);
    }
  }, []);

  // --- Global Action ---

  const handleGlobalScan = useCallback(async () => {
    setGlobalError(null);
    setGlobalLoading(true); // Only set this true for the big button animation
    
    // Execute sequentially to avoid "Rpc failed due to xhr error"
    try {
      // 1. Market Status (Fastest)
      setMarketLoading(true);
      try {
        const marketData = await scanMarketStatus();
        setMarketResults(marketData);
      } catch (e) {
        console.error("Market scan failed", e);
      } finally {
        setMarketLoading(false);
      }

      // 2. Financial Scan
      setFinancialLoading(true);
      try {
        const financialData = await scanFinancialStocks(false);
        setFinancialResults(financialData);
      } catch (e) {
        console.error("Financial scan failed", e);
      } finally {
        setFinancialLoading(false);
      }

      // 3. Long Term Scan
      setLongTermLoading(true);
      try {
        const longTermData = await scanFinancialStocks(true);
        setLongTermResults(longTermData);
      } catch (e) {
        console.error("Long term scan failed", e);
      } finally {
        setLongTermLoading(false);
      }

      // 4. News (Slowest, do last)
      setNewsLoading(true);
      try {
        const newsData = await fetchMarketNews();
        setNewsResults(newsData);
      } catch (e) {
        console.error("News fetch failed", e);
      } finally {
        setNewsLoading(false);
      }

    } catch (err) {
      console.error("Global scan encountered a critical error", err);
      setGlobalError("部分掃描發生錯誤，請檢查網路連線後重試。");
    } finally {
      setGlobalLoading(false); // Stop the big button animation
    }
  }, []);

  const changeView = (newView: 'dashboard' | 'scanner' | 'market' | 'longTerm' | 'news') => {
    setView(newView);
    setGlobalError(null);
  };

  const getMarketStatusStyle = (status: string) => {
    switch (status) {
      case 'crisis_buy': return 'bg-emerald-600 text-white shadow-lg ring-2 ring-emerald-100';
      case 'bull_pullback': return 'bg-indigo-600 text-white shadow-lg ring-4 ring-indigo-100';
      case 'overheated': return 'bg-rose-600 text-white shadow-lg ring-2 ring-rose-100';
      default: return 'bg-slate-200 text-slate-600';
    }
  };

  const getMarketStatusLabel = (status: string, deviation: number) => {
    if (status === 'bull_pullback') {
      return (deviation < 0) ? '季線黃金進場 (生命線下)' : '季線支撐佈局 (接近生命線)';
    }
    switch (status) {
      case 'crisis_buy': return '鑽石買點 (極度便宜)';
      case 'overheated': return '市場過熱 (風險警戒)';
      default: return '中性觀望';
    }
  };

  // Dashboard Card Component
  const DashboardCard = ({ 
    title, 
    icon, 
    colorClass, 
    loading, 
    data, 
    onClick,
    onScan,
    summary 
  }: { 
    title: string, 
    icon: string, 
    colorClass: string, 
    loading: boolean, 
    data: any, 
    onClick: () => void,
    onScan: (e: React.MouseEvent) => void,
    summary: React.ReactNode
  }) => (
    <div onClick={onClick} className={`relative overflow-hidden rounded-[32px] p-6 border-2 transition-all duration-300 cursor-pointer group hover:-translate-y-1 hover:shadow-xl ${loading ? 'border-slate-200 bg-slate-50' : 'bg-white border-slate-100 hover:border-slate-300'}`}>
      <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-10 ${colorClass}`}></div>
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white text-xl shadow-md ${colorClass}`}>
          {loading ? <i className="fas fa-circle-notch fa-spin"></i> : <i className={`fas ${icon}`}></i>}
        </div>
        
        {/* Prominent Action Buttons Container */}
        <div className="flex items-center gap-2">
            {/* New Prominent Scan Button */}
            <button
                onClick={onScan}
                disabled={loading}
                className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-full 
                    bg-white border-2 border-slate-200 shadow-sm
                    text-xs font-bold text-slate-500
                    transition-all duration-200
                    z-20
                    ${loading 
                        ? 'opacity-70 cursor-not-allowed bg-slate-50' 
                        : 'hover:border-blue-500 hover:text-blue-600 hover:shadow-md hover:scale-105 active:scale-95'
                    }
                `}
                title="單獨更新此區塊數據"
            >
                <i className={`fas fa-sync-alt ${loading ? 'fa-spin text-blue-500' : ''}`}></i>
                <span>{loading ? '分析中' : '更新數據'}</span>
            </button>
            
            <div className="bg-slate-100 px-3 py-1.5 rounded-full text-[10px] font-bold text-slate-400 group-hover:bg-slate-200 transition-colors">
              查看詳情
            </div>
        </div>
      </div>
      <h3 className="text-xl font-black text-slate-800 mb-2">{title}</h3>
      <div className="min-h-[3rem]">
        {loading ? (
          <span className="text-sm font-bold text-slate-400 animate-pulse">正在分析數據...</span>
        ) : !data ? (
          <span className="text-sm font-bold text-slate-300">等待啟動</span>
        ) : (
          summary
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pb-20 bg-slate-50 font-sans text-slate-900">
      <header className="bg-slate-900 text-white shadow-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <i className="fas fa-landmark text-2xl"></i>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">台股金融河流選股器</h1>
              <p className="text-xs text-slate-400 font-medium">量化選股 × 策略儀表板</p>
            </div>
          </div>

          <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 overflow-x-auto max-w-full">
            <button onClick={() => changeView('dashboard')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${view === 'dashboard' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>全域戰情室</button>
            <button onClick={() => changeView('scanner')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${view === 'scanner' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}>金融掃描</button>
            <button onClick={() => changeView('market')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${view === 'market' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>大盤指南</button>
            <button onClick={() => changeView('longTerm')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${view === 'longTerm' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'}`}>長予投資</button>
            <button onClick={() => changeView('news')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${view === 'news' ? 'bg-fuchsia-600 text-white' : 'text-slate-400 hover:text-white'}`}>市場消息</button>
          </div>
          
          <div className="w-8"></div> {/* Spacer for alignment */}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pt-8">
        {globalError && (
          <div className="bg-red-50 text-red-700 p-4 rounded-xl mb-6 text-sm border border-red-100 font-bold flex items-center gap-2">
            <i className="fas fa-exclamation-circle"></i> {globalError}
          </div>
        )}

        {/* --- GLOBAL DASHBOARD VIEW --- */}
        {view === 'dashboard' && (
          <div className="animate-in fade-in zoom-in duration-500 space-y-8">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-12 rounded-[40px] shadow-2xl relative overflow-hidden border border-slate-700 text-center">
              <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
              <div className="relative z-10 max-w-2xl mx-auto">
                <h2 className="text-4xl md:text-5xl font-black mb-6 tracking-tight">全域投資戰情室</h2>
                <p className="text-lg text-slate-300 mb-8 font-medium">
                  一鍵啟動 AI 核心，同時執行「金融板塊估值」、「大盤位階判讀」、「長線趨勢掃描」與「市場題材蒐集」。
                </p>
                
                <button 
                  onClick={handleGlobalScan}
                  disabled={isAnyScanning} 
                  className={`group relative inline-flex items-center justify-center overflow-hidden rounded-full p-0.5 mb-2 font-black transition-all duration-300 focus:outline-none ${isAnyScanning ? 'opacity-70 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}`}
                >
                  <span className="w-full h-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 group-hover:from-blue-600 group-hover:via-purple-600 group-hover:to-pink-600 absolute"></span>
                  <span className="relative px-12 py-4 transition-all ease-in duration-75 bg-slate-900 rounded-full group-hover:bg-opacity-0 text-xl flex items-center gap-3">
                    {/* Only show spinner if GLOBAL loading is active */}
                    {globalLoading ? (
                       <><i className="fas fa-circle-notch fa-spin"></i> 正在掃描全市場...</>
                    ) : (
                       <><i className="fas fa-rocket"></i> {isAnyScanning ? '系統忙碌中...' : '啟動全域掃描'}</>
                    )}
                  </span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
               {/* 1. Financial Scanner Card */}
               <DashboardCard 
                  title="金融板塊掃描" 
                  icon="microscope" 
                  colorClass="bg-emerald-500"
                  loading={financialLoading}
                  data={financialResults}
                  onClick={() => changeView('scanner')}
                  onScan={handleFinancialScan}
                  summary={
                    sortedFinancialResults && (
                      <div>
                        <div className="text-3xl font-black text-emerald-600">
                          {sortedFinancialResults.filter(s => s.isGreenZone).length} <span className="text-sm text-slate-400 font-bold">檔</span>
                        </div>
                        <p className="text-xs font-bold text-slate-400">落入便宜區間 (Green Zone)</p>
                      </div>
                    )
                  }
               />

               {/* 2. Market Status Card */}
               <DashboardCard 
                  title="大盤位階指南" 
                  icon="chart-area" 
                  colorClass="bg-indigo-500"
                  loading={marketLoading}
                  data={marketResults}
                  onClick={() => changeView('market')}
                  onScan={handleMarketScan}
                  summary={
                    marketResults && (
                      <div>
                        <div className="flex gap-2 mb-1">
                          {marketResults.slice(0, 2).map(m => (
                            <span key={m.ticker} className={`text-[10px] px-2 py-1 rounded font-black text-white ${getMarketStatusStyle(m.status)}`}>
                              {m.name}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs font-bold text-slate-400 mt-2">{marketResults[0]?.signal || '數據分析完成'}</p>
                      </div>
                    )
                  }
               />

               {/* 3. Long Term Strategy Card */}
               <DashboardCard 
                  title="長予投資策略" 
                  icon="crown" 
                  colorClass="bg-amber-500"
                  loading={longTermLoading}
                  data={longTermResults}
                  onClick={() => changeView('longTerm')}
                  onScan={handleLongTermScan}
                  summary={
                    filteredLongTermTargets && (
                      <div>
                        <div className="text-3xl font-black text-amber-600">
                          {filteredLongTermTargets.length} <span className="text-sm text-slate-400 font-bold">檔</span>
                        </div>
                        <p className="text-xs font-bold text-slate-400">符合月線收斂 + 散戶減碼</p>
                      </div>
                    )
                  }
               />

               {/* 4. Market News Card */}
               <DashboardCard 
                  title="市場題材風口" 
                  icon="bolt" 
                  colorClass="bg-fuchsia-500"
                  loading={newsLoading}
                  data={newsResults}
                  onClick={() => changeView('news')}
                  onScan={handleNewsScan}
                  summary={
                    newsResults && (
                      <div>
                        <div className="text-3xl font-black text-fuchsia-600">
                          {newsResults.length} <span className="text-sm text-slate-400 font-bold">則</span>
                        </div>
                        <p className="text-xs font-bold text-slate-400">熱門題材與籌碼動向</p>
                      </div>
                    )
                  }
               />
            </div>
          </div>
        )}

        {/* --- LONG TERM VIEW --- */}
        {view === 'longTerm' && (
          <div className="space-y-10 animate-in slide-in-from-bottom-6 duration-700">
             <div className="bg-gradient-to-br from-amber-500 via-amber-600 to-amber-900 text-white p-12 rounded-[40px] shadow-2xl relative overflow-hidden border border-amber-400/30">
                <div className="absolute top-0 right-0 p-12 opacity-10 rotate-12">
                  <i className="fas fa-crown text-[260px]"></i>
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-6">
                    <span className="bg-white/20 backdrop-blur-md text-white px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-[0.2em] border border-white/30">
                      PREMIUM STRATEGY
                    </span>
                    <span className="bg-amber-400 text-amber-950 px-3 py-1.5 rounded-full text-[10px] font-black uppercase">
                      高勝率回測
                    </span>
                  </div>
                  <h2 className="text-5xl font-black mb-8 tracking-tight">長予投資：金選標的清單</h2>
                  
                  <div className="mt-8 max-w-3xl">
                    <div className="space-y-6">
                      <p className="text-amber-50 text-lg leading-relaxed font-medium">
                        篩選「月線趨勢向上且糾結」的多頭軌道股，並在「日線回測生命線」時進場。這是專為穩健投資者設計的長線保護短線策略。
                      </p>
                      <div className="flex flex-wrap gap-3">
                          <span className="px-3 py-1.5 rounded-lg bg-amber-900/50 border border-amber-400/30 text-amber-200 text-sm font-bold flex items-center">
                            <i className="fas fa-check-circle mr-2 text-amber-400"></i> 月線收斂糾結
                          </span>
                          <span className="px-3 py-1.5 rounded-lg bg-amber-900/50 border border-amber-400/30 text-amber-200 text-sm font-bold flex items-center">
                            <i className="fas fa-check-circle mr-2 text-amber-400"></i> 日線回測生命線
                          </span>
                          <span className="px-3 py-1.5 rounded-lg bg-amber-900/50 border border-amber-400/30 text-amber-200 text-sm font-bold flex items-center">
                            <i className="fas fa-check-circle mr-2 text-amber-400"></i> 散戶人數下降
                          </span>
                      </div>
                    </div>
                  </div>
                </div>
             </div>

             <div className="space-y-6">
                <div className="flex justify-between items-end px-4">
                   <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                     <span className="w-12 h-1 bg-amber-500 rounded-full"></span>
                     符合長予策略標的 ({filteredLongTermTargets.length})
                   </h3>
                </div>

                {longTermLoading ? (
                  <div className="bg-white rounded-[40px] border border-slate-200 py-32 text-center">
                    <div className="relative inline-block mb-6">
                      <i className="fas fa-globe-asia text-5xl text-amber-500 opacity-20"></i>
                      <i className="fas fa-circle-notch fa-spin absolute inset-0 text-5xl text-amber-500"></i>
                    </div>
                    <p className="text-slate-800 font-black text-xl">正在掃描全市場...</p>
                  </div>
                ) : !longTermResults ? (
                  <div className="bg-white rounded-[40px] border-2 border-dashed border-slate-200 py-32 text-center">
                    <i className="fas fa-rocket text-4xl text-slate-200 mb-6"></i>
                    <p className="text-slate-500 font-black text-xl">尚未啟動掃描</p>
                    <button onClick={() => changeView('dashboard')} className="mt-4 text-amber-600 font-bold hover:underline">前往戰情室啟動</button>
                  </div>
                ) : filteredLongTermTargets.length === 0 ? (
                  <div className="bg-white rounded-[40px] border-2 border-dashed border-slate-200 py-32 text-center">
                    <i className="fas fa-magnifying-glass text-4xl text-slate-200 mb-6"></i>
                    <p className="text-slate-500 font-black text-xl">目前查無符合標的</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {filteredLongTermTargets.map(s => {
                      const retailDiff = s.retailCountCurrent - s.retailCountPrevious;
                      const isDecreasing = s.isRetailDecreasing;
                      return (
                        <div key={s.ticker} className={`bg-gradient-to-br from-white to-amber-50/30 border-2 rounded-[32px] p-8 hover:shadow-2xl transition-all duration-500 group relative overflow-hidden ${isDecreasing ? 'border-amber-400 ring-4 ring-amber-100' : 'border-slate-200 hover:border-amber-300'}`}>
                          {isDecreasing && (
                            <div className="absolute top-0 right-0 bg-amber-600 text-white text-[9px] font-black px-5 py-1.5 rounded-bl-2xl uppercase tracking-tighter shadow-lg">
                              <i className="fas fa-fire mr-1"></i> Smart Money Choice
                            </div>
                          )}
                          <div className="flex justify-between items-start mb-8">
                             <div>
                               <h4 className="text-3xl font-black text-slate-800 group-hover:text-amber-700 transition-colors">{s.name}</h4>
                               <p className="text-sm text-slate-400 font-mono font-bold tracking-[0.2em]">{s.ticker}</p>
                             </div>
                             <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${isDecreasing ? 'bg-amber-500 text-white rotate-6' : 'bg-slate-900 text-white'}`}>
                               <i className={`fas ${isDecreasing ? 'fa-medal' : 'fa-chart-line'} text-2xl`}></i>
                             </div>
                          </div>
                          <div className="space-y-4 mb-8">
                            <div className={`p-4 rounded-2xl border ${isDecreasing ? 'bg-amber-100/50 border-amber-200 shadow-inner' : 'bg-slate-50 border-slate-100'}`}>
                              <p className="text-[10px] font-black text-slate-500 uppercase mb-1">籌碼面：散戶 (&lt;50張) 動向</p>
                              <div className="flex items-end gap-2">
                                <span className={`text-2xl font-black ${isDecreasing ? 'text-amber-700' : 'text-slate-800'}`}>{retailDiff > 0 ? '+' : ''}{retailDiff.toLocaleString()}人</span>
                                <span className="text-[10px] font-bold text-slate-400 mb-1">{((retailDiff / s.retailCountPrevious) * 100).toFixed(1)}%</span>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-white p-4 rounded-2xl border border-slate-100 text-center flex flex-col justify-center min-h-[90px] shadow-sm">
                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-2">月線篩選 (趨勢)</p>
                                <p className="text-xs font-black text-amber-600 leading-tight px-1">{s.monthlyTrendDesc || '符合收斂向上'}</p>
                              </div>
                              <div className="bg-white p-4 rounded-2xl border border-slate-100 text-center flex flex-col justify-center min-h-[90px] shadow-sm">
                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-2">日線篩選 (買點)</p>
                                <p className="text-xs font-black text-blue-600 leading-tight px-1">{s.dailyPullbackDesc || '回測支撐有守'}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
             </div>
          </div>
        )}

        {/* --- FINANCIAL SCANNER VIEW --- */}
        {view === 'scanner' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-700">
             {/* Strategy Header Block */}
             <div className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-900 text-white p-12 rounded-[40px] shadow-2xl relative overflow-hidden border border-emerald-400/30">
                <div className="absolute top-0 right-0 p-12 opacity-10 -rotate-12">
                  <i className="fas fa-sack-dollar text-[260px]"></i>
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-6">
                    <span className="bg-white/20 backdrop-blur-md text-white px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-[0.2em] border border-white/30">
                      VALUE INVESTING
                    </span>
                    <span className="bg-emerald-400 text-emerald-950 px-3 py-1.5 rounded-full text-[10px] font-black uppercase">
                      穩定配息
                    </span>
                  </div>
                  <h2 className="text-5xl font-black mb-8 tracking-tight">金融板塊：估值河流圖掃描</h2>
                  
                  <div className="mt-8 max-w-3xl">
                    <div className="space-y-6">
                      <p className="text-emerald-50 text-lg leading-relaxed font-medium">
                        運用「本淨比 (PB Ratio) 河流圖」技術，自動過濾出目前股價處於歷史低檔區間，且具備長期穩定獲利與配息能力的優質金融股。
                      </p>
                      <div className="flex flex-wrap gap-3">
                          <span className="px-3 py-1.5 rounded-lg bg-emerald-900/50 border border-emerald-400/30 text-emerald-200 text-sm font-bold flex items-center">
                            <i className="fas fa-arrow-down mr-2 text-emerald-400"></i> 股價 &lt; PB 25分位 (便宜)
                          </span>
                          <span className="px-3 py-1.5 rounded-lg bg-emerald-900/50 border border-emerald-400/30 text-emerald-200 text-sm font-bold flex items-center">
                            <i className="fas fa-history mr-2 text-emerald-400"></i> 連續配息 &gt; 5年
                          </span>
                          <span className="px-3 py-1.5 rounded-lg bg-emerald-900/50 border border-emerald-400/30 text-emerald-200 text-sm font-bold flex items-center">
                            <i className="fas fa-chart-line mr-2 text-emerald-400"></i> ROE 穩定成長
                          </span>
                      </div>
                    </div>
                  </div>
                </div>
             </div>

             <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                 <div className="bg-slate-900 px-6 py-5 border-b border-slate-800 flex justify-between items-center">
                   <h3 className="text-white font-black text-lg">金融板塊估值清單</h3>
                   {sortedFinancialResults && (
                     <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-3 py-1.5 rounded-full border border-emerald-400/20 uppercase">
                       綠區標的：{sortedFinancialResults.filter(s => s.isGreenZone).length} 檔
                     </span>
                   )}
                 </div>
                 <div className="overflow-x-auto">
                   {financialLoading ? (
                     <div className="text-center py-20">
                       <i className="fas fa-circle-notch fa-spin text-3xl text-emerald-600 mb-4"></i>
                       <p className="font-bold text-slate-500">掃描金融股中...</p>
                     </div>
                   ) : !sortedFinancialResults ? (
                     <div className="text-center py-20">
                        <button onClick={() => changeView('dashboard')} className="font-bold text-blue-600 hover:underline">請至戰情室啟動掃描</button>
                     </div>
                   ) : (
                     <table className="w-full text-left">
                      <thead className="bg-slate-50">
                        <tr className="border-b border-slate-100">
                          <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">標的</th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">現價</th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">PB</th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">ROE</th>
                          <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase text-right">估值位階</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {sortedFinancialResults.map(s => (
                          <tr key={s.ticker} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${s.isGreenZone ? 'bg-emerald-50 border-l-4 border-l-emerald-500' : ''}`}>
                            <td className="px-6 py-4 font-bold">
                              <div className="flex items-center gap-2">
                                 {s.isGreenZone && <i className="fas fa-check-circle text-emerald-500 text-lg"></i>}
                                 <div>
                                   {s.name} <span className="text-xs text-slate-400 font-mono ml-1">{s.ticker}</span>
                                   {s.isGreenZone && <span className="block text-[9px] text-emerald-600 font-black uppercase tracking-wider">便宜區間</span>}
                                 </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 font-mono font-bold text-slate-600">${s.currentPrice}</td>
                            <td className="px-6 py-4 font-mono font-bold text-slate-600">{s.currentPB.toFixed(2)}x</td>
                            <td className="px-6 py-4 font-mono font-bold text-emerald-600">{s.roe}%</td>
                            <td className="px-6 py-4 text-right">
                              {s.isGreenZone ? (
                                <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide">
                                  <i className="fas fa-arrow-down"></i> 低檔便宜
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-600 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide">
                                  <i className="fas fa-minus"></i> 合理/偏高
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                     </table>
                   )}
                 </div>
              </div>
          </div>
        )}

        {/* --- MARKET GUIDE VIEW --- */}
        {view === 'market' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-700">
             {/* Strategy Header Block */}
             <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 text-white p-12 rounded-[40px] shadow-2xl relative overflow-hidden border border-indigo-400/30">
                <div className="absolute top-0 right-0 p-12 opacity-10 rotate-12">
                  <i className="fas fa-chart-area text-[260px]"></i>
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-6">
                    <span className="bg-white/20 backdrop-blur-md text-white px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-[0.2em] border border-white/30">
                      MACRO ANALYSIS
                    </span>
                    <span className="bg-indigo-400 text-indigo-950 px-3 py-1.5 rounded-full text-[10px] font-black uppercase">
                      位階判斷
                    </span>
                  </div>
                  <h2 className="text-5xl font-black mb-8 tracking-tight">大盤指南：趨勢與乖離分析</h2>
                  
                  <div className="mt-8 max-w-3xl">
                    <div className="space-y-6">
                      <p className="text-indigo-50 text-lg leading-relaxed font-medium">
                        監控大盤與核心 ETF 的均線乖離率 (Bias)，判斷市場目前是處於「過熱風險區」、「合理支撐區」還是「恐慌超跌區」。
                      </p>
                      <div className="flex flex-wrap gap-3">
                          <span className="px-3 py-1.5 rounded-lg bg-indigo-900/50 border border-indigo-400/30 text-indigo-200 text-sm font-bold flex items-center">
                            <i className="fas fa-ruler-vertical mr-2 text-indigo-400"></i> 季線乖離 (60MA Bias)
                          </span>
                          <span className="px-3 py-1.5 rounded-lg bg-indigo-900/50 border border-indigo-400/30 text-indigo-200 text-sm font-bold flex items-center">
                            <i className="fas fa-shield-halved mr-2 text-indigo-400"></i> 季線/年線支撐
                          </span>
                          <span className="px-3 py-1.5 rounded-lg bg-indigo-900/50 border border-indigo-400/30 text-indigo-200 text-sm font-bold flex items-center">
                            <i className="fas fa-gauge-high mr-2 text-indigo-400"></i> 過熱/崩盤指標
                          </span>
                      </div>
                    </div>
                  </div>
                </div>
             </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-500">
              {marketLoading ? (
                <div className="col-span-full text-center py-20">
                  <i className="fas fa-circle-notch fa-spin text-3xl text-indigo-600 mb-4"></i>
                  <p className="font-bold text-slate-500">分析大盤數據中...</p>
                </div>
              ) : !marketResults ? (
                 <div className="col-span-full text-center py-20">
                   <button onClick={() => changeView('dashboard')} className="font-bold text-blue-600 hover:underline">請至戰情室啟動分析</button>
                 </div>
              ) : (
                marketResults.map(m => (
                  <div key={m.ticker} className="bg-white p-8 rounded-3xl shadow-md border border-slate-200 flex flex-col group">
                    <div className="flex justify-between items-start mb-8">
                      <div className="flex items-center gap-5">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white ${getMarketStatusStyle(m.status)}`}>
                          <i className={`fas ${m.status === 'crisis_buy' ? 'fa-gem' : m.status === 'bull_pullback' ? 'fa-anchor' : 'fa-binoculars'} text-3xl`}></i>
                        </div>
                        <div>
                          <h3 className="text-2xl font-black text-slate-800">{m.name}</h3>
                          <p className="text-sm text-slate-400 font-mono uppercase">{m.ticker}</p>
                        </div>
                      </div>
                      <div className={`px-4 py-2 rounded-xl text-xs font-black uppercase ${getMarketStatusStyle(m.status)}`}>
                        {getMarketStatusLabel(m.status, m.deviationFromQuarterly)}
                      </div>
                    </div>
                    <PriceLevelGauge level={m.priceLevel} />
                    <div className="mt-8 bg-slate-900 text-white p-6 rounded-2xl flex-grow shadow-inner">
                      <p className="font-bold text-lg mb-4 text-indigo-50">{m.signal}</p>
                      <p className="text-xs text-slate-400 leading-relaxed italic opacity-80 border-t border-slate-800 pt-4">
                        {m.description}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* --- NEWS VIEW --- */}
        {view === 'news' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* Strategy Header Block */}
            <div className="bg-gradient-to-br from-fuchsia-700 via-purple-700 to-purple-900 text-white p-12 rounded-[40px] shadow-2xl relative overflow-hidden border border-fuchsia-400/30">
               <div className="absolute top-0 right-0 p-12 opacity-10 rotate-12">
                 <i className="fas fa-bolt text-[260px]"></i>
               </div>
               <div className="relative z-10">
                 <div className="flex items-center gap-3 mb-6">
                   <span className="bg-white/20 backdrop-blur-md text-white px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-[0.2em] border border-white/30">
                     MARKET INSIGHTS
                   </span>
                   <span className="bg-fuchsia-400 text-fuchsia-950 px-3 py-1.5 rounded-full text-[10px] font-black uppercase">
                     熱門題材
                   </span>
                 </div>
                 <h2 className="text-4xl md:text-5xl font-black mb-6 tracking-tight">市場熱度 & 題材炒作</h2>
                 
                 <div className="mt-8 max-w-3xl">
                    <div className="space-y-6">
                      <p className="text-fuchsia-50 text-lg leading-relaxed font-medium">
                        「風口來了，豬都會飛。」系統自動蒐集市場中討論度最高、資金流入最明顯的題材與八卦，捕捉短線爆發力強的炒作標的。
                      </p>
                      <div className="flex flex-wrap gap-3">
                          <span className="px-3 py-1.5 rounded-lg bg-fuchsia-900/50 border border-fuchsia-400/30 text-fuchsia-200 text-sm font-bold flex items-center">
                            <i className="fas fa-users mr-2 text-fuchsia-400"></i> 社群討論熱度
                          </span>
                          <span className="px-3 py-1.5 rounded-lg bg-fuchsia-900/50 border border-fuchsia-400/30 text-fuchsia-200 text-sm font-bold flex items-center">
                            <i className="fas fa-coins mr-2 text-fuchsia-400"></i> 法人/主力籌碼
                          </span>
                          <span className="px-3 py-1.5 rounded-lg bg-fuchsia-900/50 border border-fuchsia-400/30 text-fuchsia-200 text-sm font-bold flex items-center">
                            <i className="fas fa-bullhorn mr-2 text-fuchsia-400"></i> 題材爆發力
                          </span>
                      </div>
                    </div>
                  </div>
               </div>
            </div>

            {newsLoading ? (
               <div className="text-center py-20">
                 <div className="inline-block relative">
                   <i className="fas fa-bolt text-6xl text-slate-200"></i>
                   <i className="fas fa-circle-notch fa-spin text-2xl text-fuchsia-500 absolute -bottom-2 -right-2 bg-white rounded-full"></i>
                 </div>
                 <p className="mt-4 text-slate-500 font-bold">正在蒐集內線八卦與市場題材...</p>
               </div>
            ) : !newsResults ? (
               <div className="text-center py-24 opacity-60">
                 <p className="text-slate-500 font-black text-xl mb-2">尚未蒐集</p>
                 <button onClick={() => changeView('dashboard')} className="text-fuchsia-600 font-bold hover:underline">返回戰情室啟動搜集</button>
               </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {newsResults.map((item, idx) => (
                  <div key={idx} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group flex flex-col relative overflow-hidden">
                    <div className={`absolute top-0 left-0 w-1 h-full ${
                      item.sentiment === 'positive' ? 'bg-emerald-500' : 
                      item.sentiment === 'negative' ? 'bg-rose-500' : 'bg-slate-300'
                    }`}></div>
                    
                    <div className="flex justify-between items-start mb-4 pl-3">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        item.category === 'Hype' ? 'bg-fuchsia-100 text-fuchsia-700' :
                        item.category === 'Chips' ? 'bg-amber-100 text-amber-700' :
                        item.category === 'Community' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {item.category === 'Hype' ? <><i className="fas fa-fire mr-1"></i>題材炒作</> :
                         item.category === 'Chips' ? <><i className="fas fa-coins mr-1"></i>籌碼動向</> :
                         item.category === 'Community' ? <><i className="fas fa-users mr-1"></i>社群熱議</> :
                         item.category}
                      </span>
                      {item.sentiment === 'positive' && <i className="fas fa-bullhorn text-emerald-500 text-lg animate-pulse"></i>}
                    </div>
                    
                    <h3 className="text-lg font-black text-slate-800 mb-3 leading-snug pl-3 group-hover:text-fuchsia-700 transition-colors">
                      {item.title}
                    </h3>
                    
                    <div className="pl-3 mb-4">
                      <p className="text-slate-500 text-sm leading-relaxed border-l-2 border-slate-100 pl-3 italic">
                        "{item.summary}"
                      </p>
                    </div>

                    <div className="pl-3 flex flex-wrap gap-2 mb-6">
                      {item.keywords?.map((kw, i) => (
                        <span key={i} className="text-[10px] font-bold bg-slate-50 text-slate-400 px-2 py-1 rounded border border-slate-100">
                          #{kw}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
