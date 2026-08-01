from __future__ import annotations

from datetime import datetime

from PySide6.QtCore import Qt, QDate, QThread, Signal
from PySide6.QtWidgets import (
    QComboBox,
    QDateEdit,
    QDialog,
    QDialogButtonBox,
    QFormLayout,
    QGroupBox,
    QHBoxLayout,
    QLabel,
    QMessageBox,
    QPushButton,
    QTabWidget,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)

from controllers.report_controller import ReportController
from controllers.party_controller import PartyController
from utils.report_exporter import ReportExporter
from utils.logger import get_logger

logger = get_logger(__name__)


class ReportLoadThread(QThread):
    """Background thread for loading reports."""
    finished = Signal(str)  # HTML content
    error = Signal(str)     # Error message
    
    def __init__(self, report_func, *args, **kwargs):
        super().__init__()
        self.report_func = report_func
        self.args = args
        self.kwargs = kwargs
    
    def run(self):
        try:
            result = self.report_func(*self.args, **self.kwargs)
            self.finished.emit(result)
        except Exception as e:
            logger.error(f"Report load error: {e}")
            self.error.emit(str(e))


class ReportView(QWidget):
    """Widget for viewing and exporting reports with async loading."""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.controller = ReportController()
        self.party_controller = PartyController()
        self._load_thread = None
        self._is_loaded = False
        self._build_ui()
    def _set_report_font_size(self, text_edit: QTextEdit, size: int = 12):
        """Set font size for a report text edit."""
        if not text_edit:
            return
        
        # Update the font of the widget
        font = text_edit.font()
        font.setPointSize(size)
        text_edit.setFont(font)
        
        # Also update HTML content
        html = text_edit.toHtml()
        if html:
            import re
            # Replace font-size in CSS
            updated = re.sub(
                r'font-size:\s*\d+pt;',
                f'font-size: {size}pt;',
                html
            )
            # Also replace inline styles
            updated = re.sub(
                r'font-size:\s*\d+px;',
                f'font-size: {size}pt;',
                updated
            )
            text_edit.setHtml(updated)
    def showEvent(self, event):
        """Called when the widget is shown (tab selected)."""
        super().showEvent(event)
        # Lazy load - only load on first visit
        if not self._is_loaded:
            self._load_parties()
            self._is_loaded = True
        if self.party_combo.currentIndex() > 0:
            self._show_party_ledger()
        logger.info("🔄 Report View refreshed")
    
    def _on_report_error(self, error_msg):
        """Handle report loading errors."""
        QMessageBox.critical(self, "Report Error", f"Failed to load report:\n{error_msg}")
        logger.error(f"Report view error: {error_msg}")

    def _build_ui(self):
        layout = QVBoxLayout(self)

        self.tabs = QTabWidget()

        # ============================================================
        # TRIAL BALANCE
        # ============================================================
        tb_tab = QWidget()
        tb_layout = QVBoxLayout(tb_tab)
        
        tb_controls = QHBoxLayout()
        tb_btn = QPushButton("Generate Trial Balance")
        tb_btn.clicked.connect(self._show_trial_balance)
        tb_controls.addWidget(tb_btn)
        
        tb_refresh_btn = QPushButton("Refresh")
        tb_refresh_btn.clicked.connect(self._show_trial_balance)
        tb_controls.addWidget(tb_refresh_btn)
        
        tb_controls.addStretch()
        
        tb_export_btn = QPushButton("Export")
        tb_export_btn.clicked.connect(lambda: self._show_export_dialog("Trial Balance", self.tb_text))
        tb_controls.addWidget(tb_export_btn)
        
        tb_layout.addLayout(tb_controls)
        self.tb_text = QTextEdit()
        self.tb_text.setReadOnly(True)
        tb_layout.addWidget(self.tb_text)
        self.tabs.addTab(tb_tab, "Trial Balance")

        # ============================================================
        # PROFIT & LOSS
        # ============================================================
        pl_tab = QWidget()
        pl_layout = QVBoxLayout(pl_tab)
        
        pl_filters = QHBoxLayout()
        pl_filters.addWidget(QLabel("From:"))
        self.pl_date_from = QDateEdit()
        self.pl_date_from.setDate(QDate.currentDate().addMonths(-1))
        self.pl_date_from.setDisplayFormat("yyyy-MM-dd")
        pl_filters.addWidget(self.pl_date_from)
        pl_filters.addWidget(QLabel("To:"))
        self.pl_date_to = QDateEdit()
        self.pl_date_to.setDate(QDate.currentDate())
        self.pl_date_to.setDisplayFormat("yyyy-MM-dd")
        pl_filters.addWidget(self.pl_date_to)
        
        pl_btn = QPushButton("Generate P&L")
        pl_btn.clicked.connect(self._show_profit_loss)
        pl_filters.addWidget(pl_btn)
        
        pl_refresh_btn = QPushButton("Refresh")
        pl_refresh_btn.clicked.connect(self._show_profit_loss)
        pl_filters.addWidget(pl_refresh_btn)
        
        pl_export_btn = QPushButton("Export")
        pl_export_btn.clicked.connect(lambda: self._show_export_dialog("Profit_Loss", self.pl_text))
        pl_filters.addWidget(pl_export_btn)
        
        pl_layout.addLayout(pl_filters)
        self.pl_text = QTextEdit()
        self.pl_text.setReadOnly(True)
        pl_layout.addWidget(self.pl_text)
        self.tabs.addTab(pl_tab, "Profit & Loss")

        # ============================================================
        # BALANCE SHEET
        # ============================================================
        bs_tab = QWidget()
        bs_layout = QVBoxLayout(bs_tab)
        
        bs_controls = QHBoxLayout()
        bs_btn = QPushButton("Generate Balance Sheet")
        bs_btn.clicked.connect(self._show_balance_sheet)
        bs_controls.addWidget(bs_btn)
        
        bs_refresh_btn = QPushButton("Refresh")
        bs_refresh_btn.clicked.connect(self._show_balance_sheet)
        bs_controls.addWidget(bs_refresh_btn)
        
        bs_controls.addStretch()
        
        bs_export_btn = QPushButton("Export")
        bs_export_btn.clicked.connect(lambda: self._show_export_dialog("Balance_Sheet", self.bs_text))
        bs_controls.addWidget(bs_export_btn)
        
        bs_layout.addLayout(bs_controls)
        self.bs_text = QTextEdit()
        self.bs_text.setReadOnly(True)
        bs_layout.addWidget(self.bs_text)
        self.tabs.addTab(bs_tab, "Balance Sheet")

        # ============================================================
        # PARTY LEDGER
        # ============================================================
        pl_tab2 = QWidget()
        pl_layout2 = QVBoxLayout(pl_tab2)

        party_filter = QHBoxLayout()
        party_filter.addWidget(QLabel("Party:"))
        self.party_combo = QComboBox()
        self.party_combo.addItem("Select Party", None)
        party_filter.addWidget(self.party_combo)

        pl_btn2 = QPushButton("Generate Ledger")
        pl_btn2.clicked.connect(self._show_party_ledger)
        party_filter.addWidget(pl_btn2)

        pl_refresh_btn = QPushButton("Refresh")
        pl_refresh_btn.clicked.connect(self._show_party_ledger)
        party_filter.addWidget(pl_refresh_btn)

        pl_export_btn2 = QPushButton("Export")
        pl_export_btn2.clicked.connect(lambda: self._show_export_dialog("Party_Ledger", self.pl_text2))
        party_filter.addWidget(pl_export_btn2)
        
        pl_layout2.addLayout(party_filter)
        self.pl_text2 = QTextEdit()
        self.pl_text2.setReadOnly(True)
        pl_layout2.addWidget(self.pl_text2)
        self.tabs.addTab(pl_tab2, "Party Ledger")

        # ============================================================
        # CASH BOOK
        # ============================================================
        cb_tab = QWidget()
        cb_layout = QVBoxLayout(cb_tab)
        
        cb_filters = QHBoxLayout()
        cb_filters.addWidget(QLabel("From:"))
        self.cb_date_from = QDateEdit()
        self.cb_date_from.setDate(QDate.currentDate().addMonths(-1))
        self.cb_date_from.setDisplayFormat("yyyy-MM-dd")
        cb_filters.addWidget(self.cb_date_from)
        cb_filters.addWidget(QLabel("To:"))
        self.cb_date_to = QDateEdit()
        self.cb_date_to.setDate(QDate.currentDate())
        self.cb_date_to.setDisplayFormat("yyyy-MM-dd")
        cb_filters.addWidget(self.cb_date_to)
        
        cb_btn = QPushButton("Generate Cash Book")
        cb_btn.clicked.connect(self._show_cash_book)
        cb_filters.addWidget(cb_btn)
        
        cb_refresh_btn = QPushButton("Refresh")
        cb_refresh_btn.clicked.connect(self._show_cash_book)
        cb_filters.addWidget(cb_refresh_btn)
        
        cb_export_btn = QPushButton("Export")
        cb_export_btn.clicked.connect(lambda: self._show_export_dialog("Cash_Book", self.cb_text))
        cb_filters.addWidget(cb_export_btn)
        
        cb_layout.addLayout(cb_filters)
        self.cb_text = QTextEdit()
        self.cb_text.setReadOnly(True)
        cb_layout.addWidget(self.cb_text)
        self.tabs.addTab(cb_tab, "Cash Book")

        layout.addWidget(self.tabs)

        self._load_parties()

    def _load_parties(self):
        """Load parties into dropdown."""
        parties, error = self.party_controller.list_parties(active_only=True)
        if error:
            return

        self.party_combo.clear()
        self.party_combo.addItem("Select Party", None)
        for party in parties:
            self.party_combo.addItem(f"{party.name} ({party.code})", party.id)

    def _show_export_dialog(self, report_name: str, text_edit: QTextEdit):
        """Show export dialog for a report."""
        if not text_edit.toPlainText().strip():
            QMessageBox.information(self, "No Data", "Please generate the report first.")
            return
        
        ReportExporter.show_export_dialog(self, text_edit, report_name)

    def _format_currency(self, amount: float) -> str:
        """Format currency amount."""
        return f"Rs. {amount:,.2f}"

    def _show_trial_balance(self):
        """Show trial balance with async loading."""
        # Show loading state immediately
        if hasattr(self, 'tb_text'):
            self.tb_text.setHtml("<div style='text-align:center;padding:50px;font-size:14pt;color:#666;'>⏳ Loading Trial Balance...</div>")
        
        # Cancel previous thread if running
        if self._load_thread and self._load_thread.isRunning():
            self._load_thread.terminate()
            self._load_thread.wait()
        
        # Start new thread
        self._load_thread = ReportLoadThread(
            self.controller.get_trial_balance
        )
        self._load_thread.finished.connect(self._on_trial_balance_loaded)
        self._load_thread.error.connect(self._on_report_error)
        self._load_thread.start()
    
    def _on_trial_balance_loaded(self, data):
        """Handle trial balance data loaded from thread."""
        if not data:
            QMessageBox.information(self, "No Data", "No data found.")
            return
        
        error = data[1] if isinstance(data, tuple) else None
        if isinstance(data, tuple):
            data = data[0]
        
        if error:
            QMessageBox.warning(self, "Error", error)
            return
        
        # Reuse existing HTML generation logic (lines 295-480)
        rows = data.get('rows', [])
        total_odr = data.get('total_odr', 0)
        total_ocr = data.get('total_ocr', 0)
        total_cdr = data.get('total_cdr', 0)
        total_ccr = data.get('total_ccr', 0)
        is_balanced = data.get('is_balanced', True)
        balance_diff = data.get('balance_diff', 0)
        period_label = data.get('period_label', '')
        generated_at = data.get('generated_at', '')
        parties_summary = data.get('parties_summary', [])

        status_color = '#28a745' if is_balanced else '#dc3545'
        status_text = '✓ Balanced' if is_balanced else f'✗ Not Balanced (Diff: Rs. {balance_diff:,.2f})'

        html = f"""
        <html>
        <head>
        <style>
            body {{ font-family: 'Segoe UI', Arial, sans-serif; font-size: 17pt; padding: 15pt; margin: 0; }}
            .header {{ text-align: center; border-bottom: 2pt solid #1a1a2e; padding-bottom: 8pt; margin-bottom: 12pt; }}
            .header h1 {{ font-size: 16pt; margin: 0; color: #1a1a2e; }}
            .header .period {{ font-size: 10pt; color: #6c757d; margin-top: 2pt; }}
            .tb-table {{ width: 100%; border-collapse: collapse; margin-bottom: 12pt; font-size: 9pt; }}
            .tb-table th {{ background: #f0f0f0; padding: 4pt 6pt; border: 1pt solid #dee2e6; text-align: left; font-weight: 600; }}
            .tb-table td {{ padding: 3pt 6pt; border: 1pt solid #dee2e6; }}
            .tb-table .right {{ text-align: right; }}
            .tb-table .total-row td {{ font-weight: 700; border-top: 2pt solid #1a1a2e; background: #f8f9fa; }}
            .tb-table .section-title td {{ font-weight: 700; background: #e9ecef; border-top: 2pt solid #1a1a2e; }}
            .grand-total {{ display: flex; justify-content: space-around; margin: 10pt 0; padding: 8pt; background: #f8f9fa; border-radius: 4pt; font-weight: 700; border: 1pt solid #dee2e6; font-size: 10pt; }}
            .footer {{ margin-top: 10pt; border-top: 1pt solid #dee2e6; text-align: center; font-size: 8pt; color: #6c757d; }}
            .status {{ font-weight: 600; color: {status_color}; }}
            .section-divider {{ border-top: 2pt solid #1a1a2e; margin: 16pt 0 8pt 0; }}
            .parties-header {{ font-size: 12pt; font-weight: 700; margin: 12pt 0 6pt 0; color: #1a1a2e; }}
            .receivable {{ color: #28a745; }}
            .payable {{ color: #dc3545; }}
            .zero {{ color: #6c757d; }}
        </style>
        </head>
        <body>
        <div class="header">
            <h1>TRIAL BALANCE</h1>
            <div class="period">{period_label}</div>
        </div>
        """

        if not rows:
            html += '<p style="text-align:center;color:#888;padding:20pt;">No transactions found. Please add some transactions first.</p>'
        else:
            html += '''
            <table class="tb-table">
            <thead>
                <tr>
                    <th style="width:10%;">Code</th>
                    <th style="width:22%;">Name</th>
                    <th style="width:10%;text-align:right;">ODR</th>
                    <th style="width:10%;text-align:right;">OCR</th>
                    <th style="width:10%;text-align:right;">CDR</th>
                    <th style="width:10%;text-align:right;">CCR</th>
                    <th style="width:14%;text-align:right;">Net DR</th>
                    <th style="width:14%;text-align:right;">Net CR</th>
                </tr>
            </thead>
            <tbody>
            '''

            grouped = data.get('grouped_rows', {})
            section_order = ["LIABILITY", "EQUITY", "REVENUE", "EXPENSE", "ASSET"]
            section_labels = {
                "ASSET": "ASSETS",
                "LIABILITY": "LIABILITIES",
                "EQUITY": "EQUITY",
                "REVENUE": "REVENUE / SALES",
                "EXPENSE": "EXPENSES"
            }

            for acc_type in section_order:
                section_rows = grouped.get(acc_type, [])
                if not section_rows:
                    continue

                html += f'''
                <tr class="section-title">
                    <td colspan="8"><b>{section_labels.get(acc_type, acc_type)}</b></td>
                </tr>
                '''

                for row in section_rows:
                    # Calculate Net DR and Net CR
                    net = row['cdr'] - row['ccr']
                    if net >= 0:
                        net_dr = net
                        net_cr = 0.0
                    else:
                        net_dr = 0.0
                        net_cr = abs(net)
                    
                    net_dr_color = '#28a745' if net_dr > 0 else '#6c757d'
                    net_cr_color = '#dc3545' if net_cr > 0 else '#6c757d'
                    
                    html += f'''
                    <tr>
                        <td>{row['code']}</td>
                        <td>{row['name']}</td>
                        <td class="right">{row['odr']:,.2f}</td>
                        <td class="right">{row['ocr']:,.2f}</td>
                        <td class="right">{row['cdr']:,.2f}</td>
                        <td class="right">{row['ccr']:,.2f}</td>
                        <td class="right" style="color:{net_dr_color};">{net_dr:,.2f}</td>
                        <td class="right" style="color:{net_cr_color};">{net_cr:,.2f}</td>
                    </tr>
                    '''

            # Calculate total Net DR and Net CR
            total_net = total_cdr - total_ccr
            if total_net >= 0:
                total_net_dr = total_net
                total_net_cr = 0.0
            else:
                total_net_dr = 0.0
                total_net_cr = abs(total_net)
            
            net_color = '#28a745' if total_net >= 0 else '#dc3545'
            
            html += f'''
            <tr class="total-row">
                <td colspan="2"><b>TOTALS</b></td>
                <td class="right"><b>{total_odr:,.2f}</b></td>
                <td class="right"><b>{total_ocr:,.2f}</b></td>
                <td class="right"><b>{total_cdr:,.2f}</b></td>
                <td class="right"><b>{total_ccr:,.2f}</b></td>
                <td class="right" style="color:#28a745;"><b>{total_net_dr:,.2f}</b></td>
                <td class="right" style="color:#dc3545;"><b>{total_net_cr:,.2f}</b></td>
            </tr>
            '''
            html += '</tbody></table>'

        # Parties Summary (same as before)
        if parties_summary:
            html += '<div class="section-divider"></div>'
            html += '<div class="parties-header">PARTIES SUMMARY</div>'
            html += '''
            <table class="tb-table">
            <thead>
                <tr>
                    <th style="width:15%;">Code</th>
                    <th style="width:30%;">Party Name</th>
                    <th style="width:10%;text-align:right;">Opening Dr</th>
                    <th style="width:10%;text-align:right;">Opening Cr</th>
                    <th style="width:10%;text-align:right;">Current Dr</th>
                    <th style="width:10%;text-align:right;">Current Cr</th>
                    <th style="width:15%;text-align:right;">Net Balance</th>
                </tr>
            </thead>
            <tbody>
            '''

            total_op_dr = 0.0
            total_op_cr = 0.0
            total_cur_dr = 0.0
            total_cur_cr = 0.0

            for party in parties_summary:
                op_dr = party.get('opening_debit', 0)
                op_cr = party.get('opening_credit', 0)
                cur_dr = party.get('current_debit', 0)
                cur_cr = party.get('current_credit', 0)
                net = party.get('net_balance', 0)
                balance_type = party.get('balance_type', 'Zero')

                total_op_dr += op_dr
                total_op_cr += op_cr
                total_cur_dr += cur_dr
                total_cur_cr += cur_cr

                if net > 0.01:
                    net_class = 'receivable'
                    net_label = f'Receivable: Rs. {net:,.2f}'
                elif net < -0.01:
                    net_class = 'payable'
                    net_label = f'Payable: Rs. {abs(net):,.2f}'
                else:
                    net_class = 'zero'
                    net_label = 'Zero'

                html += f'''
                <tr>
                    <td>{party['party_code']}</td>
                    <td>{party['party_name']}</td>
                    <td class="right">{op_dr:,.2f}</td>
                    <td class="right">{op_cr:,.2f}</td>
                    <td class="right">{cur_dr:,.2f}</td>
                    <td class="right">{cur_cr:,.2f}</td>
                    <td class="right {net_class}">{net_label}</td>
                </tr>
                '''

            total_net = total_cur_dr - total_cur_cr
            net_color = '#28a745' if total_net >= 0 else '#dc3545'
            html += f'''
            <tr class="total-row">
                <td colspan="2"><b>TOTAL PARTIES</b></td>
                <td class="right"><b>{total_op_dr:,.2f}</b></td>
                <td class="right"><b>{total_op_cr:,.2f}</b></td>
                <td class="right"><b>{total_cur_dr:,.2f}</b></td>
                <td class="right"><b>{total_cur_cr:,.2f}</b></td>
                <td class="right" style="color:{net_color};"><b>{total_net:,.2f}</b></td>
            </tr>
            '''
            html += '</tbody></table>'

        html += f'''
        <div class="grand-total">
            <span>Total Net Debit: Rs. {total_cdr:,.2f}</span>
            <span>Total Net Credit: Rs. {total_ccr:,.2f}</span>
            <span style="color:{status_color};">{status_text}</span>
        </div>
        <div class="footer">Generated: {generated_at}</div>
        </body></html>
        '''

        self.tb_text.setHtml(html)
        self._set_report_font_size(self.tb_text, 14)
    # ============================================================
    # PROFIT & LOSS - TABLE VERSION
    # ============================================================
    def _show_profit_loss(self):
        """Show profit & loss statement with async loading."""
        # Show loading state immediately
        if hasattr(self, 'pl_text'):
            self.pl_text.setHtml("<div style='text-align:center;padding:50px;font-size:14pt;color:#666;'>⏳ Loading Profit & Loss...</div>")
        
        # Cancel previous thread if running
        if self._load_thread and self._load_thread.isRunning():
            self._load_thread.terminate()
            self._load_thread.wait()
        
        date_from = self.pl_date_from.date().toString("yyyy-MM-dd")
        date_to = self.pl_date_to.date().toString("yyyy-MM-dd")
        
        # Start new thread
        self._load_thread = ReportLoadThread(
            self.controller.get_profit_loss, date_from, date_to
        )
        self._load_thread.finished.connect(self._on_profit_loss_loaded)
        self._load_thread.error.connect(self._on_report_error)
        self._load_thread.start()
    
    def _on_profit_loss_loaded(self, data):
        """Handle P&L data loaded from thread."""
        if not data:
            QMessageBox.information(self, "No Data", "No data found.")
            return
        
        error = data[1] if isinstance(data, tuple) else None
        if isinstance(data, tuple):
            data = data[0]
        
        if error:
            QMessageBox.warning(self, "Error", error)
            return
        
        is_profit = data.get('is_profit', False)
        profit = data.get('net_profit', 0)
        color = '#28a745' if is_profit else '#dc3545'
        profit_label = 'Profit' if is_profit else 'Loss'

        sales = data.get('sales', data.get('revenue', []))
        total_sales = data.get('total_sales', data.get('total_revenue', 0))
        
        general_admin = data.get('general_admin', [])
        total_general_admin = data.get('total_general_admin', 0)
        
        selling_dist = data.get('selling_distribution', [])
        total_selling_dist = data.get('total_selling_distribution', 0)
        
        other_operating = data.get('other_operating', [])
        total_other_operating = data.get('total_other_operating', 0)
        
        cost_of_sales = data.get('cost_of_sales', [])
        total_cogs = data.get('total_cost_of_sales', 0)
        
        other_income = data.get('other_income', [])
        total_other_income = data.get('total_other_income', 0)
        
        finance_cost = data.get('finance_cost', [])
        total_finance = data.get('total_finance_cost', 0)
        
        gross_profit = data.get('gross_profit', total_sales - total_cogs)
        total_operating_expenses = total_general_admin + total_selling_dist + total_other_operating
        profit_from_operations = data.get('profit_from_operations', gross_profit - total_operating_expenses + total_other_income)
        profit_before_tax = data.get('profit_before_tax', profit_from_operations - total_finance)

        html = f"""
        <html>
        <head>
        <style>
            body {{ font-family: 'Segoe UI', Arial, sans-serif; font-size: 17pt; padding: 15pt; margin: 0; }}
            .header {{ text-align: center; border-bottom: 2pt solid #1a1a2e; padding-bottom: 8pt; margin-bottom: 12pt; }}
            .header h1 {{ font-size: 16pt; margin: 0; color: #1a1a2e; }}
            .header .subtitle {{ font-size: 10pt; color: #6c757d; margin-top: 2pt; }}
            .pl-table {{ width: 100%; border-collapse: collapse; font-size: 9pt; }}
            .pl-table th {{ background: #f0f0f0; padding: 4pt 6pt; border: 1pt solid #dee2e6; text-align: left; font-weight: 600; }}
            .pl-table td {{ padding: 3pt 6pt; border: 1pt solid #dee2e6; }}
            .pl-table .right {{ text-align: right; }}
            .pl-table .section-title td {{ font-weight: 700; background: #e9ecef; border-top: 2pt solid #1a1a2e; }}
            .pl-table .total-row td {{ font-weight: 700; border-top: 2pt solid #495057; background: #f8f9fa; }}
            .pl-table .gross-profit td {{ font-weight: 700; border-top: 2pt solid #28a745; color: #28a745; background: #f8f9fa; }}
            .pl-table .net-profit td {{ font-weight: 700; font-size: 11pt; border-top: 2pt solid {color}; color: {color}; background: #f8f9fa; }}
            .pl-table .sub-head td {{ font-weight: 600; background: #f8f9fa; border-top: 1pt solid #dee2e6; }}
            .pl-table .indent td {{ padding-left: 20pt; }}
            .footer {{ margin-top: 10pt; border-top: 1pt solid #dee2e6; text-align: center; font-size: 8pt; color: #6c757d; }}
        </style>
        </head>
        <body>
        <div class="header">
            <h1>PROFIT & LOSS STATEMENT</h1>
            <div class="subtitle">Period: {date_from} to {date_to}</div>
        </div>
        <table class="pl-table">
        """

        # SALES
        html += '<tr class="section-title"><td colspan="2"><b>SALES</b></td></tr>'
        if sales:
            for item in sales:
                amount = item.get('amount', 0)
                html += f'<tr><td class="indent">{item["code"]} - {item["name"]}</td><td class="right">Rs. {amount:,.2f}</td></tr>'
        html += f'<tr class="total-row"><td><b>Total Sales</b></td><td class="right"><b>Rs. {total_sales:,.2f}</b></td></tr>'

        # COST OF SALES
        html += '<tr class="section-title"><td colspan="2"><b>COST OF SALES</b></td></tr>'
        if cost_of_sales:
            for item in cost_of_sales:
                amount = item.get('amount', 0)
                html += f'<tr><td class="indent">{item["code"]} - {item["name"]}</td><td class="right">(Rs. {amount:,.2f})</td></tr>'
        html += f'<tr class="total-row"><td><b>Total Cost of Sales</b></td><td class="right"><b>(Rs. {total_cogs:,.2f})</b></td></tr>'

        # GROSS PROFIT
        gp_color = '#28a745' if gross_profit >= 0 else '#dc3545'
        html += f'''<tr class="gross-profit">
            <td><b>Gross Profit</b></td>
            <td class="right"><b>Rs. {gross_profit:,.2f}</b></td>
        </tr>'''

        # OPERATING EXPENSES
        html += '<tr class="section-title"><td colspan="2"><b>OPERATING EXPENSES</b></td></tr>'
        
        if general_admin or total_general_admin > 0:
            html += '<tr class="sub-head"><td colspan="2">General & Administrative Expenses</td></tr>'
            for exp in general_admin:
                amount = exp.get('amount', 0)
                html += f'<tr><td class="indent">{exp["code"]} - {exp["name"]}</td><td class="right">(Rs. {amount:,.2f})</td></tr>'
            html += f'<tr class="total-row"><td><b>Total General & Admin</b></td><td class="right"><b>(Rs. {total_general_admin:,.2f})</b></td></tr>'
        
        if selling_dist or total_selling_dist > 0:
            html += '<tr class="sub-head"><td colspan="2">Selling & Distribution Expenses</td></tr>'
            for exp in selling_dist:
                amount = exp.get('amount', 0)
                html += f'<tr><td class="indent">{exp["code"]} - {exp["name"]}</td><td class="right">(Rs. {amount:,.2f})</td></tr>'
            html += f'<tr class="total-row"><td><b>Total Selling & Distribution</b></td><td class="right"><b>(Rs. {total_selling_dist:,.2f})</b></td></tr>'
        
        if other_operating or total_other_operating > 0:
            html += '<tr class="sub-head"><td colspan="2">Other Operating Expenses</td></tr>'
            for exp in other_operating:
                amount = exp.get('amount', 0)
                html += f'<tr><td class="indent">{exp["code"]} - {exp["name"]}</td><td class="right">(Rs. {amount:,.2f})</td></tr>'
            html += f'<tr class="total-row"><td><b>Total Other Operating</b></td><td class="right"><b>(Rs. {total_other_operating:,.2f})</b></td></tr>'
        
        html += f'''<tr class="total-row" style="border-top:2pt solid #17a2b8;color:#17a2b8;">
            <td><b>Total Operating Expenses</b></td>
            <td class="right"><b>(Rs. {total_operating_expenses:,.2f})</b></td>
        </tr>'''

        # OTHER INCOME
        if other_income or total_other_income > 0:
            html += '<tr class="section-title"><td colspan="2"><b>OTHER INCOME</b></td></tr>'
            for inc in other_income:
                amount = inc.get('amount', 0)
                html += f'<tr><td class="indent">{inc["code"]} - {inc["name"]}</td><td class="right">Rs. {amount:,.2f}</td></tr>'
            html += f'<tr class="total-row"><td><b>Total Other Income</b></td><td class="right"><b>Rs. {total_other_income:,.2f}</b></td></tr>'

        # PROFIT FROM OPERATIONS
        pfo_color = '#28a745' if profit_from_operations >= 0 else '#dc3545'
        html += f'''<tr class="total-row" style="border-top:2pt solid {pfo_color};color:{pfo_color};">
            <td><b>Profit from Operations</b></td>
            <td class="right"><b>Rs. {profit_from_operations:,.2f}</b></td>
        </tr>'''

        # FINANCE COST
        if finance_cost or total_finance > 0:
            html += '<tr class="section-title"><td colspan="2"><b>FINANCE COST</b></td></tr>'
            for fc in finance_cost:
                amount = fc.get('amount', 0)
                html += f'<tr><td class="indent">{fc["code"]} - {fc["name"]}</td><td class="right">(Rs. {amount:,.2f})</td></tr>'
            html += f'<tr class="total-row"><td><b>Total Finance Cost</b></td><td class="right"><b>(Rs. {total_finance:,.2f})</b></td></tr>'

        # PROFIT BEFORE TAX
        if profit_before_tax != profit:
            pbt_color = '#28a745' if profit_before_tax >= 0 else '#dc3545'
            html += f'''<tr class="total-row" style="border-top:2pt solid #6f42c1;color:#6f42c1;">
                <td><b>Profit Before Tax</b></td>
                <td class="right"><b>Rs. {profit_before_tax:,.2f}</b></td>
            </tr>'''

        # NET PROFIT
        html += f'''<tr class="net-profit">
            <td><b>Net {profit_label}</b></td>
            <td class="right"><b>Rs. {profit:,.2f}</b></td>
        </tr>'''

        html += f"""
        </table>
        <div class="footer">Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</div>
        </body></html>
        """

        self.pl_text.setHtml(html)
        self._set_report_font_size(self.tb_text, 14)  # 14pt font

    # ============================================================
    # BALANCE SHEET - TABLE VERSION
    # ============================================================
    def _show_balance_sheet(self):
        """Show balance sheet with async loading."""
        # Show loading state immediately
        if hasattr(self, 'bs_text'):
            self.bs_text.setHtml("<div style='text-align:center;padding:50px;font-size:14pt;color:#666;'>⏳ Loading Balance Sheet...</div>")
        
        # Cancel previous thread if running
        if self._load_thread and self._load_thread.isRunning():
            self._load_thread.terminate()
            self._load_thread.wait()
        
        # Start new thread
        self._load_thread = ReportLoadThread(
            self.controller.get_balance_sheet
        )
        self._load_thread.finished.connect(self._on_balance_sheet_loaded)
        self._load_thread.error.connect(self._on_report_error)
        self._load_thread.start()
    
    def _on_balance_sheet_loaded(self, data):
        """Handle balance sheet data loaded from thread."""
        if not data:
            QMessageBox.information(self, "No Data", "No data found.")
            return
        
        error = data[1] if isinstance(data, tuple) else None
        if isinstance(data, tuple):
            data = data[0]
        
        if error:
            QMessageBox.warning(self, "Error", error)
            return
        
        balanced = data.get('is_balanced', True)
        color = '#28a745' if balanced else '#dc3545'
        status_text = '✓ Balanced' if balanced else '✗ Not Balanced'
        
        current_assets = data.get('current_assets', [])
        non_current_assets = data.get('non_current_assets', [])
        current_liabilities = data.get('current_liabilities', [])
        non_current_liabilities = data.get('non_current_liabilities', [])
        equity_items = data.get('equity', [])
        
        total_current_assets = data.get('total_current_assets', sum(a.get('balance', 0) for a in current_assets))
        total_non_current_assets = data.get('total_non_current_assets', sum(a.get('balance', 0) for a in non_current_assets))
        total_current_liabilities = data.get('total_current_liabilities', sum(l.get('balance', 0) for l in current_liabilities))
        total_non_current_liabilities = data.get('total_non_current_liabilities', sum(l.get('balance', 0) for l in non_current_liabilities))
        total_assets = data.get('total_assets', total_current_assets + total_non_current_assets)
        total_liabilities = data.get('total_liabilities', total_current_liabilities + total_non_current_liabilities)
        total_equity = data.get('total_equity', sum(e.get('balance', 0) for e in equity_items))
        retained_earnings = data.get('retained_earnings', 0)
        total_liabilities_and_equity = total_liabilities + total_equity

        as_at = data.get('as_at', QDate.currentDate().toString("MMMM d, yyyy"))

        html = f"""
        <html>
        <head>
        <style>
            body {{ font-family: 'Segoe UI', Arial, sans-serif; font-size: 17pt; padding: 15pt; margin: 0; }}
            .header {{ text-align: center; border-bottom: 2pt solid #1a1a2e; padding-bottom: 8pt; margin-bottom: 12pt; }}
            .header h1 {{ font-size: 16pt; margin: 0; color: #1a1a2e; }}
            .header .as-at {{ font-size: 10pt; color: #6c757d; margin-top: 2pt; }}
            .bs-table {{ width: 100%; border-collapse: collapse; font-size: 9pt; }}
            .bs-table th {{ background: #f0f0f0; padding: 4pt 6pt; border: 1pt solid #dee2e6; text-align: left; font-weight: 600; }}
            .bs-table td {{ padding: 3pt 6pt; border: 1pt solid #dee2e6; }}
            .bs-table .right {{ text-align: right; }}
            .bs-table .section-title td {{ font-weight: 700; background: #e9ecef; border-top: 2pt solid #1a1a2e; }}
            .bs-table .sub-section td {{ font-weight: 600; background: #f8f9fa; border-top: 1pt solid #dee2e6; }}
            .bs-table .total-row td {{ font-weight: 700; border-top: 2pt solid #495057; background: #f8f9fa; }}
            .bs-table .grand-total td {{ font-weight: 700; font-size: 10pt; border-top: 2.5pt double #1a1a2e; background: #f8f9fa; }}
            .bs-table .indent td {{ padding-left: 20pt; }}
            .bs-table .indent2 td {{ padding-left: 35pt; }}
            .footer {{ margin-top: 10pt; border-top: 1pt solid #dee2e6; text-align: center; font-size: 8pt; color: #6c757d; }}
            .status {{ font-weight: 600; color: {color}; }}
        </style>
        </head>
        <body>
        <div class="header">
            <h1>BALANCE SHEET</h1>
            <div class="as-at">AS AT {as_at}</div>
        </div>
        <table class="bs-table">
        """

        # LEFT SIDE: EQUITY & LIABILITIES
        html += '<tr class="section-title"><td colspan="2"><b>EQUITY AND LIABILITIES</b></td></tr>'
        
        html += '<tr class="sub-section"><td colspan="2"><b>SHARE CAPITAL AND RESERVES</b></td></tr>'
        
        authorised = data.get('authorised_capital', 0)
        if authorised:
            html += f'<tr><td class="indent">Authorised share capital</td><td class="right">Rs. {authorised:,.2f}</td></tr>'
        
        issued = data.get('issued_capital', 0)
        if issued:
            html += f'<tr><td class="indent">Issued, subscribed and paid up capital</td><td class="right">Rs. {issued:,.2f}</td></tr>'
        
        deposit_for_shares = data.get('deposit_for_shares', 0)
        if deposit_for_shares:
            html += f'<tr><td class="indent">Deposit for shares</td><td class="right">Rs. {deposit_for_shares:,.2f}</td></tr>'
        
        if retained_earnings:
            html += f'<tr><td class="indent">Revenue reserve</td><td class="right">Rs. {retained_earnings:,.2f}</td></tr>'
        
        for eq in equity_items:
            name = eq.get('name', '')
            name_lower = name.lower()
            if name_lower not in ['owner\'s equity', 'owners equity', 'share capital', 'retained earnings', 'revenue reserve']:
                html += f'<tr><td class="indent">{name}</td><td class="right">Rs. {eq.get("balance", 0):,.2f}</td></tr>'
        
        html += f'<tr class="total-row"><td><b>Total equity</b></td><td class="right"><b>Rs. {total_equity:,.2f}</b></td></tr>'
        
        # Non-Current Liabilities
        html += '<tr class="section-title"><td colspan="2"><b>NON CURRENT LIABILITIES</b></td></tr>'
        if non_current_liabilities:
            for liab in non_current_liabilities:
                html += f'<tr><td class="indent">{liab.get("name", "")}</td><td class="right">Rs. {liab.get("balance", 0):,.2f}</td></tr>'
        else:
            html += '<tr><td class="indent" style="color:#adb5bd;">No non-current liabilities</td><td class="right">-</td></tr>'
        html += f'<tr class="total-row"><td><b>Total Non-Current Liabilities</b></td><td class="right"><b>Rs. {total_non_current_liabilities:,.2f}</b></td></tr>'
        
        # Current Liabilities
        html += '<tr class="section-title"><td colspan="2"><b>CURRENT LIABILITIES</b></td></tr>'
        if current_liabilities:
            for liab in current_liabilities:
                neg = ' style="color:#dc3545;"' if liab.get('balance', 0) < 0 else ''
                html += f'<tr><td class="indent">{liab.get("name", "")}</td><td class="right"{neg}>Rs. {liab.get("balance", 0):,.2f}</td></tr>'
        else:
            html += '<tr><td class="indent" style="color:#adb5bd;">No current liabilities</td><td class="right">-</td></tr>'
        html += f'<tr class="total-row"><td><b>Total Current Liabilities</b></td><td class="right"><b>Rs. {total_current_liabilities:,.2f}</b></td></tr>'
        
        html += f'<tr class="total-row"><td><b>Total liabilities</b></td><td class="right"><b>Rs. {total_liabilities:,.2f}</b></td></tr>'
        html += f'<tr class="grand-total"><td><b>TOTAL EQUITY AND LIABILITIES</b></td><td class="right"><b>Rs. {total_liabilities_and_equity:,.2f}</b></td></tr>'

        # RIGHT SIDE: ASSETS
        html += '<tr class="section-title"><td colspan="2"><b>NON CURRENT ASSETS</b></td></tr>'
        if non_current_assets:
            for asset in non_current_assets:
                html += f'<tr><td class="indent">{asset.get("name", "")}</td><td class="right">Rs. {asset.get("balance", 0):,.2f}</td></tr>'
        else:
            html += '<tr><td class="indent" style="color:#adb5bd;">No non-current assets</td><td class="right">-</td></tr>'
        html += f'<tr class="total-row"><td><b>Total Non-Current Assets</b></td><td class="right"><b>Rs. {total_non_current_assets:,.2f}</b></td></tr>'
        
        html += '<tr class="section-title"><td colspan="2"><b>CURRENT ASSETS</b></td></tr>'
        if current_assets:
            for asset in current_assets:
                neg = ' style="color:#dc3545;"' if asset.get('balance', 0) < 0 else ''
                html += f'<tr><td class="indent">{asset.get("name", "")}</td><td class="right"{neg}>Rs. {asset.get("balance", 0):,.2f}</td></tr>'
        else:
            html += '<tr><td class="indent" style="color:#adb5bd;">No current assets</td><td class="right">-</td></tr>'
        html += f'<tr class="total-row"><td><b>Total Current Assets</b></td><td class="right"><b>Rs. {total_current_assets:,.2f}</b></td></tr>'
        
        html += f'<tr class="grand-total"><td><b>TOTAL ASSETS</b></td><td class="right"><b>Rs. {total_assets:,.2f}</b></td></tr>'

        html += f"""
        </table>
        <div class="footer">
            <span class="status">{status_text}</span>
            <span style="margin:0 8pt;">|</span>
            <span>Total Assets: Rs. {total_assets:,.2f}</span>
            <span style="margin:0 8pt;">|</span>
            <span>Total Liabilities + Equity: Rs. {total_liabilities_and_equity:,.2f}</span>
            <br>
            <span style="font-size:7pt;color:#adb5bd;">The annexed notes form an integral part of these financial statements.</span>
            <br>
            <span style="font-size:7pt;color:#adb5bd;">Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</span>
        </div>
        </body></html>
        """

        self.bs_text.setHtml(html)
        self._set_report_font_size(self.tb_text, 14)  # 14pt font


    def _show_party_ledger(self):
        """Show party ledger with async loading."""
        party_id = self.party_combo.currentData()
        if not party_id:
            QMessageBox.warning(self, "Selection Error", "Please select a party.")
            return
        
        # Show loading state immediately
        if hasattr(self, 'pl_text2'):
            self.pl_text2.setHtml("<div style='text-align:center;padding:50px;font-size:14pt;color:#666;'>⏳ Loading Party Ledger...</div>")
        
        # Cancel previous thread if running
        if self._load_thread and self._load_thread.isRunning():
            self._load_thread.terminate()
            self._load_thread.wait()
        
        # Start new thread
        self._load_thread = ReportLoadThread(
            self.controller.get_party_ledger, party_id
        )
        self._load_thread.finished.connect(self._on_party_ledger_loaded)
        self._load_thread.error.connect(self._on_report_error)
        self._load_thread.start()
    
    def _on_party_ledger_loaded(self, data):
        """Handle party ledger data loaded from thread."""
        if not data:
            QMessageBox.information(self, "No Data", "No transactions found.")
            return
        
        error = data[1] if isinstance(data, tuple) else None
        if isinstance(data, tuple):
            data = data[0]
        
        if not data or "error" in data:
            error_msg = data.get("error", "Unknown error") if isinstance(data, dict) else "Failed to load data"
            QMessageBox.warning(self, "Error", error_msg)
            return
        
        balance = data.get('closing_balance', 0)
        balance_type = data.get('balance_type', 'Zero')
        balance_label = data.get('balance_label', 'Zero Balance')
        party_type = data.get('party_type', 'CUSTOMER')
        
        # ✅ Set color based on balance type
        if balance_type == "Receivable":
            color = '#28a745'  # Green - Customer owes us
        elif balance_type == "Payable":
            color = '#dc3545'  # Red - We owe supplier
        elif balance_type == "Debit Balance":
            color = '#dc3545'  # Red - Supplier owes us (unusual)
        elif balance_type == "Credit Balance":
            color = '#f39c12'  # Orange - Customer overpaid
        else:
            color = '#6c757d'  # Gray - Zero balance

        # ✅ Show party type
        party_type_label = "Customer" if data.get('is_customer', False) else "Supplier"

        html = f"""
        <html>
        <head>
        <style>
            body {{ font-family: 'Segoe UI', Arial, sans-serif; font-size: 17pt; padding: 15pt; margin: 0; }}
            .header {{ text-align: center; border-bottom: 2pt solid #1a1a2e; padding-bottom: 8pt; margin-bottom: 12pt; }}
            .header h1 {{ font-size: 16pt; margin: 0; color: #1a1a2e; }}
            .info {{ font-size: 10pt; padding: 8pt 12pt; background: #f8f9fa; border: 1pt solid #dee2e6; border-radius: 4pt; margin-bottom: 12pt; }}
            .info .label {{ font-weight: 600; color: #495057; }}
            .party-type {{
                font-weight: 600;
                color: {'#28a745' if data.get('is_customer', False) else '#dc3545'};
            }}
            .pl-table {{ width: 100%; border-collapse: collapse; font-size: 9pt; }}
            .pl-table th {{ background: #f0f0f0; padding: 4pt 6pt; border: 1pt solid #dee2e6; text-align: left; font-weight: 600; }}
            .pl-table td {{ padding: 3pt 6pt; border: 1pt solid #dee2e6; }}
            .pl-table .right {{ text-align: right; }}
            .pl-table .total-row td {{ font-weight: 700; border-top: 2pt solid #495057; background: #f8f9fa; }}
            .closing {{ font-size: 11pt; font-weight: 600; text-align: center; padding: 8pt; background: #f8f9fa; border: 1pt solid {color}; border-radius: 4pt; margin-top: 10pt; color: {color}; }}
            .footer {{ margin-top: 10pt; border-top: 1pt solid #dee2e6; text-align: center; font-size: 8pt; color: #6c757d; }}
            .debit {{ color: #28a745; }}
            .credit {{ color: #dc3545; }}
            .summary {{ display: flex; justify-content: space-around; margin-top: 8pt; font-size: 9pt; }}
            .balance-positive {{ color: #28a745; }}
            .balance-negative {{ color: #dc3545; }}
            .balance-zero {{ color: #6c757d; }}
        </style>
        </head>
        <body>
        <div class="header">
            <h1>{data['title']}</h1>
        </div>
        <div class="info">
            <span class="label">Party:</span> {data['party']['name']} ({data['party']['code']}) &nbsp;|&nbsp;
            <span class="label">Type:</span> <span class="party-type">{party_type_label}</span> &nbsp;|&nbsp;
            <span class="label">Opening Balance:</span> Rs. {data.get('opening_balance', 0):,.2f}
        </div>
        <table class="pl-table">
        <tr>
            <th style='width:10%;'>Date</th>
            <th style='width:14%;'>Voucher</th>
            <th style='width:12%;'>Type</th>
            <th style='width:24%;'>Description</th>
            <th style='width:10%;text-align:right;'>Debit</th>
            <th style='width:10%;text-align:right;'>Credit</th>
            <th style='width:20%;text-align:right;'>Balance</th>
        </tr>
        """

        if data.get('transactions'):
            for txn in data['transactions']:
                # ✅ Color code based on balance
                txn_balance = txn['balance']
                if txn_balance > 0.01:
                    balance_class = 'balance-positive'
                elif txn_balance < -0.01:
                    balance_class = 'balance-negative'
                else:
                    balance_class = 'balance-zero'
                
                debit_color = '#28a745' if txn['debit'] > 0 else '#6c757d'
                credit_color = '#dc3545' if txn['credit'] > 0 else '#6c757d'
                
                html += f"""
                <tr>
                    <td>{txn['date_formatted']}</td>
                    <td>{txn['voucher_number']}</td>
                    <td>{txn['voucher_type']}</td>
                    <td>{txn['description'] or '-'}</td>
                    <td class='right' style='color:{debit_color};'>{txn['debit']:,.2f}</td>
                    <td class='right' style='color:{credit_color};'>{txn['credit']:,.2f}</td>
                    <td class='right {balance_class}'>{txn_balance:,.2f}</td>
                </tr>
                """
        else:
            html += """
            <tr>
                <td colspan="7" style="text-align:center;color:#888;padding:20pt;">
                    No transactions found for this party.
                </td>
            </tr>
            """

        total_debit = data.get('total_debit', 0)
        total_credit = data.get('total_credit', 0)

        html += f"""
        <tr class="total-row">
            <td colspan="4"><b>TOTALS</b></td>
            <td class="right"><b>{total_debit:,.2f}</b></td>
            <td class="right"><b>{total_credit:,.2f}</b></td>
            <td class="right"><b>{balance:,.2f}</b></td>
        </tr>
        </table>

        <div class="closing">
            Closing Balance: Rs. {balance:,.2f} ({balance_label})
        </div>

        <div class="summary">
            <span>📊 Total Debits: Rs. {total_debit:,.2f}</span>
            <span>📊 Total Credits: Rs. {total_credit:,.2f}</span>
            <span>📊 Net Movement: Rs. {total_debit - total_credit:,.2f}</span>
        </div>

        <div class="footer">Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</div>
        </body></html>
        """

        self.pl_text2.setHtml(html)
        self._set_report_font_size(self.tb_text, 14)  # 14pt font


    # ============================================================
    # CASH BOOK
    # ============================================================
    def _show_cash_book(self):
        """Show cash book with async loading."""
        date_from = self.cb_date_from.date().toString("yyyy-MM-dd")
        date_to = self.cb_date_to.date().toString("yyyy-MM-dd")
        
        # Show loading state immediately
        if hasattr(self, 'cb_text'):
            self.cb_text.setHtml("<div style='text-align:center;padding:50px;font-size:14pt;color:#666;'>⏳ Loading Cash Book...</div>")
        
        # Cancel previous thread if running
        if self._load_thread and self._load_thread.isRunning():
            self._load_thread.terminate()
            self._load_thread.wait()
        
        # Start new thread
        self._load_thread = ReportLoadThread(
            self.controller.get_cash_book, date_from, date_to
        )
        self._load_thread.finished.connect(self._on_cash_book_loaded)
        self._load_thread.error.connect(self._on_report_error)
        self._load_thread.start()
    
    def _on_cash_book_loaded(self, data):
        """Handle cash book data loaded from thread."""
        if not data:
            QMessageBox.information(self, "No Data", "No data found.")
            return
        
        error = data[1] if isinstance(data, tuple) else None
        if isinstance(data, tuple):
            data = data[0]
        
        if not data or "error" in data:
            error_msg = data.get("error", "Unknown error") if isinstance(data, dict) else "Failed to load data"
            QMessageBox.warning(self, "Error", error_msg)
            return
        
        balance = data['closing_balance']
        balance_color = '#28a745' if balance >= 0 else '#dc3545'

        html = f"""
        <html>
        <head>
        <style>
            body {{ font-family: 'Segoe UI', Arial, sans-serif; font-size: 17pt; padding: 15pt; margin: 0; }}
            .header {{ text-align: center; border-bottom: 2pt solid #1a1a2e; padding-bottom: 8pt; margin-bottom: 12pt; }}
            .header h1 {{ font-size: 16pt; margin: 0; color: #1a1a2e; }}
            .header .subtitle {{ font-size: 10pt; color: #6c757d; margin-top: 2pt; }}
            .cb-table {{ width: 100%; border-collapse: collapse; font-size: 9pt; }}
            .cb-table th {{ background: #f0f0f0; padding: 4pt 6pt; border: 1pt solid #dee2e6; text-align: left; font-weight: 600; }}
            .cb-table td {{ padding: 3pt 6pt; border: 1pt solid #dee2e6; }}
            .cb-table .right {{ text-align: right; }}
            .cb-table .total-row td {{ font-weight: 700; border-top: 2pt solid #495057; background: #f8f9fa; }}
            .summary {{ display: flex; justify-content: space-around; margin: 10pt 0; padding: 8pt; background: #f8f9fa; border: 1pt solid #dee2e6; border-radius: 4pt; font-weight: 600; font-size: 10pt; }}
            .positive {{ color: #28a745; }}
            .negative {{ color: #dc3545; }}
            .account-tag {{ font-size: 8pt; color: #888; padding: 1pt 4pt; background: #f1f3f5; border-radius: 3pt; }}
            .footer {{ margin-top: 10pt; border-top: 1pt solid #dee2e6; text-align: center; font-size: 8pt; color: #6c757d; }}
        </style>
        </head>
        <body>
        <div class="header">
            <h1>{data['title']}</h1>
            <div class="subtitle">Period: {data['date_from']} to {data['date_to']}</div>
        </div>
        <table class="cb-table">
        <tr><th style='width:10%;'>Date</th><th style='width:14%;'>Voucher</th><th style='width:24%;'>Description</th><th style='width:8%;'>Account</th><th style='width:13%;text-align:right;'>Received</th><th style='width:13%;text-align:right;'>Paid</th><th style='width:18%;text-align:right;'>Balance</th></tr>
        """

        for txn in data['transactions']:
            txn_balance = txn['balance']
            txn_color = '#28a745' if txn_balance >= 0 else '#dc3545'
            account = txn.get('account', '')
            account_tag = f'<span class="account-tag">{account}</span>' if account else ''
            html += f"<tr><td>{txn['date']}</td><td>{txn['voucher']}</td><td>{txn['description']}</td><td>{account_tag}</td><td class='right'>{txn['received']:,.2f}</td><td class='right'>{txn['paid']:,.2f}</td><td class='right' style='color:{txn_color};'>{txn_balance:,.2f}</td></tr>"

        html += f"""
        </table>
        <div class="summary">
            <div><span>Total Received:</span> <span class="positive">Rs. {data['total_received']:,.2f}</span></div>
            <div><span>Total Paid:</span> <span class="negative">Rs. {data['total_paid']:,.2f}</span></div>
            <div><span>Closing Balance:</span> <span style="color:{balance_color};">Rs. {balance:,.2f}</span></div>
        </div>
        <div class="footer">Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</div>
        </body></html>
        """

        self.cb_text.setHtml(html)
        self._set_report_font_size(self.cb_text, 14)  # 14pt font