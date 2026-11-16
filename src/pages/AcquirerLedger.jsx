import { useState, useEffect } from 'react';
import accountsAPI from '../api/accounts_api';
import { 
  Server, Search, Download, FileText, FileSpreadsheet, 
  Calendar, RefreshCw, Settings2, Percent, TrendingUp, 
  DollarSign, ArrowDownRight, ArrowUpRight, CheckCircle2, Sliders 
} from 'lucide-react';
import { toast } from 'sonner';
import { downloadCSV, downloadExcel, logReportToHistory } from '../utils/exportHelpers';
import { generateAcquirerLedgerPDF, formatINR } from '../utils/pdfGenerator';

export default function AcquirerLedger() {
  const [activeTab, setActiveTab] = useState('PAYIN'); // 'PAYIN' | 'PAYOUT'

  // Date Filters
  const todayStr = new Date().toISOString().slice(0, 10);
  const firstDayStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(firstDayStr);
  const [toDate, setToDate] = useState(todayStr);
  const [selectedApiId, setSelectedApiId] = useState('ALL');

  // Acquirer rates state & modal
  const [ratesList, setRatesList] = useState([]);
  const [showRatesModal, setShowRatesModal] = useState(false);
  const [universalRateInput, setUniversalRateInput] = useState('');
  const [editingRates, setEditingRates] = useState({});
  const [savingRates, setSavingRates] = useState(false);

  // Ledger calculation state
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [summary, setSummary] = useState({
    total_txns: 0,
    total_raw_volume: 0,
    total_charges_cut: 0,
    total_net_volume: 0,
    effective_rate: 0,
    active_acquirers_count: 0
  });
  const [acquirerItems, setAcquirerItems] = useState([]);

  // Load configured rates and ledger when tab changes
  useEffect(() => {
    loadRates(activeTab);
    fetchLedger(activeTab, fromDate, toDate, selectedApiId);
  }, [activeTab]);

  const loadRates = async (serviceType) => {
    try {
      const res = await accountsAPI.getAcquirerRates(serviceType);
      if (res.success) {
        setRatesList(res.rates || []);
        const rMap = {};
        (res.rates || []).forEach(r => {
          rMap[r.api_id] = r.charge_value;
        });
        setEditingRates(rMap);
      }
    } catch (err) {
      console.warn('Failed to load acquirer rates:', err);
    }
  };

  const fetchLedger = async (serviceType, from, to, apiId) => {
    try {
      setLedgerLoading(true);
      const res = await accountsAPI.getAcquirerLedger({
        service_type: serviceType,
        from_date: from,
        to_date: to,
        api_id: apiId
      });
      if (res.success) {
        setSummary(res.summary || {
          total_txns: 0,
          total_raw_volume: 0,
          total_charges_cut: 0,
          total_net_volume: 0,
          effective_rate: 0,
          active_acquirers_count: 0
        });
        setAcquirerItems(res.items || []);
      } else {
        toast.error(res.message || 'Failed to calculate acquirer ledger');
      }
    } catch (err) {
      toast.error('Error fetching acquirer ledger: ' + err.message);
    } finally {
      setLedgerLoading(false);
    }
  };

  const handleFilterSubmit = (e) => {
    if (e) e.preventDefault();
    fetchLedger(activeTab, fromDate, toDate, selectedApiId);
  };

  // Save rates
  const handleSaveAllRates = async () => {
    try {
      setSavingRates(true);
      const payload = {
        service_type: activeTab,
        rates: Object.keys(editingRates).map(apiId => ({
          api_id: apiId,
          charge_value: parseFloat(editingRates[apiId]) || 0.0
        }))
      };
      const res = await accountsAPI.saveAcquirerRates(payload);
      if (res.success) {
        toast.success('Acquirer charge percentages saved successfully!');
        setShowRatesModal(false);
        loadRates(activeTab);
        fetchLedger(activeTab, fromDate, toDate, selectedApiId);
      } else {
        toast.error(res.message || 'Failed to save rates');
      }
    } catch (err) {
      toast.error(err.message || 'Error saving rates');
    } finally {
      setSavingRates(false);
    }
  };

  const handleApplyUniversalRate = async () => {
    const val = parseFloat(universalRateInput);
    if (isNaN(val) || val < 0) {
      toast.error('Please enter a valid percentage rate');
      return;
    }
    try {
      setSavingRates(true);
      const res = await accountsAPI.saveAcquirerRates({
        service_type: activeTab,
        universal_rate: val
      });
      if (res.success) {
        toast.success(`Set ${val}% rate for all ${activeTab} acquirers!`);
        setUniversalRateInput('');
        setShowRatesModal(false);
        loadRates(activeTab);
        fetchLedger(activeTab, fromDate, toDate, selectedApiId);
      }
    } catch (err) {
      toast.error('Failed to set universal rate');
    } finally {
      setSavingRates(false);
    }
  };

  // Quick Date Presets
  const setDatePreset = (preset) => {
    const now = new Date();
    if (preset === 'today') {
      const d = now.toISOString().slice(0, 10);
      setFromDate(d);
      setToDate(d);
      fetchLedger(activeTab, d, d, selectedApiId);
    } else if (preset === 'yesterday') {
      const y = new Date(now.setDate(now.getDate() - 1)).toISOString().slice(0, 10);
      setFromDate(y);
      setToDate(y);
      fetchLedger(activeTab, y, y, selectedApiId);
    } else if (preset === 'last7') {
      const end = now.toISOString().slice(0, 10);
      const start = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      setFromDate(start);
      setToDate(end);
      fetchLedger(activeTab, start, end, selectedApiId);
    } else if (preset === 'thisMonth') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const end = new Date().toISOString().slice(0, 10);
      setFromDate(start);
      setToDate(end);
      fetchLedger(activeTab, start, end, selectedApiId);
    }
  };

  const getDynamicBaseName = () => {
    const apiName = selectedApiId === 'ALL' ? 'AllAcquirers' : selectedApiId;
    return `AcquirerLedger_${activeTab}_${apiName}_${fromDate || 'start'}_to_${toDate || 'present'}`;
  };

  // Exports
  const handleExportCSV = async () => {
    if (acquirerItems.length === 0) {
      toast.error('No acquirer data to export');
      return;
    }
    const filename = `${getDynamicBaseName()}.csv`;
    const headers = ['Acquirer API Name', 'Service', 'Txn Count', 'Raw Volume (INR)', 'Vendor Rate (%)', 'Charges Cut from Us (INR)', 'Net Volume Retained (INR)'];
    const rows = acquirerItems.map(it => [
      it.api_name,
      it.service_type,
      it.txns_count,
      it.raw_volume.toFixed(2),
      `${it.charge_percentage.toFixed(2)}%`,
      it.charges_cut.toFixed(2),
      it.net_volume.toFixed(2)
    ]);
    rows.push([
      'GRAND TOTAL',
      activeTab,
      summary.total_txns,
      summary.total_raw_volume.toFixed(2),
      `${summary.effective_rate.toFixed(2)}% Avg`,
      summary.total_charges_cut.toFixed(2),
      summary.total_net_volume.toFixed(2)
    ]);

    downloadCSV(filename, headers, rows);
    toast.success('CSV downloaded successfully');

    await logReportToHistory({
      reportType: 'ACQUIRER_LEDGER',
      serviceType: activeTab,
      targetName: selectedApiId === 'ALL' ? 'All Acquirers' : selectedApiId,
      targetId: selectedApiId,
      fromDate,
      toDate,
      format: 'CSV',
      filename,
      totalGross: summary.total_raw_volume,
      totalCharges: summary.total_charges_cut,
      totalNet: summary.total_net_volume,
      totalCount: summary.total_txns,
      reportData: { summary, items: acquirerItems }
    });
  };

  const handleExportExcel = async () => {
    if (acquirerItems.length === 0) {
      toast.error('No acquirer data to export');
      return;
    }
    const filename = `${getDynamicBaseName()}.xls`;
    const headers = ['Acquirer Gateway Name', 'Service', 'Txn Count', 'Raw Volume (INR)', 'Vendor Charge Rate', 'Vendor Fees Cut (INR)', 'Net Volume (INR)'];
    const rows = acquirerItems.map(it => [
      it.api_name,
      it.service_type,
      it.txns_count,
      it.raw_volume,
      `${it.charge_percentage}%`,
      it.charges_cut,
      it.net_volume
    ]);
    rows.push([
      'GRAND TOTAL',
      activeTab,
      summary.total_txns,
      summary.total_raw_volume,
      `${summary.effective_rate}% Avg`,
      summary.total_charges_cut,
      summary.total_net_volume
    ]);

    downloadExcel(filename, `Acquirer ${activeTab}`, headers, rows);
    toast.success('Excel spreadsheet downloaded');

    await logReportToHistory({
      reportType: 'ACQUIRER_LEDGER',
      serviceType: activeTab,
      targetName: selectedApiId === 'ALL' ? 'All Acquirers' : selectedApiId,
      targetId: selectedApiId,
      fromDate,
      toDate,
      format: 'EXCEL',
      filename,
      totalGross: summary.total_raw_volume,
      totalCharges: summary.total_charges_cut,
      totalNet: summary.total_net_volume,
      totalCount: summary.total_txns,
      reportData: { summary, items: acquirerItems }
    });
  };

  const handleExportPDF = async () => {
    if (acquirerItems.length === 0) {
      toast.error('No acquirer data to export');
      return;
    }
    try {
      const generatedFilename = generateAcquirerLedgerPDF(
        activeTab,
        fromDate,
        toDate,
        summary,
        acquirerItems,
        selectedApiId === 'ALL' ? 'All Acquirers' : selectedApiId
      );
      toast.success('Acquirer Reconciliation PDF downloaded');

      await logReportToHistory({
        reportType: 'ACQUIRER_LEDGER',
        serviceType: activeTab,
        targetName: selectedApiId === 'ALL' ? 'All Acquirers' : selectedApiId,
        targetId: selectedApiId,
        fromDate,
        toDate,
        format: 'PDF',
        filename: generatedFilename,
        totalGross: summary.total_raw_volume,
        totalCharges: summary.total_charges_cut,
        totalNet: summary.total_net_volume,
        totalCount: summary.total_txns,
        reportData: { summary, items: acquirerItems }
      });
    } catch (err) {
      toast.error('Failed to generate PDF: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Server className="h-7 w-7 text-blue-600" />
            <span>Acquirer Ledger</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Reconcile volumes processed by registered gateway APIs and calculate fees charged to us
          </p>
        </div>

        {/* Tab Switcher & Configure Rates Button */}
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <div className="inline-flex p-1 bg-slate-200/80 rounded-xl border border-slate-300/60 shadow-xs">
            <button
              onClick={() => setActiveTab('PAYIN')}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'PAYIN'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowDownRight className="h-4 w-4" />
              <span>Payin Acquirers</span>
            </button>
            <button
              onClick={() => setActiveTab('PAYOUT')}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'PAYOUT'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowUpRight className="h-4 w-4" />
              <span>Payout Acquirers</span>
            </button>
          </div>

          <button
            onClick={() => setShowRatesModal(true)}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Settings2 className="h-4 w-4 text-emerald-400" />
            <span>Set Acquirer % Rates</span>
          </button>
        </div>
      </div>

      {/* Primary Filters Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
        <form onSubmit={handleFilterSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Acquirer Select */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Acquirer / Gateway API
              </label>
              <select
                value={selectedApiId}
                onChange={(e) => setSelectedApiId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-slate-800"
              >
                <option value="ALL">All Registered {activeTab} Acquirers ({acquirerItems.length})</option>
                {acquirerItems.map((api) => (
                  <option key={api.api_id} value={api.api_id}>
                    {api.api_name} (Rate: {api.charge_percentage}%)
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
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800"
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
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800"
              />
            </div>
          </div>

          {/* Quick Date Presets & Filter Submit */}
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
              disabled={ledgerLoading}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-blue-600/25 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <Search className={`h-4 w-4 ${ledgerLoading ? 'animate-spin' : ''}`} />
              <span>{ledgerLoading ? 'Calculating Turnover...' : 'Filter Ledger'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Raw Volume */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>Total Raw Volume</span>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-900 mt-2 truncate">
            {formatINR(summary.total_raw_volume)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Processed across {summary.active_acquirers_count} active APIs</p>
        </div>

        {/* Vendor Fees Cut from Us */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-rose-200 bg-rose-50/20 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-rose-600 uppercase tracking-wider">
            <span>Vendor Fees Cut (Cost)</span>
            <Percent className="h-4 w-4 text-rose-500" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-rose-700 mt-2 truncate">
            - {formatINR(summary.total_charges_cut)}
          </p>
          <p className="text-[11px] text-rose-600 mt-1">Avg Rate: {summary.effective_rate}%</p>
        </div>

        {/* Net Volume Retained */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-700 uppercase tracking-wider">
            <span>Net Volume Retained</span>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-700 mt-2 truncate">
            {formatINR(summary.total_net_volume)}
          </p>
          <p className="text-[11px] text-emerald-600 mt-1">After acquirer fees deduction</p>
        </div>

        {/* Total Successful Txns */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>Total Success Txns</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-900 mt-2 truncate">
            {summary.total_txns.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Status: SUCCESS (IST time)</p>
        </div>
      </div>

      {/* Excel Type Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="font-extrabold text-base text-slate-900">
              {activeTab === 'PAYIN' ? 'Payin' : 'Payout'} Acquirer Breakdown Table
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Live reconciliation of each payment gateway partner based on registered routing prefix rules
            </p>
          </div>

          {/* Export Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExportCSV}
              disabled={acquirerItems.length === 0}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all disabled:opacity-40"
              title="Download Excel CSV"
            >
              <FileSpreadsheet className="h-4 w-4 text-slate-600" />
              <span>CSV</span>
            </button>

            <button
              onClick={handleExportExcel}
              disabled={acquirerItems.length === 0}
              className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all disabled:opacity-40"
              title="Download Excel Sheet"
            >
              <Download className="h-4 w-4 text-blue-600" />
              <span>Excel (.xls)</span>
            </button>

            <button
              onClick={handleExportPDF}
              disabled={acquirerItems.length === 0}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-40"
              title="Download PDF Summary"
            >
              <FileText className="h-4 w-4 text-blue-400" />
              <span>Reconciliation PDF</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-extrabold text-slate-600 uppercase tracking-wider">
                <th className="py-3.5 px-4">Acquirer API Name</th>
                <th className="py-3.5 px-4 text-center">Txn Count</th>
                <th className="py-3.5 px-4 text-right">Raw Volume (Before Charges)</th>
                <th className="py-3.5 px-4 text-center">Acquirer Fee %</th>
                <th className="py-3.5 px-4 text-right">Charges Cut from Us</th>
                <th className="py-3.5 px-4 text-right">Net Volume Retained</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ledgerLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">
                    <RefreshCw className="h-6 w-6 animate-spin text-blue-600 mx-auto mb-2" />
                    Calculating acquirer turnover from transaction logs...
                  </td>
                </tr>
              ) : acquirerItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-slate-400">
                    No registered acquirers found matching the criteria.
                  </td>
                </tr>
              ) : (
                acquirerItems.map((api, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${api.txns_count > 0 ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        <span>{api.api_name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-slate-700">
                      {api.txns_count.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {formatINR(api.raw_volume)}
                    </td>
                    <td className="py-3 px-4 text-center font-mono">
                      <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-bold">
                        {api.charge_percentage.toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-rose-600 font-semibold">
                      - {formatINR(api.charges_cut)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black text-emerald-700 bg-emerald-50/30">
                      {formatINR(api.net_volume)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {acquirerItems.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100/90 font-black text-slate-900 border-t-2 border-slate-300">
                  <td className="py-3.5 px-4 uppercase tracking-wider">GRAND TOTAL</td>
                  <td className="py-3.5 px-4 text-center font-mono">{summary.total_txns.toLocaleString()}</td>
                  <td className="py-3.5 px-4 text-right font-mono">{formatINR(summary.total_raw_volume)}</td>
                  <td className="py-3.5 px-4 text-center font-mono">{summary.effective_rate}% Avg</td>
                  <td className="py-3.5 px-4 text-right font-mono text-rose-700">- {formatINR(summary.total_charges_cut)}</td>
                  <td className="py-3.5 px-4 text-right font-mono text-emerald-800 bg-emerald-100/60">{formatINR(summary.total_net_volume)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Acquirer Rate Setting Modal */}
      {showRatesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Settings2 className="h-5 w-5 text-emerald-600" />
                  <span>Configure Acquirer Charge Rates ({activeTab})</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set the percentage fee charged by each payment gateway vendor from us
                </p>
              </div>
              <button
                onClick={() => setShowRatesModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            {/* Set All / Universal Rate Option */}
            <div className="my-4 p-4 rounded-xl bg-blue-50/70 border border-blue-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-blue-900">
                <span className="font-bold block">Apply Universal Rate for All {activeTab} APIs:</span>
                <span className="text-[11px] text-blue-700">Quickly overwrite the charge percentage for every acquirer below.</span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative w-28">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 2.00"
                    value={universalRateInput}
                    onChange={(e) => setUniversalRateInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-blue-300 pr-6"
                  />
                  <span className="absolute right-2 top-1.5 text-xs text-blue-600 font-bold">%</span>
                </div>
                <button
                  type="button"
                  disabled={savingRates || !universalRateInput}
                  onClick={handleApplyUniversalRate}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg whitespace-nowrap transition-all disabled:opacity-50"
                >
                  Set All
                </button>
              </div>
            </div>

            {/* Per-Acquirer Individual Table */}
            <div className="space-y-2 mt-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Individual Acquirer Rates:</h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {acquirerItems.map((api) => (
                  <div key={api.api_id} className="p-2.5 flex items-center justify-between hover:bg-slate-50 gap-2">
                    <span className="text-xs font-semibold text-slate-800">{api.api_name}</span>
                    <div className="relative w-28 shrink-0">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editingRates[api.api_id] ?? api.charge_percentage}
                        onChange={(e) => setEditingRates({ ...editingRates, [api.api_id]: e.target.value })}
                        className="w-full px-2.5 py-1 text-xs font-bold text-right rounded-lg border border-slate-300 pr-6"
                      />
                      <span className="absolute right-2 top-1 text-xs text-slate-400 font-bold">%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-4 mt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowRatesModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingRates}
                onClick={handleSaveAllRates}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all disabled:opacity-50"
              >
                {savingRates ? 'Saving Rates...' : 'Save All Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
