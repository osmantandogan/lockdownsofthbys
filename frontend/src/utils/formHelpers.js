import { formsAPI } from '../api';
import { toast } from 'sonner';

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
