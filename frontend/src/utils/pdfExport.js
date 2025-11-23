// Simple PDF generation using print
export const exportFormToPDF = (formTitle) => {
  // Set document title for PDF
  const originalTitle = document.title;
  document.title = `${formTitle} - ${new Date().toLocaleDateString('tr-TR')}`;
  
  // Print (browser will handle PDF)
  window.print();
  
  // Restore title
  setTimeout(() => {
    document.title = originalTitle;
  }, 1000);
};

// Export with custom content
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
