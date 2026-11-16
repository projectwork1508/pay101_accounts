// Professional Settlement Statement & Ledger PDF Generator
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const formatINR = (val) => {
  const num = Number(val) || 0;
  return 'Rs. ' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const generateMerchantLedgerPDF = (merchant, serviceType, fromDate, toDate, summary, items, schemeName, slabSummary) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Colors
  const primaryColor = [15, 23, 42]; // Slate-900
  const emeraldColor = [16, 185, 129]; // Emerald-500
  const accentColor = [5, 150, 105]; // Emerald-600
  const lightBg = [248, 250, 252]; // Slate-50

  // 1. Header Banner
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 36, 'F');

  doc.setFillColor(...emeraldColor);
  doc.rect(0, 36, pageWidth, 2, 'F');

  // Title & Brand
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('PAY101 ACCOUNTS DIVISION', 14, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(203, 213, 225);
  doc.text('Financial Settlement & Merchant Billing Statement', 14, 26);

  // Statement Meta right side
  doc.setFontSize(9);
  doc.setTextColor(241, 245, 249);
  const stmtNo = `STM-${Date.now().toString().slice(-8)}`;
  doc.text(`Statement No: ${stmtNo}`, pageWidth - 14, 16, { align: 'right' });
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`, pageWidth - 14, 22, { align: 'right' });
  doc.text(`Service: ${serviceType} LEDGER`, pageWidth - 14, 28, { align: 'right' });

  // 2. Billing & Commercial Slab Box
  doc.setFillColor(...lightBg);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 44, pageWidth - 28, 38, 2, 2, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('BILL TO / MERCHANT DETAILS:', 20, 52);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(`Merchant Name: ${merchant.full_name || merchant.merchant_id}`, 20, 59);
  doc.text(`Merchant ID: ${merchant.merchant_id}`, 20, 65);
  doc.text(`Mobile / Contact: ${merchant.mobile || 'N/A'}  |  Email: ${merchant.email || 'N/A'}`, 20, 71);

  // Right column of box: Commercials
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('COMMERCIAL SLAB & PERIOD:', pageWidth / 2 + 5, 52);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(`Commercial Scheme: ${schemeName || 'Standard'}`, pageWidth / 2 + 5, 59);
  doc.text(`Applicable Charge Slab: ${slabSummary || 'As per agreement'}`, pageWidth / 2 + 5, 65);
  doc.text(`Statement Period: ${fromDate || 'All Time'} to ${toDate || 'Present'}`, pageWidth / 2 + 5, 71);

  // 3. Financial Summary Key Figures
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(14, 88, pageWidth - 28, 24, 2, 2, 'FD');

  const colW = (pageWidth - 28) / 4;

  // Box 1: Txns
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL TXNS', 14 + colW * 0.5, 96, { align: 'center' });
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${summary.total_txns || 0}`, 14 + colW * 0.5, 105, { align: 'center' });

  // Box 2: Gross
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('GROSS VOLUME (RAW)', 14 + colW * 1.5, 96, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(formatINR(summary.total_gross), 14 + colW * 1.5, 105, { align: 'center' });

  // Box 3: Charges
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(190, 18, 60);
  doc.text('CHARGES CUT (FEES)', 14 + colW * 2.5, 96, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(190, 18, 60);
  doc.text(`- ${formatINR(summary.total_charges)}`, 14 + colW * 2.5, 105, { align: 'center' });

  // Box 4: Net
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(5, 150, 105);
  doc.text('NET SETTLEABLE AMOUNT', 14 + colW * 3.5, 96, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(5, 150, 105);
  doc.text(formatINR(summary.total_net), 14 + colW * 3.5, 105, { align: 'center' });

  // 4. Daily Ledger Breakdown Table
  const tableData = items.map((it) => [
    it.date,
    it.txns_count.toString(),
    formatINR(it.gross_amount),
    formatINR(it.charge_amount),
    formatINR(it.net_amount),
    `${it.effective_rate}%`
  ]);

  autoTable(doc, {
    startY: 118,
    head: [['Date (IST)', 'Txn Count', 'Gross Amount (₹)', 'Charges Deducted (₹)', 'Net Settleable (₹)', 'Effective Rate']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold',
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [51, 65, 85]
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 28 },
      1: { halign: 'center', cellWidth: 22 },
      2: { halign: 'right', cellWidth: 36 },
      3: { halign: 'right', cellWidth: 34, textColor: [190, 18, 60] },
      4: { halign: 'right', cellWidth: 38, fontStyle: 'bold', textColor: [5, 150, 105] },
      5: { halign: 'center', cellWidth: 24 }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    margin: { left: 14, right: 14 },
    foot: [[
      'GRAND TOTAL',
      `${summary.total_txns || 0}`,
      formatINR(summary.total_gross),
      formatINR(summary.total_charges),
      formatINR(summary.total_net),
      `${summary.effective_rate}%`
    ]],
    footStyles: {
      fillColor: [226, 232, 240],
      textColor: [15, 23, 42],
      fontSize: 9,
      fontStyle: 'bold'
    }
  });

  // 5. Signature & Footer Note
  const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 14 : 220;
  if (finalY + 35 < pageHeight) {
    doc.setDrawColor(203, 213, 225);
    doc.line(14, finalY + 16, 65, finalY + 16);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Prepared by Accounts Desk', 14, finalY + 20);

    doc.line(pageWidth - 65, finalY + 16, pageWidth - 14, finalY + 16);
    doc.text('Authorized Finance Signatory', pageWidth - 14, finalY + 20, { align: 'right' });

    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('This is a computer generated financial ledger and does not require a physical seal. Powered by Pay101 Ledger Engine.', pageWidth / 2, pageHeight - 10, { align: 'center' });
  }

  // Dynamic Filename
  const cleanMerchant = (merchant.full_name || merchant.merchant_id || 'Merchant').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `MerchantLedger_${serviceType}_${cleanMerchant}_${fromDate || 'start'}_to_${toDate || 'present'}.pdf`;
  doc.save(filename);
  return filename;
};

export const generateAcquirerLedgerPDF = (serviceType, fromDate, toDate, summary, items, selectedApiName = 'All Acquirers') => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const primaryColor = [15, 23, 42]; // Slate-900
  const blueColor = [37, 99, 235]; // Blue-600

  // 1. Header
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 36, 'F');
  doc.setFillColor(...blueColor);
  doc.rect(0, 36, pageWidth, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('PAY101 ACQUIRER RECONCILIATION', 14, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(203, 213, 225);
  doc.text(`Payment Gateway Vendor & Acquirer Ledger (${serviceType})`, 14, 26);

  doc.setFontSize(9);
  doc.setTextColor(241, 245, 249);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, pageWidth - 14, 18, { align: 'right' });
  doc.text(`Period: ${fromDate || 'All Time'} to ${toDate || 'Present'}`, pageWidth - 14, 26, { align: 'right' });

  // 2. Summary Box
  doc.setFillColor(240, 249, 255);
  doc.setDrawColor(186, 230, 253);
  doc.roundedRect(14, 44, pageWidth - 28, 22, 2, 2, 'FD');

  const colW = (pageWidth - 28) / 4;
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('ACTIVE APIS', 14 + colW * 0.5, 52, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${summary.active_acquirers_count || 0}`, 14 + colW * 0.5, 60, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL RAW VOLUME', 14 + colW * 1.5, 52, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(formatINR(summary.total_raw_volume), 14 + colW * 1.5, 60, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(190, 18, 60);
  doc.text('ACQUIRER FEES CUT', 14 + colW * 2.5, 52, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(190, 18, 60);
  doc.text(`- ${formatINR(summary.total_charges_cut)}`, 14 + colW * 2.5, 60, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(5, 150, 105);
  doc.text('NET VOLUME RETAINED', 14 + colW * 3.5, 52, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(5, 150, 105);
  doc.text(formatINR(summary.total_net_volume), 14 + colW * 3.5, 60, { align: 'center' });

  // 3. Table of Acquirers
  const tableData = items.map((it) => [
    it.api_name,
    it.txns_count.toString(),
    formatINR(it.raw_volume),
    `${it.charge_percentage.toFixed(2)}%`,
    formatINR(it.charges_cut),
    formatINR(it.net_volume)
  ]);

  autoTable(doc, {
    startY: 72,
    head: [['Acquirer / Gateway Name', 'Txns', 'Raw Volume (₹)', 'Vendor Rate', 'Vendor Fee Cut (₹)', 'Net Volume (₹)']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold'
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [51, 65, 85]
    },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { halign: 'center', cellWidth: 18 },
      2: { halign: 'right', cellWidth: 32 },
      3: { halign: 'center', cellWidth: 24 },
      4: { halign: 'right', cellWidth: 30, textColor: [190, 18, 60] },
      5: { halign: 'right', cellWidth: 32, fontStyle: 'bold', textColor: [5, 150, 105] }
    },
    margin: { left: 14, right: 14 },
    foot: [[
      'GRAND TOTAL',
      `${summary.total_txns || 0}`,
      formatINR(summary.total_raw_volume),
      `${summary.effective_rate}% Avg`,
      formatINR(summary.total_charges_cut),
      formatINR(summary.total_net_volume)
    ]],
    footStyles: {
      fillColor: [226, 232, 240],
      textColor: [15, 23, 42],
      fontSize: 9,
      fontStyle: 'bold'
    }
  });

  const cleanName = selectedApiName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `AcquirerLedger_${serviceType}_${cleanName}_${fromDate || 'start'}_to_${toDate || 'present'}.pdf`;
  doc.save(filename);
  return filename;
};
