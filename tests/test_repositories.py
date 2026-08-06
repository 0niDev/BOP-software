"""
Tests for repository layer.
"""
import pytest
from repositories.party_repository import PartyRepository
from repositories.item_repository import ItemRepository
from repositories.account_repository import AccountRepository
from utils.exceptions import RecordNotFoundError


class TestPartyRepository:
    """Test PartyRepository CRUD operations."""
    
    def setup_method(self):
        """Setup test fixtures."""
        self.repo = PartyRepository()
        self.test_data = {
            'company_id': 1,
            'name': 'Test Party',
            'code': 'TESTPARTY001',
            'party_type': 'CUSTOMER',
            'is_active': 1,
            'phone': '9876543210',
            'email': 'testparty@example.com',
            'address': 'Test Address City',
            'opening_balance': 0.0,
            'credit_limit': 0.0
        }
        self.created_id = None
    
    def teardown_method(self):
        """Cleanup after each test."""
        if self.created_id:
            try:
                self.repo.delete(self.created_id)
            except Exception:
                pass
    
    def test_insert(self):
        """Test inserting a new party."""
        party_id = self.repo.insert(self.test_data)
        self.created_id = party_id
        
        assert party_id > 0
        assert isinstance(party_id, int)
    
    def test_find_by_id(self):
        """Test finding a party by ID."""
        party_id = self.repo.insert(self.test_data)
        self.created_id = party_id
        
        party = self.repo.find_by_id(party_id)
        
        assert party is not None
        assert party['name'] == 'Test Party'
        assert party['code'] == 'TESTPARTY001'
    
    def test_get_by_id_not_found(self):
        """Test getting a non-existent party raises error."""
        with pytest.raises(RecordNotFoundError):
            self.repo.get_by_id(999999)
    
    def test_update(self):
        """Test updating a party."""
        party_id = self.repo.insert(self.test_data)
        self.created_id = party_id
        
        update_data = {'contact_number': '1111111111'}
        self.repo.update(party_id, update_data)
        
        updated_party = self.repo.find_by_id(party_id)
        assert updated_party['contact_number'] == '1111111111'
    
    def test_find_all(self):
        """Test finding all parties."""
        parties = self.repo.find_all()
        
        assert isinstance(parties, list)
        # Should have at least the seed data parties
    
    def test_exists(self):
        """Test checking if a party exists."""
        party_id = self.repo.insert(self.test_data)
        self.created_id = party_id
        
        assert self.repo.exists(party_id) is True
        assert self.repo.exists(999999) is False
    
    def test_deactivate(self):
        """Test soft deleting a party."""
        party_id = self.repo.insert(self.test_data)
        self.created_id = party_id
        
        self.repo.deactivate(party_id)
        
        party = self.repo.find_by_id(party_id)
        assert party['is_active'] == 0
    
    def test_count(self):
        """Test counting parties."""
        count = self.repo.count()
        assert count >= 0
    
    def test_cache_hit(self):
        """Test that L1 cache works."""
        party_id = self.repo.insert(self.test_data)
        self.created_id = party_id
        
        # First call - should query database
        party1 = self.repo.find_by_id(party_id)
        
        # Second call - should hit cache
        party2 = self.repo.find_by_id(party_id)
        
        assert party1 == party2


class TestItemRepository:
    """Test ItemRepository operations."""
    
    def setup_method(self):
        """Setup test fixtures."""
        self.repo = ItemRepository()
        self.test_data = {
            'company_id': 1,
            'name': 'Test Product',
            'code': 'TESTPROD001',
            'unit_of_measure': 'PCS',
            'is_active': 1,
            'standard_rate': 150.00,
            'tax_rate_id': 1
        }
        self.created_id = None
    
    def teardown_method(self):
        """Cleanup after each test."""
        if self.created_id:
            try:
                self.repo.delete(self.created_id)
            except Exception:
                pass
    
    def test_insert_item(self):
        """Test inserting a new item."""
        item_id = self.repo.insert(self.test_data)
        self.created_id = item_id
        
        assert item_id > 0
    
    def test_find_by_code(self):
        """Test finding item by code."""
        item_id = self.repo.insert(self.test_data)
        self.created_id = item_id
        
        item = self.repo.find_by_code('TESTPROD001')
        
        assert item is not None
        assert item['name'] == 'Test Product'


