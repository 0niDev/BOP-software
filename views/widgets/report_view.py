from __future__ import annotations

from datetime import datetime

from PySide6.QtCore import Qt, QDate
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
from utils.help_utils import create_help_button
from utils.report_exporter import ReportExporter
from utils.logger import get_logger

logger = get_logger(__name__)

REPORT_HELP = """
<h3>Reports</h3>
<p>Generate financial reports with export/print options.</p>
<ul>
    <li><b>Trial Balance</b> - summary of all account balances.</li>
    <li><b>Profit & Loss</b> - revenue minus expenses for a date range.</li>
    <li><b>Balance Sheet</b> - assets, liabilities, and equity position.</li>
    <li><b>Cash Book</b> - all cash and bank transactions.</li>
    <li><b>Party Ledger</b> - transaction history for any customer or supplier.</li>
</ul>
<p>Use Export to save reports as PDF, Excel, or CSV.</p>
"""

# Shared CSS fragment used by every report's HTML template
_SHARED_CSS = """
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 14px; padding: 20px; margin: 0; background: #ffffff; color: #1a1a2e; line-height: 1.5; }

    .company-header { text-align: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 3px solid #1a1a2e; }
    .company-header h2 { font-size: 22px; margin: 0 0 2px 0; color: #1a1a2e; letter-spacing: 0.5px; }
    .company-header .subtitle { font-size: 13px; color: #495057; margin-top: 2px; }

    .report-title { text-align: center; font-size: 18px; font-weight: 700; color: #1a1a2e; margin: 10px 0 4px 0; text-transform: uppercase; letter-spacing: 1px; }
    .report-period { text-align: center; font-size: 12px; color: #6c757d; margin-bottom: 14px; }

    .section-title { font-weight: 700; background: #e9ecef; border-top: 2px solid #1a1a2e; }
    .section-title td { padding: 6px 8px !important; }
    .sub-head { font-weight: 600; background: #f8f9fa; }
    .sub-head td { padding: 5px 8px 5px 16px !important; }
    .total-row td { font-weight: 700; border-top: 2px solid #495057; background: #f8f9fa; padding: 6px 8px !important; }
    .grand-total td { font-weight: 700; font-size: 13px; border-top: 3px double #1a1a2e; background: #e9ecef; padding: 8px !important; }

    .right { text-align: right; }
    .indent td:first-child { padding-left: 24px !important; }

    .positive { color: #28a745; }
    .negative { color: #dc3545; }
    .zero { color: #adb5bd; }
    .muted { color: #6c757d; }

    .summary-box { margin: 12px 0; padding: 10px 16px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; font-weight: 600; font-size: 13px; }
    .closing-box { text-align: center; margin: 12px 0; padding: 10px 16px; background: #f8f9fa; border-radius: 6px; font-size: 14px; font-weight: 700; }

    .footer { margin-top: 16px; border-top: 1px solid #dee2e6; text-align: center; font-size: 11px; color: #adb5bd; padding-top: 8px; }
    .footer .note { font-size: 10px; color: #adb5bd; }

    table { width: 100%; border-collapse: collapse; }
    table th { background: #1a1a2e; color: #ffffff; padding: 7px 8px; text-align: left; font-weight: 600; font-size: 12px; }
    table td { padding: 5px 8px; border-bottom: 1px solid #dee2e6; font-size: 12px; }
    table tr:hover { background: #f8f9fa; }
"""


