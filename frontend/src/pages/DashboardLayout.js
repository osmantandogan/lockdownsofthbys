import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { 
  LayoutDashboard, 
  Phone, 
  Folder, 
  Truck, 
  Package, 
  Clock, 
  Settings, 
  LogOut,
  Menu,
  X,
  FileText,
  History,
  UserCog,
  Users,
  User,
  Archive as ArchiveIcon,
  FileCog,
  Bell,
  Gauge,
  UserPlus
} from 'lucide-react';
import { useState } from 'react';
import NotificationDropdown from '../components/NotificationDropdown';

const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const menuItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/dashboard/call-center', icon: Phone, label: 'Çağrı Merkezi', roles: ['cagri_merkezi', 'operasyon_muduru', 'merkez_ofis'] },
    { path: '/dashboard/patient-registration', icon: UserPlus, label: 'Kayıt', roles: ['att', 'paramedik', 'hemsire', 'operasyon_muduru', 'merkez_ofis'] },
    { path: '/dashboard/my-stock', icon: Package, label: 'Lokasyon Stoğum', roles: ['att', 'paramedik', 'hemsire', 'sofor'] },
    { path: '/dashboard/cases', icon: Folder, label: 'Vakalar' },
    { path: '/dashboard/vehicles', icon: Truck, label: 'Araçlar' },
    { path: '/dashboard/stock', icon: Package, label: 'Stok', roles: ['operasyon_muduru', 'merkez_ofis', 'bas_sofor', 'cagri_merkezi', 'hemsire'] },
    { path: '/dashboard/shifts', icon: Clock, label: 'Vardiya' },
    { path: '/dashboard/shift-assignments', icon: Clock, label: 'Vardiya Atama', roles: ['merkez_ofis', 'operasyon_muduru', 'bas_sofor'] },
    { path: '/dashboard/forms', icon: FileText, label: 'Formlar' },
    { path: '/dashboard/form-history', icon: History, label: 'Form Geçmişi', roles: ['merkez_ofis', 'operasyon_muduru', 'doktor'] },
    { path: '/dashboard/patient-cards', icon: User, label: 'Hasta Kartları', roles: ['merkez_ofis', 'operasyon_muduru', 'doktor', 'hemsire', 'paramedik', 'att', 'cagri_merkezi'] },
    { path: '/dashboard/user-management', icon: UserCog, label: 'Kullanıcı Yönetimi', roles: ['merkez_ofis', 'operasyon_muduru'] },
    { path: '/dashboard/staff', icon: Users, label: 'Personel Performansı', roles: ['merkez_ofis', 'operasyon_muduru', 'bas_sofor'] },
    { path: '/dashboard/documents', icon: FileCog, label: 'Döküman Yönetimi', roles: ['merkez_ofis', 'operasyon_muduru'] },
    { path: '/dashboard/archive', icon: ArchiveIcon, label: 'Form Arşivi', roles: ['merkez_ofis', 'operasyon_muduru'] },
    { path: '/dashboard/notifications', icon: Bell, label: 'Bildirim Ayarları' },
    { path: '/dashboard/settings', icon: Settings, label: 'Ayarlar' }
  ];

  const roleLabels = {
    'merkez_ofis': 'Merkez Ofis',
    'operasyon_muduru': 'Operasyon Müdürü',
    'doktor': 'Doktor',
    'hemsire': 'Hemşire',
    'paramedik': 'Paramedik',
    'att': 'ATT',
    'bas_sofor': 'Baş Şoför',
    'sofor': 'Şoför',
    'cagri_merkezi': 'Çağrı Merkezi',
    'personel': 'Personel'
  };

  const filteredMenuItems = menuItems.filter(item => {
    if (!item.roles) return true;
    return item.roles.includes(user?.role);
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-white border-b z-50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <img src="/logo.svg" alt="HealMedy" className="h-8 w-8" />
          <span className="font-bold text-lg">HealMedy</span>
        </div>
        <div className="flex items-center space-x-2">
          <NotificationDropdown />
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </div>

      {/* Desktop header with notifications */}
      <div className="hidden lg:flex fixed top-0 left-64 right-0 bg-white border-b z-30 px-6 py-3 items-center justify-end">
        <NotificationDropdown />
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-white border-r transform transition-transform duration-200 ease-in-out z-40 flex flex-col
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        <div className="p-6 border-b">
          <div className="flex items-center space-x-3">
            <img src="/logo.svg" alt="HealMedy" className="h-10 w-10" />
            <div>
              <h1 className="font-bold text-lg">HealMedy</h1>
              <p className="text-xs text-gray-500">HBYS</p>
            </div>
          </div>
        </div>

        <div className="p-4 border-b">
          <div className="flex items-center space-x-3">
            {user?.profile_photo || user?.picture ? (
              <img src={user.profile_photo || user.picture} alt={user.name} className="w-10 h-10 rounded-full object-cover border-2 border-red-200" />
            ) : (
              <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-700 rounded-full flex items-center justify-center">
                <span className="text-white font-bold">{user?.name?.[0]?.toUpperCase()}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-gray-500">{roleLabels[user?.role]}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1" style={{ maxHeight: 'calc(100vh - 220px)' }}>
          {filteredMenuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/dashboard'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-700 hover:bg-gray-50'
                }`
              }
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t bg-white p-4">
          <Button
            variant="ghost"
            className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={handleLogout}
            data-testid="logout-button"
          >
            <LogOut className="h-5 w-5 mr-3" />
            Çıkış Yap
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64 pt-16 lg:pt-14">
        <main className="p-6">
          <Outlet />
        </main>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default DashboardLayout;
