// CSV & Excel Exporter with UTF-8 BOM and dynamic naming
import accountsAPI from '../api/accounts_api';

/**
 * Downloads data as Excel-compatible CSV with UTF-8 BOM
 */
export const downloadCSV = (filename, headers, rows) => {
  const csvContent = [
    headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','),
    ...rows.map(row => row.map(val => `"${String(val ?? '').replace(/"/g, '""')}"`).join(','))
  ].join('\r\n');

  // \uFEFF ensures Microsoft Excel detects UTF-8 correctly
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

/**
 * Downloads data as native Excel XML / XLS table format
 */
export const downloadExcel = (filename, sheetName, headers, rows) => {
  let xml = '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>';
  xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ';
  xml += 'xmlns:o="urn:schemas-microsoft-com:office:office" ';
  xml += 'xmlns:x="urn:schemas-microsoft-com:office:excel" ';
  xml += 'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">';
  xml += '<Styles>';
  xml += '<Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#0F172A" ss:Pattern="Solid"/></Style>';
  xml += '<Style ss:ID="Bold"><Font ss:Bold="1"/></Style>';
  xml += '</Styles>';
  xml += `<Worksheet ss:Name="${sheetName || 'Ledger'}"><Table>`;

  // Header row
  xml += '<Row ss:StyleID="Header">';
  headers.forEach(h => {
    xml += `<Cell><Data ss:Type="String">${h}</Data></Cell>`;
  });
  xml += '</Row>';

  // Data rows
  rows.forEach(r => {
    xml += '<Row>';
    r.forEach(v => {
      const isNum = typeof v === 'number' && !isNaN(v);
      xml += `<Cell><Data ss:Type="${isNum ? 'Number' : 'String'}">${v ?? ''}</Data></Cell>`;
    });
    xml += '</Row>';
  });

  xml += '</Table></Worksheet></Workbook>';

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xls') ? filename : `${filename}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

/**
 * Helper to log downloaded reports to the Reports History database
 */
export const logReportToHistory = async ({
  reportType,
  serviceType,
  targetName,
  targetId,
  fromDate,
  toDate,
  format,
  filename,
  totalGross,
  totalCharges,
  totalNet,
  totalCount,
  reportData
}) => {
  try {
    await accountsAPI.logReport({
      report_type: reportType,
      service_type: serviceType,
      target_name: targetName,
      target_id: targetId,
      from_date: fromDate || null,
      to_date: toDate || null,
      format,
      filename,
      total_gross: totalGross || 0,
      total_charges: totalCharges || 0,
      total_net: totalNet || 0,
      total_count: totalCount || 0,
      report_data: reportData || null
    });
  } catch (err) {
    console.warn('Failed to log report:', err);
  }
};
