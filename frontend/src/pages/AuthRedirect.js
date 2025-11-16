import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const AuthRedirect = () => {
  const [status, setStatus] = useState('İşleniyor...');
  const navigate = useNavigate();
  const { checkAuth } = useAuth();

  useEffect(() => {
    const processSession = async () => {
      // Get session_id from URL fragment
      const hash = window.location.hash;
      const params = new URLSearchParams(hash.substring(1));
      const sessionId = params.get('session_id');

      if (!sessionId) {
        setStatus('Session ID bulunamadı');
        setTimeout(() => navigate('/login'), 2000);
        return;
      }

      try {
        setStatus('Kimlik doğrulanıyor...');
        
        // Process session with backend
        await axios.get(`${API_URL}/auth/session`, {
          headers: {
            'X-Session-ID': sessionId
          },
          withCredentials: true
        });

        // Refresh auth context
        await checkAuth();

        setStatus('Başarılı! Yönlendiriliyorsunuz...');
        
        // Clean URL and redirect
        window.history.replaceState({}, document.title, '/dashboard');
        navigate('/dashboard', { replace: true });
      } catch (error) {
        console.error('Auth error:', error);
        setStatus('Kimlik doğrulama başarısız');
        setTimeout(() => navigate('/login'), 2000);
      }
    };

    processSession();
  }, [navigate, checkAuth]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-lg font-medium text-gray-700">{status}</p>
      </div>
    </div>
  );
};

export default AuthRedirect;