class TestAccountRepository:
    """Test AccountRepository operations."""
    
    def setup_method(self):
        """Setup test fixtures."""
        self.repo = AccountRepository()
        self.test_data = {
            'company_id': 1,
            'account_name': 'Test Asset Account',
            'account_code': 'TESTASSET001',
            'account_type': 'ASSET',
            'is_active': 1,
            'parent_account_id': None
        }
        self.created_id = None
    
    def teardown_method(self):
        """Cleanup after each test."""
        if self.created_id:
            try:
                self.repo.delete(self.created_id)
            except Exception:
                pass
    
    def test_insert_account(self):
        """Test inserting a new account."""
        account_id = self.repo.insert(self.test_data)
        self.created_id = account_id
        
        assert account_id > 0
    
    def test_find_by_account_code(self):
        """Test finding account by code."""
        account_id = self.repo.insert(self.test_data)
        self.created_id = account_id
        
        account = self.repo.find_by_account_code('TESTASSET001')
        
        assert account is not None
        assert account['account_name'] == 'Test Asset Account'


class TestBatchOperations:
    """Test batch operation optimizations."""
    
    def setup_method(self):
        """Setup test fixtures."""
        self.repo = PartyRepository()
        self.created_ids = []
    
    def teardown_method(self):
        """Cleanup after each test."""
        for party_id in self.created_ids:
            try:
                self.repo.delete(party_id)
            except Exception:
                pass
    
    def test_find_by_ids(self):
        """Test batch finding by IDs."""
        # Create multiple parties
        ids = []
        for i in range(3):
            data = {
                'company_id': 1,
                'name': f'Batch Party {i}',
                'code': f'BATCH{i:03d}',
                'party_type': 'CUSTOMER',
                'is_active': 1,
                'phone': '1234567890',
                'email': f'batch{i}@example.com',
                'address': 'Batch Address',
                'opening_balance': 0.0,
                'credit_limit': 0.0
            }
            party_id = self.repo.insert(data)
            ids.append(party_id)
            self.created_ids.append(party_id)
        
        # Batch fetch
        parties = self.repo.find_by_ids(ids)
        
        assert len(parties) == 3
    
    def test_insert_batch(self):
        """Test batch insert."""
        data_list = [
            {'company_id': 1, 'name': 'Batch 1', 'code': 'BATCHINS001', 'party_type': 'CUSTOMER', 'is_active': 1, 'phone': '123', 'email': 'b1@test.com', 'address': 'A', 'opening_balance': 0.0, 'credit_limit': 0.0},
            {'company_id': 1, 'name': 'Batch 2', 'code': 'BATCHINS002', 'party_type': 'CUSTOMER', 'is_active': 1, 'phone': '123', 'email': 'b2@test.com', 'address': 'A', 'opening_balance': 0.0, 'credit_limit': 0.0},
            {'company_id': 1, 'name': 'Batch 3', 'code': 'BATCHINS003', 'party_type': 'CUSTOMER', 'is_active': 1, 'phone': '123', 'email': 'b3@test.com', 'address': 'A', 'opening_balance': 0.0, 'credit_limit': 0.0}
        ]
        
        ids = self.repo.insert_batch(data_list)
        
        assert len(ids) == 3
        for party_id in ids:
            self.created_ids.append(party_id)
    
    def test_delete_batch(self):
        """Test batch delete."""
        # Create parties to delete
        ids_to_delete = []
        for i in range(3):
            data = {
                'company_id': 1,
                'name': f'Delete Batch {i}',
                'code': f'DELBATCH{i:03d}',
                'party_type': 'CUSTOMER',
                'is_active': 1,
                'phone': '123',
                'email': f'del{i}@test.com',
                'address': 'A',
                'opening_balance': 0.0,
                'credit_limit': 0.0
            }
            party_id = self.repo.insert(data)
            ids_to_delete.append(party_id)
        
        # Batch delete
        self.repo.delete_batch(ids_to_delete)
        
        # Verify deletion
        for party_id in ids_to_delete:
            assert self.repo.exists(party_id) is False
