import React, { useState, useEffect } from 'react';
import { stockBarcodeAPI } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { toast } from 'sonner';
import BarcodeScanner from './BarcodeScanner';
import {
  Pill,
  QrCode,
  ScanLine,
  CheckCircle,
  AlertTriangle,
  Calendar,
  MapPin,
  Trash2,
  Plus,
  Loader2,
  Package,
  Clock
} from 'lucide-react';

/**
 * Vakada İlaç Kullanımı Komponenti
 * Karekod tarayarak ilaç kullanımı kaydı ve stoktan düşme
 * 
 * Props:
 * - caseId: string - Vaka ID'si
 * - caseName: string - Vaka numarası/adı (gösterim için)
 * - onMedicationAdded: () => void - İlaç eklendiğinde callback
 */
const CaseMedicationScanner = ({ caseId, caseName, onMedicationAdded }) => {
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (caseId) {
      loadMedications();
    }
  }, [caseId]);

  const loadMedications = async () => {
    try {
      const response = await stockBarcodeAPI.getCaseMedications(caseId);
      setMedications(response.data.medications || []);
    } catch (error) {
      console.error('Medications load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async (barcode) => {
    try {
      setProcessing(true);
      const response = await stockBarcodeAPI.useInCase({
        barcode: barcode,
        case_id: caseId
      });
      
      if (response.data.success) {
        toast.success(response.data.message);
        loadMedications();
        if (onMedicationAdded) {
          onMedicationAdded();
        }
        return { success: true, item: response.data.medication };
      }
    } catch (error) {
      const message = error.response?.data?.detail || 'İlaç kullanımı kaydedilemedi';
      toast.error(message);
      return { success: false, error: message };
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isExpiringSoon = (dateString) => {
    if (!dateString) return false;
    const expiry = new Date(dateString);
    const now = new Date();
    const daysUntilExpiry = (expiry - now) / (1000 * 60 * 60 * 24);
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  };

  const isExpired = (dateString) => {
    if (!dateString) return false;
    return new Date(dateString) < new Date();
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Pill className="h-5 w-5 text-purple-600" />
            Kullanılan İlaçlar
          </CardTitle>
          <Dialog open={scannerOpen} onOpenChange={setScannerOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
                <ScanLine className="h-4 w-4 mr-2" />
                İlaç Okut
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg p-0">
              <BarcodeScanner
                mode="usage"
                caseId={caseId}
                title="İlaç Kullanımı - Karekod Tara"
                onScan={handleScan}
                onClose={() => setScannerOpen(false)}
                continuousScan={true}
              />
            </DialogContent>
          </Dialog>
        </div>
        {caseName && (
          <p className="text-sm text-gray-500">Vaka: {caseName}</p>
        )}
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : medications.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Package className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">Henüz ilaç kullanılmadı</p>
            <p className="text-sm mt-1">
              Karekod okutarak ilaç kullanımı kaydedin
            </p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => setScannerOpen(true)}
            >
              <QrCode className="h-4 w-4 mr-2" />
              Karekod Tara
            </Button>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-3">
              {medications.map((med, idx) => (
                <div
                  key={med.id || idx}
                  className={`p-3 rounded-lg border ${
                    isExpired(med.expiry_date) 
                      ? 'border-red-200 bg-red-50' 
                      : isExpiringSoon(med.expiry_date)
                      ? 'border-amber-200 bg-amber-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Pill className="h-4 w-4 text-purple-600" />
                        <span className="font-medium">{med.drug_name}</span>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        {med.lot_number && (
                          <span>Lot: {med.lot_number}</span>
                        )}
                        {med.expiry_date && (
                          <span className={`flex items-center gap-1 ${
                            isExpired(med.expiry_date) ? 'text-red-600' :
                            isExpiringSoon(med.expiry_date) ? 'text-amber-600' : ''
                          }`}>
                            <Calendar className="h-3 w-3" />
                            SKT: {new Date(med.expiry_date).toLocaleDateString('tr-TR')}
                            {isExpired(med.expiry_date) && (
                              <Badge variant="destructive" className="ml-1 text-xs">Dolmuş!</Badge>
                            )}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {med.from_location}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(med.used_at)}
                        </span>
                      </div>

                      {med.used_by_name && (
                        <p className="text-xs text-gray-400">
                          Kullanan: {med.used_by_name}
                        </p>
                      )}
                    </div>

                    <Badge className="bg-purple-100 text-purple-800 shrink-0">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Kullanıldı
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Özet */}
        {medications.length > 0 && (
          <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm">
            <span className="text-gray-500">
              Toplam: <strong>{medications.length}</strong> ilaç
            </span>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setScannerOpen(true)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Yeni İlaç Ekle
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CaseMedicationScanner;

