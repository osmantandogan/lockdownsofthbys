/**
 * VehicleGPSMap - Araç GPS Haritası
 * Tüm araçların gerçek zamanlı konumunu harita üzerinde gösterir
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { locationsAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  RefreshCw, MapPin, Navigation, Clock, 
  Truck, Signal, AlertTriangle, Maximize2
} from 'lucide-react';
import { toast } from 'sonner';

// Leaflet marker icon fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom ambulance icon
const createAmbulanceIcon = (isActive, speed) => {
  const color = isActive ? (speed > 0 ? '#22c55e' : '#3b82f6') : '#9ca3af';
  const pulse = isActive && speed > 0 ? 'animate-pulse' : '';
  
  return L.divIcon({
    className: 'custom-ambulance-marker',
    html: `
      <div class="relative ${pulse}">
        <div class="w-10 h-10 rounded-full flex items-center justify-center shadow-lg border-2 border-white" 
             style="background-color: ${color}">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        ${isActive ? `<div class="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border border-white"></div>` : ''}
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
  });
};

// Map bounds adjuster
const MapBoundsAdjuster = ({ vehicles }) => {
  const map = useMap();
  
  useEffect(() => {
    if (vehicles.length > 0) {
      const bounds = L.latLngBounds(
        vehicles.map(v => [v.latitude, v.longitude])
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [vehicles, map]);
  
  return null;
};

const VehicleGPSMap = ({ 
  height = '400px',
  autoRefresh = true,
  refreshInterval = 30000,
  showControls = true,
  onVehicleClick = null,
  selectedVehicleId = null
}) => {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const mapContainerRef = useRef(null);
  const refreshTimerRef = useRef(null);

  // Türkiye merkez koordinatları
  const defaultCenter = [39.0, 35.0];
  const defaultZoom = 6;

  // Araç konumlarını yükle
  const loadVehicleLocations = useCallback(async () => {
    try {
      setError(null);
      const response = await locationsAPI.getAllVehiclesGPS();
      
      const validVehicles = (response.data || []).filter(
        v => v.latitude && v.longitude
      );
      
      setVehicles(validVehicles);
      setLastUpdate(new Date());
      
    } catch (err) {
      console.error('Failed to load vehicle locations:', err);
      setError('Araç konumları yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, []);

  // İlk yükleme ve otomatik yenileme
  useEffect(() => {
    loadVehicleLocations();
    
    if (autoRefresh) {
      refreshTimerRef.current = setInterval(loadVehicleLocations, refreshInterval);
    }
    
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [loadVehicleLocations, autoRefresh, refreshInterval]);

  // Tam ekran toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      mapContainerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Zaman formatı
  const formatTime = (date) => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  };

  // Zaman farkı
  const getTimeDiff = (date) => {
    if (!date) return null;
    const diff = (new Date() - new Date(date)) / 1000 / 60; // dakika
    if (diff < 1) return 'Az önce';
    if (diff < 60) return `${Math.floor(diff)} dk önce`;
    if (diff < 1440) return `${Math.floor(diff / 60)} saat önce`;
    return `${Math.floor(diff / 1440)} gün önce`;
  };

  // Araç durumu
  const getVehicleStatus = (vehicle) => {
    if (!vehicle.last_update) return { status: 'unknown', label: 'Bilinmiyor', color: 'gray' };
    
    const diffMinutes = (new Date() - new Date(vehicle.last_update)) / 1000 / 60;
    
    if (diffMinutes < 5) {
      if (vehicle.speed > 0) {
        return { status: 'moving', label: 'Hareket Halinde', color: 'green' };
      }
      return { status: 'active', label: 'Aktif', color: 'blue' };
    }
    if (diffMinutes < 30) {
      return { status: 'idle', label: 'Beklemede', color: 'yellow' };
    }
    return { status: 'offline', label: 'Çevrimdışı', color: 'gray' };
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-500">Araç konumları yükleniyor...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden" ref={mapContainerRef}>
      {showControls && (
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="h-5 w-5 text-blue-600" />
              Araç Konumları
              <Badge variant="outline" className="ml-2">
                {vehicles.length} araç
              </Badge>
            </CardTitle>
            
            <div className="flex items-center gap-2">
              {lastUpdate && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTime(lastUpdate)}
                </span>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={loadVehicleLocations}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={toggleFullscreen}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      )}
      
      <CardContent className="p-0">
        {error ? (
          <div className="flex items-center justify-center py-12 text-red-500">
            <AlertTriangle className="h-5 w-5 mr-2" />
            {error}
          </div>
        ) : (
          <div style={{ height: isFullscreen ? '100vh' : height }}>
            <MapContainer
              center={defaultCenter}
              zoom={defaultZoom}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              {vehicles.length > 0 && <MapBoundsAdjuster vehicles={vehicles} />}
              
              {vehicles.map((vehicle) => {
                const status = getVehicleStatus(vehicle);
                const isSelected = selectedVehicleId === vehicle.vehicle_id;
                
                return (
                  <Marker
                    key={vehicle.vehicle_id}
                    position={[vehicle.latitude, vehicle.longitude]}
                    icon={createAmbulanceIcon(
                      status.status !== 'offline',
                      vehicle.speed || 0
                    )}
                    eventHandlers={{
                      click: () => onVehicleClick?.(vehicle)
                    }}
                  >
                    <Popup>
                      <div className="min-w-[200px]">
                        <div className="font-bold text-lg flex items-center gap-2 mb-2">
                          <Truck className="h-4 w-4" />
                          {vehicle.vehicle_plate}
                        </div>
                        
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500">Durum:</span>
                            <Badge 
                              className={`bg-${status.color}-100 text-${status.color}-700`}
                            >
                              {status.label}
                            </Badge>
                          </div>
                          
                          {vehicle.current_location_name && (
                            <div className="flex items-center justify-between">
                              <span className="text-gray-500">Lokasyon:</span>
                              <span>{vehicle.current_location_name}</span>
                            </div>
                          )}
                          
                          {vehicle.speed > 0 && (
                            <div className="flex items-center justify-between">
                              <span className="text-gray-500">Hız:</span>
                              <span className="flex items-center gap-1">
                                <Navigation className="h-3 w-3" />
                                {Math.round(vehicle.speed * 3.6)} km/s
                              </span>
                            </div>
                          )}
                          
                          {vehicle.accuracy && (
                            <div className="flex items-center justify-between">
                              <span className="text-gray-500">Doğruluk:</span>
                              <span className="flex items-center gap-1">
                                <Signal className="h-3 w-3" />
                                ±{Math.round(vehicle.accuracy)}m
                              </span>
                            </div>
                          )}
                          
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500">Güncelleme:</span>
                            <span>{getTimeDiff(vehicle.last_update)}</span>
                          </div>
                          
                          <div className="pt-2 text-xs text-gray-400">
                            {vehicle.latitude.toFixed(6)}, {vehicle.longitude.toFixed(6)}
                          </div>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>
        )}
      </CardContent>
      
      {/* Araç listesi */}
      {showControls && vehicles.length > 0 && (
        <div className="border-t p-2 max-h-32 overflow-y-auto">
          <div className="flex flex-wrap gap-2">
            {vehicles.map((vehicle) => {
              const status = getVehicleStatus(vehicle);
              return (
                <Badge
                  key={vehicle.vehicle_id}
                  variant="outline"
                  className={`cursor-pointer hover:bg-gray-100 ${
                    selectedVehicleId === vehicle.vehicle_id ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => onVehicleClick?.(vehicle)}
                >
                  <span 
                    className={`w-2 h-2 rounded-full mr-1 bg-${status.color}-500`}
                  />
                  {vehicle.vehicle_plate}
                </Badge>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
};

export default VehicleGPSMap;



