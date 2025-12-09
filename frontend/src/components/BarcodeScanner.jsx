import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { 
  Camera, 
  CameraOff, 
  QrCode, 
  Keyboard, 
  X, 
  CheckCircle, 
  AlertCircle,
  RefreshCw,
  Loader2,
  SwitchCamera
} from 'lucide-react';

/**
 * Kamera tabanlı karekod/barkod tarayıcı komponenti
 * 
 * Props:
 * - onScan: (barcode) => void - Karekod okunduğunda çağrılır
 * - onClose: () => void - Kapatıldığında çağrılır
 * - mode: 'entry' | 'usage' - Stok girişi veya kullanım modu
 * - locationName: string - Hedef lokasyon adı (entry modu için)
 * - caseId: string - Vaka ID'si (usage modu için)
 * - title: string - Başlık
 * - allowManualInput: boolean - Manuel giriş izni
 * - continuousScan: boolean - Sürekli tarama modu
 */
const BarcodeScanner = ({ 
  onScan, 
  onClose, 
  mode = 'entry',
  locationName = '',
  caseId = '',
  title = 'Karekod Tara',
  allowManualInput = true,
  continuousScan = true
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [lastScanned, setLastScanned] = useState(null);
  const [scannedItems, setScannedItems] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [cameraFacing, setCameraFacing] = useState('environment'); // environment = arka kamera
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState(null);
  
  const scannerRef = useRef(null);
  const html5QrcodeRef = useRef(null);
  const lastScannedRef = useRef(null);
  const scanCooldownRef = useRef(false);

  // Kameraları listele
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then(devices => {
        setAvailableCameras(devices);
        // Arka kamerayı tercih et
        const backCamera = devices.find(d => 
          d.label.toLowerCase().includes('back') || 
          d.label.toLowerCase().includes('environment') ||
          d.label.toLowerCase().includes('arka')
        );
        if (backCamera) {
          setSelectedCameraId(backCamera.id);
        } else if (devices.length > 0) {
          setSelectedCameraId(devices[0].id);
        }
      })
      .catch(err => {
        console.error('Kamera listesi alınamadı:', err);
        toast.error('Kamera erişimi sağlanamadı');
      });
  }, []);

  // Tarayıcıyı başlat
  const startScanner = useCallback(async () => {
    if (!scannerRef.current) return;
    
    try {
      html5QrcodeRef.current = new Html5Qrcode(scannerId);
      
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 150 },
        aspectRatio: 1.7778, // 16:9
        formatsToSupport: [
          0, // QR_CODE
          1, // AZTEC
          2, // CODABAR
          3, // CODE_39
          4, // CODE_93
          5, // CODE_128
          6, // DATA_MATRIX
          7, // MAXICODE
          8, // ITF
          9, // EAN_13
          10, // EAN_8
          11, // PDF_417
          12, // RSS_14
          13, // RSS_EXPANDED
          14, // UPC_A
          15  // UPC_E
        ]
      };

      const onScanSuccess = async (decodedText, decodedResult) => {
        // Aynı kodu tekrar okumayı engelle (3 saniyelik cooldown)
        if (scanCooldownRef.current || decodedText === lastScannedRef.current) {
          return;
        }
        
        scanCooldownRef.current = true;
        lastScannedRef.current = decodedText;
        setLastScanned(decodedText);
        
        // Titreşim feedback
        if (navigator.vibrate) {
          navigator.vibrate(100);
        }
        
        // Callback'i çağır
        if (onScan) {
          setProcessing(true);
          try {
            const result = await onScan(decodedText);
            if (result?.success) {
              setScannedItems(prev => [...prev, {
                barcode: decodedText,
                ...result.item,
                timestamp: new Date()
              }]);
            }
          } catch (error) {
            console.error('Scan callback error:', error);
          } finally {
            setProcessing(false);
          }
        }
        
        // Sürekli tarama modunda 2 saniye sonra cooldown'ı kaldır
        if (continuousScan) {
          setTimeout(() => {
            scanCooldownRef.current = false;
          }, 2000);
        }
      };

      const onScanFailure = (error) => {
        // Sessizce devam et
      };

      // Kamera tercihini belirle
      let cameraConfig;
      if (selectedCameraId) {
        cameraConfig = { deviceId: selectedCameraId };
      } else {
        cameraConfig = { facingMode: cameraFacing };
      }

      await html5QrcodeRef.current.start(
        cameraConfig,
        config,
        onScanSuccess,
        onScanFailure
      );
      
      setIsScanning(true);
      toast.success('Kamera başlatıldı');
      
    } catch (err) {
      console.error('Scanner start error:', err);
      toast.error('Kamera başlatılamadı: ' + err.message);
    }
  }, [onScan, continuousScan, cameraFacing, selectedCameraId, scannerId]);

  // Tarayıcıyı durdur
  const stopScanner = useCallback(async () => {
    if (html5QrcodeRef.current) {
      try {
        const state = html5QrcodeRef.current.getState();
        if (state === 2) { // SCANNING state
          await html5QrcodeRef.current.stop();
        }
      } catch (err) {
        // Sessizce devam et
      }
      html5QrcodeRef.current = null;
      setIsScanning(false);
    }
  }, []);

  // Kamera değiştir
  const switchCamera = async () => {
    await stopScanner();
    
    // Sonraki kamerayı seç
    const currentIndex = availableCameras.findIndex(c => c.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % availableCameras.length;
    setSelectedCameraId(availableCameras[nextIndex]?.id);
    
    // Kısa gecikme ile yeniden başlat
    setTimeout(() => startScanner(), 500);
  };

  // Manuel giriş işle
  const handleManualSubmit = async () => {
    if (!manualBarcode.trim()) return;
    
    setProcessing(true);
    try {
      if (onScan) {
        const result = await onScan(manualBarcode.trim());
        if (result?.success) {
          setScannedItems(prev => [...prev, {
            barcode: manualBarcode,
            ...result.item,
            timestamp: new Date()
          }]);
          setManualBarcode('');
        }
      }
    } catch (error) {
      console.error('Manual input error:', error);
    } finally {
      setProcessing(false);
    }
  };

  // Cleanup - Daha güvenli temizlik
  useEffect(() => {
    return () => {
      const cleanup = async () => {
        if (html5QrcodeRef.current) {
          try {
            const state = html5QrcodeRef.current.getState();
            if (state === 2) { // SCANNING state
              await html5QrcodeRef.current.stop();
            }
          } catch (err) {
            // Sessizce devam et - scanner zaten durmuş olabilir
          }
          html5QrcodeRef.current = null;
        }
        setIsScanning(false);
      };
      cleanup();
    };
  }, []);

  // Scanner ID - benzersiz olması için
  const scannerId = useRef(`barcode-scanner-${Date.now()}`).current;

  return (
    <Card className="w-full max-w-lg mx-auto shadow-2xl border-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <QrCode className="h-5 w-5 text-blue-600" />
            {title}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        {/* Mod Badge */}
        <div className="flex items-center gap-2 mt-2">
          <Badge variant={mode === 'entry' ? 'default' : 'secondary'}>
            {mode === 'entry' ? 'Stok Girişi' : 'İlaç Kullanımı'}
          </Badge>
          {locationName && (
            <Badge variant="outline">{locationName}</Badge>
          )}
          {caseId && (
            <Badge variant="outline">Vaka: {caseId.substring(0, 8)}...</Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Mod Seçimi */}
        <div className="flex gap-2">
          <Button
            variant={!manualMode ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={() => setManualMode(false)}
          >
            <Camera className="h-4 w-4 mr-2" />
            Kamera
          </Button>
          {allowManualInput && (
            <Button
              variant={manualMode ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              onClick={() => {
                setManualMode(true);
                stopScanner();
              }}
            >
              <Keyboard className="h-4 w-4 mr-2" />
              Manuel
            </Button>
          )}
        </div>

        {/* Kamera Modu */}
        {!manualMode && (
          <div className="space-y-3">
            {/* Kamera Önizleme */}
            <div 
              id={scannerId}
              ref={scannerRef}
              className="w-full aspect-video bg-gray-900 rounded-lg overflow-hidden relative"
            >
              {!isScanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                  <CameraOff className="h-12 w-12 mb-3 text-gray-400" />
                  <p className="text-sm text-gray-400">Kamera kapalı</p>
                </div>
              )}
              
              {processing && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="bg-white rounded-lg p-4 flex items-center gap-3">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                    <span className="font-medium">İşleniyor...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Kamera Kontrolleri */}
            <div className="flex gap-2">
              {!isScanning ? (
                <Button onClick={startScanner} className="flex-1 bg-green-600 hover:bg-green-700">
                  <Camera className="h-4 w-4 mr-2" />
                  Kamerayı Başlat
                </Button>
              ) : (
                <Button onClick={stopScanner} variant="destructive" className="flex-1">
                  <CameraOff className="h-4 w-4 mr-2" />
                  Durdur
                </Button>
              )}
              
              {availableCameras.length > 1 && isScanning && (
                <Button variant="outline" onClick={switchCamera}>
                  <SwitchCamera className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Son Okunan */}
            {lastScanned && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-800">Son Okunan:</span>
                </div>
                <p className="text-sm text-green-700 mt-1 font-mono break-all">
                  {lastScanned}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Manuel Giriş Modu */}
        {manualMode && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Karekod / Barkod Verisi
              </label>
              <div className="flex gap-2">
                <Input
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                  placeholder="Karekod verisini yapıştırın..."
                  className="font-mono text-sm"
                  autoFocus
                />
                <Button 
                  onClick={handleManualSubmit}
                  disabled={!manualBarcode.trim() || processing}
                >
                  {processing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
              <p><strong>İpucu:</strong> El tipi barkod okuyucu kullanıyorsanız, 
              karekodu okuttuktan sonra otomatik olarak işlenecektir.</p>
            </div>
          </div>
        )}

        {/* Taranan Öğeler Listesi */}
        {scannedItems.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">
                Taranan Öğeler ({scannedItems.length})
              </h4>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setScannedItems([])}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Temizle
              </Button>
            </div>
            
            <div className="max-h-40 overflow-y-auto space-y-1">
              {scannedItems.slice(-10).reverse().map((item, idx) => (
                <div 
                  key={idx}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="font-medium">{item.drug_name || 'Bilinmeyen'}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {item.lot_number || '-'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Kullanım Talimatları */}
        <div className="text-xs text-gray-500 space-y-1 pt-2 border-t">
          <p>• Karekodu kameranın ortasına hizalayın</p>
          <p>• İyi aydınlatılmış ortamda daha iyi sonuç alırsınız</p>
          <p>• Her karekod benzersizdir ve sadece 1 kez okutulabilir</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default BarcodeScanner;

