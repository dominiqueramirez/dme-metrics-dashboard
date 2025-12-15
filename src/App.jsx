import React, { useState, useCallback } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, ComposedChart, Area } from 'recharts';
import Papa from 'papaparse';

const DMEDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [rawData, setRawData] = useState(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedGoalYear, setSelectedGoalYear] = useState(null);
  const [goalChartView, setGoalChartView] = useState('cumulative'); // 'cumulative' or 'monthly'
  // FY selectors for different sections
  const [selectedChannelYear, setSelectedChannelYear] = useState(null);
  const [selectedSeasonalityYear, setSelectedSeasonalityYear] = useState(null);
  const [selectedPerformanceYear, setSelectedPerformanceYear] = useState(null);
  const [selectedProjectionYear, setSelectedProjectionYear] = useState(null);
  const dragCounter = React.useRef(0);

  // Parse CSV file
  const parseCSVFile = useCallback((file) => {
    if (file && file.name.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        complete: (results) => {
          setRawData(results.data.filter(row => row.FiscalYear));
          setDataLoaded(true);
        }
      });
    }
  }, []);

  const handleFileUpload = useCallback((event) => {
    const file = event.target.files[0];
    parseCSVFile(file);
  }, [parseCSVFile]);

  // Drag and drop handlers with counter to prevent flickering
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    
    const file = e.dataTransfer.files[0];
    parseCSVFile(file);
  }, [parseCSVFile]);

  // Process raw data into dashboard-ready formats
  const processData = useCallback(() => {
    if (!rawData) return null;

    const fiscalYears = [...new Set(rawData.map(r => parseInt(r.FiscalYear)))].sort();
    const currentFY = Math.max(...fiscalYears);
    const previousFY = currentFY - 1;

    const yearlyTotals = {};
    fiscalYears.forEach(fy => {
      const fyData = rawData.filter(r => parseInt(r.FiscalYear) === fy);
      yearlyTotals[fy] = {
        vaGov: fyData.reduce((sum, r) => sum + (parseInt(r.VA_Gov_PageVisits) || 0), 0),
        video: fyData.reduce((sum, r) => sum + (parseInt(r.Video_Views) || 0), 0),
        vaNews: fyData.reduce((sum, r) => sum + (parseInt(r.VA_News_PageViews) || 0), 0),
        podcast: fyData.reduce((sum, r) => sum + (parseInt(r.Podcast_Downloads) || 0), 0),
      };
      yearlyTotals[fy].total = yearlyTotals[fy].vaGov + yearlyTotals[fy].video + yearlyTotals[fy].vaNews + yearlyTotals[fy].podcast;
    });

    const yearlyData = fiscalYears.filter(fy => fy < currentFY).map(fy => ({
      year: `FY${fy.toString().slice(-2)}`,
      vaGov: yearlyTotals[fy].vaGov / 1000000,
      video: yearlyTotals[fy].video / 1000000,
      vaNews: yearlyTotals[fy].vaNews / 1000000,
      podcast: yearlyTotals[fy].podcast / 1000000,
      total: yearlyTotals[fy].total / 1000000,
    }));

    const previousYearBaseline = yearlyTotals[previousFY]?.total || 0;
    const monthlyPct = 1.03 / 12;

    const monthAbbrevs = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
    const currentFYData = rawData.filter(r => parseInt(r.FiscalYear) === currentFY);
    
    let cumulative = 0;
    const goalTracking = monthAbbrevs.map((month, idx) => {
      const monthData = currentFYData.find(r => parseInt(r.MonthNum) === idx + 1);
      const monthTotal = monthData ? (parseInt(monthData.Total) || 0) : 0;
      cumulative += monthTotal;
      const hasData = monthTotal > 0;
      
      return {
        month,
        monthNum: idx + 1,
        goal: Math.round(previousYearBaseline * monthlyPct * (idx + 1)),
        actual: hasData ? cumulative : null,
        hasData,
        monthlyTotal: monthTotal,
        vaGov: monthData ? (parseInt(monthData.VA_Gov_PageVisits) || 0) / 1000000 : 0,
        video: monthData ? (parseInt(monthData.Video_Views) || 0) / 1000000 : 0,
        vaNews: monthData ? (parseInt(monthData.VA_News_PageViews) || 0) / 1000000 : 0,
        podcast: monthData ? (parseInt(monthData.Podcast_Downloads) || 0) / 1000000 : 0,
      };
    });

    const goalData = fiscalYears.filter(fy => fy > fiscalYears[0] && fy < currentFY).map(fy => {
      const prevTotal = yearlyTotals[fy - 1]?.total || 0;
      const goal = prevTotal * 1.03;
      const actual = yearlyTotals[fy].total;
      return {
        year: `FY${fy.toString().slice(-2)}`,
        actual: actual / 1000000,
        goal: goal / 1000000,
        pct: Math.round((actual / goal) * 100),
      };
    });

    const currentMonth = goalTracking.filter(m => m.hasData).slice(-1)[0];
    const currentYTD = currentMonth?.actual || 0;
    const currentGoal = currentMonth?.goal || 0;
    const pctOfGoal = currentGoal ? ((currentYTD / currentGoal) * 100).toFixed(1) : 0;
    const aheadBehind = currentYTD - currentGoal;

    const currentFYMonthly = goalTracking.filter(m => m.hasData).map(m => ({
      month: m.month,
      vaGov: m.vaGov,
      video: m.video,
      vaNews: m.vaNews,
      podcast: m.podcast,
      total: m.monthlyTotal / 1000000,
    }));

    // Generate goal tracking data for ALL fiscal years (except the first one which has no baseline)
    const allYearsGoalTracking = {};
    fiscalYears.filter(fy => fy > fiscalYears[0]).forEach(fy => {
      const fyData = rawData.filter(r => parseInt(r.FiscalYear) === fy);
      const baselineYear = fy - 1;
      const baseline = yearlyTotals[baselineYear]?.total || 0;
      const fyMonthlyPct = 1.03 / 12;
      
      let fyCumulative = 0;
      allYearsGoalTracking[fy] = monthAbbrevs.map((month, idx) => {
        const monthData = fyData.find(r => parseInt(r.MonthNum) === idx + 1);
        const monthTotal = monthData ? (parseInt(monthData.Total) || 0) : 0;
        fyCumulative += monthTotal;
        const hasData = monthTotal > 0;
        
        // Parse individual channel data
        const vaGov = monthData ? (parseInt(monthData.VA_Gov_PageVisits) || 0) / 1000000 : 0;
        const video = monthData ? (parseInt(monthData.Video_Views) || 0) / 1000000 : 0;
        const vaNews = monthData ? (parseInt(monthData.VA_News_PageViews) || 0) / 1000000 : 0;
        const podcast = monthData ? (parseInt(monthData.Podcast_Downloads) || 0) / 1000000 : 0;
        
        return {
          month,
          monthNum: idx + 1,
          goal: Math.round(baseline * fyMonthlyPct * (idx + 1)),
          actual: hasData ? fyCumulative : null,
          hasData,
          monthlyTotal: monthTotal,
          vaGov,
          video,
          vaNews,
          podcast,
        };
      });
    });

    return {
      yearlyData,
      goalTracking,
      goalData,
      currentFYMonthly,
      previousYearBaseline,
      currentYearGoal: Math.round(previousYearBaseline * 1.03),
      currentYTD,
      currentGoal,
      pctOfGoal,
      aheadBehind,
      currentFY,
      previousFY,
      monthsComplete: goalTracking.filter(m => m.hasData).length,
      yearlyTotals,
      allYearsGoalTracking,
      fiscalYears: fiscalYears.filter(fy => fy > fiscalYears[0]),
    };
  }, [rawData]);

  const data = processData();

  // Set default selected year when data loads
  React.useEffect(() => {
    if (data?.currentFY && selectedGoalYear === null) {
      setSelectedGoalYear(data.currentFY);
    }
  }, [data?.currentFY, selectedGoalYear]);

  // Use processed data only (no fallback)
  const yearlyData = data?.yearlyData || [];
  const goalData = data?.goalData || [];
  const availableFiscalYears = data?.fiscalYears || [];
  const fiscalYears = availableFiscalYears; // Alias for convenience
  const allYearsGoalTracking = data?.allYearsGoalTracking || {};
  const fy26GoalTracking = data?.goalTracking || [];
  const currentMonth = fy26GoalTracking.filter(m => m.hasData).slice(-1)[0] || {};
  const pctOfGoal = data?.pctOfGoal || '0';
  const aheadBehind = data?.aheadBehind || 0;
  const previousYearBaseline = data?.previousYearBaseline || 0;
  const currentYearGoal = data?.currentYearGoal || 0;
  const currentFY = data?.currentFY || 'XX';
  const previousFY = data?.previousFY || 'XX';
  const currentFYMonthly = data?.currentFYMonthly || [];

  const videoPlatforms = [
    { name: 'YouTube', value: 56.3, color: '#FF0000' },
    { name: 'Facebook', value: 10.4, color: '#1877F2' },
    { name: 'Instagram', value: 4.2, color: '#E4405F' },
    { name: 'Twitter/X', value: 0.7, color: '#000000' },
  ];

  const formatMillions = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num;
  };

  const formatWithCommas = (num) => num?.toLocaleString() || '-';

  // Info tooltip component for explaining metrics
  const InfoTooltip = ({ text }) => (
    <div className="relative inline-block ml-1 group">
      <span className="inline-flex items-center justify-center w-4 h-4 text-xs font-bold text-gray-500 bg-gray-200 rounded-full cursor-help hover:bg-blue-500 hover:text-white transition-colors">
        i
      </span>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs text-white bg-gray-800 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 w-64 z-50 shadow-lg">
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
      </div>
    </div>
  );

  const MetricCard = ({ title, value, subtitle, trend, color = 'blue', info }) => (
    <div className={`bg-white rounded-lg shadow p-4 border-l-4 ${color === 'green' ? 'border-green-500' : color === 'red' ? 'border-red-500' : color === 'purple' ? 'border-purple-500' : 'border-blue-500'}`}>
      <p className="text-sm text-gray-500 uppercase tracking-wide">
        {title}
        {info && <InfoTooltip text={info} />}
      </p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      {subtitle && <p className="text-sm text-gray-600">{subtitle}</p>}
      {trend && (
        <p className={`text-sm ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
          {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}% vs prior year
        </p>
      )}
    </div>
  );

  // Section header with info tooltip
  const SectionHeader = ({ title, info, children }) => (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
      <h2 className="text-xl font-semibold flex items-center">
        {title}
        {info && <InfoTooltip text={info} />}
      </h2>
      {children}
    </div>
  );

  const GoalTrackingTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const goalVal = payload.find(p => p.dataKey === 'goal')?.value;
      const actualVal = payload.find(p => p.dataKey === 'actual')?.value;
      const diff = actualVal ? actualVal - goalVal : null;
      
      return (
        <div className="bg-white p-3 border border-gray-200 rounded shadow-lg">
          <p className="font-semibold text-gray-800">{label}</p>
          <p className="text-gray-600">Goal: {formatWithCommas(goalVal)}</p>
          {actualVal && (
            <>
              <p className="text-blue-600">Actual: {formatWithCommas(actualVal)}</p>
              <p className={diff >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                {diff >= 0 ? '+' : ''}{formatWithCommas(diff)} ({((actualVal/goalVal)*100).toFixed(1)}%)
              </p>
            </>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div 
      className="min-h-screen bg-gray-100 p-4 relative"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag and Drop Overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-blue-600 bg-opacity-90 z-50 flex items-center justify-center rounded-lg">
          <div className="text-center text-white">
            <div className="text-6xl mb-4">📊</div>
            <p className="text-2xl font-bold">Drop your CSV file here</p>
            <p className="text-blue-200 mt-2">Release to upload and update the dashboard</p>
          </div>
        </div>
      )}
      
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 to-blue-700 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-white">VA Digital Media Engagement Dashboard</h1>
              <p className="text-blue-100 mt-1">Tracking engagement across VA.gov, Video, VA News, and Podcasts</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <label className={`${dataLoaded ? 'bg-green-100 text-green-700' : 'bg-white text-blue-700 hover:bg-blue-50'} font-medium px-4 py-2 rounded-lg cursor-pointer transition-colors`}>
                {dataLoaded ? '✓ CSV Loaded' : 'Upload CSV'}
                <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
              </label>
              <span className="text-blue-200 text-xs">
                {dataLoaded ? `Data through FY${currentFY}` : 'or drag & drop anywhere'}
              </span>
            </div>
          </div>
        </div>

        {/* Empty State - Show when no data loaded */}
        {!dataLoaded && (
          <div className="bg-white rounded-lg shadow-lg p-12 mb-6 border-2 border-dashed border-gray-300 text-center">
            <div className="text-6xl mb-4">📁</div>
            <h2 className="text-2xl font-bold text-gray-700 mb-2">No Data Loaded</h2>
            <p className="text-gray-500 mb-6">Upload your CSV file to view the dashboard</p>
            <div className="flex flex-col items-center gap-4">
              <label className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg cursor-pointer transition-colors">
                Choose CSV File
                <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
              </label>
              <p className="text-gray-400 text-sm">or drag & drop your file anywhere on this page</p>
            </div>
            <div className="mt-8 p-4 bg-gray-50 rounded-lg text-left max-w-md mx-auto">
              <p className="text-sm font-medium text-gray-600 mb-2">Expected CSV format:</p>
              <code className="text-xs text-gray-500 block">
                FiscalYear, Month, MonthNum, VA_Gov_PageVisits,<br/>
                Video_Views, VA_News_PageViews, Podcast_Downloads, Total
              </code>
            </div>
          </div>
        )}

        {/* Dashboard Content - Only show when data is loaded */}
        {dataLoaded && (
          <>
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6 border-2 border-blue-200">
          {(() => {
            // Calculate stats for the selected year
            const selectedData = selectedGoalYear ? allYearsGoalTracking[selectedGoalYear] || fy26GoalTracking : fy26GoalTracking;
            const selectedBaseline = selectedGoalYear ? (data?.yearlyTotals?.[selectedGoalYear - 1]?.total || 0) : previousYearBaseline;
            const selectedGoal = Math.round(selectedBaseline * 1.03);
            const selectedCurrentMonth = selectedData.filter(m => m.hasData).slice(-1)[0] || {};
            const selectedYTD = selectedCurrentMonth?.actual || 0;
            const selectedYTDGoal = selectedCurrentMonth?.goal || 0;
            const selectedPctOfGoal = selectedYTDGoal ? ((selectedYTD / selectedYTDGoal) * 100).toFixed(1) : '0';
            const selectedAheadBehind = selectedYTD - selectedYTDGoal;
            const isCurrentYear = selectedGoalYear === currentFY;
            const isCompleteYear = selectedData.filter(m => m.hasData).length === 12;
            
            // For complete years, show final stats
            const finalActual = isCompleteYear ? selectedData[11].actual : selectedYTD;
            const finalGoal = isCompleteYear ? selectedGoal : selectedYTDGoal;
            const finalPct = finalGoal ? ((finalActual / finalGoal) * 100).toFixed(1) : '0';
            const finalDiff = finalActual - finalGoal;
            
            return (
              <>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800 flex items-center">
                      FY{selectedGoalYear || currentFY} Goal Tracking
                      <InfoTooltip text="Tracks progress toward the annual engagement goal, which is set at 3% growth over the previous fiscal year's total. The gold line/area shows the cumulative goal, and blue bars show actual cumulative engagement." />
                    </h2>
                    <p className="text-gray-500 text-sm">
                      {goalChartView === 'cumulative' 
                        ? 'Cumulative progress vs. 3% annual growth target' 
                        : 'Monthly performance vs. monthly goal'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* View Toggle Switch */}
                    <div className="flex items-center bg-gray-100 rounded-lg p-1">
                      <button
                        onClick={() => setGoalChartView('cumulative')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                          goalChartView === 'cumulative'
                            ? 'bg-white text-blue-700 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        Cumulative
                      </button>
                      <button
                        onClick={() => setGoalChartView('monthly')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                          goalChartView === 'monthly'
                            ? 'bg-white text-blue-700 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        Monthly
                      </button>
                    </div>
                    <div className="text-right px-3 py-2 bg-gray-100 rounded-lg">
                      <p className="text-xs text-gray-500 uppercase">Monthly Target</p>
                      <p className="text-base font-bold text-gray-700">8.58%</p>
                    </div>
                    <div className={`text-right px-4 py-2 rounded-lg ${finalDiff >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                      <p className={`text-xl font-bold ${finalDiff >= 0 ? 'text-green-700' : 'text-red-700'}`}>{finalPct}%</p>
                      <p className={`text-xs ${finalDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {finalDiff >= 0 ? '+' : ''}{formatWithCommas(finalDiff)} vs goal
                      </p>
                    </div>
                  </div>
                </div>

                {/* Status Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <p className="text-xs text-gray-500 uppercase">FY{(selectedGoalYear || currentFY) - 1} Baseline</p>
                    <p className="text-lg font-bold text-gray-700">{formatWithCommas(selectedBaseline)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <p className="text-xs text-gray-500 uppercase">FY{selectedGoalYear || currentFY} Goal (103%)</p>
                    <p className="text-lg font-bold text-gray-700">{formatWithCommas(selectedGoal)}</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                    <p className="text-xs text-amber-600 uppercase">{isCompleteYear ? 'Final Goal' : 'YTD Goal'}</p>
                    <p className="text-lg font-bold text-amber-700">{formatWithCommas(finalGoal)}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                    <p className="text-xs text-blue-600 uppercase">{isCompleteYear ? 'Final Actual' : 'Current YTD Actual'}</p>
                    <p className="text-lg font-bold text-blue-700">{formatWithCommas(finalActual)}</p>
                  </div>
                </div>

                {/* Goal Tracking Chart */}
                {(() => {
                  // Calculate monthly goal (same for each month = annual goal / 12)
                  const monthlyGoal = Math.round(selectedGoal / 12);
                  
                  // Transform data for monthly view
                  const monthlyViewData = selectedData.map(m => ({
                    ...m,
                    monthlyGoal: monthlyGoal,
                    monthlyActual: m.hasData ? m.monthlyTotal : null,
                  }));
                  
                  const MonthlyTooltip = ({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const goalVal = payload.find(p => p.dataKey === 'monthlyGoal')?.value;
                      const actualVal = payload.find(p => p.dataKey === 'monthlyActual')?.value;
                      const diff = actualVal ? actualVal - goalVal : null;
                      
                      return (
                        <div className="bg-white p-3 border border-gray-200 rounded shadow-lg">
                          <p className="font-semibold text-gray-800">{label}</p>
                          <p className="text-gray-600">Monthly Goal: {formatWithCommas(goalVal)}</p>
                          {actualVal && (
                            <>
                              <p className="text-blue-600">Monthly Actual: {formatWithCommas(actualVal)}</p>
                              <p className={diff >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                                {diff >= 0 ? '+' : ''}{formatWithCommas(diff)} ({((actualVal/goalVal)*100).toFixed(1)}%)
                              </p>
                            </>
                          )}
                        </div>
                      );
                    }
                    return null;
                  };
                  
                  return (
                    <ResponsiveContainer width="100%" height={300}>
                      {goalChartView === 'cumulative' ? (
                        <ComposedChart data={selectedData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 12 }} />
                          <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} tick={{ fill: '#6b7280', fontSize: 12 }} domain={[0, 'auto']} />
                          <Tooltip content={<GoalTrackingTooltip />} />
                          <Legend />
                          <Area type="monotone" dataKey="goal" name="Cumulative Goal" fill="#fef3c7" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" />
                          <Bar dataKey="actual" name="Actual YTD" fill="#2563eb" radius={[4, 4, 0, 0]} />
                        </ComposedChart>
                      ) : (
                        <ComposedChart data={monthlyViewData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 12 }} />
                          <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} tick={{ fill: '#6b7280', fontSize: 12 }} domain={[0, 'auto']} />
                          <Tooltip content={<MonthlyTooltip />} />
                          <Legend />
                          <Line type="monotone" dataKey="monthlyGoal" name="Monthly Goal" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                          <Bar dataKey="monthlyActual" name="Monthly Actual" fill="#2563eb" radius={[4, 4, 0, 0]} />
                        </ComposedChart>
                      )}
                    </ResponsiveContainer>
                  );
                })()}

                {/* Goal Table */}
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="px-2 py-1 text-left text-gray-500">Month</th>
                        {selectedData.map(m => (
                          <th key={m.month} className={`px-2 py-1 text-center ${m.hasData ? 'text-blue-700 font-semibold' : 'text-gray-400'}`}>{m.month}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {goalChartView === 'cumulative' ? (
                        <>
                          <tr className="border-b border-gray-100 bg-amber-50">
                            <td className="px-2 py-1 text-amber-700 font-medium">Cum. Goal</td>
                            {selectedData.map(m => (
                              <td key={m.month} className="px-2 py-1 text-center text-amber-700">{(m.goal / 1000000).toFixed(1)}M</td>
                            ))}
                          </tr>
                          <tr className="bg-blue-50">
                            <td className="px-2 py-1 text-blue-700 font-medium">Cum. Actual</td>
                            {selectedData.map(m => (
                              <td key={m.month} className={`px-2 py-1 text-center font-semibold ${m.hasData ? 'text-blue-700' : 'text-gray-300'}`}>
                                {m.hasData ? `${(m.actual / 1000000).toFixed(1)}M` : '-'}
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <td className="px-2 py-1 text-gray-600">vs Goal</td>
                            {selectedData.map(m => {
                              if (!m.hasData) return <td key={m.month} className="px-2 py-1 text-center text-gray-300">-</td>;
                              const diff = ((m.actual / m.goal) * 100 - 100).toFixed(1);
                              const isPositive = parseFloat(diff) >= 0;
                              return (
                                <td key={m.month} className={`px-2 py-1 text-center font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                  {isPositive ? '+' : ''}{diff}%
                                </td>
                              );
                            })}
                          </tr>
                        </>
                      ) : (
                        <>
                          <tr className="border-b border-gray-100 bg-amber-50">
                            <td className="px-2 py-1 text-amber-700 font-medium">Mo. Goal</td>
                            {selectedData.map(m => (
                              <td key={m.month} className="px-2 py-1 text-center text-amber-700">{(selectedGoal / 12 / 1000000).toFixed(1)}M</td>
                            ))}
                          </tr>
                          <tr className="bg-blue-50">
                            <td className="px-2 py-1 text-blue-700 font-medium">Mo. Actual</td>
                            {selectedData.map(m => (
                              <td key={m.month} className={`px-2 py-1 text-center font-semibold ${m.hasData ? 'text-blue-700' : 'text-gray-300'}`}>
                                {m.hasData ? `${(m.monthlyTotal / 1000000).toFixed(1)}M` : '-'}
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <td className="px-2 py-1 text-gray-600">vs Goal</td>
                            {selectedData.map(m => {
                              if (!m.hasData) return <td key={m.month} className="px-2 py-1 text-center text-gray-300">-</td>;
                              const monthlyGoal = selectedGoal / 12;
                              const diff = ((m.monthlyTotal / monthlyGoal) * 100 - 100).toFixed(1);
                              const isPositive = parseFloat(diff) >= 0;
                              return (
                                <td key={m.month} className={`px-2 py-1 text-center font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                  {isPositive ? '+' : ''}{diff}%
                                </td>
                              );
                            })}
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Fiscal Year Tabs */}
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-gray-500 mr-2">Select Fiscal Year:</span>
                    {[...availableFiscalYears].reverse().map(fy => (
                      <button
                        key={fy}
                        onClick={() => setSelectedGoalYear(fy)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          selectedGoalYear === fy
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        FY{fy.toString().slice(-2)}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            );
          })()}
        </div>

        {/* Annual Baseline Trend Chart */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-800 flex items-center">
                Annual Baseline Trend
                <InfoTooltip text="Shows total engagement for each completed fiscal year. Each year's total becomes the baseline for calculating the next year's 3% growth goal. Green indicates highest year, red indicates lowest." />
              </h2>
              <p className="text-gray-500 text-sm">Total engagement by fiscal year (used as baseline for next year's goal)</p>
            </div>
          </div>
          
          {(() => {
            // Build baseline data from yearlyTotals
            const baselineData = availableFiscalYears.map(fy => {
              const baseline = data?.yearlyTotals?.[fy - 1]?.total || 0;
              const actual = data?.yearlyTotals?.[fy]?.total || 0;
              return {
                year: `FY${(fy - 1).toString().slice(-2)}`,
                fy: fy - 1,
                baseline: baseline,
                baselineM: baseline / 1000000,
              };
            });
            
            // Add the most recent complete year if not already included
            const allYears = [...new Set(baselineData.map(d => d.fy))].sort();
            const latestFY = data?.currentFY;
            if (latestFY && data?.yearlyTotals?.[latestFY - 1]) {
              const lastBaseline = baselineData.find(d => d.fy === latestFY - 1);
              if (!lastBaseline) {
                baselineData.push({
                  year: `FY${(latestFY - 1).toString().slice(-2)}`,
                  fy: latestFY - 1,
                  baseline: data.yearlyTotals[latestFY - 1].total,
                  baselineM: data.yearlyTotals[latestFY - 1].total / 1000000,
                });
              }
            }
            
            // Sort by fiscal year
            baselineData.sort((a, b) => a.fy - b.fy);
            
            // Calculate year-over-year growth
            const baselineWithGrowth = baselineData.map((d, idx) => {
              const prevBaseline = idx > 0 ? baselineData[idx - 1].baseline : null;
              const growth = prevBaseline ? ((d.baseline - prevBaseline) / prevBaseline * 100).toFixed(1) : null;
              return { ...d, growth };
            });
            
            // Find min and max for highlighting
            const values = baselineWithGrowth.map(d => d.baseline).filter(v => v > 0);
            const maxBaseline = Math.max(...values);
            const minBaseline = Math.min(...values);
            
            return (
              <>
                <ResponsiveContainer width="100%" height={250}>
                  <ComposedChart data={baselineWithGrowth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="year" tick={{ fill: '#6b7280', fontSize: 12 }} />
                    <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} tick={{ fill: '#6b7280', fontSize: 12 }} domain={[0, 'auto']} />
                    <Tooltip 
                      formatter={(value, name) => [formatWithCommas(value), 'Total Engagement']}
                      labelFormatter={(label) => `${label} Baseline`}
                    />
                    <Bar dataKey="baseline" name="Annual Total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="baseline" stroke="#1e40af" strokeWidth={2} dot={{ fill: '#1e40af', r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
                
                {/* Growth Stats */}
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {baselineWithGrowth.map((d, idx) => (
                    <div 
                      key={d.year} 
                      className={`p-3 rounded-lg border ${
                        d.baseline === maxBaseline 
                          ? 'bg-green-50 border-green-200' 
                          : d.baseline === minBaseline 
                            ? 'bg-red-50 border-red-200' 
                            : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <p className="text-xs text-gray-500 uppercase">{d.year}</p>
                      <p className="text-lg font-bold text-gray-800">{(d.baseline / 1000000).toFixed(1)}M</p>
                      {d.growth && (
                        <p className={`text-xs font-medium ${parseFloat(d.growth) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {parseFloat(d.growth) >= 0 ? '↑' : '↓'} {Math.abs(parseFloat(d.growth))}% YoY
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-2 mb-6 flex-wrap gap-2">
          {['overview', 'channels', 'seasonality', 'performance', 'projections'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === tab ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Key Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <MetricCard 
                title={`FY${previousFY} Total Engagement`} 
                value={formatMillions(previousYearBaseline)} 
                subtitle={`Goal: ${formatMillions(currentYearGoal)} (103%)`} 
                color="green" 
              />
              <MetricCard 
                title="VA.gov Page Visits" 
                value={formatMillions(data?.yearlyTotals?.[previousFY]?.vaGov || 0)} 
                subtitle={`${previousYearBaseline ? Math.round((data?.yearlyTotals?.[previousFY]?.vaGov || 0) / previousYearBaseline * 100) : 0}% of total`} 
                color="blue" 
              />
              <MetricCard 
                title="Video Views" 
                value={formatMillions(data?.yearlyTotals?.[previousFY]?.video || 0)} 
                color="red" 
              />
              <MetricCard 
                title={`FY${currentFY} YTD`} 
                value={formatMillions(currentMonth?.actual || 0)} 
                subtitle={`${fy26GoalTracking.filter(m => m.hasData).length} months complete`} 
                color="purple" 
              />
            </div>

            {/* Stacked Engagement Chart */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Total Engagement by Fiscal Year</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={yearlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis tickFormatter={(v) => `${v}M`} />
                  <Tooltip formatter={(v) => `${v.toFixed(1)}M`} />
                  <Legend />
                  <Bar dataKey="vaGov" name="VA.gov" fill="#1e40af" stackId="a" />
                  <Bar dataKey="video" name="Video" fill="#dc2626" stackId="a" />
                  <Bar dataKey="vaNews" name="VA News" fill="#16a34a" stackId="a" />
                  <Bar dataKey="podcast" name="Podcast" fill="#9333ea" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Goal Achievement */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Goal Achievement History (3% Annual Growth Target)</h2>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={goalData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => `${v}M`} />
                  <YAxis type="category" dataKey="year" />
                  <Tooltip formatter={(v) => `${v.toFixed(1)}M`} />
                  <Legend />
                  <Bar dataKey="goal" name="Goal (3% growth)" fill="#94a3b8" />
                  <Bar dataKey="actual" name="Actual" fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 flex justify-center space-x-6">
                {goalData.map((d) => (
                  <div key={d.year} className="text-center">
                    <p className="text-sm text-gray-500">{d.year}</p>
                    <p className={`text-lg font-bold ${d.pct >= 100 ? 'text-green-600' : 'text-red-600'}`}>{d.pct}%</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Channels Tab - Deep dive into each channel */}
        {activeTab === 'channels' && (
          <div className="space-y-6">
            {/* Channel Mix Over Time */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-2 flex items-center">
                Channel Mix Evolution
                <InfoTooltip text="Shows how engagement is distributed across channels (VA.gov page visits, video views, VA News page views, podcast downloads) for each fiscal year. Helps identify which channels are growing or declining." />
              </h2>
              <p className="text-gray-500 text-sm mb-4">How the share of each channel has changed over time</p>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={yearlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis tickFormatter={(v) => `${v}M`} />
                  <Tooltip formatter={(v) => `${v.toFixed(1)}M`} />
                  <Legend />
                  <Bar dataKey="vaGov" name="VA.gov" fill="#1e40af" />
                  <Bar dataKey="video" name="Video" fill="#dc2626" />
                  <Bar dataKey="vaNews" name="VA News" fill="#16a34a" />
                  <Bar dataKey="podcast" name="Podcast" fill="#9333ea" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Channel Performance Cards with FY Selector */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <h2 className="text-xl font-semibold flex items-center">
                  Channel Performance
                  <InfoTooltip text="Shows each channel's total engagement for the selected fiscal year, its percentage share of total engagement, and year-over-year growth compared to the previous fiscal year." />
                </h2>
                <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                  {[...fiscalYears].reverse().map(fy => (
                    <button
                      key={fy}
                      onClick={() => setSelectedChannelYear(fy)}
                      className={`px-3 py-1 text-sm rounded-md transition-colors ${
                        (selectedChannelYear || previousFY) === fy
                          ? 'bg-blue-600 text-white' 
                          : 'text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      FY{fy}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {(() => {
                const displayYear = selectedChannelYear || previousFY;
                const channels = [
                  { key: 'vaGov', name: 'VA.gov', color: '#1e40af', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
                  { key: 'video', name: 'Video', color: '#dc2626', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
                  { key: 'vaNews', name: 'VA News', color: '#16a34a', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
                  { key: 'podcast', name: 'Podcast', color: '#9333ea', bgColor: 'bg-purple-50', borderColor: 'border-purple-200' },
                ];
                
                const displayYearTotal = data?.yearlyTotals?.[displayYear]?.total || 0;
                
                return channels.map(channel => {
                  const currentVal = data?.yearlyTotals?.[displayYear]?.[channel.key] || 0;
                  const prevVal = data?.yearlyTotals?.[displayYear - 1]?.[channel.key] || 0;
                  const growth = prevVal ? ((currentVal - prevVal) / prevVal * 100).toFixed(1) : 0;
                  const shareOfTotal = displayYearTotal ? ((currentVal / displayYearTotal) * 100).toFixed(1) : 0;
                  
                  return (
                    <div key={channel.key} className={`${channel.bgColor} rounded-lg p-4 border ${channel.borderColor}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: channel.color }} />
                        <h3 className="font-semibold text-gray-800">{channel.name}</h3>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">{formatMillions(currentVal)}</p>
                      <p className="text-sm text-gray-600">{shareOfTotal}% of total</p>
                      <p className={`text-sm font-medium mt-1 ${parseFloat(growth) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {parseFloat(growth) >= 0 ? '↑' : '↓'} {Math.abs(parseFloat(growth))}% vs FY{displayYear - 1}
                      </p>
                    </div>
                  );
                });
              })()}
              </div>
            </div>

            {/* Channel Trends */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                Channel Growth Trends
                <InfoTooltip text="Line chart showing how each channel's engagement has trended over all available fiscal years. Steeper upward slopes indicate faster growth." />
              </h2>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={yearlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis tickFormatter={(v) => `${v}M`} />
                  <Tooltip formatter={(v) => `${v.toFixed(1)}M`} />
                  <Legend />
                  <Line type="monotone" dataKey="vaGov" name="VA.gov" stroke="#1e40af" strokeWidth={3} dot={{ r: 5 }} />
                  <Line type="monotone" dataKey="video" name="Video" stroke="#dc2626" strokeWidth={3} dot={{ r: 5 }} />
                  <Line type="monotone" dataKey="vaNews" name="VA News" stroke="#16a34a" strokeWidth={3} dot={{ r: 5 }} />
                  <Line type="monotone" dataKey="podcast" name="Podcast" stroke="#9333ea" strokeWidth={3} dot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Channel Share Pie Chart */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                  <h2 className="text-xl font-semibold flex items-center">
                    Channel Distribution
                    <InfoTooltip text="Pie chart showing what percentage of total engagement each channel contributed for the selected fiscal year." />
                  </h2>
                  <select
                    value={selectedChannelYear || previousFY}
                    onChange={(e) => setSelectedChannelYear(parseInt(e.target.value))}
                    className="px-3 py-1 border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {[...fiscalYears].reverse().map(fy => (
                      <option key={fy} value={fy}>FY{fy}</option>
                    ))}
                  </select>
                </div>
                {(() => {
                  const displayYear = selectedChannelYear || previousFY;
                  return (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie 
                          data={[
                            { name: 'VA.gov', value: data?.yearlyTotals?.[displayYear]?.vaGov || 0, color: '#1e40af' },
                            { name: 'Video', value: data?.yearlyTotals?.[displayYear]?.video || 0, color: '#dc2626' },
                            { name: 'VA News', value: data?.yearlyTotals?.[displayYear]?.vaNews || 0, color: '#16a34a' },
                            { name: 'Podcast', value: data?.yearlyTotals?.[displayYear]?.podcast || 0, color: '#9333ea' },
                          ]} 
                          cx="50%" 
                          cy="50%" 
                          outerRadius={90} 
                          dataKey="value" 
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          <Cell fill="#1e40af" />
                          <Cell fill="#dc2626" />
                          <Cell fill="#16a34a" />
                          <Cell fill="#9333ea" />
                        </Pie>
                        <Tooltip formatter={(v) => formatWithCommas(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  );
                })()}
              </div>

              {/* Channel Growth Comparison */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  Multi-Year Growth Comparison
                  <InfoTooltip text="Shows percentage growth for each channel from the earliest to the most recent complete fiscal year in the dataset. Helps identify which channels have grown the most over time." />
                </h2>
                <div className="space-y-4">
                  {(() => {
                    const channels = [
                      { key: 'vaGov', name: 'VA.gov', color: '#1e40af' },
                      { key: 'video', name: 'Video', color: '#dc2626' },
                      { key: 'vaNews', name: 'VA News', color: '#16a34a' },
                      { key: 'podcast', name: 'Podcast', color: '#9333ea' },
                    ];
                    
                    return channels.map(channel => {
                      const firstYear = yearlyData[0];
                      const lastYear = yearlyData[yearlyData.length - 1];
                      const growth = firstYear && lastYear && firstYear[channel.key] 
                        ? ((lastYear[channel.key] - firstYear[channel.key]) / firstYear[channel.key] * 100).toFixed(0) 
                        : 0;
                      const maxGrowth = 200; // Cap for display
                      const displayGrowth = Math.min(Math.abs(parseFloat(growth)), maxGrowth);
                      
                      return (
                        <div key={channel.key}>
                          <div className="flex justify-between mb-1">
                            <span className="font-medium text-gray-700">{channel.name}</span>
                            <span className={`font-bold ${parseFloat(growth) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {parseFloat(growth) >= 0 ? '+' : ''}{growth}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div 
                              className="h-3 rounded-full transition-all" 
                              style={{ 
                                width: `${(displayGrowth / maxGrowth) * 100}%`, 
                                backgroundColor: channel.color 
                              }} 
                            />
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {firstYear?.year} → {lastYear?.year}
                          </p>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Seasonality Tab */}
        {activeTab === 'seasonality' && (
          <div className="space-y-6">
            {/* Monthly Patterns */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-2 flex items-center">
                Monthly Engagement Patterns
                <InfoTooltip text="Shows average engagement for each month across all fiscal years. Blue bars show the average, green line shows the best month ever, red line shows the lowest. Percentages show how each month compares to the overall monthly average." />
              </h2>
              <p className="text-gray-500 text-sm mb-4">Identify seasonal trends and high-performing months</p>
              
              {(() => {
                // Calculate average by month across all years
                const monthNames = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
                const monthlyAverages = monthNames.map((month, idx) => {
                  const monthNum = idx + 1;
                  const monthData = rawData?.filter(r => parseInt(r.MonthNum) === monthNum) || [];
                  const totals = monthData.map(r => parseInt(r.Total) || 0).filter(t => t > 0);
                  const avg = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
                  const max = totals.length ? Math.max(...totals) : 0;
                  const min = totals.length ? Math.min(...totals) : 0;
                  return { month, monthNum, avg, max, min, count: totals.length };
                });
                
                const overallAvg = monthlyAverages.reduce((sum, m) => sum + m.avg, 0) / 12;
                
                return (
                  <>
                    <ResponsiveContainer width="100%" height={300}>
                      <ComposedChart data={monthlyAverages}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} />
                        <Tooltip formatter={(v) => formatWithCommas(Math.round(v))} />
                        <Legend />
                        <Bar dataKey="avg" name="Average" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        <Line type="monotone" dataKey="max" name="Best Month" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
                        <Line type="monotone" dataKey="min" name="Lowest Month" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                    
                    {/* Month Performance Cards */}
                    <div className="mt-6 grid grid-cols-3 md:grid-cols-6 lg:grid-cols-12 gap-2">
                      {monthlyAverages.map(m => {
                        const vsAvg = ((m.avg - overallAvg) / overallAvg * 100).toFixed(0);
                        const isAbove = parseFloat(vsAvg) >= 0;
                        return (
                          <div 
                            key={m.month} 
                            className={`p-2 rounded-lg text-center ${isAbove ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}
                          >
                            <p className="text-xs font-semibold text-gray-600">{m.month}</p>
                            <p className="text-sm font-bold text-gray-800">{(m.avg / 1000000).toFixed(1)}M</p>
                            <p className={`text-xs ${isAbove ? 'text-green-600' : 'text-red-600'}`}>
                              {isAbove ? '+' : ''}{vsAvg}%
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Quarter Analysis */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                  <h2 className="text-xl font-semibold flex items-center">
                    Quarterly Performance
                    <InfoTooltip text="Shows total engagement by fiscal quarter for the selected year. Q1=Oct-Dec, Q2=Jan-Mar, Q3=Apr-Jun, Q4=Jul-Sep. Green bar indicates the highest-performing quarter." />
                  </h2>
                  <select
                    value={selectedSeasonalityYear || previousFY}
                    onChange={(e) => setSelectedSeasonalityYear(parseInt(e.target.value))}
                    className="px-3 py-1 border rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {[...fiscalYears].reverse().map(fy => (
                      <option key={fy} value={fy}>FY{fy}</option>
                    ))}
                  </select>
                </div>
                {(() => {
                  const displayYear = selectedSeasonalityYear || previousFY;
                  const quarters = [
                    { name: 'Q1 (Oct-Dec)', months: [1, 2, 3] },
                    { name: 'Q2 (Jan-Mar)', months: [4, 5, 6] },
                    { name: 'Q3 (Apr-Jun)', months: [7, 8, 9] },
                    { name: 'Q4 (Jul-Sep)', months: [10, 11, 12] },
                  ];
                  
                  const fyData = rawData?.filter(r => parseInt(r.FiscalYear) === displayYear) || [];
                  const quarterData = quarters.map(q => {
                    const total = q.months.reduce((sum, monthNum) => {
                      const monthData = fyData.find(r => parseInt(r.MonthNum) === monthNum);
                      return sum + (parseInt(monthData?.Total) || 0);
                    }, 0);
                    return { ...q, total };
                  });
                  
                  const maxQ = Math.max(...quarterData.map(q => q.total));
                  
                  return (
                    <div className="space-y-4">
                      {quarterData.map((q, idx) => (
                        <div key={q.name}>
                          <div className="flex justify-between mb-1">
                            <span className="font-medium text-gray-700">{q.name}</span>
                            <span className="font-bold text-gray-800">{formatMillions(q.total)}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-4">
                            <div 
                              className={`h-4 rounded-full ${q.total === maxQ ? 'bg-green-500' : 'bg-blue-500'}`}
                              style={{ width: `${maxQ > 0 ? (q.total / maxQ) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Best/Worst Months */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  Top & Bottom Performing Months
                  <InfoTooltip text="Lists the 5 highest and 5 lowest engagement months across all fiscal years in the dataset. Useful for identifying exceptional months and potential anomalies." />
                </h2>
                {(() => {
                  const allMonths = rawData?.map(r => ({
                    label: `${r.Month} FY${r.FiscalYear?.toString().slice(-2)}`,
                    total: parseInt(r.Total) || 0,
                    fy: parseInt(r.FiscalYear),
                  })).filter(m => m.total > 0).sort((a, b) => b.total - a.total) || [];
                  
                  const top5 = allMonths.slice(0, 5);
                  const bottom5 = allMonths.slice(-5).reverse();
                  
                  return (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-1">
                          <span>🏆</span> Top 5 Months
                        </h3>
                        <div className="space-y-2">
                          {top5.map((m, idx) => (
                            <div key={idx} className="flex justify-between text-sm bg-green-50 p-2 rounded">
                              <span className="text-gray-700">{m.label}</span>
                              <span className="font-semibold text-green-700">{formatMillions(m.total)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-1">
                          <span>📉</span> Bottom 5 Months
                        </h3>
                        <div className="space-y-2">
                          {bottom5.map((m, idx) => (
                            <div key={idx} className="flex justify-between text-sm bg-red-50 p-2 rounded">
                              <span className="text-gray-700">{m.label}</span>
                              <span className="font-semibold text-red-700">{formatMillions(m.total)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Year-over-Year Monthly Comparison */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                Month-over-Month Comparison by Year
                <InfoTooltip text="Compares the same month across different fiscal years. Useful for spotting if certain months are consistently strong or weak, and identifying year-over-year trends for specific months." />
              </h2>
              {(() => {
                const monthNames = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
                const years = [...new Set(rawData?.map(r => parseInt(r.FiscalYear)) || [])].sort();
                
                const comparisonData = monthNames.map((month, idx) => {
                  const entry = { month };
                  years.forEach(fy => {
                    const monthData = rawData?.find(r => parseInt(r.FiscalYear) === fy && parseInt(r.MonthNum) === idx + 1);
                    entry[`FY${fy.toString().slice(-2)}`] = (parseInt(monthData?.Total) || 0) / 1000000;
                  });
                  return entry;
                });
                
                const colors = ['#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af'];
                
                return (
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={comparisonData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis tickFormatter={(v) => `${v.toFixed(0)}M`} />
                      <Tooltip formatter={(v) => `${v.toFixed(1)}M`} />
                      <Legend />
                      {years.map((fy, idx) => (
                        <Line 
                          key={fy}
                          type="monotone" 
                          dataKey={`FY${fy.toString().slice(-2)}`} 
                          stroke={colors[idx % colors.length]} 
                          strokeWidth={fy === currentFY ? 3 : 2}
                          dot={{ r: fy === currentFY ? 5 : 3 }}
                          strokeDasharray={fy === currentFY ? '' : ''}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                );
              })()}
            </div>
          </div>
        )}

        {/* Performance Tab */}
        {activeTab === 'performance' && (
          <div className="space-y-6">
            {/* FY Selector for Performance Tab */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-700 flex items-center">
                Performance Analysis
                <InfoTooltip text="Deep dive into performance metrics for the selected fiscal year. All KPIs, progress tracking, and breakdowns update based on your FY selection." />
              </h2>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                {[...fiscalYears].reverse().map(fy => (
                  <button
                    key={fy}
                    onClick={() => setSelectedPerformanceYear(fy)}
                    className={`px-3 py-1 text-sm rounded-md transition-colors ${
                      (selectedPerformanceYear || currentFY) === fy
                        ? 'bg-blue-600 text-white' 
                        : 'text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    FY{fy}
                  </button>
                ))}
              </div>
            </div>

            {/* Key Performance Indicators */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {(() => {
                const perfYear = selectedPerformanceYear || currentFY;
                const perfYearTracking = allYearsGoalTracking[perfYear] || [];
                const perfCurrentMonth = perfYearTracking.filter(m => m.hasData).slice(-1)[0] || {};
                
                // Calculate goal from previous year baseline
                const perfPrevYearTotal = data?.yearlyTotals?.[perfYear - 1];
                const perfPrevBaseline = perfPrevYearTotal?.total || 0;
                const perfGoal = Math.round(perfPrevBaseline * 1.03);
                
                const ytdActual = perfCurrentMonth?.actual || 0;
                const ytdGoal = perfCurrentMonth?.goal || 0;
                const monthsComplete = perfYearTracking.filter(m => m.hasData).length;
                const avgMonthly = monthsComplete ? ytdActual / monthsComplete : 0;
                const projectedAnnual = avgMonthly * 12;
                const runRate = perfGoal ? (projectedAnnual / perfGoal * 100).toFixed(1) : 0;
                const daysIntoFY = monthsComplete * 30; // Approximate
                const dailyAvg = daysIntoFY ? ytdActual / daysIntoFY : 0;
                
                const kpis = [
                  { label: 'YTD Actual', value: formatMillions(ytdActual), color: 'blue', info: 'Year-to-date cumulative total engagement across all channels.' },
                  { label: 'YTD Goal', value: formatMillions(ytdGoal), color: 'amber', info: 'Cumulative goal for the months completed so far (3% annual growth prorated).' },
                  { label: 'Avg/Month', value: formatMillions(avgMonthly), color: 'purple', info: 'Average monthly engagement calculated from YTD actual divided by months completed.' },
                  { label: 'Run Rate', value: `${runRate}%`, color: parseFloat(runRate) >= 100 ? 'green' : 'red', info: 'Projected annual total as a percentage of the annual goal. 100%+ means on track to meet goal.' },
                  { label: 'Projected Annual', value: formatMillions(projectedAnnual), color: projectedAnnual >= perfGoal ? 'green' : 'red', info: 'Estimated year-end total if current monthly average continues (Avg/Month × 12).' },
                  { label: 'Daily Avg', value: formatMillions(dailyAvg), color: 'gray', info: 'Approximate daily engagement (YTD actual ÷ days elapsed in FY).' },
                ];
                
                return kpis.map((kpi, idx) => (
                  <div key={idx} className={`bg-${kpi.color}-50 border border-${kpi.color}-200 rounded-lg p-4`}>
                    <p className="text-xs text-gray-500 uppercase flex items-center">
                      {kpi.label}
                      <InfoTooltip text={kpi.info} />
                    </p>
                    <p className="text-xl font-bold text-gray-800">{kpi.value}</p>
                  </div>
                ));
              })()}
            </div>

            {/* FY Progress */}
            <div className="bg-white rounded-lg shadow p-6">
              {(() => {
                const perfYear = selectedPerformanceYear || currentFY;
                const perfYearTracking = allYearsGoalTracking[perfYear] || [];
                const perfCurrentMonth = perfYearTracking.filter(m => m.hasData).slice(-1)[0] || {};
                const perfPrevYearTotal = data?.yearlyTotals?.[perfYear - 1];
                const perfPrevBaseline = perfPrevYearTotal?.total || 0;
                const perfGoal = Math.round(perfPrevBaseline * 1.03);
                const monthsWithData = perfYearTracking.filter(m => m.hasData).length;
                
                return (
                  <>
                    <h2 className="text-xl font-semibold mb-4 flex items-center">
                      FY{perfYear} Progress Tracker
                      <InfoTooltip text="Visual progress bars showing: 1) Annual Goal Progress - YTD actual vs full-year goal, and 2) Pacing vs Expected - whether you're ahead or behind where you should be at this point in the year." />
                    </h2>
                    <div className="space-y-4">
                      {/* Overall Progress */}
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="font-medium text-gray-700">Annual Goal Progress</span>
                          <span className="font-bold text-gray-800">
                            {formatMillions(perfCurrentMonth?.actual || 0)} / {formatMillions(perfGoal)}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-6 relative">
                          <div 
                            className="bg-blue-600 h-6 rounded-full transition-all"
                            style={{ width: `${perfGoal ? Math.min(((perfCurrentMonth?.actual || 0) / perfGoal) * 100, 100) : 0}%` }}
                          />
                          <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-white mix-blend-difference">
                            {perfGoal ? (((perfCurrentMonth?.actual || 0) / perfGoal) * 100).toFixed(1) : 0}%
                          </span>
                        </div>
                      </div>

                      {/* Pacing vs Expected */}
                      <div>
                        {(() => {
                          const expectedAtThisPoint = perfGoal * (monthsWithData / 12);
                          const actual = perfCurrentMonth?.actual || 0;
                          const paceVsExpected = expectedAtThisPoint ? ((actual / expectedAtThisPoint) * 100).toFixed(1) : 0;
                          const difference = actual - expectedAtThisPoint;
                          const isAhead = difference >= 0;
                          // Cap the visual bar at 100% width, but show actual percentage in text
                          const barWidth = Math.min(parseFloat(paceVsExpected), 100);
                          
                          return (
                            <>
                              <div className="flex justify-between mb-2">
                                <span className="font-medium text-gray-700">
                                  Pacing vs Expected ({monthsWithData} mo)
                                </span>
                                <span className={`font-bold ${isAhead ? 'text-green-600' : 'text-red-600'}`}>
                                  {isAhead ? '+' : ''}{formatMillions(difference)} ({paceVsExpected}%)
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-6 relative overflow-hidden">
                                <div 
                                  className={`h-6 rounded-full ${isAhead ? 'bg-green-500' : 'bg-red-500'}`}
                                  style={{ width: `${barWidth}%` }}
                                />
                                <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-white mix-blend-difference">
                                  {paceVsExpected}% of expected
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                Expected by month {monthsWithData}: {formatMillions(expectedAtThisPoint)} • Actual: {formatMillions(actual)}
                              </p>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Monthly Performance Table */}
            <div className="bg-white rounded-lg shadow p-6">
              {(() => {
                const perfYear = selectedPerformanceYear || currentFY;
                const perfYearTracking = allYearsGoalTracking[perfYear] || [];
                const perfPrevYearTotal = data?.yearlyTotals?.[perfYear - 1];
                const perfPrevBaseline = perfPrevYearTotal?.total || 0;
                const perfGoal = Math.round(perfPrevBaseline * 1.03);
                
                return (
                  <>
                    <h2 className="text-xl font-semibold mb-4 flex items-center">
                      FY{perfYear} Monthly Breakdown
                      <InfoTooltip text="Detailed table showing each channel's monthly engagement and total. 'vs Goal' shows how each month performed against its prorated monthly goal (annual goal ÷ 12)." />
                    </h2>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="border-b-2 border-gray-200">
                            <th className="px-4 py-2 text-left text-gray-600">Month</th>
                            <th className="px-4 py-2 text-right text-gray-600">VA.gov</th>
                            <th className="px-4 py-2 text-right text-gray-600">Video</th>
                            <th className="px-4 py-2 text-right text-gray-600">VA News</th>
                            <th className="px-4 py-2 text-right text-gray-600">Podcast</th>
                            <th className="px-4 py-2 text-right text-gray-600">Total</th>
                            <th className="px-4 py-2 text-right text-gray-600">vs Goal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {perfYearTracking.map((m, idx) => {
                            const monthlyGoal = perfGoal / 12;
                            const vsGoal = m.hasData ? ((m.monthlyTotal / monthlyGoal - 1) * 100).toFixed(1) : null;
                            
                            return (
                              <tr key={m.month} className={`border-b ${m.hasData ? '' : 'text-gray-300'}`}>
                                <td className="px-4 py-2 font-medium">{m.month}</td>
                                <td className="px-4 py-2 text-right">{m.hasData && m.vaGov != null ? `${m.vaGov.toFixed(1)}M` : '-'}</td>
                                <td className="px-4 py-2 text-right">{m.hasData && m.video != null ? `${m.video.toFixed(1)}M` : '-'}</td>
                                <td className="px-4 py-2 text-right">{m.hasData && m.vaNews != null ? `${m.vaNews.toFixed(1)}M` : '-'}</td>
                                <td className="px-4 py-2 text-right">{m.hasData && m.podcast != null ? `${m.podcast.toFixed(1)}M` : '-'}</td>
                                <td className="px-4 py-2 text-right font-semibold">{m.hasData ? formatMillions(m.monthlyTotal || 0) : '-'}</td>
                                <td className={`px-4 py-2 text-right font-semibold ${vsGoal && parseFloat(vsGoal) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {vsGoal ? `${parseFloat(vsGoal) >= 0 ? '+' : ''}${vsGoal}%` : '-'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Channel Velocity */}
            <div className="bg-white rounded-lg shadow p-6">
              {(() => {
                const perfYear = selectedPerformanceYear || currentFY;
                // Get monthly data for selected year
                const perfYearMonthly = (() => {
                  const months = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
                  return months.map((month, idx) => {
                    const monthData = rawData?.find(r => parseInt(r.FiscalYear) === perfYear && parseInt(r.MonthNum) === idx + 1);
                    return {
                      month,
                      vaGov: monthData ? (parseInt(monthData.VA_Gov_PageVisits) || 0) / 1000000 : 0,
                      video: monthData ? (parseInt(monthData.Video_Views) || 0) / 1000000 : 0,
                      vaNews: monthData ? (parseInt(monthData.VA_News_PageViews) || 0) / 1000000 : 0,
                    };
                  });
                })();
                
                return (
                  <>
                    <h2 className="text-xl font-semibold mb-4">FY{perfYear} Monthly Performance by Channel</h2>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={perfYearMonthly}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis tickFormatter={(v) => `${v}M`} />
                        <Tooltip formatter={(v) => `${v.toFixed(2)}M`} />
                        <Legend />
                        <Bar dataKey="vaGov" name="VA.gov" fill="#1e40af" />
                        <Bar dataKey="video" name="Video" fill="#dc2626" />
                        <Bar dataKey="vaNews" name="VA News" fill="#16a34a" />
                      </BarChart>
                    </ResponsiveContainer>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* Projections Tab */}
        {activeTab === 'projections' && (
          <div className="space-y-6">
            {/* FY Selector for Projections Tab */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-700 flex items-center">
                Projections & Scenarios
                <InfoTooltip text="Forward-looking analysis based on current performance trends. Projections assume future months will match the current monthly average unless otherwise specified." />
              </h2>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                {[...fiscalYears].reverse().map(fy => (
                  <button
                    key={fy}
                    onClick={() => setSelectedProjectionYear(fy)}
                    className={`px-3 py-1 text-sm rounded-md transition-colors ${
                      (selectedProjectionYear || currentFY) === fy
                        ? 'bg-blue-600 text-white' 
                        : 'text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    FY{fy}
                  </button>
                ))}
              </div>
            </div>

            {/* Projection Summary */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
              {(() => {
                const projYear = selectedProjectionYear || currentFY;
                const projYearTracking = allYearsGoalTracking[projYear] || [];
                const projCurrentMonth = projYearTracking.filter(m => m.hasData).slice(-1)[0] || {};
                const projPrevYearTotal = data?.yearlyTotals?.[projYear - 1];
                const projPrevBaseline = projPrevYearTotal?.total || 0;
                const projGoal = Math.round(projPrevBaseline * 1.03);
                
                const monthsComplete = projYearTracking.filter(m => m.hasData).length;
                const ytdActual = projCurrentMonth?.actual || 0;
                const avgMonthly = monthsComplete ? ytdActual / monthsComplete : 0;
                const projectedAnnual = avgMonthly * 12;
                const projectedVsGoal = projGoal ? ((projectedAnnual / projGoal) * 100).toFixed(1) : 0;
                const projectedDiff = projectedAnnual - projGoal;
                
                return (
                  <>
                    <h2 className="text-xl font-semibold mb-4">FY{projYear} Year-End Projection</h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="bg-white/10 rounded-lg p-4">
                        <p className="text-indigo-100 text-sm">Current Run Rate</p>
                        <p className="text-3xl font-bold">{formatMillions(avgMonthly)}/mo</p>
                      </div>
                      <div className="bg-white/10 rounded-lg p-4">
                        <p className="text-indigo-100 text-sm">Projected Year-End</p>
                        <p className="text-3xl font-bold">{formatMillions(projectedAnnual)}</p>
                      </div>
                      <div className="bg-white/10 rounded-lg p-4">
                        <p className="text-indigo-100 text-sm">vs Annual Goal</p>
                        <p className="text-3xl font-bold">{projectedVsGoal}%</p>
                      </div>
                      <div className="bg-white/10 rounded-lg p-4">
                        <p className="text-indigo-100 text-sm">Projected {projectedDiff >= 0 ? 'Surplus' : 'Gap'}</p>
                        <p className={`text-3xl font-bold ${projectedDiff >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                          {projectedDiff >= 0 ? '+' : ''}{formatMillions(projectedDiff)}
                        </p>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Scenario Analysis */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                Scenario Analysis
                <InfoTooltip text="'What-if' scenarios showing projected year-end totals under different assumptions: Pessimistic (10% below current pace), Current Pace, Optimistic (10% above), and Stretch (20% above). Green border = meets goal." />
              </h2>
              <p className="text-gray-500 text-sm mb-4">What different monthly averages would mean for year-end results</p>
              {(() => {
                const projYear = selectedProjectionYear || currentFY;
                const projYearTracking = allYearsGoalTracking[projYear] || [];
                const projCurrentMonth = projYearTracking.filter(m => m.hasData).slice(-1)[0] || {};
                const projPrevYearTotal = data?.yearlyTotals?.[projYear - 1];
                const projPrevBaseline = projPrevYearTotal?.total || 0;
                const projGoal = Math.round(projPrevBaseline * 1.03);
                
                const monthsComplete = projYearTracking.filter(m => m.hasData).length;
                const monthsRemaining = 12 - monthsComplete;
                const ytdActual = projCurrentMonth?.actual || 0;
                const avgMonthly = monthsComplete ? ytdActual / monthsComplete : 0;
                
                const scenarios = [
                  { name: 'Pessimistic (-10%)', factor: 0.9, color: 'red' },
                  { name: 'Current Pace', factor: 1.0, color: 'blue' },
                  { name: 'Optimistic (+10%)', factor: 1.1, color: 'green' },
                  { name: 'Stretch (+20%)', factor: 1.2, color: 'purple' },
                ];
                
                const scenarioData = scenarios.map(s => {
                  const projectedMonthly = avgMonthly * s.factor;
                  const yearEnd = ytdActual + (projectedMonthly * monthsRemaining);
                  const vsGoalPct = projGoal ? ((yearEnd / projGoal) * 100).toFixed(1) : 0;
                  return {
                    ...s,
                    projectedMonthly,
                    yearEnd,
                    vsGoal: vsGoalPct,
                    meetsGoal: yearEnd >= projGoal,
                  };
                });
                
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {scenarioData.map(s => (
                      <div 
                        key={s.name} 
                        className={`border-2 rounded-lg p-4 ${s.meetsGoal ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}
                      >
                        <h3 className="font-semibold text-gray-800 mb-2">{s.name}</h3>
                        <p className="text-sm text-gray-600">Monthly: {formatMillions(s.projectedMonthly)}</p>
                        <p className="text-lg font-bold text-gray-800">Year-End: {formatMillions(s.yearEnd)}</p>
                        <p className={`text-sm font-medium ${s.meetsGoal ? 'text-green-600' : 'text-red-600'}`}>
                          {s.vsGoal}% of goal
                        </p>
                        <p className={`text-xs mt-1 ${s.meetsGoal ? 'text-green-600' : 'text-red-600'}`}>
                          {s.meetsGoal ? '✓ Meets goal' : '✗ Below goal'}
                        </p>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Required Run Rate */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                Required Performance to Meet Goal
                <InfoTooltip text="Calculates exactly what monthly average you need for the remaining months to hit the annual goal. Shows how much you need to increase (or can decrease) vs current pace." />
              </h2>
              {(() => {
                const projYear = selectedProjectionYear || currentFY;
                const projYearTracking = allYearsGoalTracking[projYear] || [];
                const projCurrentMonth = projYearTracking.filter(m => m.hasData).slice(-1)[0] || {};
                const projPrevYearTotal = data?.yearlyTotals?.[projYear - 1];
                const projPrevBaseline = projPrevYearTotal?.total || 0;
                const projGoal = Math.round(projPrevBaseline * 1.03);
                
                const monthsComplete = projYearTracking.filter(m => m.hasData).length;
                const monthsRemaining = 12 - monthsComplete;
                const ytdActual = projCurrentMonth?.actual || 0;
                const remaining = projGoal - ytdActual;
                const requiredMonthly = monthsRemaining > 0 ? remaining / monthsRemaining : 0;
                const avgMonthly = monthsComplete ? ytdActual / monthsComplete : 0;
                const changeRequired = avgMonthly ? ((requiredMonthly / avgMonthly - 1) * 100).toFixed(1) : 0;
                
                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-500">Remaining to Goal</p>
                      <p className="text-3xl font-bold text-gray-800">{formatMillions(remaining)}</p>
                      <p className="text-sm text-gray-500">over {monthsRemaining} months</p>
                    </div>
                    <div className="text-center p-4 bg-amber-50 rounded-lg border border-amber-200">
                      <p className="text-sm text-amber-600">Required Monthly Avg</p>
                      <p className="text-3xl font-bold text-amber-700">{formatMillions(requiredMonthly)}</p>
                      <p className="text-sm text-amber-600">per remaining month</p>
                    </div>
                    <div className={`text-center p-4 rounded-lg border ${parseFloat(changeRequired) <= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <p className={`text-sm ${parseFloat(changeRequired) <= 0 ? 'text-green-600' : 'text-red-600'}`}>vs Current Pace</p>
                      <p className={`text-3xl font-bold ${parseFloat(changeRequired) <= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {parseFloat(changeRequired) >= 0 ? '+' : ''}{changeRequired}%
                      </p>
                      <p className={`text-sm ${parseFloat(changeRequired) <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {parseFloat(changeRequired) <= 0 ? 'On track!' : 'increase needed'}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Historical Goal Achievement */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                Historical Goal Achievement Rate
                <InfoTooltip text="Shows actual vs goal performance for completed fiscal years. Blue bars show actual engagement, gray bars show the goal (3% growth target). Green line shows achievement percentage - above 100% means goal was exceeded." />
              </h2>
              <ResponsiveContainer width="100%" height={250}>
                <ComposedChart data={goalData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis yAxisId="left" tickFormatter={(v) => `${v}M`} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}%`} domain={[80, 120]} />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="actual" name="Actual" fill="#3b82f6" />
                  <Bar yAxisId="left" dataKey="goal" name="Goal" fill="#d1d5db" />
                  <Line yAxisId="right" type="monotone" dataKey="pct" name="% of Goal" stroke="#22c55e" strokeWidth={3} dot={{ r: 6 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
          </>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>VA Digital Media Engagement Dashboard {dataLoaded ? '• Data loaded from CSV' : '• Upload CSV for live data'}</p>
          <p className="mt-1">Goal: 3% annual growth over previous fiscal year baseline</p>
        </div>
      </div>
    </div>
  );
};

export default DMEDashboard;
