/**
 * OfflineStatusBar - Çevrimdışı durum göstergesi
 * Ekranın üstünde veya altında offline durumu ve pending sync sayısını gösterir
 */

import React from 'react';
import { useOffline } from '../contexts/OfflineContext';
import { useGPS } from '../contexts/GPSContext';
import { WifiOff, Wifi, RefreshCw, MapPin, CloudOff } from 'lucide-react';
import { Button } from './ui/button';

const OfflineStatusBar = ({ position = 'bottom' }) => {
  const { isOnline, isSyncing, pendingCount, syncNow } = useOffline();
  const { isTracking, currentPosition } = useGPS();
  
  // Online ve bekleyen veri yoksa gösterme
  if (isOnline && pendingCount === 0) {
    return null;
  }
  
  const positionClass = position === 'top' 
    ? 'top-0 left-0 right-0' 
    : 'bottom-0 left-0 right-0';
  
  return (
    <div className={`fixed ${positionClass} z-50 px-4 py-2`}>
      <div className={`
        flex items-center justify-between gap-4 px-4 py-2 rounded-lg shadow-lg
        ${isOnline 
          ? 'bg-yellow-100 border border-yellow-300 text-yellow-800' 
          : 'bg-red-100 border border-red-300 text-red-800'
        }
      `}>
        <div className="flex items-center gap-3">
          {/* Network Status */}
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Wifi className="h-4 w-4 text-green-600" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-600" />
            )}
            <span className="text-sm font-medium">
              {isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
            </span>
          </div>
          
          {/* GPS Status */}
          {isTracking && currentPosition && (
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <MapPin className="h-3 w-3" />
              <span>GPS Aktif</span>
            </div>
          )}
          
          {/* Pending Count */}
          {pendingCount > 0 && (
            <div className="flex items-center gap-1 text-sm">
              <CloudOff className="h-4 w-4" />
              <span>
                {pendingCount} bekleyen veri
              </span>
            </div>
          )}
        </div>
        
        {/* Sync Button */}
        {isOnline && pendingCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={syncNow}
            disabled={isSyncing}
            className="h-7 text-xs"
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Senkronize ediliyor...' : 'Şimdi Senkronize Et'}
          </Button>
        )}
        
        {/* Offline Message */}
        {!isOnline && (
          <span className="text-xs">
            Veriler yerel olarak kaydediliyor
          </span>
        )}
      </div>
    </div>
  );
};

export default OfflineStatusBar;

