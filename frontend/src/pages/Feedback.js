import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { feedbackAPI } from '../api';
import { 
  MessageSquare, Bug, Lightbulb, HelpCircle, Send, Camera, X, 
  Upload, CheckCircle, Loader2, Code
} from 'lucide-react';

const Feedback = () => {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  
  const [formData, setFormData] = useState({
    category: '',
    title: '',
    description: '',
    priority: 'normal'
  });
  
  const [screenshots, setScreenshots] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  const categories = [
    { value: 'bug', label: 'Hata Bildirimi', icon: Bug, color: 'text-red-600', bgColor: 'bg-red-100' },
    { value: 'suggestion', label: 'Öneri', icon: Lightbulb, color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
    { value: 'question', label: 'Soru', icon: HelpCircle, color: 'text-blue-600', bgColor: 'bg-blue-100' },
    { value: 'feedback', label: 'Genel Görüş', icon: MessageSquare, color: 'text-green-600', bgColor: 'bg-green-100' }
  ];
  
  const priorities = [
    { value: 'low', label: 'Düşük', color: 'bg-gray-100 text-gray-700' },
    { value: 'normal', label: 'Normal', color: 'bg-blue-100 text-blue-700' },
    { value: 'high', label: 'Yüksek', color: 'bg-orange-100 text-orange-700' },
    { value: 'critical', label: 'Kritik', color: 'bg-red-100 text-red-700' }
  ];
  
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Dosya boyutu 5MB\'dan küçük olmalı');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setScreenshots(prev => [...prev, {
          id: Date.now() + Math.random(),
          name: file.name,
          data: event.target.result,
          type: file.type
        }]);
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  
  const removeScreenshot = (id) => setScreenshots(prev => prev.filter(s => s.id !== id));
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.category) { toast.error('Lütfen bir kategori seçin'); return; }
    if (!formData.title.trim()) { toast.error('Lütfen bir başlık girin'); return; }
    if (!formData.description.trim()) { toast.error('Lütfen açıklama girin'); return; }
    
    setSubmitting(true);
    try {
      await feedbackAPI.create({
        ...formData,
        screenshots: screenshots.map(s => ({ name: s.name, data: s.data, type: s.type })),
        user_info: { id: user?.id, name: `${user?.name || ''} ${user?.surname || ''}`.trim(), role: user?.role, email: user?.email },
        user_agent: navigator.userAgent,
        screen_size: `${window.innerWidth}x${window.innerHeight}`,
        timestamp: new Date().toISOString()
      });
      setSubmitted(true);
      toast.success('Geri bildiriminiz başarıyla gönderildi!');
      setTimeout(() => {
        setFormData({ category: '', title: '', description: '', priority: 'normal' });
        setScreenshots([]);
        setSubmitted(false);
      }, 3000);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error('Geri bildirim gönderilemedi. Lütfen tekrar deneyin.');
    } finally {
      setSubmitting(false);
    }
  };
  
  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-12 pb-12 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-green-700 mb-2">Teşekkürler!</h2>
            <p className="text-green-600">Geri bildiriminiz başarıyla iletildi.</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white mb-4">
          <Code className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800">Geliştiriciye Bildir</h1>
        <p className="text-gray-500 mt-2">Sistem hakkında görüş, öneri, hata veya sorularınızı bize iletin</p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-lg">Kategori Seçin</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {categories.map((cat) => {
                const Icon = cat.icon;
                const isSelected = formData.category === cat.value;
                return (
                  <button key={cat.value} type="button" onClick={() => setFormData(prev => ({ ...prev, category: cat.value }))}
                    className={`p-4 rounded-lg border-2 transition-all ${isSelected ? `border-indigo-500 ${cat.bgColor} ring-2 ring-indigo-200` : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                    <Icon className={`h-6 w-6 mx-auto mb-2 ${isSelected ? cat.color : 'text-gray-400'}`} />
                    <p className={`text-sm font-medium ${isSelected ? cat.color : 'text-gray-600'}`}>{cat.label}</p>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-lg">Detaylar</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Başlık *</Label>
              <Input id="title" value={formData.title} onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))} placeholder="Kısa ve açıklayıcı bir başlık" className="mt-1" />
            </div>
            <div>
              <Label>Öncelik</Label>
              <div className="flex gap-2 mt-1">
                {priorities.map((p) => (
                  <button key={p.value} type="button" onClick={() => setFormData(prev => ({ ...prev, priority: p.value }))}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${formData.priority === p.value ? `${p.color} ring-2 ring-offset-1 ring-gray-300` : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="description">Açıklama *</Label>
              <Textarea id="description" value={formData.description} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder={formData.category === 'bug' ? 'Hatayı detaylı açıklayın...' : formData.category === 'suggestion' ? 'Önerinizi açıklayın...' : 'Görüşlerinizi paylaşın...'} rows={6} className="mt-1" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2"><Camera className="h-5 w-5" />Ekran Görüntüleri<Badge variant="secondary" className="ml-2">Opsiyonel</Badge></CardTitle>
          </CardHeader>
          <CardContent>
            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" />
            {screenshots.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                {screenshots.map((ss) => (
                  <div key={ss.id} className="relative group">
                    <img src={ss.data} alt={ss.name} className="w-full h-32 object-cover rounded-lg border" />
                    <button type="button" onClick={() => removeScreenshot(ss.id)} className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            )}
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full border-dashed border-2 h-20">
              <div className="flex flex-col items-center"><Upload className="h-6 w-6 mb-1 text-gray-400" /><span className="text-sm text-gray-500">Ekran görüntüsü ekle</span></div>
            </Button>
          </CardContent>
        </Card>
        
        <Button type="submit" disabled={submitting || !formData.category || !formData.title || !formData.description} className="w-full h-12 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700">
          {submitting ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Gönderiliyor...</> : <><Send className="h-5 w-5 mr-2" />Geri Bildirimi Gönder</>}
        </Button>
      </form>
    </div>
  );
};

export default Feedback;

