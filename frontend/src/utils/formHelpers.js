import { formsAPI } from '../api';
import { toast } from 'sonner';

export const saveFormSubmission = async (formType, formData, extraData = {}) => {
  try {
    const submission = {
      form_type: formType,
      form_data: formData,
      patient_name: extraData.patientName || formData.patientName || null,
      vehicle_plate: extraData.vehiclePlate || formData.vehiclePlate || formData.aracPlakasi || null,
      case_id: extraData.caseId || null
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
    validateSignature = true
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

    // Save
    const success = await saveFormSubmission(formType, formData);
    
    if (success && onSuccess) {
      onSuccess();
    } else if (!success && onError) {
      onError();
    }

    return success;
  };
};
