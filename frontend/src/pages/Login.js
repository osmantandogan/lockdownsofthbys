import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Separator } from '../components/ui/separator';
import { toast } from 'sonner';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
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

  const handleQuickLogin = async (testEmail) => {
    setLoading(true);
    try {
      await login(testEmail, 'test123');
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
            <img src="/logo.svg" alt="HealMedy" className="h-20 w-20" />
          </div>
          <CardTitle className="text-2xl font-bold">HealMedy HBYS</CardTitle>
          <CardDescription>Saha Sağlık Yönetim Sistemi</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email veya İsim Soyisim</Label>
              <Input
                id="email"
                type="text"
                placeholder="ornek@email.com veya Ali Veli"
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

          {/* Development Quick Login Section */}
          <Separator className="my-6" />
          
          <div className="space-y-3">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700 mb-3">
                🧪 Hızlı Giriş (Geliştirme)
              </p>
              <p className="text-xs text-gray-500 mb-4">
                Tüm şifreler: <code className="bg-gray-100 px-2 py-1 rounded">test123</code>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
              {testUsers.map((user) => (
                <Button
                  key={user.email}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickLogin(user.email)}
                  disabled={loading}
                  className={`justify-start text-left h-auto py-2 ${user.color}`}
                  data-testid={`quick-login-${user.email}`}
                >
                  <div className="flex flex-col items-start">
                    <span className="font-semibold text-xs">{user.role}</span>
                    <span className="text-xs opacity-75">{user.name}</span>
                  </div>
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
