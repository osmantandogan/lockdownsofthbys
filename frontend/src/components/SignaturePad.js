import React, { useRef, useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Label } from './ui/label';

const SignaturePad = ({ label, onSignature, required = false, value = null }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isSigned, setIsSigned] = useState(!!value);

  // Canvas'ı başlat
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;  // Kalınlaştırıldı (yazıcıda net görünsün)
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
  }, []);
  
  // Kaydedilen imzayı göster
  useEffect(() => {
    if (value && value.startsWith('data:image')) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        // Canvas'ı temizle
        ctx.clearRect(0, 0, canvas.width / 2, canvas.height / 2);
        // İmzayı çiz
        ctx.drawImage(img, 0, 0, canvas.width / 2, canvas.height / 2);
        setIsSigned(true);
      };
      img.src = value;
    }
  }, [value]);

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    
    ctx.beginPath();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    
    e.preventDefault();
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsSigned(false);
    if (onSignature) onSignature(null);
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    const dataURL = canvas.toDataURL('image/png');
    setIsSigned(true);
    if (onSignature) onSignature(dataURL);
  };

  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      <div className={`border-2 rounded-lg ${isSigned ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}>
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-32 cursor-crosshair touch-none"
          style={{ touchAction: 'none' }}
        />
      </div>
      <div className="flex space-x-2">
        <Button type="button" variant="outline" size="sm" onClick={clearSignature}>
          Temizle
        </Button>
        <Button type="button" size="sm" onClick={saveSignature}>
          İmzayı Kaydet
        </Button>
      </div>
      {isSigned && (
        <p className="text-xs text-green-600">✓ İmza kaydedildi</p>
      )}
    </div>
  );
};

export default SignaturePad;
