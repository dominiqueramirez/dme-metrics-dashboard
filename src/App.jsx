import React, { useState, useCallback } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, ComposedChart, Area } from 'recharts';
import Papa from 'papaparse';

const DMEDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [rawData, setRawData] = useState(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
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
    };
  }, [rawData]);

  const data = processData();

  // Use processed data only (no fallback)
  const yearlyData = data?.yearlyData || [];
  const goalData = data?.goalData || [];
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

  const MetricCard = ({ title, value, subtitle, trend, color = 'blue' }) => (
    <div className={`bg-white rounded-lg shadow p-4 border-l-4 ${color === 'green' ? 'border-green-500' : color === 'red' ? 'border-red-500' : color === 'purple' ? 'border-purple-500' : 'border-blue-500'}`}>
      <p className="text-sm text-gray-500 uppercase tracking-wide">{title}</p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      {subtitle && <p className="text-sm text-gray-600">{subtitle}</p>}
      {trend && (
        <p className={`text-sm ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
          {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}% vs prior year
        </p>
      )}
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
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-800">FY{currentFY} Goal Tracking</h2>
              <p className="text-gray-500 text-sm">Cumulative progress vs. 3% annual growth target</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right px-3 py-2 bg-gray-100 rounded-lg">
                <p className="text-xs text-gray-500 uppercase">Monthly Target</p>
                <p className="text-base font-bold text-gray-700">8.58%</p>
              </div>
              <div className={`text-right px-4 py-2 rounded-lg ${aheadBehind >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                <p className={`text-xl font-bold ${aheadBehind >= 0 ? 'text-green-700' : 'text-red-700'}`}>{pctOfGoal}%</p>
                <p className={`text-xs ${aheadBehind >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {aheadBehind >= 0 ? '+' : ''}{formatWithCommas(aheadBehind)} vs goal
                </p>
              </div>
            </div>
          </div>

          {/* Status Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-xs text-gray-500 uppercase">FY{previousFY} Baseline</p>
              <p className="text-lg font-bold text-gray-700">{formatWithCommas(previousYearBaseline)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-xs text-gray-500 uppercase">FY{currentFY} Goal (103%)</p>
              <p className="text-lg font-bold text-gray-700">{formatWithCommas(currentYearGoal)}</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
              <p className="text-xs text-amber-600 uppercase">YTD Goal</p>
              <p className="text-lg font-bold text-amber-700">{formatWithCommas(currentMonth?.goal)}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <p className="text-xs text-blue-600 uppercase">Current YTD Actual</p>
              <p className="text-lg font-bold text-blue-700">{formatWithCommas(currentMonth?.actual)}</p>
            </div>
          </div>

          {/* Goal Tracking Chart */}
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={fy26GoalTracking}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} tick={{ fill: '#6b7280', fontSize: 12 }} domain={[0, 380000000]} />
              <Tooltip content={<GoalTrackingTooltip />} />
              <Legend />
              <Area type="monotone" dataKey="goal" name="Cumulative Goal" fill="#fef3c7" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" />
              <Bar dataKey="actual" name="Actual YTD" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>

          {/* Monthly Goal Table */}
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-2 py-1 text-left text-gray-500">Month</th>
                  {fy26GoalTracking.map(m => (
                    <th key={m.month} className={`px-2 py-1 text-center ${m.hasData ? 'text-blue-700 font-semibold' : 'text-gray-400'}`}>{m.month}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100 bg-amber-50">
                  <td className="px-2 py-1 text-amber-700 font-medium">Goal</td>
                  {fy26GoalTracking.map(m => (
                    <td key={m.month} className="px-2 py-1 text-center text-amber-700">{(m.goal / 1000000).toFixed(1)}M</td>
                  ))}
                </tr>
                <tr className="bg-blue-50">
                  <td className="px-2 py-1 text-blue-700 font-medium">Actual</td>
                  {fy26GoalTracking.map(m => (
                    <td key={m.month} className={`px-2 py-1 text-center font-semibold ${m.hasData ? 'text-blue-700' : 'text-gray-300'}`}>
                      {m.hasData ? `${(m.actual / 1000000).toFixed(1)}M` : '-'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-2 py-1 text-gray-600">vs Goal</td>
                  {fy26GoalTracking.map(m => {
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
              </tbody>
            </table>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-2 mb-6">
          {['overview', 'trends', 'fy2026', 'platforms'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === tab ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {tab === 'fy2026' ? `FY${currentFY}` : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
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

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Goal Achievement (3% Annual Growth Target)</h2>
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

        {/* Trends Tab */}
        {activeTab === 'trends' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Platform Trends Over Time</h2>
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
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-semibold text-gray-700 mb-2">VA.gov Growth</h3>
                <p className="text-3xl font-bold text-blue-600">
                  {yearlyData.length >= 2 ? `+${Math.round((yearlyData[yearlyData.length-1]?.vaGov / yearlyData[0]?.vaGov - 1) * 100)}%` : '-'}
                </p>
                <p className="text-sm text-gray-500">{yearlyData.length >= 2 ? `${yearlyData[0]?.year} to ${yearlyData[yearlyData.length-1]?.year}` : ''}</p>
                <p className="mt-2 text-sm text-gray-600">
                  {yearlyData.length >= 2 ? `${yearlyData[0]?.vaGov?.toFixed(1)}M → ${yearlyData[yearlyData.length-1]?.vaGov?.toFixed(1)}M` : ''}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-semibold text-gray-700 mb-2">Video Growth</h3>
                <p className="text-3xl font-bold text-red-600">
                  {yearlyData.length >= 2 ? `+${Math.round((yearlyData[yearlyData.length-1]?.video / yearlyData[0]?.video - 1) * 100)}%` : '-'}
                </p>
                <p className="text-sm text-gray-500">{yearlyData.length >= 2 ? `${yearlyData[0]?.year} to ${yearlyData[yearlyData.length-1]?.year}` : ''}</p>
                <p className="mt-2 text-sm text-gray-600">
                  {yearlyData.length >= 2 ? `${yearlyData[0]?.video?.toFixed(1)}M → ${yearlyData[yearlyData.length-1]?.video?.toFixed(1)}M` : ''}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-semibold text-gray-700 mb-2">Total Growth</h3>
                <p className="text-3xl font-bold text-green-600">
                  {yearlyData.length >= 2 ? `+${Math.round((yearlyData[yearlyData.length-1]?.total / yearlyData[0]?.total - 1) * 100)}%` : '-'}
                </p>
                <p className="text-sm text-gray-500">{yearlyData.length >= 2 ? `${yearlyData[0]?.year} to ${yearlyData[yearlyData.length-1]?.year}` : ''}</p>
                <p className="mt-2 text-sm text-gray-600">
                  {yearlyData.length >= 2 ? `${yearlyData[0]?.total?.toFixed(1)}M → ${yearlyData[yearlyData.length-1]?.total?.toFixed(1)}M` : ''}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* FY2026 Tab */}
        {activeTab === 'fy2026' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">FY{currentFY} Progress</h2>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">YTD: {formatMillions(currentMonth?.actual || 0)}</span>
                <span className="text-sm text-gray-600">Goal: {formatMillions(currentYearGoal)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div className="bg-blue-600 h-4 rounded-full" style={{ width: `${((currentMonth?.actual || 0) / currentYearGoal) * 100}%` }} />
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-sm text-gray-500">{fy26GoalTracking.filter(m => m.hasData).length}/12 months complete</span>
                <span className="text-sm font-medium text-green-600">{(((currentMonth?.actual || 0) / currentYearGoal) * 100).toFixed(1)}% of annual goal</span>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Monthly Performance</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={currentFYMonthly}>
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
            </div>
          </div>
        )}

        {/* Platforms Tab */}
        {activeTab === 'platforms' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">FY{previousFY} Video Views by Platform</h2>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={videoPlatforms} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value.toFixed(1)}M`}>
                      {videoPlatforms.map((entry, index) => (<Cell key={index} fill={entry.color} />))}
                    </Pie>
                    <Tooltip formatter={(v) => `${v.toFixed(1)}M`} />
                  </PieChart>
                </ResponsiveContainer>
                <p className="text-xs text-gray-400 text-center mt-2">Note: Platform breakdown not included in CSV</p>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Video Platform Breakdown</h2>
                <div className="space-y-4">
                  {videoPlatforms.map((platform) => (
                    <div key={platform.name} className="flex items-center">
                      <div className="w-4 h-4 rounded mr-3" style={{ backgroundColor: platform.color }} />
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="font-medium">{platform.name}</span>
                          <span className="text-gray-600">{platform.value.toFixed(1)}M</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="h-2 rounded-full" style={{ width: `${(platform.value / 71.6) * 100}%`, backgroundColor: platform.color }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600"><strong>Key Insight:</strong> YouTube dominates with 78.6% of all video views.</p>
                </div>
              </div>
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
