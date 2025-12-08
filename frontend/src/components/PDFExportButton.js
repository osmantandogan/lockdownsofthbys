/**
 * PDF Export Button Komponenti
 * Tüm formlar için kullanılabilir PDF export butonu
 */

import React, { useState } from 'react';
import { Button } from './ui/button';
import { Download, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { exportFormToPDF, downloadPDF } from '../utils/pdfExport';

const PDFExportButton = ({ 
  formType, 
  formData, 
  extraData = {},
  filename,
  variant = 'outline',
  size = 'sm',
  className = '',
  children,
  disabled = false
}) => {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (disabled || exporting) return;
    
    setExporting(true);
    
    try {
      // PDF oluştur
      const doc = exportFormToPDF(formType, formData, extraData);
      
      // Blob oluştur ve yeni sekmede aç (kullanıcı oradan indirebilir)
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      
      // Yeni sekmede aç - kullanıcı tarayıcının "Kaydet" butonuyla indirebilir
      const newWindow = window.open(pdfUrl, '_blank');
      
      if (!newWindow) {
        // Popup engellenmiş olabilir, doğrudan indirmeyi dene
        const safeFilename = filename || `${formType}_form`;
        downloadPDF(doc, safeFilename);
      }
      
      toast.success('PDF oluşturuldu - Yeni sekmede açıldı');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('PDF oluşturulurken bir hata oluştu');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button 
      variant={variant}
      size={size}
      onClick={handleExport}
      disabled={disabled || exporting}
      className={className}
    >
      {exporting ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          İndiriliyor...
        </>
      ) : (
        <>
          {children || (
            <>
              <Download className="h-4 w-4 mr-2" />
              PDF İndir
            </>
          )}
        </>
      )}
    </Button>
  );
};

/**
 * PDF Preview Button - Modal içinde önizleme gösterir
 */
export const PDFPreviewButton = ({ 
  formType, 
  formData, 
  extraData = {},
  variant = 'ghost',
  size = 'sm',
  className = ''
}) => {
  const [previewing, setPreviewing] = useState(false);

  const handlePreview = async () => {
    setPreviewing(true);
    
    try {
      const doc = exportFormToPDF(formType, formData, extraData);
      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      
      // Yeni sekmede aç
      window.open(pdfUrl, '_blank');
      
    } catch (error) {
      console.error('PDF preview error:', error);
      toast.error('PDF önizleme hatası');
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <Button 
      variant={variant}
      size={size}
      onClick={handlePreview}
      disabled={previewing}
      className={className}
    >
      {previewing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <FileText className="h-4 w-4" />
      )}
    </Button>
  );
};

export default PDFExportButton;
