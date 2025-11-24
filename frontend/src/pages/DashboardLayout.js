import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { ScrollArea } from '../components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Badge } from '../components/ui/badge';
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
  BarChart3,
  Shield,
  Bell
} from 'lucide-react';
import { useState } from 'react';

const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'Yeni Vaka', message: 'Yüksek öncelikli vaka oluşturuldu', time: '5 dk önce', read: false },
    { id: 2, title: 'Kritik Stok', message: 'Parasetamol kritik seviyede', time: '1 saat önce', read: false }
  ]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id) => {
    setNotifications(notifications.map(n => n.id === id ? {...n, read: true} : n));
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const menuItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/dashboard/call-center', icon: Phone, label: 'Çağrı Merkezi', roles: ['cagri_merkezi', 'operasyon_muduru', 'merkez_ofis'] },
    { path: '/dashboard/cases', icon: Folder, label: 'Vakalar' },
    { path: '/dashboard/vehicles', icon: Truck, label: 'Araçlar' },
    { path: '/dashboard/stock', icon: Package, label: 'Stok' },
    { path: '/dashboard/stock-movements', icon: Package, label: 'Stok Hareketleri', roles: ['merkez_ofis', 'operasyon_muduru', 'hemsire'] },
    { path: '/dashboard/shifts', icon: Clock, label: 'Vardiya' },
    { path: '/dashboard/shift-assignments', icon: Clock, label: 'Vardiya Atama', roles: ['merkez_ofis', 'operasyon_muduru', 'bas_sofor'] },
    { path: '/dashboard/forms', icon: FileText, label: 'Formlar' },
    { path: '/dashboard/form-history', icon: History, label: 'Form Geçmişi', roles: ['merkez_ofis', 'operasyon_muduru', 'doktor'] },
    { path: '/dashboard/reports', icon: BarChart3, label: 'Raporlar', roles: ['merkez_ofis', 'operasyon_muduru'] },
    { path: '/dashboard/user-management', icon: UserCog, label: 'Kullanıcı Yönetimi', roles: ['merkez_ofis', 'operasyon_muduru'] },
    { path: '/dashboard/audit-logs', icon: Shield, label: 'Audit Logları', roles: ['merkez_ofis'] },
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 text-white text-xs">
                    {unreadCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <div className="p-2 border-b">
                <p className="font-semibold">Bildirimler</p>
              </div>
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">Bildirim yok</div>
              ) : (
                notifications.map(notif => (
                  <DropdownMenuItem key={notif.id} className="p-3 cursor-pointer" onClick={() => markAsRead(notif.id)}>
                    <div className="space-y-1 w-full">
                      <div className="flex justify-between items-start">
                        <p className="font-medium text-sm">{notif.title}</p>
                        {!notif.read && <div className="w-2 h-2 bg-blue-600 rounded-full"></div>}
                      </div>
                      <p className="text-xs text-gray-600">{notif.message}</p>
                      <p className="text-xs text-gray-400">{notif.time}</p>
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
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
            {user?.picture ? (
              <img src={user.picture} alt={user.name} className="w-10 h-10 rounded-full" />
            ) : (
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                <span className="text-gray-600 font-medium">{user?.name?.[0]}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-gray-500">{roleLabels[user?.role]}</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center p-0 bg-red-500 text-white text-xs">
                      {unreadCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="p-2 border-b">
                  <p className="font-semibold text-sm">Bildirimler</p>
                </div>
                {notifications.map(notif => (
                  <DropdownMenuItem key={notif.id} className="p-3" onClick={() => markAsRead(notif.id)}>
                    <div className="space-y-1 w-full">
                      <div className="flex justify-between">
                        <p className="font-medium text-sm">{notif.title}</p>
                        {!notif.read && <div className="w-2 h-2 bg-blue-600 rounded-full"></div>}
                      </div>
                      <p className="text-xs text-gray-600">{notif.message}</p>
                      <p className="text-xs text-gray-400">{notif.time}</p>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <ScrollArea className="flex-1 px-4">
          <nav className="space-y-1 py-4">
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
                <item.icon className="h-5 w-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </ScrollArea>

        <div className="p-4 border-t">
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
      <div className="lg:pl-64 pt-16 lg:pt-0">
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
