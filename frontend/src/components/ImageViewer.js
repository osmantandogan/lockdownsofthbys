import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent } from './ui/dialog';
import { Button } from './ui/button';
import { X, ZoomIn, ZoomOut, RotateCw, Download } from 'lucide-react';

/**
 * ImageViewer - Fotoğrafları büyütme ve yakınlaştırma için popup bileşeni
 * 
 * Kullanım:
 * <ImageViewer 
 *   src="image_url" 
 *   alt="Açıklama"
 *   className="w-20 h-20 object-cover cursor-pointer"
 * />
 */
const ImageViewer = ({ 
  src, 
  alt = 'Fotoğraf', 
  className = '',
  thumbnailClassName = '',
  children 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageRef = useRef(null);
  const containerRef = useRef(null);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setScale(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen]);

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.5, 5));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.5, 0.5));
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleReset = () => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale(prev => Math.min(Math.max(prev + delta, 0.5), 5));
  };

  const handleMouseDown = (e) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e) => {
    if (e.touches.length === 1 && scale > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y
      });
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 1 && isDragging && scale > 1) {
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = src;
    link.download = alt || 'image';
    link.click();
  };

  // If no src, return null
  if (!src) return null;

  return (
    <>
      {/* Thumbnail / Trigger */}
      {children ? (
        <div onClick={() => setIsOpen(true)} className="cursor-pointer">
          {children}
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          className={`cursor-pointer hover:opacity-80 transition-opacity ${className} ${thumbnailClassName}`}
          onClick={() => setIsOpen(true)}
        />
      )}

      {/* Fullscreen Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 bg-black/95 border-none">
          {/* Controls */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-black/70 rounded-full px-4 py-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={handleZoomOut}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-white text-sm min-w-[50px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={handleZoomIn}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <div className="w-px h-6 bg-white/30" />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={handleRotate}
            >
              <RotateCw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={handleDownload}
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>

          {/* Close Button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 z-50 h-10 w-10 text-white hover:bg-white/20 rounded-full"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-6 w-6" />
          </Button>

          {/* Reset Button */}
          {(scale !== 1 || rotation !== 0 || position.x !== 0 || position.y !== 0) && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 text-white hover:bg-white/20"
              onClick={handleReset}
            >
              Sıfırla
            </Button>
          )}

          {/* Image Container */}
          <div
            ref={containerRef}
            className="w-full h-full flex items-center justify-center overflow-hidden"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
          >
            <img
              ref={imageRef}
              src={src}
              alt={alt}
              className="max-w-full max-h-full object-contain select-none"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
                transition: isDragging ? 'none' : 'transform 0.2s ease-out'
              }}
              draggable={false}
            />
          </div>

          {/* Alt text */}
          {alt && alt !== 'Fotoğraf' && (
            <div className="absolute bottom-4 right-4 z-50 bg-black/70 text-white text-sm px-3 py-1 rounded">
              {alt}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ImageViewer;

