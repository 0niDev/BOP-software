"""Report export utilities - PDF, Excel, CSV, Print."""
from __future__ import annotations

import csv
import os
from datetime import datetime
from io import BytesIO
from typing import Any

from PySide6.QtCore import Qt, QMarginsF
from PySide6.QtGui import QTextDocument, QPageLayout, QPageSize
from PySide6.QtPrintSupport import QPrinter, QPrintDialog
from PySide6.QtWidgets import QApplication, QFileDialog, QMessageBox, QTextEdit, QDialog, QVBoxLayout, QHBoxLayout, QPushButton, QLabel

from utils.logger import get_logger

logger = get_logger(__name__)


class ReportExporter:
    """Export reports to various formats."""

    @staticmethod
    def print_report(text_edit: QTextEdit, title: str = "Report") -> bool:
        """Print the report directly."""
        try:
            printer = QPrinter(QPrinter.HighResolution)
            
            # Create page layout with proper margins
            page_layout = QPageLayout(
                QPageSize(QPageSize.A4),
                QPageLayout.Orientation.Portrait,
                QMarginsF(10, 10, 10, 10),  # margins in mm
                QPageLayout.Unit.Millimeter
            )
            printer.setPageLayout(page_layout)
            printer.setDocName(title)
            printer.setCreator("Pharmaceutical ERP")
            
            dialog = QPrintDialog(printer)
            if dialog.exec() != QPrintDialog.Accepted:
                return False
            
            doc = QTextDocument()
            doc.setHtml(text_edit.toHtml())
            doc.print_(printer)
            return True
            
        except Exception as e:
            logger.exception(f"Print failed: {e}")
            return False

    @staticmethod
    def export_pdf(text_edit: QTextEdit, default_filename: str = "report.pdf") -> bool:
        """Export report to PDF."""
        try:
            file_path, _ = QFileDialog.getSaveFileName(
                None,
                "Save PDF",
                default_filename,
                "PDF Files (*.pdf)"
            )
            
            if not file_path:
                return False
            
            if not file_path.endswith('.pdf'):
                file_path += '.pdf'
            
            printer = QPrinter(QPrinter.HighResolution)
            printer.setOutputFormat(QPrinter.PdfFormat)
            printer.setOutputFileName(file_path)
            
            # Create page layout with proper margins
            page_layout = QPageLayout(
                QPageSize(QPageSize.A4),
                QPageLayout.Orientation.Portrait,
                QMarginsF(10, 10, 10, 10),  # margins in mm
                QPageLayout.Unit.Millimeter
            )
            printer.setPageLayout(page_layout)
            printer.setDocName(default_filename)
            
            doc = QTextDocument()
            doc.setHtml(text_edit.toHtml())
            doc.print_(printer)
            
            QMessageBox.information(None, "Success", f"PDF exported to:\n{file_path}")
            logger.info(f"PDF exported: {file_path}")
            return True
            
        except Exception as e:
            logger.exception(f"PDF export failed: {e}")
            QMessageBox.warning(None, "Export Failed", f"Failed to export PDF:\n{str(e)}")
            return False

    @staticmethod
    def _normalized_row_values(table_info: dict, row_idx: int) -> list:
        """Return normalized cell values for ``row_idx`` (1-based) of a
        parsed table, applying the TB Net Debit/Credit merge and section
        banner collapse."""
        rows = table_info.get('rows', []) or []
        data = table_info.get('data', []) or []
        if row_idx - 1 >= len(rows):
            return []
        row_meta = rows[row_idx - 1]
        cells_meta = row_meta.get('cells', [])
        is_header = any('th' in (c.get('tag', '')) for c in cells_meta)
        is_section = 'section-title' in row_meta.get('classes', [])
        _, norm_data = ReportExporter._normalize_export_row(
            cells_meta,
            data[row_idx - 1] if row_idx - 1 < len(data) else [],
            is_header,
            is_section,
            merge_idx=ReportExporter._find_net_merge_index(rows),
        )
        return norm_data

    @staticmethod
    def export_excel(text_edit: QTextEdit, default_filename: str = "report.xlsx") -> bool:
        """Export report to Excel with borders, fills, and formatting matching the PDF."""
        try:
            from openpyxl import Workbook
            
            file_path, _ = QFileDialog.getSaveFileName(
                None,
                "Save Excel",
                default_filename,
                "Excel Files (*.xlsx)"
            )
            
            if not file_path:
                return False
            
            if not file_path.endswith('.xlsx'):
                file_path += '.xlsx'
            
            html = text_edit.toHtml()
            styled_tables = ReportExporter._parse_html_table_styled(html)
            
            if not styled_tables:
                # Fallback: plain table without styling
                wb = Workbook()
                ws = wb.active
                data = ReportExporter._parse_html_table(html)
                if not data:
                    data = ReportExporter._parse_html_text(html)
                for row_idx, row in enumerate(data, 1):
                    for col_idx, value in enumerate(row, 1):
                        ws.cell(row=row_idx, column=col_idx, value=value)
                ReportExporter._apply_excel_styling(ws, {'data': data, 'rows': []})
                wb.save(file_path)
            elif len(styled_tables) == 1:
                wb = Workbook()
                ws = wb.active
                ws.title = "Report"
                table_info = styled_tables[0]
                for row_idx in range(1, len(table_info['rows']) + 1):
                    for col_idx, value in enumerate(
                            ReportExporter._normalized_row_values(table_info, row_idx), 1):
                        ws.cell(row=row_idx, column=col_idx, value=value)
                ReportExporter._apply_excel_styling(ws, table_info)
                wb.save(file_path)
            else:
                # Multiple tables: put each on its own sheet
                wb = Workbook()
                wb.remove(wb.active)
                for idx, table_info in enumerate(styled_tables):
                    data = table_info['data']
                    if not data:
                        continue
                    ws = wb.create_sheet(title=f"Table {idx + 1}")
                    for row_idx, row in enumerate(data, 1):
                        for col_idx, value in enumerate(row, 1):
                            ws.cell(row=row_idx, column=col_idx, value=value)
                    ReportExporter._apply_excel_styling(ws, table_info)
                if not wb.sheetnames:
                    wb.create_sheet(title="Report")
                wb.save(file_path)
            
            QMessageBox.information(None, "Success", f"Excel exported to:\n{file_path}")
            logger.info(f"Excel exported: {file_path}")
            return True
            
        except ImportError:
            QMessageBox.warning(None, "Missing Library",
                "openpyxl is not installed.\nPlease install it with:\npip install openpyxl")
            return False
        except Exception as e:
            logger.exception(f"Excel export failed: {e}")
            QMessageBox.warning(None, "Export Failed", f"Failed to export Excel:\n{str(e)}")
            return False

    @staticmethod
    def export_csv(text_edit: QTextEdit, default_filename: str = "report.csv") -> bool:
        """Export report to CSV."""
        try:
            file_path, _ = QFileDialog.getSaveFileName(
                None,
                "Save CSV",
                default_filename,
                "CSV Files (*.csv)"
            )
            
            if not file_path:
                return False
            
            if not file_path.endswith('.csv'):
                file_path += '.csv'
            
            html = text_edit.toHtml()
            data = ReportExporter._parse_html_table(html)
            
            if not data:
                data = ReportExporter._parse_html_text(html)
            
            with open(file_path, 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                for row in data:
                    writer.writerow(row)
            
            QMessageBox.information(None, "Success", f"CSV exported to:\n{file_path}")
            logger.info(f"CSV exported: {file_path}")
            return True
            
        except Exception as e:
            logger.exception(f"CSV export failed: {e}")
            QMessageBox.warning(None, "Export Failed", f"Failed to export CSV:\n{str(e)}")
            return False

    @staticmethod
    def _coerce_cell_value(text):
        """Convert display text into a numeric Excel value where possible.

        Handles plain numbers, thousands separators, 'Rs.' prefixes,
        accounting parentheses (negative), +/- prefixes and party balance
        labels. 'Receivable: Rs. x' becomes +x and 'Payable: Rs. x' becomes
        -x so exported sheets carry signed +/- balances instead of Dr/Cr
        words; 'Nil' becomes 0.
        """
        if text is None:
            return None
        t = str(text).replace('\u00a0', ' ').strip()
        if not t:
            return None
        negative = False
        low = t.lower()
        if low.startswith('payable:'):
            negative = True
            t = t.split(':', 1)[1].strip()
        elif low.startswith('receivable:'):
            t = t.split(':', 1)[1].strip()
        elif t == 'Nil':
            return 0.0
        if t.startswith('(') and t.endswith(')'):
            negative = True
            t = t[1:-1].strip()
        sign = 1.0
        if t.startswith('-'):
            sign = -1.0
            t = t[1:].strip()
        elif t.startswith('+'):
            t = t[1:].strip()
        cleaned = t.replace('Rs.', '').replace('Rs', '').replace(',', '').strip()
        try:
            val = float(cleaned) * sign
        except ValueError:
            return t
        return -val if negative else val

    @staticmethod
    def _apply_cell_number_format(cell, raw_text: str, value,
                                  signed: bool = False, cell_classes: str = '') -> None:
        """Apply an Excel number format so amounts show as formatted figures
        (thousands separators, +/- prefixes) instead of raw numbers.

        - Signed columns (Net Balance) show an explicit +/- prefix.
        - Currency text ('Rs. x', parentheses, Receivable/Payable labels)
          gets '#,##0.00' with negatives in parentheses.
        - Other right-aligned numeric amounts get '#,##0.00'.
        - Non-right-aligned cells (account/party codes, labels) are left
          unformatted.
        """
        if value is None or isinstance(value, bool) or not isinstance(value, (int, float)):
            return
        if not signed and 'right' not in (cell_classes or ''):
            return
        t = (raw_text or '').replace('\u00a0', ' ').strip().lower()
        if signed:
            cell.number_format = '+#,##0.00;-#,##0.00;0.00'
        elif 'rs.' in t or 'payable' in t or 'receivable' in t or (t.startswith('(') and t.endswith(')')):
            cell.number_format = '#,##0.00;(#,##0.00)'
        else:
            cell.number_format = '#,##0.00'

    @staticmethod
    def _find_net_merge_index(rows: list) -> tuple[int, int] | None:
        """Return (net_debit_idx, net_credit_idx) located in the table's
        header row, or None when the table has no such columns."""
        for probe in rows:
            probe_cells = probe.get('cells', [])
            if any('th' in (c.get('tag', '')) for c in probe_cells):
                texts = [str(c.get('value', '')).strip() for c in probe_cells]
                if 'Net Debit' in texts:
                    nd = texts.index('Net Debit')
                    nc = texts.index('Net Credit') if 'Net Credit' in texts else -1
                    if nc == nd + 1:
                        return (nd, nc)
                break
        return None

    @staticmethod
    def _find_signed_columns(rows: list, merge_idx: tuple | None) -> set:
        """Return 0-based column indexes that must show signed +/- amounts.

        Includes the merged Trial Balance 'Net Balance' column and any
        header column literally named 'Net Balance' (e.g. the Parties
        Summary receivable/payable column).
        """
        signed: set = set()
        if merge_idx:
            signed.add(merge_idx[0])
        for probe in rows:
            probe_cells = probe.get('cells', [])
            if any('th' in (c.get('tag', '')) for c in probe_cells):
                for i, c in enumerate(probe_cells):
                    if str(c.get('value', '')).strip() == 'Net Balance':
                        signed.add(i)
                break
        return signed

    @staticmethod
    def _normalize_export_row(cells_meta: list, data_row: list,
                              is_header: bool, is_section: bool,
                              merge_idx: tuple | None = None) -> tuple[list, list]:
        """Normalize one parsed report row for Excel output.

        - Collapses section banner rows (e.g. 'ASSETS') to their first cell.
        - When ``merge_idx`` (from ``_find_net_merge_index``) is given, merges
          the Trial Balance 'Net Debit'/'Net Credit' columns into a single
          signed 'Net Balance' column (positive = Dr / receivable,
          negative = Cr / payable) instead of two raw columns.
        """
        def _num(v):
            return v if isinstance(v, (int, float)) and not isinstance(v, bool) else 0.0

        if is_section and cells_meta:
            label = data_row[0] if data_row else cells_meta[0].get('value', '')
            return [cells_meta[0]], [label]

        if merge_idx:
            nd, nc = merge_idx
            if nd < len(cells_meta) and nc < len(cells_meta):
                new_cells = list(cells_meta)
                new_data = list(data_row)
                if is_header:
                    new_cells[nd] = dict(cells_meta[nd])
                    new_cells[nd]['value'] = 'Net Balance'
                    if nd < len(new_data):
                        new_data[nd] = 'Net Balance'
                else:
                    signed = _num(data_row[nd] if nd < len(data_row) else 0) - \
                             _num(data_row[nc] if nc < len(data_row) else 0)
                    merged = dict(cells_meta[nd])
                    merged['classes'] = 'right ' + (
                        'positive' if signed > 0 else 'negative' if signed < 0 else 'zero')
                    merged['value'] = f"{signed:,.2f}"
                    new_cells[nd] = merged
                    if nd < len(new_data):
                        new_data[nd] = signed
                new_cells.pop(nc)
                if nc < len(new_data):
                    new_data.pop(nc)
                return new_cells, new_data
        return cells_meta, data_row

    @staticmethod
    def _parse_html_table(html: str) -> list[list]:
        """Parse HTML table into 2D list."""
        try:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(html, 'html.parser')
            data = []
            
            tables = soup.find_all('table')
            if not tables:
                return []
            
            for table in tables:
                for row in table.find_all('tr'):
                    row_data = []
                    for cell in row.find_all(['td', 'th']):
                        text = cell.get_text(strip=True)
                        row_data.append(ReportExporter._coerce_cell_value(text))
                    if row_data:
                        data.append(row_data)
            
            return data
        except Exception as e:
            logger.warning(f"HTML table parsing failed: {e}")
            return []

    @staticmethod
    def _parse_html_table_styled(html: str) -> list[dict]:
        """Parse HTML tables returning cell metadata for Excel styling.

        Returns a list of dicts, one per table, each with:
          - 'data': 2D list of cell text values (same as _parse_html_table)
          - 'rows': list of row metadata dicts, each with:
              - 'classes': str – combined CSS classes of the <tr> element
              - 'cells': list of cell metadata dicts, each with:
                  - 'value': str – cell text
                  - 'classes': str – combined CSS classes of the <td>/<th>
                  - 'tag': str – 'th' or 'td'
                  - 'colspan': int
        """
        try:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(html, 'html.parser')
            results = []

            tables = soup.find_all('table')
            if not tables:
                return []

            for table in tables:
                table_data = []
                table_rows = []

                for tr in table.find_all('tr'):
                    tr_classes = ' '.join(tr.get('class', []))
                    row_data = []
                    row_cells = []
                    col_idx = 0

                    for cell in tr.find_all(['td', 'th']):
                        text = cell.get_text(strip=True)
                        cell_classes = ' '.join(cell.get('class', []))
                        colspan = int(cell.get('colspan', 1))
                        tag = cell.name

                        # Convert display text into a numeric value where possible
                        val = ReportExporter._coerce_cell_value(text)

                        # Every spanned column carries styling metadata so
                        # cells stay aligned with their headers across the
                        # sheet; only the first spanned cell keeps the value
                        for span_i in range(colspan):
                            row_data.append(val if span_i == 0 else None)
                            row_cells.append({
                                'value': text,
                                'classes': cell_classes,
                                'tag': tag,
                                'colspan': colspan,
                            })
                            col_idx += 1

                    if row_data:
                        table_data.append(row_data)
                        table_rows.append({
                            'classes': tr_classes,
                            'cells': row_cells,
                        })

                results.append({
                    'data': table_data,
                    'rows': table_rows,
                })

            return results
        except Exception as e:
            logger.warning(f"Styled HTML table parsing failed: {e}")
            return []

    @staticmethod
    def _parse_html_text(html: str) -> list[list]:
        """Parse HTML text into 2D list."""
        try:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(html, 'html.parser')
            text = soup.get_text()
            lines = text.strip().split('\n')
            data = []
            for line in lines:
                line = line.strip()
                if line and not line.startswith('=') and not line.startswith('-'):
                    import re
                    parts = re.split(r'\s{2,}|\t', line)
                    if len(parts) > 1:
                        data.append(parts)
                    else:
                        data.append([line])
            return data
        except Exception as e:
            logger.warning(f"HTML text parsing failed: {e}")
            return []

    @staticmethod
    def _apply_excel_styling(ws, table_info: dict) -> None:
        """Apply professional styling to an Excel worksheet matching PDF output.

        Maps CSS classes from the HTML report to openpyxl styles:
          - table headers: dark navy fill, white bold font
          - section-title: light gray fill, bold, top border
          - sub-head: very light gray fill, bold
          - total-row: very light gray fill, bold, top border
          - grand-total: slightly darker gray fill, bold, double top border
          - positive: green font
          - negative: red font
          - zero: muted gray font
          - right: right-aligned
          - All cells: thin bottom border
        """
        from openpyxl.styles import Font, PatternFill, Border, Side, Alignment

        thin_side = Side(style='thin', color='DEE2E6')
        medium_side = Side(style='medium', color='495057')
        double_side = Side(style='double', color='1A1A2E')

        thin_border = Border(bottom=thin_side)
        thin_top_border = Border(top=medium_side, bottom=thin_side)
        double_top_border = Border(top=double_side, bottom=thin_side)

        navy_fill = PatternFill(start_color='1A1A2E', end_color='1A1A2E', fill_type='solid')
        section_fill = PatternFill(start_color='E9ECEF', end_color='E9ECEF', fill_type='solid')
        subhead_fill = PatternFill(start_color='F8F9FA', end_color='F8F9FA', fill_type='solid')
        total_fill = PatternFill(start_color='F8F9FA', end_color='F8F9FA', fill_type='solid')
        grandtotal_fill = PatternFill(start_color='E9ECEF', end_color='E9ECEF', fill_type='solid')

        white_bold_font = Font(bold=True, color='FFFFFF', size=11)
        bold_font = Font(bold=True)
        green_font = Font(color='28A745')
        red_font = Font(color='DC3545')
        muted_font = Font(color='ADB5BD')

        right_align = Alignment(horizontal='right')
        left_align = Alignment(horizontal='left')
        center_align = Alignment(horizontal='center')

        rows = table_info['rows']
        data = table_info['data']
        # Locate the TB Net Debit/Credit columns (signed Net Balance)
        merge_idx = ReportExporter._find_net_merge_index(rows)
        signed_cols = ReportExporter._find_signed_columns(rows, merge_idx)

        for row_idx, row_meta in enumerate(rows, 1):
            tr_classes = row_meta['classes']
            cells_meta = row_meta['cells']
            is_header = any('th' in c['tag'] for c in cells_meta)
            is_section_row = 'section-title' in tr_classes
            # Merge TB Net Debit/Credit + collapse section banners so the
            # styled single-report export matches the Export All workbook
            cells_meta, _ = ReportExporter._normalize_export_row(
                cells_meta, [], is_header, is_section_row,
                merge_idx=merge_idx)

            # Determine row-level styling
            is_section = 'section-title' in tr_classes
            is_subhead = 'sub-head' in tr_classes
            is_total = 'total-row' in tr_classes
            is_grand_total = 'grand-total' in tr_classes

            for col_idx, cell_meta in enumerate(cells_meta, 1):
                cell = ws.cell(row=row_idx, column=col_idx)
                cc = cell_meta['classes']
                ReportExporter._apply_cell_number_format(
                    cell, cell_meta.get('value', ''), cell.value,
                    signed=(not is_header and (col_idx - 1) in signed_cols),
                    cell_classes=cc)

                # --- Background fills ---
                if is_header:
                    cell.fill = navy_fill
                elif is_grand_total:
                    cell.fill = grandtotal_fill
                elif is_section:
                    cell.fill = section_fill
                elif is_total:
                    cell.fill = total_fill
                elif is_subhead:
                    cell.fill = subhead_fill

                # --- Borders ---
                if is_grand_total:
                    cell.border = double_top_border
                elif is_total:
                    cell.border = thin_top_border
                elif is_section:
                    cell.border = Border(top=Side(style='medium', color='1A1A2E'), bottom=thin_side)
                else:
                    cell.border = thin_border

                # --- Fonts ---
                if is_header:
                    cell.font = white_bold_font
                elif is_grand_total or is_total or is_section or is_subhead:
                    cell.font = bold_font

                # Color classes
                if 'positive' in cc:
                    cell.font = Font(bold=cell.font.bold if cell.font else False, color='28A745')
                elif 'negative' in cc:
                    cell.font = Font(bold=cell.font.bold if cell.font else False, color='DC3545')
                elif 'zero' in cc:
                    cell.font = muted_font

                # --- Alignment ---
                if 'right' in cc or is_header:
                    cell.alignment = right_align
                else:
                    cell.alignment = left_align

        # Auto-width columns
        for col in ws.columns:
            max_length = 0
            column_letter = col[0].column_letter
            for cell in col:
                try:
                    if cell.value is not None:
                        cell_len = len(str(cell.value))
                        if cell_len > max_length:
                            max_length = cell_len
                except Exception:
                    pass
            adjusted = min(max_length + 3, 55)
            ws.column_dimensions[column_letter].width = adjusted

    @staticmethod
    def show_export_dialog(parent, text_edit: QTextEdit, report_name: str = "Report"):
        """Show a dialog with export options."""
        if not text_edit or not text_edit.toPlainText().strip():
            QMessageBox.information(parent, "No Data", "Please generate the report first.")
            return
        
        dialog = QDialog(parent)
        dialog.setWindowTitle("Export Report")
        dialog.setModal(True)
        dialog.resize(450, 250)
        
        layout = QVBoxLayout(dialog)
        
        label = QLabel(f"Export '{report_name.replace('_', ' ')}' to:")
        label.setStyleSheet("font-size: 14px; font-weight: bold;")
        layout.addWidget(label)
        
        btn_layout = QHBoxLayout()
        
        print_btn = QPushButton("🖨️ Print")
        print_btn.clicked.connect(lambda: ReportExporter.print_report(text_edit, report_name))
        print_btn.setMinimumHeight(50)
        print_btn.setMinimumWidth(80)
        btn_layout.addWidget(print_btn)
        
        pdf_btn = QPushButton("📄 PDF")
        pdf_btn.clicked.connect(lambda: ReportExporter.export_pdf(text_edit, f"{report_name}.pdf"))
        pdf_btn.setMinimumHeight(50)
        pdf_btn.setMinimumWidth(80)
        btn_layout.addWidget(pdf_btn)
        
        excel_btn = QPushButton("📊 Excel")
        excel_btn.clicked.connect(lambda: ReportExporter.export_excel(text_edit, f"{report_name}.xlsx"))
        excel_btn.setMinimumHeight(50)
        excel_btn.setMinimumWidth(80)
        btn_layout.addWidget(excel_btn)
        
        csv_btn = QPushButton("📋 CSV")
        csv_btn.clicked.connect(lambda: ReportExporter.export_csv(text_edit, f"{report_name}.csv"))
        csv_btn.setMinimumHeight(50)
        csv_btn.setMinimumWidth(80)
        btn_layout.addWidget(csv_btn)
        
        layout.addLayout(btn_layout)
        
        close_btn = QPushButton("Close")
        close_btn.clicked.connect(dialog.accept)
        close_btn.setMinimumHeight(30)
        layout.addWidget(close_btn)
        
        dialog.exec()
    @staticmethod
    def save_pdf_html(html: str, file_path: str) -> bool:
        """Write raw report HTML to a PDF at the given path (no dialog).

        Used by the batch "Export All" feature so multiple reports can be
        written straight into a chosen folder without a per-file prompt.
        """
        try:
            if not file_path.lower().endswith('.pdf'):
                file_path += '.pdf'
            printer = QPrinter(QPrinter.HighResolution)
            page_layout = QPageLayout(
                QPageSize(QPageSize.A4),
                QPageLayout.Orientation.Portrait,
                QMarginsF(10, 10, 10, 10),
                QPageLayout.Unit.Millimeter,
            )
            printer.setPageLayout(page_layout)
            printer.setOutputFormat(QPrinter.PdfFormat)
            printer.setOutputFileName(file_path)

            doc = QTextDocument()
            doc.setHtml(html)
            doc.print_(printer)
            logger.info(f"PDF saved: {file_path}")
            return True
        except Exception as e:
            logger.exception(f"PDF save failed: {e}")
            return False

    @staticmethod
    def save_excel_reports(reports: list[tuple[str, str]], file_path: str) -> bool:
        """Save multiple (sheet_title, html) reports into ONE .xlsx workbook.

        Each report becomes its own sheet; multiple HTML tables in a single
        report (e.g. Trial Balance + Parties Summary) are stacked on that
        report's sheet.
        """
        try:
            from openpyxl import Workbook

            wb = Workbook()
            wb.remove(wb.active)
            for title, html in reports:
                if not html or not html.strip():
                    continue
                name = (str(title)[:31]) or "Report"
                ws = wb.create_sheet(title=name)
                styled = ReportExporter._parse_html_table_styled(html)
                if styled:
                    ReportExporter._write_stacked_tables(ws, styled)
                else:
                    data = ReportExporter._parse_html_table(html)
                    if not data:
                        data = ReportExporter._parse_html_text(html)
                    for row_idx, row in enumerate(data, 1):
                        for col_idx, value in enumerate(row, 1):
                            ws.cell(row=row_idx, column=col_idx, value=value)
            if not wb.sheetnames:
                wb.create_sheet(title="Reports")
            wb.save(file_path)
            logger.info(f"Excel workbook saved: {file_path}")
            return True
        except ImportError:
            return False
        except Exception as e:
            logger.exception(f"Excel workbook save failed: {e}")
            return False
    @staticmethod
    def _write_stacked_tables(ws, styled_tables: list) -> None:
        """Write one or more parsed HTML tables to a worksheet, stacked vertically.

        ``styled_tables`` is the output of ``_parse_html_table_styled``: a list
        of dicts with ``data`` (matrix) and ``rows`` (row metadata incl. cells).
        """
        from openpyxl.styles import Font, PatternFill, Border, Side, Alignment

        thin_side = Side(style='thin', color='DEE2E6')
        medium_side = Side(style='medium', color='495057')
        double_side = Side(style='double', color='1A1A2E')
        thin_border = Border(bottom=thin_side)
        thin_top = Border(top=medium_side, bottom=thin_side)
        double_top = Border(top=double_side, bottom=thin_side)

        navy = PatternFill(start_color='1A1A2E', end_color='1A1A2E', fill_type='solid')
        section = PatternFill(start_color='E9ECEF', end_color='E9ECEF', fill_type='solid')
        subhead = PatternFill(start_color='F8F9FA', end_color='F8F9FA', fill_type='solid')
        total = PatternFill(start_color='F8F9FA', end_color='F8F9FA', fill_type='solid')
        grand = PatternFill(start_color='E9ECEF', end_color='E9ECEF', fill_type='solid')

        wb_font = Font(bold=True, color='FFFFFF', size=11)
        bold = Font(bold=True)
        green = Font(color='28A745')
        red = Font(color='DC3545')
        muted = Font(color='ADB5BD')
        right_align = Alignment(horizontal='right')
        left_align = Alignment(horizontal='left')

        cur_row = 1
        for table in styled_tables:
            data = table.get('data', []) or []
            rows = table.get('rows', []) or []
            # Locate the TB Net Debit/Credit columns (signed Net Balance)
            merge_idx = ReportExporter._find_net_merge_index(rows)
            signed_cols = ReportExporter._find_signed_columns(rows, merge_idx)
            local_idx = 0
            for row_meta in rows:
                tr_classes = row_meta.get('classes', [])
                cells_meta = row_meta.get('cells', [])
                is_header = any('th' in (c.get('tag', '')) for c in cells_meta)
                is_section = 'section-title' in tr_classes
                is_subhead = 'sub-head' in tr_classes
                is_total = 'total-row' in tr_classes
                is_grand = 'grand-total' in tr_classes
                data_row = data[local_idx] if local_idx < len(data) else []
                # Merge TB Net Debit/Credit into one signed column and
                # collapse section banners to their first cell
                cells_meta, data_row = ReportExporter._normalize_export_row(
                    cells_meta, data_row, is_header, is_section,
                    merge_idx=merge_idx)
                for col_idx, cm in enumerate(cells_meta, 1):
                    cell = ws.cell(row=cur_row, column=col_idx)
                    raw_text = cm.get('value', '')
                    value = data_row[col_idx - 1] if col_idx - 1 < len(data_row) else None
                    cc = cm.get('classes', [])
                    cell.value = value
                    ReportExporter._apply_cell_number_format(
                        cell, raw_text, value,
                        signed=(not is_header and (col_idx - 1) in signed_cols),
                        cell_classes=cc)
                    if is_header:
                        cell.fill = navy
                    elif is_grand:
                        cell.fill = grand
                    elif is_section:
                        cell.fill = section
                    elif is_total:
                        cell.fill = total
                    elif is_subhead:
                        cell.fill = subhead
                    if is_header:
                        cell.font = wb_font
                    elif is_grand or is_total or is_section or is_subhead:
                        cell.font = bold
                    if 'positive' in cc:
                        cell.font = green
                    elif 'negative' in cc:
                        cell.font = red
                    elif 'zero' in cc:
                        cell.font = muted
                    if is_grand:
                        cell.border = double_top
                    elif is_total:
                        cell.border = thin_top
                    elif is_section:
                        cell.border = Border(top=Side(style='medium', color='1A1A2E'), bottom=thin_side)
                    else:
                        cell.border = thin_border
                    cell.alignment = right_align if ('right' in cc or is_header) else left_align
                cur_row += 1
                local_idx += 1
            cur_row += 1  # spacer row between tables