import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { Separator } from '../components/ui/separator';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, handleGoogleAuthRedirect } = useAuth();
  const navigate = useNavigate();

  // Test users for quick login
  const testUsers = [
    { email: 'merkez@healmedy.com', role: 'Merkez Ofis', name: 'Ahmet Yılmaz', color: 'bg-purple-100 text-purple-800 hover:bg-purple-200' },
    { email: 'operasyon@healmedy.com', role: 'Operasyon Müdürü', name: 'Mehmet Demir', color: 'bg-blue-100 text-blue-800 hover:bg-blue-200' },
    { email: 'doktor@healmedy.com', role: 'Doktor', name: 'Dr. Ayşe Kaya', color: 'bg-green-100 text-green-800 hover:bg-green-200' },
    { email: 'hemsire@healmedy.com', role: 'Hemşire', name: 'Fatma Şahin', color: 'bg-pink-100 text-pink-800 hover:bg-pink-200' },
    { email: 'paramedik@healmedy.com', role: 'Paramedik', name: 'Can Öztürk', color: 'bg-orange-100 text-orange-800 hover:bg-orange-200' },
    { email: 'att@healmedy.com', role: 'ATT', name: 'Emre Yıldız', color: 'bg-red-100 text-red-800 hover:bg-red-200' },
    { email: 'bassofor@healmedy.com', role: 'Baş Şoför', name: 'Ali Çelik', color: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' },
    { email: 'sofor@healmedy.com', role: 'Şoför', name: 'Hasan Aydın', color: 'bg-gray-100 text-gray-800 hover:bg-gray-200' },
    { email: 'cagri@healmedy.com', role: 'Çağrı Merkezi', name: 'Zeynep Arslan', color: 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Giriş başarılı!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Giriş başarısız');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white text-2xl font-bold">H</span>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">HealMedy HBYS</CardTitle>
          <CardDescription>Saha Sağlık Yönetim Sistemi</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="ornek@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="email-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Şifre</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="password-input"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
              data-testid="login-button"
            >
              {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">veya</span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={handleGoogleAuthRedirect}
            data-testid="google-login-button"
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Google ile Giriş Yap
          </Button>

          <div className="text-center text-sm">
            <span className="text-muted-foreground">Hesabınız yok mu? </span>
            <Button
              variant="link"
              className="p-0 h-auto font-semibold"
              onClick={() => navigate('/register')}
            >
              Kayıt Ol
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
