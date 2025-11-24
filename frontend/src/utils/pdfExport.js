import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Simple PDF generation using print
export const exportFormToPDF = (formTitle) => {
  const originalTitle = document.title;
  document.title = `${formTitle} - ${new Date().toLocaleDateString('tr-TR')}`;
  window.print();
  setTimeout(() => {
    document.title = originalTitle;
  }, 1000);
};

// Advanced PDF with jsPDF
export const generatePDFFromElement = async (elementId, filename) => {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error('Element not found');
    }

    const canvas = await html2canvas(element, {
      scale: 2,
      logging: false,
      useCORS: true
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const imgWidth = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    pdf.save(filename || 'form.pdf');
    
    return true;
  } catch (error) {
    console.error('PDF generation error:', error);
    return false;
  }
};

// Print content
export const printFormContent = (elementId) => {
  const printContent = document.getElementById(elementId);
  if (!printContent) return;
  
  const printWindow = window.open('', '', 'height=600,width=800');
  printWindow.document.write('<html><head><title>Form</title>');
  printWindow.document.write('<style>body{font-family:Arial;padding:20px;}</style>');
  printWindow.document.write('</head><body>');
  printWindow.document.write(printContent.innerHTML);
  printWindow.document.write('</body></html>');
  printWindow.document.close();
  printWindow.print();
};
