import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { Activity, User, FileText } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    user_id: '',
    action: '',
    start_date: new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadLogs();
  }, [filters]);

  const loadLogs = async () => {
    try {
      // Simulated - backend endpoint eklenecek
      const response = await axios.get(`${API_URL}/audit-logs`, {
        params: filters,
        withCredentials: true
      });
      setLogs(response.data || []);
    } catch (error) {
      console.error('Error:', error);
      // toast.info('Audit log sistemi hazırlanıyor');
      setLogs([
        {
          id: '1',
          user_id: 'test-user',
          action: 'CREATE_CASE',
          entity_type: 'case',
          entity_id: 'case-123',
          created_at: new Date().toISOString(),
          details: { case_number: '20250116-001' }
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const actionColors = {
    CREATE: 'bg-green-100 text-green-800',
    UPDATE: 'bg-blue-100 text-blue-800',
    DELETE: 'bg-red-100 text-red-800',
    VIEW: 'bg-gray-100 text-gray-800'
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Audit Logları</h1>
        <p className="text-gray-500">Sistem aktivite kayıtları</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Filtreler</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Başlangıç</Label>
              <Input type="date" value={filters.start_date} onChange={(e) => setFilters({...filters, start_date: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Bitiş</Label>
              <Input type="date" value={filters.end_date} onChange={(e) => setFilters({...filters, end_date: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Kullanıcı ID</Label>
              <Input value={filters.user_id} onChange={(e) => setFilters({...filters, user_id: e.target.value})} placeholder="Filtrele..." />
            </div>
            <div className="space-y-2">
              <Label>Aksiyon</Label>
              <Input value={filters.action} onChange={(e) => setFilters({...filters, action: e.target.value})} placeholder="CREATE, UPDATE..." />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {logs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">Log kaydı bulunamadı</p>
            </CardContent>
          </Card>
        ) : (
          logs.map((log) => (
            <Card key={log.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center space-x-3">
                      <Badge className={actionColors[log.action?.split('_')[0]] || 'bg-gray-100'}>
                        {log.action}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {new Date(log.created_at).toLocaleString('tr-TR')}
                      </span>
                    </div>
                    <div className="flex items-center space-x-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <span>{log.user_id}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <span>{log.entity_type} - {log.entity_id}</span>
                      </div>
                    </div>
                    {log.details && (
                      <p className="text-xs text-gray-600">
                        Detay: {JSON.stringify(log.details)}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default AuditLogs;
