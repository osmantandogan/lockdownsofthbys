import { formsAPI } from '../api';
import { toast } from 'sonner';

/**
 * API hata mesajını düzgün string'e çevirir
 * FastAPI validation hataları array veya object olarak gelebilir
 */
export const getErrorMessage = (error, defaultMessage = 'Bir hata oluştu') => {
  const detail = error.response?.data?.detail;
  
  if (!detail) return defaultMessage;
  
  if (typeof detail === 'string') {
    return detail;
  }
  
  if (Array.isArray(detail)) {
    // FastAPI validation error formatı: [{loc: [...], msg: "...", type: "..."}]
    return detail.map(e => {
      if (typeof e === 'string') return e;
      return e.msg || e.message || JSON.stringify(e);
    }).join(', ');
  }
  
  if (typeof detail === 'object') {
    return detail.msg || detail.message || JSON.stringify(detail);
  }
  
  return defaultMessage;
};

export const saveFormSubmission = async (formType, formData, extraData = {}) => {
  try {
    // formData içinden caseId'yi çıkar (eğer varsa)
    const { caseId: formCaseId, caseNumber, ...cleanFormData } = formData;
    
    const submission = {
      form_type: formType,
      form_data: cleanFormData,
      patient_name: extraData.patientName || formData.patientName || null,
      vehicle_plate: extraData.vehiclePlate || formData.vehiclePlate || formData.aracPlakasi || null,
      case_id: extraData.caseId || formCaseId || null
    };

    await formsAPI.submit(submission);
    toast.success('Form başarıyla kaydedildi!');
    return true;
  } catch (error) {
    console.error('Form save error:', error);
    toast.error(error.response?.data?.detail || 'Form kaydedilemedi');
    return false;
  }
};

export const handleFormSave = (formType, formData, options = {}) => {
  const {
    onSuccess,
    onError,
    validateFields = [],
    validateSignature = true,
    extraData = {}
  } = options;

  return async () => {
    // Validation
    for (const field of validateFields) {
      if (!formData[field]) {
        toast.error(`Lütfen ${field} alanını doldurunuz`);
        return false;
      }
    }

    if (validateSignature && !formData.signature) {
      toast.error('Lütfen formu imzalayınız');
      return false;
    }

    // Save with extraData
    const success = await saveFormSubmission(formType, formData, extraData);
    
    if (success && onSuccess) {
      onSuccess();
    } else if (!success && onError) {
      onError();
    }

    return success;
  };
};
