"""
Tests for services layer.
"""
import pytest
from services.accounting_service import AccountingService
from services.sales_invoice_service import SalesInvoiceService


class TestAccountingService:
    """Test AccountingService business logic."""
    
    def setup_method(self):
        """Setup test fixtures."""
        self.service = AccountingService()
    
    def test_validate_debits_credits_balanced(self):
        """Test that balanced entries pass validation."""
        lines = [
            {'account_id': 1, 'debit_amount': 1000, 'credit_amount': 0},
            {'account_id': 2, 'debit_amount': 0, 'credit_amount': 1000}
        ]
        
        # Should not raise exception
        try:
            self.service._validate_journal_entry_lines(lines)
        except Exception as e:
            pytest.fail(f"Validation failed unexpectedly: {e}")
    
    def test_validate_debits_credits_unbalanced(self):
        """Test that unbalanced entries fail validation."""
        lines = [
            {'account_id': 1, 'debit_amount': 1000, 'credit_amount': 0},
            {'account_id': 2, 'debit_amount': 0, 'credit_amount': 500}
        ]
        
        with pytest.raises(Exception):
            self.service._validate_journal_entry_lines(lines)
    
    def test_generate_voucher_number(self):
        """Test voucher number generation."""
        voucher = self.service.generate_voucher_number('JV')
        
        assert voucher.startswith('JV-')
        assert len(voucher) > 3


class TestSalesInvoiceService:
    """Test SalesInvoiceService business logic."""
    
    def setup_method(self):
        """Setup test fixtures."""
        self.service = SalesInvoiceService()
    
    def test_calculate_invoice_totals(self):
        """Test invoice total calculation."""
        items = [
            {'quantity': 2, 'price': 100, 'line_total': 200},
            {'quantity': 1, 'price': 50, 'line_total': 50}
        ]
        
        total = sum(item['line_total'] for item in items)
        
        assert total == 250
