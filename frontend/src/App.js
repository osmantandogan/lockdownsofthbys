import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { Toaster } from "./components/ui/sonner";

// Pages
import Login from "./pages/Login";
import Register from "./pages/Register";
import DashboardLayout from "./pages/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import CallCenterNew from "./pages/CallCenterNew";
import CallCenterSimple from "./pages/CallCenterSimple";
import CallCenter from "./pages/CallCenter";
import Cases from "./pages/Cases";
import CaseDetail from "./pages/CaseDetail";
import Vehicles from "./pages/Vehicles";
import StockManagement from "./pages/StockManagement";
import StockBarcodeEntry from "./pages/StockBarcodeEntry";
import Shifts from "./pages/Shifts";
import ShiftAssignments from "./pages/ShiftAssignments";
import ShiftStartNew from "./pages/ShiftStartNew";
import ShiftEnd from "./pages/ShiftEnd";
import ShiftForms from "./pages/ShiftForms";
import Forms from "./pages/Forms";
import FormHistory from "./pages/FormHistory";
import PatientCards from "./pages/PatientCards";
import UserManagement from "./pages/UserManagement";
import Settings from "./pages/Settings";
import Staff from "./pages/Staff";
import DocumentManagement from "./pages/DocumentManagement";
import Archive from "./pages/Archive";
import NotificationSettings from "./pages/NotificationSettings";
import VehicleKmReport from "./pages/VehicleKmReport";
import PatientRegistration from "./pages/PatientRegistration";
import MyLocationStock from "./pages/MyLocationStock";
import ShiftApprovals from "./pages/ShiftApprovals";
import MaterialRequests from "./pages/MaterialRequests";
import Tickets from "./pages/Tickets";
import TicketsApprovals from "./pages/TicketsApprovals";
import VehicleLocationManagement from "./pages/VehicleLocationManagement";
import PdfTemplates from "./pages/PdfTemplates";
import PdfTemplateEditor from "./pages/PdfTemplateEditor";
import FormTemplates from "./pages/FormTemplates";
import TableTemplateEditor from "./pages/TableTemplateEditor";
import ExcelTemplateEditor from "./pages/ExcelTemplateEditor";
import ExcelMappingVisualizer from "./pages/ExcelMappingVisualizer";
import ExcelOnlineEditor from "./pages/ExcelOnlineEditor";
import FirmManagement from "./pages/FirmManagement";

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Public Route (redirect if authenticated)
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <Register />
              </PublicRoute>
            }
          />
          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="call-center" element={<CallCenter />} />
            <Route path="patient-registration" element={<PatientRegistration />} />
            <Route path="my-stock" element={<MyLocationStock />} />
            <Route path="cases" element={<Cases />} />
            <Route path="cases/:id" element={<CaseDetail />} />
            <Route path="vehicles" element={<Vehicles />} />
            <Route path="vehicle-locations" element={<VehicleLocationManagement />} />
            <Route path="pdf-templates" element={<PdfTemplates />} />
            <Route path="pdf-templates/:templateId" element={<PdfTemplateEditor />} />
            <Route path="form-templates" element={<FormTemplates />} />
            <Route path="form-templates/pdf/new" element={<PdfTemplateEditor />} />
            <Route path="form-templates/pdf/:templateId" element={<PdfTemplateEditor />} />
            <Route path="form-templates/table/new" element={<TableTemplateEditor />} />
            <Route path="form-templates/table/:templateId" element={<TableTemplateEditor />} />
            <Route path="form-templates/excel/new" element={<ExcelTemplateEditor />} />
            <Route path="form-templates/excel/:id" element={<ExcelTemplateEditor />} />
            <Route path="form-templates/excel/:id/mapping" element={<ExcelMappingVisualizer />} />
            <Route path="form-templates/excel/:id/online" element={<ExcelOnlineEditor />} />
            <Route path="stock" element={<StockManagement />} />
            <Route path="stock-barcode-entry" element={<StockBarcodeEntry />} />
            <Route path="shifts" element={<Shifts />} />
            <Route path="shift-assignments" element={<ShiftAssignments />} />
            <Route path="shift-start" element={<ShiftStartNew />} />
            <Route path="shift-end" element={<ShiftEnd />} />
            <Route path="shift-forms" element={<ShiftForms />} />
            <Route path="shift-approvals" element={<Navigate to="/dashboard/shift-assignments" replace />} />
            <Route path="shift-photos" element={<Navigate to="/dashboard/shift-assignments" replace />} />
            <Route path="material-requests" element={<MaterialRequests />} />
            <Route path="tickets" element={<Tickets />} />
            <Route path="tickets-approvals" element={<TicketsApprovals />} />
            <Route path="forms" element={<Forms />} />
            <Route path="form-history" element={<FormHistory />} />
            <Route path="patient-cards" element={<PatientCards />} />
            <Route path="user-management" element={<UserManagement />} />
            <Route path="staff" element={<Staff />} />
            <Route path="documents" element={<DocumentManagement />} />
            <Route path="archive" element={<Archive />} />
            <Route path="notifications" element={<NotificationSettings />} />
            <Route path="vehicle-km-report" element={<VehicleKmReport />} />
            <Route path="firms" element={<FirmManagement />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Redirect root to login */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          
          {/* 404 */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
