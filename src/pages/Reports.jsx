import { useState, useEffect } from 'react';
import accountsAPI from '../api/accounts_api';
import { 
  FileSpreadsheet, Download, Trash2, Search, RefreshCw, 
  Filter, FileText, FileDown, CheckCircle2, Calendar 
} from 'lucide-react';
import { toast } from 'sonner';
import { downloadCSV, downloadExcel } from '../utils/exportHelpers';
import { generateMerchantLedgerPDF, generateAcquirerLedgerPDF, formatINR } from '../utils/pdfGenerator';

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reportTypeFilter, setReportTypeFilter] = useState('ALL');
  const [serviceTypeFilter, setServiceTypeFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total_items: 0, total_pages: 1 });

  useEffect(() => {
    fetchReports(1);
  }, [reportTypeFilter, serviceTypeFilter]);

  const fetchReports = async (page = 1) => {
    try {
      setLoading(true);
      const res = await accountsAPI.getReportsHistory({
        page,
        limit: 15,
        report_type: reportTypeFilter,
        service_type: serviceTypeFilter,
        search: searchQuery
      });
      if (res.success) {
        setReports(res.reports || []);
        setPagination(res.pagination || { page: 1, limit: 15, total_items: 0, total_pages: 1 });
      } else {
        toast.error(res.message || 'Failed to load report history');
      }
    } catch (err) {
      toast.error('Error fetching reports history: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchReports(1);
  };

  const handleDelete = async (reportId) => {
    if (!confirm('Are you sure you want to remove this report entry from history?')) return;
    try {
      const res = await accountsAPI.deleteReport(reportId);
      if (res.success) {
        toast.success('Report history entry deleted');
        fetchReports(pagination.page);
      }
    } catch (err) {
      toast.error('Failed to delete report log');
    }
  };

  // Re-download report from logged data or trigger download
  const handleReDownload = (rep) => {
    try {
      const fmt = (rep.format || 'CSV').toUpperCase();
      const data = rep.report_data || {};
      const summary = data.summary || {
        total_txns: rep.total_count,
        total_gross: rep.total_gross,
        total_charges: rep.total_charges,
        total_net: rep.total_net,
        effective_rate: rep.total_gross > 0 ? ((rep.total_charges / rep.total_gross) * 100).toFixed(2) : 0
      };
      const items = data.items || [];

      if (rep.report_type === 'MERCHANT_LEDGER') {
        if (fmt === 'PDF') {
          generateMerchantLedgerPDF(
            { merchant_id: rep.target_id || rep.target_name, full_name: rep.target_name },
            rep.service_type,
            rep.from_date,
            rep.to_date,
            summary,
            items,
            'Standard Scheme',
            data.slab || 'Standard'
          );
          toast.success(`Re-downloaded ${rep.filename}`);
        } else if (fmt === 'EXCEL') {
          const headers = ['Date (IST)', 'Txn Count', 'Gross Amount (INR)', 'Charges Cut (INR)', 'Net Amount (INR)', 'Effective Rate (%)'];
          const rows = items.map(it => [it.date, it.txns_count, it.gross_amount, it.charge_amount, it.net_amount, `${it.effective_rate}%`]);
          rows.push(['TOTAL', summary.total_txns, summary.total_gross, summary.total_charges, summary.total_net, `${summary.effective_rate}%`]);
          downloadExcel(rep.filename, `${rep.service_type} Ledger`, headers, rows);
          toast.success(`Re-downloaded ${rep.filename}`);
        } else {
          // CSV
          const headers = ['Date (IST)', 'Txn Count', 'Gross Raw Volume (INR)', 'Charges Deducted (INR)', 'Net Settleable (INR)', 'Effective Fee Rate (%)'];
          const rows = items.map(it => [it.date, it.txns_count, it.gross_amount, it.charge_amount, it.net_amount, `${it.effective_rate}%`]);
          rows.push(['GRAND TOTAL', summary.total_txns, summary.total_gross, summary.total_charges, summary.total_net, `${summary.effective_rate}%`]);
          downloadCSV(rep.filename, headers, rows);
          toast.success(`Re-downloaded ${rep.filename}`);
        }
      } else {
        // ACQUIRER_LEDGER
        if (fmt === 'PDF') {
          generateAcquirerLedgerPDF(rep.service_type, rep.from_date, rep.to_date, summary, items, rep.target_name);
          toast.success(`Re-downloaded ${rep.filename}`);
        } else if (fmt === 'EXCEL') {
          const headers = ['Acquirer Gateway Name', 'Service', 'Txn Count', 'Raw Volume (INR)', 'Vendor Charge Rate', 'Vendor Fees Cut (INR)', 'Net Volume (INR)'];
          const rows = items.map(it => [it.api_name, it.service_type, it.txns_count, it.raw_volume, `${it.charge_percentage}%`, it.charges_cut, it.net_volume]);
          downloadExcel(rep.filename, `Acquirer ${rep.service_type}`, headers, rows);
          toast.success(`Re-downloaded ${rep.filename}`);
        } else {
          const headers = ['Acquirer API Name', 'Service', 'Txn Count', 'Raw Volume (INR)', 'Vendor Rate (%)', 'Charges Cut from Us (INR)', 'Net Volume Retained (INR)'];
          const rows = items.map(it => [it.api_name, it.service_type, it.txns_count, it.raw_volume, `${it.charge_percentage}%`, it.charges_cut, it.net_volume]);
          downloadCSV(rep.filename, headers, rows);
          toast.success(`Re-downloaded ${rep.filename}`);
        }
      }
    } catch (err) {
      toast.error('Re-download failed: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <FileSpreadsheet className="h-7 w-7 text-emerald-600" />
            <span>Reports &amp; Download History</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Complete audit trail of all generated statements, billing PDFs, and ledger exports
          </p>
        </div>

        <button
          onClick={() => fetchReports(pagination.page)}
          className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 hover:bg-slate-50 transition-all shadow-xs self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh List</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by target merchant, acquirer or filename..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Report Type Filter */}
            <select
              value={reportTypeFilter}
              onChange={(e) => setReportTypeFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-semibold text-slate-700"
            >
              <option value="ALL">All Report Types</option>
              <option value="MERCHANT_LEDGER">Merchant Ledger</option>
              <option value="ACQUIRER_LEDGER">Acquirer Ledger</option>
            </select>

            {/* Service Type Filter */}
            <select
              value={serviceTypeFilter}
              onChange={(e) => setServiceTypeFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white font-semibold text-slate-700"
            >
              <option value="ALL">All Services</option>
              <option value="PAYIN">Payins</option>
              <option value="PAYOUT">Payouts</option>
            </select>

            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5"
            >
              <Filter className="h-3.5 w-3.5" />
              <span>Apply Filter</span>
            </button>
          </div>
        </form>
      </div>

      {/* Reports Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-extrabold text-slate-600 uppercase tracking-wider">
                <th className="py-3.5 px-4">Generated At (IST)</th>
                <th className="py-3.5 px-4">Report Module</th>
                <th className="py-3.5 px-4">Target Name / ID</th>
                <th className="py-3.5 px-4">Statement Period</th>
                <th className="py-3.5 px-4 text-right">Gross Volume</th>
                <th className="py-3.5 px-4 text-right">Fees / Charges Cut</th>
                <th className="py-3.5 px-4 text-right">Net Volume</th>
                <th className="py-3.5 px-4 text-center">Format</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-500">
                    <RefreshCw className="h-6 w-6 animate-spin text-emerald-600 mx-auto mb-2" />
                    Loading report audit history...
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-slate-400">
                    <FileSpreadsheet className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                    No generated reports logged in history yet. Download a statement from Merchant or Acquirer Ledger to see it here.
                  </td>
                </tr>
              ) : (
                reports.map((rep) => (
                  <tr key={rep.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                      {rep.created_at}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                          rep.service_type === 'PAYIN' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {rep.service_type}
                        </span>
                        <span className="font-bold text-slate-800">
                          {rep.report_type === 'MERCHANT_LEDGER' ? 'Merchant Ledger' : 'Acquirer Ledger'}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap font-bold text-slate-900">
                      {rep.target_name}
                      {rep.target_id && <span className="block text-[11px] font-mono text-slate-400 font-normal">{rep.target_id}</span>}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                      {rep.from_date || 'Start'} &rarr; {rep.to_date || 'Present'}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                      {formatINR(rep.total_gross)}
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-rose-600 font-semibold whitespace-nowrap">
                      - {formatINR(rep.total_charges)}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-black text-emerald-700 bg-emerald-50/20 whitespace-nowrap">
                      {formatINR(rep.total_net)}
                    </td>

                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black tracking-wider uppercase ${
                        rep.format === 'PDF' 
                          ? 'bg-rose-100 text-rose-700 border border-rose-200' 
                          : rep.format === 'EXCEL' 
                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {rep.format}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleReDownload(rep)}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs transition-all"
                          title="Download report again"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>Download</span>
                        </button>
                        <button
                          onClick={() => handleDelete(rep.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                          title="Delete from history"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.total_pages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total_items)} of {pagination.total_items} items
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchReports(pagination.page - 1)}
                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="px-2 font-bold">{pagination.page} / {pagination.total_pages}</span>
              <button
                disabled={pagination.page >= pagination.total_pages}
                onClick={() => fetchReports(pagination.page + 1)}
                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
