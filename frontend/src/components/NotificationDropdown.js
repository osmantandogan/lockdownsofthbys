import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../contexts/NotificationContext';
import { otpAPI } from '../api';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  AlertTriangle,
  Ambulance,
  Clock,
  Package,
  FileText,
  Shield,
  RefreshCw,
  Key,
  Copy,
  CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';

// Bildirim tipi ikonu
const getNotificationIcon = (type) => {
  switch (type) {
    case 'case_created':
    case 'case_assigned':
      return <Ambulance className="h-4 w-4 text-red-500" />;
    case 'case_doctor_approval':
      return <Check className="h-4 w-4 text-green-500" />;
    case 'shift_reminder':
    case 'shift_start_alert':
      return <Clock className="h-4 w-4 text-blue-500" />;
    case 'shift_master_code':
      return <Shield className="h-4 w-4 text-purple-500" />;
    case 'handover_approval':
      return <RefreshCw className="h-4 w-4 text-orange-500" />;
    case 'stock_critical':
      return <Package className="h-4 w-4 text-yellow-500" />;
    case 'case_file_access':
      return <FileText className="h-4 w-4 text-gray-500" />;
    case 'emergency':
      return <AlertTriangle className="h-4 w-4 text-red-600" />;
    default:
      return <Bell className="h-4 w-4 text-gray-500" />;
  }
};

// Zaman formatı
const formatTime = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'Az önce';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} dk önce`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} saat önce`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} gün önce`;
  
  return date.toLocaleDateString('tr-TR');
};

// OTP Bileşeni - Google Authenticator tarzı
const OTPDisplay = () => {
  const [otpData, setOtpData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);

  const fetchOTP = useCallback(async () => {
    try {
      const response = await otpAPI.getMyCode();
      setOtpData(response.data);
      setTimeLeft(response.data.remaining_seconds);
    } catch (error) {
      console.error('OTP fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOTP();
    
    // Her saniye güncelle
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Yeni kod al
          fetchOTP();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [fetchOTP]);

  const handleCopy = async () => {
    if (otpData?.code) {
      try {
        await navigator.clipboard.writeText(otpData.code);
        setCopied(true);
        toast.success('Kod kopyalandı');
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        toast.error('Kopyalama başarısız');
      }
    }
  };

  // Progress bar rengi
  const getProgressColor = () => {
    if (timeLeft > 20) return 'bg-green-500';
    if (timeLeft > 10) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (loading) {
    return (
      <div className="p-3 bg-gray-50 animate-pulse">
        <div className="h-12 bg-gray-200 rounded"></div>
      </div>
    );
  }

  return (
    <div className="border-t bg-gradient-to-r from-red-50 to-orange-50">
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Key className="h-4 w-4 text-red-600" />
            <span className="text-xs font-medium text-gray-600">Onay Kodu</span>
          </div>
          <div className="flex items-center space-x-1">
            <Clock className="h-3 w-3 text-gray-400" />
            <span className="text-xs text-gray-500">{timeLeft}s</span>
          </div>
        </div>
        
        {/* OTP Kodu */}
        <div className="flex items-center justify-between">
          <div 
            className="text-2xl font-mono font-bold tracking-widest text-red-700 cursor-pointer hover:text-red-800"
            onClick={handleCopy}
            title="Kopyalamak için tıkla"
          >
            {otpData?.code?.slice(0, 3)} {otpData?.code?.slice(3)}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-8 px-2"
          >
            {copied ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4 text-gray-500" />
            )}
          </Button>
        </div>
        
        {/* Progress bar */}
        <div className="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-1000 ${getProgressColor()}`}
            style={{ width: `${(timeLeft / 30) * 100}%` }}
          />
        </div>
        
        <p className="text-xs text-gray-500 mt-2 text-center">
          Onay gerektiren işlemlerde bu kodu kullanın
        </p>
      </div>
    </div>
  );
};

const NotificationDropdown = () => {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    loading,
    loadNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification
  } = useNotifications();
  
  const [open, setOpen] = useState(false);

  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    
    // URL'e yönlendir
    const url = notification.data?.url;
    if (url) {
      setOpen(false);
      navigate(url);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-red-500"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-semibold">Bildirimler</h3>
          <div className="flex items-center space-x-2">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllAsRead}>
                <CheckCheck className="h-4 w-4 mr-1" />
                Tümünü Oku
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={loadNotifications}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        
        <ScrollArea className="h-72">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Bell className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>Bildirim yok</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                    !notification.read ? 'bg-blue-50/50' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!notification.read ? 'font-semibold' : ''}`}>
                        {notification.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {notification.body}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatTime(notification.created_at)}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      {!notification.read && (
                        <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notification.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3 text-gray-400" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        
        {/* OTP Section - Ayırıcı çizgi ile */}
        <OTPDisplay />
        
        <div className="p-2 border-t">
          <Button 
            variant="ghost" 
            className="w-full text-sm"
            onClick={() => {
              setOpen(false);
              navigate('/dashboard/notifications');
            }}
          >
            Tüm Bildirimleri Gör
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationDropdown;
