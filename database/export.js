'use strict';

const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs');

/**
 * Export data tabular generik ke file Excel (.xlsx)
 * columns: [{ header: 'Nama Kolom', key: 'field', width: 20 }]
 * rows: array of plain objects
 */
async function exportToExcel(filePath, sheetName, columns, rows, title) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistem Kasir & Manajemen Usaha';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName.substring(0, 31));
  sheet.columns = columns;

  if (title) {
    sheet.spliceRows(1, 0, [title]);
    sheet.mergeCells(1, 1, 1, columns.length);
    sheet.getCell('A1').font = { bold: true, size: 13 };
    sheet.getRow(2).values = columns.map((c) => c.header);
    sheet.getRow(2).font = { bold: true };
    rows.forEach((r) => sheet.addRow(columns.map((c) => resolveValue(r, c.key))));
  } else {
    sheet.getRow(1).font = { bold: true };
    rows.forEach((r) => sheet.addRow(columns.map((c) => resolveValue(r, c.key))));
  }

  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E5EC' } } };
    });
  });

  await workbook.xlsx.writeFile(filePath);
  return { success: true, path: filePath };
}

function resolveValue(row, key) {
  return key.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), row);
}

/**
 * Export data tabular generik ke PDF sederhana (tabel + header judul)
 */
function exportToPDF(filePath, title, columns, rows, subtitle) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 36, size: 'A4', layout: columns.length > 6 ? 'landscape' : 'portrait' });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      doc.fontSize(16).fillColor('#16a34a').text(title, { align: 'left' });
      if (subtitle) doc.fontSize(10).fillColor('#6b7280').text(subtitle);
      doc.moveDown(0.8);

      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const colWidth = pageWidth / columns.length;
      let y = doc.y;

      function drawHeader() {
        doc.fontSize(9).fillColor('#111827').font('Helvetica-Bold');
        columns.forEach((col, i) => {
          doc.text(String(col.header), doc.page.margins.left + i * colWidth, y, { width: colWidth - 4 });
        });
        y += 16;
        doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).strokeColor('#e5e7eb').stroke();
        y += 4;
        doc.font('Helvetica');
      }

      drawHeader();

      doc.fontSize(8.5).fillColor('#1f2937');
      rows.forEach((row) => {
        if (y > doc.page.height - doc.page.margins.bottom - 20) {
          doc.addPage();
          y = doc.page.margins.top;
          drawHeader();
        }
        columns.forEach((col, i) => {
          const val = resolveValue(row, col.key);
          doc.text(val == null ? '-' : String(val), doc.page.margins.left + i * colWidth, y, { width: colWidth - 4 });
        });
        y += 15;
      });

      doc.end();
      stream.on('finish', () => resolve({ success: true, path: filePath }));
      stream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { exportToExcel, exportToPDF };
