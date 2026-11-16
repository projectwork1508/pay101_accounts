import { useState, useEffect } from 'react';
import accountsAPI from '../api/accounts_api';
import { 
  Building2, Search, Download, FileText, FileSpreadsheet, 
  Calendar, RefreshCw, AlertCircle, TrendingUp, DollarSign, 
  Percent, ArrowDownRight, ArrowUpRight, CheckCircle2 
} from 'lucide-react';
import { toast } from 'sonner';
import { downloadCSV, downloadExcel, logReportToHistory } from '../utils/exportHelpers';
import { generateMerchantLedgerPDF, formatINR } from '../utils/pdfGenerator';

export default function MerchantLedger() {
  const [activeTab, setActiveTab] = useState('PAYIN'); // 'PAYIN' | 'PAYOUT'
  const [merchants, setMerchants] = useState([]);
  const [selectedMerchantId, setSelectedMerchantId] = useState('');
  const [selectedMerchant, setSelectedMerchant] = useState(null);

  // Date Filters (default: first day of current month to today)
  const todayStr = new Date().toISOString().slice(0, 10);
  const firstDayStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(firstDayStr);
  const [toDate, setToDate] = useState(todayStr);

  // Commercial slab state
  const [commercials, setCommercials] = useState(null);
  const [loadingCommercials, setLoadingCommercials] = useState(false);

  // Ledger data state
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [summary, setSummary] = useState({
    total_txns: 0,
    total_gross: 0,
    total_charges: 0,
    total_net: 0,
    effective_rate: 0
  });
  const [dailyItems, setDailyItems] = useState([]);

  // Load merchants list on mount
  useEffect(() => {
    loadMerchants();
  }, []);

  // When merchant or activeTab changes, load commercial slab
  useEffect(() => {
    if (selectedMerchantId) {
      loadCommercialSlab(selectedMerchantId, activeTab);
    }
  }, [selectedMerchantId, activeTab]);

  const loadMerchants = async () => {
    try {
      const res = await accountsAPI.getMerchantsList();
      if (res.success) {
        setMerchants(res.merchants || []);
        if (res.merchants && res.merchants.length > 0 && !selectedMerchantId) {
          setSelectedMerchantId(res.merchants[0].merchant_id);
          setSelectedMerchant(res.merchants[0]);
        }
      }
    } catch (err) {
      toast.error('Failed to load merchants list');
    }
  };

  const loadCommercialSlab = async (merchantId, serviceType) => {
    try {
      setLoadingCommercials(true);
      const res = await accountsAPI.getMerchantCommercials(merchantId, serviceType);
      if (res.success) {
        setCommercials(res);
      }
    } catch (err) {
      console.warn('Commercial lookup error:', err);
    } finally {
      setLoadingCommercials(false);
    }
  };

  const handleMerchantChange = (e) => {
    const mId = e.target.value;
    setSelectedMerchantId(mId);
    const mObj = merchants.find(m => m.merchant_id === mId) || { merchant_id: mId, full_name: mId };
    setSelectedMerchant(mObj);
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!selectedMerchantId) {
      toast.error('Please select a merchant');
      return;
    }

    try {
      setLedgerLoading(true);
      setHasSearched(true);
      const res = await accountsAPI.getMerchantLedger({
        merchant_id: selectedMerchantId,
        service_type: activeTab,
        from_date: fromDate,
        to_date: toDate
      });

      if (res.success) {
        setSummary(res.summary || { total_txns: 0, total_gross: 0, total_charges: 0, total_net: 0, effective_rate: 0 });
        setDailyItems(res.items || []);
        if (res.merchant) setSelectedMerchant(res.merchant);
      } else {
        toast.error(res.message || 'Failed to fetch ledger');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to query ledger');
    } finally {
      setLedgerLoading(false);
    }
  };

  // Quick Date Range Presets
  const setDatePreset = (preset) => {
    const now = new Date();
    if (preset === 'today') {
      const d = now.toISOString().slice(0, 10);
      setFromDate(d);
      setToDate(d);
    } else if (preset === 'yesterday') {
      const y = new Date(now.setDate(now.getDate() - 1)).toISOString().slice(0, 10);
      setFromDate(y);
      setToDate(y);
    } else if (preset === 'last7') {
      const end = now.toISOString().slice(0, 10);
      const start = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      setFromDate(start);
      setToDate(end);
    } else if (preset === 'thisMonth') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const end = new Date().toISOString().slice(0, 10);
      setFromDate(start);
      setToDate(end);
    }
  };

  // Dynamic file base name
  const getDynamicBaseName = () => {
    const cleanName = (selectedMerchant?.full_name || selectedMerchantId || 'Merchant').replace(/[^a-zA-Z0-9_-]/g, '_');
    return `MerchantLedger_${activeTab}_${cleanName}_${fromDate || 'start'}_to_${toDate || 'present'}`;
  };

  // Export handlers
  const handleExportCSV = async () => {
    if (dailyItems.length === 0) {
      toast.error('No ledger data to export');
      return;
    }
    const filename = `${getDynamicBaseName()}.csv`;
    const headers = ['Date (IST)', 'Txn Count', 'Gross Raw Volume (INR)', 'Charges Deducted (INR)', 'Net Settleable (INR)', 'Effective Fee Rate (%)'];
    const rows = dailyItems.map(it => [
      it.date,
      it.txns_count,
      it.gross_amount.toFixed(2),
      it.charge_amount.toFixed(2),
      it.net_amount.toFixed(2),
      `${it.effective_rate.toFixed(2)}%`
    ]);
    // Add summary row
    rows.push([
      'GRAND TOTAL',
      summary.total_txns,
      summary.total_gross.toFixed(2),
      summary.total_charges.toFixed(2),
      summary.total_net.toFixed(2),
      `${summary.effective_rate.toFixed(2)}%`
    ]);

    downloadCSV(filename, headers, rows);
    toast.success('CSV downloaded successfully');

    // Log to Reports history
    await logReportToHistory({
      reportType: 'MERCHANT_LEDGER',
      serviceType: activeTab,
      targetName: selectedMerchant?.full_name || selectedMerchantId,
      targetId: selectedMerchantId,
      fromDate,
      toDate,
      format: 'CSV',
      filename,
      totalGross: summary.total_gross,
      totalCharges: summary.total_charges,
      totalNet: summary.total_net,
      totalCount: summary.total_txns,
      reportData: { summary, items: dailyItems, slab: commercials?.slab_summary }
    });
  };

  const handleExportExcel = async () => {
    if (dailyItems.length === 0) {
      toast.error('No ledger data to export');
      return;
    }
    const filename = `${getDynamicBaseName()}.xls`;
    const headers = ['Date (IST)', 'Txn Count', 'Gross Amount (INR)', 'Charges Cut (INR)', 'Net Amount (INR)', 'Effective Rate (%)'];
    const rows = dailyItems.map(it => [
      it.date,
      it.txns_count,
      it.gross_amount,
      it.charge_amount,
      it.net_amount,
      `${it.effective_rate}%`
    ]);
    rows.push([
      'TOTAL',
      summary.total_txns,
      summary.total_gross,
      summary.total_charges,
      summary.total_net,
      `${summary.effective_rate}%`
    ]);

    downloadExcel(filename, `${activeTab} Ledger`, headers, rows);
    toast.success('Excel spreadsheet downloaded');

    await logReportToHistory({
      reportType: 'MERCHANT_LEDGER',
      serviceType: activeTab,
      targetName: selectedMerchant?.full_name || selectedMerchantId,
      targetId: selectedMerchantId,
      fromDate,
      toDate,
      format: 'EXCEL',
      filename,
      totalGross: summary.total_gross,
      totalCharges: summary.total_charges,
      totalNet: summary.total_net,
      totalCount: summary.total_txns,
      reportData: { summary, items: dailyItems, slab: commercials?.slab_summary }
    });
  };

  const handleExportPDF = async () => {
    if (dailyItems.length === 0) {
      toast.error('No ledger data to generate statement');
      return;
    }
    try {
      const generatedFilename = generateMerchantLedgerPDF(
        selectedMerchant || { merchant_id: selectedMerchantId },
        activeTab,
        fromDate,
        toDate,
        summary,
        dailyItems,
        commercials?.scheme_name,
        commercials?.slab_summary
      );
      toast.success('Billing Settlement Statement PDF downloaded');

      await logReportToHistory({
        reportType: 'MERCHANT_LEDGER',
        serviceType: activeTab,
        targetName: selectedMerchant?.full_name || selectedMerchantId,
        targetId: selectedMerchantId,
        fromDate,
        toDate,
        format: 'PDF',
        filename: generatedFilename,
        totalGross: summary.total_gross,
        totalCharges: summary.total_charges,
        totalNet: summary.total_net,
        totalCount: summary.total_txns,
        reportData: { summary, items: dailyItems, slab: commercials?.slab_summary }
      });
    } catch (err) {
      toast.error('Failed to generate PDF statement: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Building2 className="h-7 w-7 text-emerald-600" />
            <span>Merchants Ledger</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Reconcile raw merchant volume, commission charges cut, and net settleable amounts
          </p>
        </div>

        {/* Tab Switcher: Payins vs Payouts */}
        <div className="inline-flex p-1 bg-slate-200/80 rounded-xl self-start sm:self-auto border border-slate-300/60 shadow-xs">
          <button
            onClick={() => setActiveTab('PAYIN')}
            className={`flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'PAYIN'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowDownRight className="h-4 w-4" />
            <span>Payins Ledger</span>
          </button>
          <button
            onClick={() => setActiveTab('PAYOUT')}
            className={`flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'PAYOUT'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowUpRight className="h-4 w-4" />
            <span>Payouts Ledger</span>
          </button>
        </div>
      </div>

      {/* Primary Filters Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Merchant Select */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Select Merchant *
              </label>
              <select
                value={selectedMerchantId}
                onChange={handleMerchantChange}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-800"
                required
              >
                <option value="">-- Choose Merchant --</option>
                {merchants.map((m) => (
                  <option key={m.merchant_id} value={m.merchant_id}>
                    {m.full_name} ({m.merchant_id}) - {m.scheme_name || 'No Scheme'}
                  </option>
                ))}
              </select>
            </div>

            {/* Date From */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                <span>Date From (IST)</span>
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-800"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                <span>Date To (IST)</span>
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-800"
              />
            </div>
          </div>

          {/* Quick Date Presets & Submit */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">Presets:</span>
              <button
                type="button"
                onClick={() => setDatePreset('today')}
                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setDatePreset('yesterday')}
                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => setDatePreset('last7')}
                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                Last 7 Days
              </button>
              <button
                type="button"
                onClick={() => setDatePreset('thisMonth')}
                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                This Month
              </button>
            </div>

            <button
              type="submit"
              disabled={ledgerLoading || !selectedMerchantId}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-emerald-600/25 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <Search className={`h-4 w-4 ${ledgerLoading ? 'animate-spin' : ''}`} />
              <span>{ledgerLoading ? 'Calculating Totals...' : 'Generate Ledger'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Commercial Slab Display Box (Strict User Requirement) */}
      {selectedMerchantId && (
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 text-white shadow-md border border-slate-700/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                ACTIVE COMMERCIAL CONFIGURATION ({activeTab})
              </span>
              <span className="text-xs text-slate-400">&bull; Scheme: <strong>{commercials?.scheme_name || 'Standard'}</strong></span>
            </div>
            <p className="text-base sm:text-lg font-black text-white">
              {commercials?.slab_summary || 'Loading slab details...'}
            </p>
            <p className="text-xs text-slate-400">
              Merchant: <span className="text-slate-200 font-bold">{selectedMerchant?.full_name}</span> ({selectedMerchantId})
            </p>
          </div>

          {/* Slabs Detail Pills */}
          {commercials?.slabs && commercials.slabs.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {commercials.slabs.map((s, idx) => (
                <div key={idx} className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700 text-xs text-center min-w-[120px]">
                  <p className="text-[10px] uppercase font-bold text-slate-400">{s.product_name || 'All Volumes'}</p>
                  <p className="text-sm font-black text-emerald-400">
                    {s.charge_type === 'PERCENTAGE' ? `${s.charge_value}%` : `₹${s.charge_value}`}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono">
                    ₹{s.min_amount} - ₹{s.max_amount}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Overall Financial Totals Cards */}
      {hasSearched && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Gross Raw Volume */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
              <span>Gross Raw Volume</span>
              <DollarSign className="h-4 w-4 text-slate-400" />
            </div>
            <p className="text-xl sm:text-2xl font-black text-slate-900 mt-2 truncate">
              {formatINR(summary.total_gross)}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">Before commission deduction</p>
          </div>

          {/* Charges Cut */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-rose-200 bg-rose-50/20 shadow-xs">
            <div className="flex items-center justify-between text-xs font-bold text-rose-600 uppercase tracking-wider">
              <span>Commission Cut</span>
              <Percent className="h-4 w-4 text-rose-500" />
            </div>
            <p className="text-xl sm:text-2xl font-black text-rose-700 mt-2 truncate">
              - {formatINR(summary.total_charges)}
            </p>
            <p className="text-[11px] text-rose-600 mt-1">
              Effective Avg: {summary.effective_rate}%
            </p>
          </div>

          {/* Net Settleable Volume */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-700 uppercase tracking-wider">
              <span>Net Settleable Volume</span>
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-xl sm:text-2xl font-black text-emerald-700 mt-2 truncate">
              {formatINR(summary.total_net)}
            </p>
            <p className="text-[11px] text-emerald-600 mt-1">After commission deduction</p>
          </div>

          {/* Successful Txns */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
              <span>Successful Txns</span>
              <CheckCircle2 className="h-4 w-4 text-slate-400" />
            </div>
            <p className="text-xl sm:text-2xl font-black text-slate-900 mt-2 truncate">
              {summary.total_txns.toLocaleString()}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">Status: SUCCESS only</p>
          </div>
        </div>
      )}

      {/* Excel-Style Daily Ledger Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="font-extrabold text-base text-slate-900">
              {activeTab === 'PAYIN' ? 'Payin' : 'Payout'} Daily Summary Ledger
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Aggregated daily turnover showing raw volume, fees deducted, and net balance
            </p>
          </div>

          {/* Export Buttons: CSV, Excel, PDF */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExportCSV}
              disabled={dailyItems.length === 0}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all disabled:opacity-40"
              title="Download Excel-Compatible CSV"
            >
              <FileSpreadsheet className="h-4 w-4 text-slate-600" />
              <span>CSV</span>
            </button>

            <button
              onClick={handleExportExcel}
              disabled={dailyItems.length === 0}
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all disabled:opacity-40"
              title="Download Excel (.xls) Spreadsheet"
            >
              <Download className="h-4 w-4 text-emerald-600" />
              <span>Excel (.xls)</span>
            </button>

            <button
              onClick={handleExportPDF}
              disabled={dailyItems.length === 0}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-40"
              title="Download Professional Billing Statement PDF"
            >
              <FileText className="h-4 w-4 text-rose-400" />
              <span>Billing PDF</span>
            </button>
          </div>
        </div>

        {/* Excel Type Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-extrabold text-slate-600 uppercase tracking-wider">
                <th className="py-3.5 px-4">Date (IST)</th>
                <th className="py-3.5 px-4 text-center">Txn Count</th>
                <th className="py-3.5 px-4 text-right">Gross Amount (Raw)</th>
                <th className="py-3.5 px-4 text-right">Charges Deducted</th>
                <th className="py-3.5 px-4 text-right">Net Settleable</th>
                <th className="py-3.5 px-4 text-center">Effective Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ledgerLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">
                    <RefreshCw className="h-6 w-6 animate-spin text-emerald-600 mx-auto mb-2" />
                    Calculating exact merchant turnover and charges...
                  </td>
                </tr>
              ) : !hasSearched ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-slate-400">
                    <Search className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                    Please select a merchant and click <strong>"Generate Ledger"</strong> above to load totals.
                  </td>
                </tr>
              ) : dailyItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-slate-400">
                    No successful transactions found for the selected merchant and date range.
                  </td>
                </tr>
              ) : (
                dailyItems.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                      {row.date}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-slate-700">
                      {row.txns_count.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {formatINR(row.gross_amount)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-rose-600 font-semibold">
                      - {formatINR(row.charge_amount)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black text-emerald-700 bg-emerald-50/30">
                      {formatINR(row.net_amount)}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-slate-600">
                      {row.effective_rate}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* Sticky Table Footer with Grand Totals */}
            {dailyItems.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100/90 font-black text-slate-900 border-t-2 border-slate-300">
                  <td className="py-3.5 px-4 uppercase tracking-wider">GRAND TOTAL</td>
                  <td className="py-3.5 px-4 text-center font-mono">{summary.total_txns.toLocaleString()}</td>
                  <td className="py-3.5 px-4 text-right font-mono">{formatINR(summary.total_gross)}</td>
                  <td className="py-3.5 px-4 text-right font-mono text-rose-700">- {formatINR(summary.total_charges)}</td>
                  <td className="py-3.5 px-4 text-right font-mono text-emerald-800 bg-emerald-100/60">{formatINR(summary.total_net)}</td>
                  <td className="py-3.5 px-4 text-center font-mono">{summary.effective_rate}% Avg</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