class ReportView(QWidget):
    """Widget for viewing and exporting reports."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.controller = ReportController()
        self.party_controller = PartyController()
        self._build_ui()

    def _set_report_font_size(self, text_edit: QTextEdit, size: int = 12):
        """Set font size for a report text edit."""
        if not text_edit:
            return
        font = text_edit.font()
        font.setPointSize(size)
        text_edit.setFont(font)

    def showEvent(self, event):
        """Called when the widget is shown (tab selected)."""
        super().showEvent(event)
        self._load_parties()
        if self.party_combo.currentIndex() > 0:
            self._show_party_ledger()

    def _build_ui(self):
        layout = QVBoxLayout(self)

        # Header row with help button
        header = QHBoxLayout()
        title = QLabel("Reports")
        title.setStyleSheet("font-size: 18px; font-weight: bold;")
        header.addWidget(title)
        header.addStretch()
        header.addWidget(create_help_button("Reports", REPORT_HELP))
        layout.addLayout(header)

        self.tabs = QTabWidget()

        # ============================================================
        # TRIAL BALANCE
        # ============================================================
        tb_tab = QWidget()
        tb_layout = QVBoxLayout(tb_tab)

        tb_desc = QLabel("Summary of all account balances with opening and closing balances.")
        tb_desc.setStyleSheet("color: #6c757d; font-size: 12px; padding: 0 0 4px 0;")
        tb_layout.addWidget(tb_desc)

        tb_controls = QHBoxLayout()
        tb_btn = QPushButton("Generate Trial Balance")
        tb_btn.setObjectName("primary")
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

        pl_desc = QLabel("Revenue, cost of sales, operating expenses, and net profit/loss for a period.")
        pl_desc.setStyleSheet("color: #6c757d; font-size: 12px; padding: 0 0 4px 0;")
        pl_layout.addWidget(pl_desc)

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
        pl_btn.setObjectName("primary")
        pl_btn.clicked.connect(self._show_profit_loss)
        pl_filters.addWidget(pl_btn)

        pl_refresh_btn = QPushButton("Refresh")
        pl_refresh_btn.clicked.connect(self._show_profit_loss)
        pl_filters.addWidget(pl_refresh_btn)

        pl_filters.addStretch()

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

        bs_desc = QLabel("Company financial position: assets, liabilities, and equity as at a specific date.")
        bs_desc.setStyleSheet("color: #6c757d; font-size: 12px; padding: 0 0 4px 0;")
        bs_layout.addWidget(bs_desc)

        bs_controls = QHBoxLayout()
        bs_btn = QPushButton("Generate Balance Sheet")
        bs_btn.setObjectName("primary")
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

        pl_desc2 = QLabel("Full transaction history for any customer or supplier with running balance.")
        pl_desc2.setStyleSheet("color: #6c757d; font-size: 12px; padding: 0 0 4px 0;")
        pl_layout2.addWidget(pl_desc2)

        party_filter = QHBoxLayout()
        party_filter.addWidget(QLabel("Party:"))
        self.party_combo = QComboBox()
        self.party_combo.setMinimumWidth(200)
        self.party_combo.addItem("Select Party", None)
        party_filter.addWidget(self.party_combo)

        party_filter.addWidget(QLabel("From:"))
        self.pl_date_from_ledger = QDateEdit()
        self.pl_date_from_ledger.setDate(QDate.currentDate().addMonths(-1))
        self.pl_date_from_ledger.setDisplayFormat("yyyy-MM-dd")
        party_filter.addWidget(self.pl_date_from_ledger)

        party_filter.addWidget(QLabel("To:"))
        self.pl_date_to_ledger = QDateEdit()
        self.pl_date_to_ledger.setDate(QDate.currentDate())
        self.pl_date_to_ledger.setDisplayFormat("yyyy-MM-dd")
        party_filter.addWidget(self.pl_date_to_ledger)

        pl_btn2 = QPushButton("Generate Ledger")
        pl_btn2.setObjectName("primary")
        pl_btn2.clicked.connect(self._show_party_ledger)
        party_filter.addWidget(pl_btn2)

        pl_refresh_btn = QPushButton("Refresh")
        pl_refresh_btn.clicked.connect(self._show_party_ledger)
        party_filter.addWidget(pl_refresh_btn)

        party_filter.addStretch()

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

        cb_desc = QLabel("All cash and bank transactions with running balance for a date range.")
        cb_desc.setStyleSheet("color: #6c757d; font-size: 12px; padding: 0 0 4px 0;")
        cb_layout.addWidget(cb_desc)

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
        cb_btn.setObjectName("primary")
        cb_btn.clicked.connect(self._show_cash_book)
        cb_filters.addWidget(cb_btn)

        cb_refresh_btn = QPushButton("Refresh")
        cb_refresh_btn.clicked.connect(self._show_cash_book)
        cb_filters.addWidget(cb_refresh_btn)

        cb_filters.addStretch()

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

    # ============================================================
    # TRIAL BALANCE
    # ============================================================
    def _show_trial_balance(self):
        """Show trial balance with 6 columns: Code, Name, ODR, OCR, CDR, CCR + Parties Summary."""
        data, error = self.controller.get_trial_balance()
        if error:
            QMessageBox.warning(self, "Error", error)
            return

        if not data:
            QMessageBox.information(self, "No Data", "No data found.")
            return

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
        status_text = '&#10003; Balanced' if is_balanced else f'&#10007; Not Balanced (Diff: Rs. {balance_diff:,.2f})'

        html = f"""
        <html><head><style>
        {_SHARED_CSS}
        </style></head><body>
        <div class="company-header">
            <h2>BOP Nutraceuticals</h2>
            <div class="subtitle">Pharmaceutical Manufacturing</div>
        </div>
        <div class="report-title">Trial Balance</div>
        <div class="report-period">{period_label}</div>
        """

        if not rows:
            html += '<p style="text-align:center;color:#888;padding:40px;">No transactions found. Please add some transactions first.</p>'
        else:
            html += '''
            <table>
            <thead>
                <tr>
                    <th style="width:8%;">Code</th>
                    <th style="width:24%;">Account Name</th>
                    <th style="width:10%;text-align:right;">Opening Dr</th>
                    <th style="width:10%;text-align:right;">Opening Cr</th>
                    <th style="width:10%;text-align:right;">Current Dr</th>
                    <th style="width:10%;text-align:right;">Current Cr</th>
                    <th style="width:14%;text-align:right;">Net Debit</th>
                    <th style="width:14%;text-align:right;">Net Credit</th>
                </tr>
            </thead>
            <tbody>
            '''

            grouped = data.get('grouped_rows', {})
            section_order = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]
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

                html += f'<tr class="section-title"><td colspan="8"><b>{section_labels.get(acc_type, acc_type)}</b></td></tr>'

                for row in section_rows:
                    net = row['cdr'] - row['ccr']
                    net_dr = max(net, 0)
                    net_cr = abs(min(net, 0))
                    net_dr_class = 'positive' if net_dr > 0 else 'zero'
                    net_cr_class = 'negative' if net_cr > 0 else 'zero'

                    html += f'''
                    <tr>
                        <td>{row['code']}</td>
                        <td>{row['name']}</td>
                        <td class="right">{row['odr']:,.2f}</td>
                        <td class="right">{row['ocr']:,.2f}</td>
                        <td class="right">{row['cdr']:,.2f}</td>
                        <td class="right">{row['ccr']:,.2f}</td>
                        <td class="right {net_dr_class}">{net_dr:,.2f}</td>
                        <td class="right {net_cr_class}">{net_cr:,.2f}</td>
                    </tr>
                    '''

            total_net = total_cdr - total_ccr
            total_net_dr = max(total_net, 0)
            total_net_cr = abs(min(total_net, 0))

            html += f'''
            <tr class="total-row">
                <td colspan="2"><b>TOTALS</b></td>
                <td class="right"><b>{total_odr:,.2f}</b></td>
                <td class="right"><b>{total_ocr:,.2f}</b></td>
                <td class="right"><b>{total_cdr:,.2f}</b></td>
                <td class="right"><b>{total_ccr:,.2f}</b></td>
                <td class="right positive"><b>{total_net_dr:,.2f}</b></td>
                <td class="right negative"><b>{total_net_cr:,.2f}</b></td>
            </tr>
            '''
            html += '</tbody></table>'

        # Parties Summary
        if parties_summary:
            html += '<div class="report-title" style="font-size:14px;margin-top:16px;">Parties Summary</div>'
            html += '''
            <table>
            <thead>
                <tr>
                    <th style="width:12%;">Code</th>
                    <th style="width:24%;">Party Name</th>
                    <th style="width:10%;text-align:right;">Opening Dr</th>
                    <th style="width:10%;text-align:right;">Opening Cr</th>
                    <th style="width:12%;text-align:right;">Current Dr</th>
                    <th style="width:12%;text-align:right;">Current Cr</th>
                    <th style="width:20%;text-align:right;">Net Balance</th>
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

                total_op_dr += op_dr
                total_op_cr += op_cr
                total_cur_dr += cur_dr
                total_cur_cr += cur_cr

                if net > 0.01:
                    net_class = 'positive'
                    net_label = f'Receivable: Rs. {net:,.2f}'
                elif net < -0.01:
                    net_class = 'negative'
                    net_label = f'Payable: Rs. {abs(net):,.2f}'
                else:
                    net_class = 'zero'
                    net_label = 'Nil'

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
            total_net_class = 'positive' if total_net >= 0 else 'negative'
            html += f'''
            <tr class="total-row">
                <td colspan="2"><b>TOTAL PARTIES</b></td>
                <td class="right"><b>{total_op_dr:,.2f}</b></td>
                <td class="right"><b>{total_op_cr:,.2f}</b></td>
                <td class="right"><b>{total_cur_dr:,.2f}</b></td>
                <td class="right"><b>{total_cur_cr:,.2f}</b></td>
                <td class="right {total_net_class}"><b>Rs. {total_net:,.2f}</b></td>
            </tr>
            '''
            html += '</tbody></table>'

        html += f'''
        <div class="summary-box" style="display:flex;justify-content:space-between;">
            <span>Total Net Debit: <b>Rs. {total_cdr:,.2f}</b></span>
            <span>Total Net Credit: <b>Rs. {total_ccr:,.2f}</b></span>
            <span style="color:{status_color};font-weight:700;">{status_text}</span>
        </div>
        <div class="footer">
            Generated: {generated_at}
            <br><span class="note">The annexed notes form an integral part of these financial statements.</span>
        </div>
        </body></html>
        '''

        self.tb_text.setHtml(html)
        self._set_report_font_size(self.tb_text, 14)

    # ============================================================
    # PROFIT & LOSS
    # ============================================================
    def _show_profit_loss(self):
        """Show profit & loss statement with table format for Excel export."""
        date_from = self.pl_date_from.date().toString("yyyy-MM-dd")
        date_to = self.pl_date_to.date().toString("yyyy-MM-dd")

        data, error = self.controller.get_profit_loss(date_from, date_to)
        if error:
            QMessageBox.warning(self, "Error", error)
            return

        if not data:
            QMessageBox.information(self, "No Data", "No data found.")
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
        <html><head><style>
        {_SHARED_CSS}
        </style></head><body>
        <div class="company-header">
            <h2>BOP Nutraceuticals</h2>
            <div class="subtitle">Pharmaceutical Manufacturing</div>
        </div>
        <div class="report-title">Profit & Loss Statement</div>
        <div class="report-period">Period: {date_from} to {date_to}</div>
        <table>
        """

        # SALES
        html += '<tr class="section-title"><td colspan="2"><b>SALES / REVENUE</b></td></tr>'
        if sales:
            for item in sales:
                amount = item.get('amount', 0)
                html += f'<tr><td class="indent">{item["code"]} - {item["name"]}</td><td class="right">Rs. {amount:,.2f}</td></tr>'
        html += f'<tr class="total-row"><td><b>Total Sales</b></td><td class="right"><b>Rs. {total_sales:,.2f}</b></td></tr>'

        # COST OF SALES
        html += '<tr class="section-title"><td colspan="2"><b>COST OF SALES</b></td></tr>'
        cogs_raw_total = 0.0
        cogs_packing_total = 0.0
        cogs_other_total = 0.0
        if cost_of_sales:
            for item in cost_of_sales:
                amount = item.get('amount', 0)
                code = str(item.get('code', ''))
                if code == '5000':
                    cogs_raw_total += amount
                elif code == '5001':
                    cogs_packing_total += amount
                else:
                    cogs_other_total += amount
                html += f'<tr><td class="indent">{item["code"]} - {item["name"]}</td><td class="right">(Rs. {amount:,.2f})</td></tr>'

        if cogs_raw_total or cogs_packing_total:
            if cogs_raw_total:
                html += f'<tr class="sub-head"><td class="indent">Raw Material Cost</td><td class="right">(Rs. {cogs_raw_total:,.2f})</td></tr>'
            if cogs_packing_total:
                html += f'<tr class="sub-head"><td class="indent">Packing Material Cost</td><td class="right">(Rs. {cogs_packing_total:,.2f})</td></tr>'

        html += f'<tr class="total-row"><td><b>Total Cost of Sales</b></td><td class="right"><b>(Rs. {total_cogs:,.2f})</b></td></tr>'

        # GROSS PROFIT
        gp_class = 'positive' if gross_profit >= 0 else 'negative'
        html += f'<tr class="total-row"><td><b>Gross Profit</b></td><td class="right {gp_class}"><b>Rs. {gross_profit:,.2f}</b></td></tr>'

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

        html += f'''<tr class="total-row" style="border-top:2px solid #17a2b8;">
            <td><b>Total Operating Expenses</b></td>
            <td class="right negative"><b>(Rs. {total_operating_expenses:,.2f})</b></td>
        </tr>'''

        # OTHER INCOME
        if other_income or total_other_income > 0:
            html += '<tr class="section-title"><td colspan="2"><b>OTHER INCOME</b></td></tr>'
            for inc in other_income:
                amount = inc.get('amount', 0)
                html += f'<tr><td class="indent">{inc["code"]} - {inc["name"]}</td><td class="right">Rs. {amount:,.2f}</td></tr>'
            html += f'<tr class="total-row"><td><b>Total Other Income</b></td><td class="right positive"><b>Rs. {total_other_income:,.2f}</b></td></tr>'

        # PROFIT FROM OPERATIONS
        pfo_class = 'positive' if profit_from_operations >= 0 else 'negative'
        html += f'''<tr class="total-row" style="border-top:2px solid #17a2b8;">
            <td><b>Profit from Operations</b></td>
            <td class="right {pfo_class}"><b>Rs. {profit_from_operations:,.2f}</b></td>
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
            html += f'''<tr class="total-row" style="border-top:2px solid #6f42c1;">
                <td><b>Profit Before Tax</b></td>
                <td class="right" style="color:#6f42c1;"><b>Rs. {profit_before_tax:,.2f}</b></td>
            </tr>'''

        # NET PROFIT
        html += f'''<tr class="grand-total">
            <td><b>NET {profit_label.upper()}</b></td>
            <td class="right" style="color:{color};"><b>Rs. {profit:,.2f}</b></td>
        </tr>'''

        html += f"""
        </table>
        <div class="footer">
            Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
            <br><span class="note">The annexed notes form an integral part of these financial statements.</span>
        </div>
        </body></html>
        """

        self.pl_text.setHtml(html)
        self._set_report_font_size(self.pl_text, 14)

    # ============================================================
    # BALANCE SHEET
    # ============================================================
    def _show_balance_sheet(self):
        """Show balance sheet with table format for Excel export."""
        data, error = self.controller.get_balance_sheet()
        if error:
            QMessageBox.warning(self, "Error", error)
            return

        if not data:
            QMessageBox.information(self, "No Data", "No data found.")
            return

        balanced = data.get('is_balanced', True)
        color = '#28a745' if balanced else '#dc3545'
        status_text = '&#10003; Balanced' if balanced else '&#10007; Not Balanced'

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
        <html><head><style>
        {_SHARED_CSS}
        </style></head><body>
        <div class="company-header">
            <h2>BOP Nutraceuticals</h2>
            <div class="subtitle">Pharmaceutical Manufacturing</div>
        </div>
        <div class="report-title">Balance Sheet</div>
        <div class="report-period">As at {as_at}</div>
        <table>
        """

        # EQUITY AND LIABILITIES
        html += '<tr class="section-title"><td colspan="2"><b>EQUITY AND LIABILITIES</b></td></tr>'

        html += '<tr class="sub-head"><td colspan="2"><b>SHARE CAPITAL AND RESERVES</b></td></tr>'

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
            if name_lower not in ["owner's equity", "owners equity", "share capital", "retained earnings", "revenue reserve"]:
                html += f'<tr><td class="indent">{name}</td><td class="right">Rs. {eq.get("balance", 0):,.2f}</td></tr>'

        html += f'<tr class="total-row"><td><b>Total Equity</b></td><td class="right"><b>Rs. {total_equity:,.2f}</b></td></tr>'

        # Non-Current Liabilities
        html += '<tr class="section-title"><td colspan="2"><b>NON-CURRENT LIABILITIES</b></td></tr>'
        if non_current_liabilities:
            for liab in non_current_liabilities:
                html += f'<tr><td class="indent">{liab.get("name", "")}</td><td class="right">Rs. {liab.get("balance", 0):,.2f}</td></tr>'
        else:
            html += '<tr><td class="indent muted">No non-current liabilities</td><td class="right muted">-</td></tr>'
        html += f'<tr class="total-row"><td><b>Total Non-Current Liabilities</b></td><td class="right"><b>Rs. {total_non_current_liabilities:,.2f}</b></td></tr>'

        # Current Liabilities
        html += '<tr class="section-title"><td colspan="2"><b>CURRENT LIABILITIES</b></td></tr>'
        if current_liabilities:
            for liab in current_liabilities:
                neg = ' negative' if liab.get('balance', 0) < 0 else ''
                html += f'<tr><td class="indent">{liab.get("name", "")}</td><td class="right{neg}">Rs. {liab.get("balance", 0):,.2f}</td></tr>'
        else:
            html += '<tr><td class="indent muted">No current liabilities</td><td class="right muted">-</td></tr>'
        html += f'<tr class="total-row"><td><b>Total Current Liabilities</b></td><td class="right"><b>Rs. {total_current_liabilities:,.2f}</b></td></tr>'

        html += f'<tr class="total-row"><td><b>Total Liabilities</b></td><td class="right"><b>Rs. {total_liabilities:,.2f}</b></td></tr>'
        html += f'<tr class="grand-total"><td><b>TOTAL EQUITY AND LIABILITIES</b></td><td class="right"><b>Rs. {total_liabilities_and_equity:,.2f}</b></td></tr>'

        # ASSETS
        html += '<tr class="section-title"><td colspan="2"><b>NON-CURRENT ASSETS</b></td></tr>'
        if non_current_assets:
            for asset in non_current_assets:
                html += f'<tr><td class="indent">{asset.get("name", "")}</td><td class="right">Rs. {asset.get("balance", 0):,.2f}</td></tr>'
        else:
            html += '<tr><td class="indent muted">No non-current assets</td><td class="right muted">-</td></tr>'
        html += f'<tr class="total-row"><td><b>Total Non-Current Assets</b></td><td class="right"><b>Rs. {total_non_current_assets:,.2f}</b></td></tr>'

        html += '<tr class="section-title"><td colspan="2"><b>CURRENT ASSETS</b></td></tr>'
        if current_assets:
            for asset in current_assets:
                neg = ' negative' if asset.get('balance', 0) < 0 else ''
                html += f'<tr><td class="indent">{asset.get("name", "")}</td><td class="right{neg}">Rs. {asset.get("balance", 0):,.2f}</td></tr>'
        else:
            html += '<tr><td class="indent muted">No current assets</td><td class="right muted">-</td></tr>'
        html += f'<tr class="total-row"><td><b>Total Current Assets</b></td><td class="right"><b>Rs. {total_current_assets:,.2f}</b></td></tr>'

        html += f'<tr class="grand-total"><td><b>TOTAL ASSETS</b></td><td class="right"><b>Rs. {total_assets:,.2f}</b></td></tr>'

        html += f"""
        </table>
        <div class="summary-box" style="display:flex;justify-content:space-between;">
            <span class="{'' if balanced else 'negative'}" style="font-weight:700;">{status_text}</span>
            <span>Total Assets: <b>Rs. {total_assets:,.2f}</b></span>
            <span>Total L+E: <b>Rs. {total_liabilities_and_equity:,.2f}</b></span>
        </div>
        <div class="footer">
            Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
            <br><span class="note">The annexed notes form an integral part of these financial statements.</span>
        </div>
        </body></html>
        """

        self.bs_text.setHtml(html)
        self._set_report_font_size(self.bs_text, 14)

    # ============================================================
    # PARTY LEDGER
    # ============================================================
    def _show_party_ledger(self):
        """Show party ledger with correct balance for both customers and suppliers."""
        party_id = self.party_combo.currentData()
        if not party_id:
            QMessageBox.warning(self, "Selection Error", "Please select a party.")
            return

        data, error = self.controller.get_party_ledger(party_id)
        if error:
            QMessageBox.warning(self, "Error", error)
            return

        if not data:
            QMessageBox.information(self, "No Data", "No transactions found.")
            return

        if "error" in data:
            QMessageBox.warning(self, "Error", data["error"])
            return

        balance = data.get('closing_balance', 0)
        balance_type = data.get('balance_type', 'Zero')
        balance_label = data.get('balance_label', 'Zero Balance')
        party_type = data.get('party_type', 'CUSTOMER')

        if balance_type == "Receivable":
            color = '#28a745'
        elif balance_type == "Payable":
            color = '#dc3545'
        elif balance_type == "Debit Balance":
            color = '#dc3545'
        elif balance_type == "Credit Balance":
            color = '#f39c12'
        else:
            color = '#6c757d'

        party_type_label = "Customer" if data.get('is_customer', False) else "Supplier"

        html = f"""
        <html><head><style>
        {_SHARED_CSS}
        </style></head><body>
        <div class="company-header">
            <h2>BOP Nutraceuticals</h2>
            <div class="subtitle">Pharmaceutical Manufacturing</div>
        </div>
        <div class="report-title">{data['title']}</div>
        <div class="summary-box" style="display:flex;gap:24px;">
            <span><b>Party:</b> {data['party']['name']} ({data['party']['code']})</span>
            <span><b>Type:</b> <span style="color:{'#28a745' if data.get('is_customer', False) else '#dc3545'};font-weight:600;">{party_type_label}</span></span>
            <span><b>Opening Balance:</b> Rs. {data.get('opening_balance', 0):,.2f}</span>
        </div>
        <table>
        <tr>
            <th style="width:10%;">Date</th>
            <th style="width:14%;">Voucher</th>
            <th style="width:10%;">Type</th>
            <th style="width:26%;">Description</th>
            <th style="width:10%;text-align:right;">Debit</th>
            <th style="width:10%;text-align:right;">Credit</th>
            <th style="width:20%;text-align:right;">Balance</th>
        </tr>
        """

        if data.get('transactions'):
            for txn in data['transactions']:
                txn_balance = txn['balance']
                balance_class = 'positive' if txn_balance > 0.01 else ('negative' if txn_balance < -0.01 else 'zero')
                debit_class = 'positive' if txn['debit'] > 0 else 'zero'
                credit_class = 'negative' if txn['credit'] > 0 else 'zero'

                html += f"""
                <tr>
                    <td>{txn['date_formatted']}</td>
                    <td>{txn['voucher_number']}</td>
                    <td>{txn['voucher_type']}</td>
                    <td>{txn['description'] or '-'}</td>
                    <td class="right {debit_class}">{txn['debit']:,.2f}</td>
                    <td class="right {credit_class}">{txn['credit']:,.2f}</td>
                    <td class="right {balance_class}"><b>{txn_balance:,.2f}</b></td>
                </tr>
                """
        else:
            html += '<tr><td colspan="7" style="text-align:center;color:#888;padding:30px;">No transactions found for this party.</td></tr>'

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

        <div class="closing-box" style="border:2px solid {color};color:{color};">
            Closing Balance: Rs. {balance:,.2f} ({balance_label})
        </div>

        <div class="summary-box" style="display:flex;justify-content:space-around;">
            <span>Total Debits: <b>Rs. {total_debit:,.2f}</b></span>
            <span>Total Credits: <b>Rs. {total_credit:,.2f}</b></span>
            <span>Net Movement: <b>Rs. {total_debit - total_credit:,.2f}</b></span>
        </div>

        <div class="footer">
            Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
            <br><span class="note">All amounts in Pakistani Rupees (PKR).</span>
        </div>
        </body></html>
        """

        self.pl_text2.setHtml(html)
        self._set_report_font_size(self.pl_text2, 14)

    # ============================================================
    # CASH BOOK
    # ============================================================
    def _show_cash_book(self):
        """Show cash book with table format for Excel export."""
        date_from = self.cb_date_from.date().toString("yyyy-MM-dd")
        date_to = self.cb_date_to.date().toString("yyyy-MM-dd")

        data, error = self.controller.get_cash_book(date_from, date_to)
        if error:
            QMessageBox.warning(self, "Error", error)
            return

        if not data:
            QMessageBox.information(self, "No Data", "No data found.")
            return

        if "error" in data:
            QMessageBox.warning(self, "Error", data["error"])
            return

        balance = data['closing_balance']
        balance_color = '#28a745' if balance >= 0 else '#dc3545'

        html = f"""
        <html><head><style>
        {_SHARED_CSS}
        </style></head><body>
        <div class="company-header">
            <h2>BOP Nutraceuticals</h2>
            <div class="subtitle">Pharmaceutical Manufacturing</div>
        </div>
        <div class="report-title">{data['title']}</div>
        <div class="report-period">Period: {data['date_from']} to {data['date_to']}</div>
        <table>
        <tr>
            <th style="width:10%;">Date</th>
            <th style="width:14%;">Voucher</th>
            <th style="width:26%;">Description</th>
            <th style="width:8%;">Account</th>
            <th style="width:13%;text-align:right;">Received</th>
            <th style="width:13%;text-align:right;">Paid</th>
            <th style="width:16%;text-align:right;">Balance</th>
        </tr>
        """

        for txn in data['transactions']:
            txn_balance = txn['balance']
            txn_color = 'positive' if txn_balance >= 0 else 'negative'
            account = txn.get('account', '')
            account_html = f'<span style="font-size:10px;color:#888;padding:1px 4px;background:#f1f3f5;border-radius:3px;">{account}</span>' if account else ''
            html += f'<tr><td>{txn["date"]}</td><td>{txn["voucher"]}</td><td>{txn["description"]}</td><td>{account_html}</td><td class="right positive">{txn["received"]:,.2f}</td><td class="right negative">{txn["paid"]:,.2f}</td><td class="right {txn_color}"><b>{txn_balance:,.2f}</b></td></tr>'

        html += f"""
        </table>
        <div class="summary-box" style="display:flex;justify-content:space-around;">
            <span>Total Received: <b class="positive">Rs. {data['total_received']:,.2f}</b></span>
            <span>Total Paid: <b class="negative">Rs. {data['total_paid']:,.2f}</b></span>
            <span>Closing Balance: <b style="color:{balance_color};">Rs. {balance:,.2f}</b></span>
        </div>
        <div class="footer">
            Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
            <br><span class="note">All amounts in Pakistani Rupees (PKR).</span>
        </div>
        </body></html>
        """

        self.cb_text.setHtml(html)
        self._set_report_font_size(self.cb_text, 14)
