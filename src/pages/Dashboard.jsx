import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, Server, FileSpreadsheet, ArrowRight, ShieldCheck, 
  TrendingUp, ArrowDownRight, ArrowUpRight, DollarSign, Clock 
} from 'lucide-react';
import accountsAPI from '../api/accounts_api';
import { formatINR } from '../utils/pdfGenerator';

export default function Dashboard() {
  const navigate = useNavigate();
  const [merchantsCount, setMerchantsCount] = useState(0);
  const [recentReportsCount, setRecentReportsCount] = useState(0);

  useEffect(() => {
    loadOverview();
  }, []);

  const loadOverview = async () => {
    try {
      const mRes = await accountsAPI.getMerchantsList();
      if (mRes.success) setMerchantsCount((mRes.merchants || []).length);

      const rRes = await accountsAPI.getReportsHistory({ limit: 5 });
      if (rRes.success) setRecentReportsCount(rRes.pagination?.total_items || 0);
    } catch (err) {
      console.warn('Dashboard stats load error:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 sm:p-8 text-white shadow-xl border border-slate-800">
        <div className="relative z-10 max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="h-4 w-4" />
            <span>PAY101 FINANCIAL DESK</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Accounts &amp; Settlement Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Welcome to the centralized accounting portal. Audit raw turnover before fees, calculate exact merchant commercial deductions, reconcile acquirer gateway costs, and generate verified settlement statements.
          </p>
        </div>
      </div>

      {/* Module Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        {/* 1. Merchants Ledger */}
        <div
          onClick={() => navigate('/merchants-ledger')}
          className="group cursor-pointer bg-white p-6 rounded-2xl border border-slate-200/90 hover:border-emerald-500 hover:shadow-lg transition-all duration-200 flex flex-col justify-between"
        >
          <div>
            <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <Building2 className="h-6 w-6" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900 mb-1">Merchants Ledger</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Analyze merchant turnover for Payins and Payouts. Displays applicable commercial fee slabs, raw volume, charges cut, and net settleable amounts.
            </p>
          </div>
          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-700">
            <span>{merchantsCount} Merchants Available</span>
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* 2. Acquirer Ledger */}
        <div
          onClick={() => navigate('/acquirer-ledger')}
          className="group cursor-pointer bg-white p-6 rounded-2xl border border-slate-200/90 hover:border-blue-500 hover:shadow-lg transition-all duration-200 flex flex-col justify-between"
        >
          <div>
            <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <Server className="h-6 w-6" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900 mb-1">Acquirer Ledger</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Reconcile all registered payment gateways (Viyonapay, HDFC Paytouch, MMP Trendigo, etc.). Configure acquirer percentage rates and audit cost of funds.
            </p>
          </div>
          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-blue-700">
            <span>Live Gateway Reconciliation</span>
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* 3. Reports & History */}
        <div
          onClick={() => navigate('/reports')}
          className="group cursor-pointer bg-white p-6 rounded-2xl border border-slate-200/90 hover:border-purple-500 hover:shadow-lg transition-all duration-200 flex flex-col justify-between"
        >
          <div>
            <div className="h-12 w-12 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900 mb-1">Reports History</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Complete historical archive of all generated statements, Excel spreadsheets, and billing settlement PDFs with one-click re-download capability.
            </p>
          </div>
          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-purple-700">
            <span>{recentReportsCount} Logged Statements</span>
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>

      {/* Audit Guidelines Box */}
      <div className="rounded-2xl bg-white border border-slate-200/90 p-5 shadow-xs">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Accounting Guidelines &amp; Protocol:</h4>
        <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-5 leading-relaxed">
          <li>All daily turnovers and transaction summaries are computed strictly in <strong>Indian Standard Time (IST)</strong> matching the primary database.</li>
          <li>Commercial fee slabs automatically load from the merchant's assigned commercial scheme in the database.</li>
          <li>Acquirer rates can be adjusted individually per gateway API or universally set across all active gateways.</li>
          <li>Exported billing statements in PDF format follow official banking settlement structure ready for merchant distribution.</li>
        </ul>
      </div>
    </div>
  );
}
