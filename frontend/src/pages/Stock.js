import React, { useEffect, useState } from 'react';
import { stockAPI } from '../api';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { Package, AlertTriangle } from 'lucide-react';

const Stock = () => {
  const [items, setItems] = useState([]);
  const [alerts, setAlerts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [itemsRes, alertsRes] = await Promise.all([
        stockAPI.getAll(),
        stockAPI.getAlerts()
      ]);
      setItems(itemsRes.data);
      setAlerts(alertsRes.data);
    } catch (error) {
      console.error('Error loading stock:', error);
      toast.error('Stok y\u00fcklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const locationLabels = {
    ambulans: 'Ambulans',
    saha_ofis: 'Saha Ofis',
    acil_canta: 'Acil \u00c7anta',
    merkez_depo: 'Merkez Depo'
  };

  const isExpired = (expiryDate) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  const isExpiringSoon = (expiryDate) => {
    if (!expiryDate) return false;
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diffDays = (expiry - now) / (1000 * 60 * 60 * 24);
    return diffDays > 0 && diffDays <= 30;
  };

  const isCritical = (item) => item.quantity < item.min_quantity;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="stock-page">
      <div>
        <h1 className="text-3xl font-bold">Stok Y\u00f6netimi</h1>
        <p className="text-gray-500">\u0130la\u00e7 ve malzeme takibi</p>
      </div>

      {/* Alerts */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertTriangle className="h-8 w-8 text-red-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-red-600">{alerts.critical_stock || 0}</p>
              <p className="text-sm text-gray-500">Kritik Stok</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertTriangle className="h-8 w-8 text-orange-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-orange-600">{alerts.expired || 0}</p>
              <p className="text-sm text-gray-500">S\u00fcresi Dolmu\u015f</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertTriangle className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-yellow-600">{alerts.expiring_soon || 0}</p>
              <p className="text-sm text-gray-500">S\u00fcresi Dolacak</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stock List */}
      <div className="grid gap-4">
        {items.map((item) => (
          <Card key={item.id} data-testid={`stock-item-${item.code}`}>
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="flex items-start space-x-4">
                  <Package className="h-6 w-6 text-blue-600 mt-1" />
                  <div className="space-y-2">
                    <div>
                      <p className="font-bold text-lg">{item.name}</p>
                      <p className="text-sm text-gray-500">Kod: {item.code}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">{locationLabels[item.location]}</Badge>
                      {item.location_detail && (
                        <span className="text-sm text-gray-500">({item.location_detail})</span>
                      )}
                    </div>
                    <div className="text-sm space-y-1">
                      <p>
                        <span className="font-medium">Miktar:</span> {item.quantity} / Min: {item.min_quantity}
                        {isCritical(item) && (
                          <Badge className="ml-2 bg-red-100 text-red-800">Kritik!</Badge>
                        )}
                      </p>
                      {item.lot_number && (
                        <p><span className="font-medium">Lot:</span> {item.lot_number}</p>
                      )}
                      {item.expiry_date && (
                        <p>
                          <span className="font-medium">SKT:</span> {new Date(item.expiry_date).toLocaleDateString('tr-TR')}
                          {isExpired(item.expiry_date) && (
                            <Badge className="ml-2 bg-orange-100 text-orange-800">Dolmu\u015f!</Badge>
                          )}
                          {isExpiringSoon(item.expiry_date) && (
                            <Badge className="ml-2 bg-yellow-100 text-yellow-800">Dolacak</Badge>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Stock;
