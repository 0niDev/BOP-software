// Main Dashboard Component
// DEBUG: Role-based navigation and dashboard widgets

import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole, PermissionCode } from '../enums';
import { debugLog } from '../config';
import { 
  LayoutDashboard, 
  FileText, 
  ShoppingCart, 
  Package, 
  Users, 
  Settings,
  LogOut,
  Menu,
  X,
  TrendingUp,
  DollarSign,
  PackageCheck,
  AlertTriangle
} from 'lucide-react';

export function MainWindow() {
  const { user, logout, hasPermission, hasRole } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    debugLog('MainWindow', 'Dashboard mounted for user:', user?.username);
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Import dashboard service dynamically
      const { DashboardService } = await import('../services/dashboard-service');
      const dashboardService = new DashboardService();
      
      const data = await dashboardService.getDashboardSummary(user?.company_id || 1);
      setDashboardData(data);
      debugLog('MainWindow', 'Dashboard data loaded', data);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    debugLog('MainWindow', 'User logging out');
    logout();
  };

  // Define menu items based on role and permissions
  const getMenuItems = () => {
    const items: any[] = [];

    // Dashboard - always visible
    items.push({
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      view: 'dashboard',
    });

    // Sales Module
    if (hasPermission(PermissionCode.VIEW_SALES_INVOICE)) {
      items.push({
        id: 'sales',
        label: 'Sales',
        icon: ShoppingCart,
        children: [
          { id: 'sales-invoices', label: 'Sales Invoices', view: 'sales-invoices' },
          { id: 'customers', label: 'Customers', view: 'customers' },
        ],
      });
    }

    // Purchase Module
    if (hasPermission(PermissionCode.VIEW_PURCHASE_INVOICE)) {
      items.push({
        id: 'purchase',
        label: 'Purchase',
        icon: Package,
        children: [
          { id: 'purchase-invoices', label: 'Purchase Invoices', view: 'purchase-invoices' },
          { id: 'suppliers', label: 'Suppliers', view: 'suppliers' },
        ],
      });
    }

    // Manufacturing Module
    if (hasPermission(PermissionCode.VIEW_PRODUCTION_ORDER)) {
      items.push({
        id: 'manufacturing',
        label: 'Manufacturing',
        icon: PackageCheck,
        children: [
          { id: 'production-orders', label: 'Production Orders', view: 'production-orders' },
          { id: 'bom', label: 'Bill of Materials', view: 'bom' },
        ],
      });
    }

    // Accounting Module
    if (hasPermission(PermissionCode.VIEW_JOURNAL_ENTRY)) {
      items.push({
        id: 'accounting',
        label: 'Accounting',
        icon: FileText,
        children: [
          { id: 'journal-entries', label: 'Journal Entries', view: 'journal-entries' },
          { id: 'chart-of-accounts', label: 'Chart of Accounts', view: 'chart-of-accounts' },
          { id: 'payments', label: 'Payments', view: 'payments' },
          { id: 'receipts', label: 'Receipts', view: 'receipts' },
        ],
      });
    }

    // Inventory Module
    if (hasPermission(PermissionCode.VIEW_STOCK)) {
      items.push({
        id: 'inventory',
        label: 'Inventory',
        icon: Package,
        children: [
          { id: 'stock-levels', label: 'Stock Levels', view: 'stock-levels' },
          { id: 'items', label: 'Items', view: 'items' },
          { id: 'warehouses', label: 'Warehouses', view: 'warehouses' },
        ],
      });
    }

    // Reports Module
    if (hasPermission(PermissionCode.VIEW_REPORTS)) {
      items.push({
        id: 'reports',
        label: 'Reports',
        icon: TrendingUp,
        children: [
          { id: 'trial-balance', label: 'Trial Balance', view: 'trial-balance' },
          { id: 'profit-loss', label: 'Profit & Loss', view: 'profit-loss' },
          { id: 'balance-sheet', label: 'Balance Sheet', view: 'balance-sheet' },
          { id: 'party-ledger', label: 'Party Ledger', view: 'party-ledger' },
        ],
      });
    }

    // Parties Module
    if (hasPermission(PermissionCode.VIEW_PARTIES)) {
      items.push({
        id: 'parties',
        label: 'Parties',
        icon: Users,
        children: [
          { id: 'all-parties', label: 'All Parties', view: 'all-parties' },
        ],
      });
    }

    // Admin Module (Admin only)
    if (hasRole(UserRole.ADMIN)) {
      items.push({
        id: 'admin',
        label: 'Admin',
        icon: Settings,
        children: [
          { id: 'users', label: 'Users', view: 'users' },
          { id: 'roles', label: 'Roles & Permissions', view: 'roles' },
          { id: 'companies', label: 'Companies', view: 'companies' },
        ],
      });
    }

    return items;
  };

  const menuItems = getMenuItems();

  return (
    <div className="main-window">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <h2>BOP ERP</h2>
          {sidebarOpen && (
            <button onClick={() => setSidebarOpen(false)} className="toggle-btn">
              <X size={20} />
            </button>
          )}
        </div>

        {!sidebarOpen && (
          <button onClick={() => setSidebarOpen(true)} className="toggle-btn collapsed">
            <Menu size={20} />
          </button>
        )}

        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <div key={item.id} className="nav-item">
              <div className="nav-link">
                <item.icon size={20} />
                {sidebarOpen && <span>{item.label}</span>}
              </div>
              {item.children && sidebarOpen && (
                <div className="nav-submenu">
                  {item.children.map((child: any) => (
                    <div key={child.id} className="nav-sublink">
                      {child.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          {sidebarOpen && (
            <>
              <div className="user-info">
                <p className="user-name">{user?.full_name}</p>
                <p className="user-role">Role: {UserRole[user?.role_id || 1]}</p>
              </div>
              <button onClick={handleLogout} className="logout-btn">
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="content-header">
          <h1>Dashboard</h1>
          <div className="header-actions">
            <span className="company-name">BOP Nutraceuticals</span>
          </div>
        </header>

        <div className="dashboard-content">
          {isLoading ? (
            <div className="loading-spinner">Loading dashboard...</div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="dashboard-cards">
                <div className="card">
                  <div className="card-icon">
                    <DollarSign size={32} />
                  </div>
                  <div className="card-content">
                    <h3>Total Revenue</h3>
                    <p className="card-value">
                      ₹{dashboardData?.totalRevenue?.toLocaleString() || '0.00'}
                    </p>
                  </div>
                </div>

                <div className="card">
                  <div className="card-icon">
                    <PackageCheck size={32} />
                  </div>
                  <div className="card-content">
                    <h3>Pending Orders</h3>
                    <p className="card-value">
                      {dashboardData?.pendingOrders || 0}
                    </p>
                  </div>
                </div>

                <div className="card">
                  <div className="card-icon">
                    <AlertTriangle size={32} />
                  </div>
                  <div className="card-content">
                    <h3>Low Stock Items</h3>
                    <p className="card-value">
                      {dashboardData?.lowStockItems || 0}
                    </p>
                  </div>
                </div>

                <div className="card">
                  <div className="card-icon">
                    <TrendingUp size={32} />
                  </div>
                  <div className="card-content">
                    <h3>Net Profit</h3>
                    <p className="card-value">
                      ₹{dashboardData?.netProfit?.toLocaleString() || '0.00'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="dashboard-section">
                <h2>Recent Activity</h2>
                <div className="activity-list">
                  {dashboardData?.recentActivities?.map((activity: any, index: number) => (
                    <div key={index} className="activity-item">
                      <span className="activity-date">{activity.date}</span>
                      <span className="activity-description">{activity.description}</span>
                      <span className="activity-amount">₹{activity.amount?.toLocaleString()}</span>
                    </div>
                  )) || <p>No recent activity</p>}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

console.log('[MainWindow] Main dashboard component created with role-based navigation');
