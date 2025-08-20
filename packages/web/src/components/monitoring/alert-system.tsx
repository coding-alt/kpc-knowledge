'use client';

import { useState, useEffect } from 'react';
import { useSubscription, useMutation } from '@apollo/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, CheckCircle, Clock, X, Bell, BellOff, Filter } from 'lucide-react';
import { SYSTEM_ALERTS_SUBSCRIPTION, ACKNOWLEDGE_ALERT } from '@/lib/graphql/queries';
import { formatRelativeTime } from '@/lib/utils';

interface AlertSystemProps {
  className?: string;
}

interface SystemAlert {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  service: string;
  timestamp: string;
  acknowledged: boolean;
  resolved: boolean;
  metadata?: Record<string, any>;
}

export function AlertSystem({ className }: AlertSystemProps) {
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [filter, setFilter] = useState<'all' | 'unacknowledged' | 'critical'>('unacknowledged');
  const [soundEnabled, setSoundEnabled] = useState(true);

  const { data: subscriptionData } = useSubscription(SYSTEM_ALERTS_SUBSCRIPTION);
  const [acknowledgeAlert] = useMutation(ACKNOWLEDGE_ALERT);

  useEffect(() => {
    if (subscriptionData?.systemAlert) {
      const newAlert = subscriptionData.systemAlert;
      setAlerts(prev => [newAlert, ...prev.slice(0, 99)]); // Keep last 100 alerts
      
      // Play sound for critical alerts
      if (soundEnabled && newAlert.severity === 'critical') {
        playAlertSound();
      }
    }
  }, [subscriptionData, soundEnabled]);

  const filteredAlerts = alerts.filter(alert => {
    switch (filter) {
      case 'unacknowledged':
        return !alert.acknowledged && !alert.resolved;
      case 'critical':
        return alert.severity === 'critical';
      default:
        return true;
    }
  });

  const handleAcknowledge = async (alertId: string) => {
    try {
      await acknowledgeAlert({ variables: { alertId } });
      setAlerts(prev => 
        prev.map(alert => 
          alert.id === alertId ? { ...alert, acknowledged: true } : alert
        )
      );
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  };

  const handleDismiss = (alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  const criticalCount = alerts.filter(a => a.severity === 'critical' && !a.resolved).length;
  const unacknowledgedCount = alerts.filter(a => !a.acknowledged && !a.resolved).length;

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Bell className="h-5 w-5" />
                <span>System Alerts</span>
                {unacknowledgedCount > 0 && (
                  <Badge variant="destructive">{unacknowledgedCount}</Badge>
                )}
              </CardTitle>
              <CardDescription>
                Real-time system alerts and notifications
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSoundEnabled(!soundEnabled)}
              >
                {soundEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilter(filter === 'all' ? 'unacknowledged' : 'all')}
              >
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={filter} onValueChange={(value) => setFilter(value as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">All ({alerts.length})</TabsTrigger>
              <TabsTrigger value="unacknowledged">
                Unacknowledged ({unacknowledgedCount})
              </TabsTrigger>
              <TabsTrigger value="critical">Critical ({criticalCount})</TabsTrigger>
            </TabsList>

            <TabsContent value={filter} className="mt-4">
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {filteredAlerts.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <p className="text-muted-foreground">No alerts to show</p>
                  </div>
                ) : (
                  filteredAlerts.map(alert => (
                    <AlertItem
                      key={alert.id}
                      alert={alert}
                      onAcknowledge={handleAcknowledge}
                      onDismiss={handleDismiss}
                    />
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function AlertItem({ 
  alert, 
  onAcknowledge, 
  onDismiss 
}: { 
  alert: SystemAlert;
  onAcknowledge: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <AlertTriangle className="h-4 w-4" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4" />;
      case 'success':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getAlertVariant = (type: string) => {
    switch (type) {
      case 'error':
        return 'destructive';
      case 'warning':
        return 'default';
      case 'success':
        return 'default';
      default:
        return 'default';
    }
  };

  return (
    <Alert variant={getAlertVariant(alert.type) as any} className="relative">
      <div className="flex items-start space-x-3">
        {getAlertIcon(alert.type)}
        <div className="flex-1 min-w-0">
          <AlertTitle className="flex items-center space-x-2">
            <span>{alert.title}</span>
            <Badge variant={getSeverityVariant(alert.severity)}>
              {alert.severity}
            </Badge>
            <Badge variant="outline">{alert.service}</Badge>
          </AlertTitle>
          <AlertDescription className="mt-1">
            {alert.message}
          </AlertDescription>
          <div className="flex items-center space-x-4 mt-2 text-xs text-muted-foreground">
            <span>{formatRelativeTime(alert.timestamp)}</span>
            {alert.acknowledged && (
              <Badge variant="secondary" className="text-xs">
                Acknowledged
              </Badge>
            )}
            {alert.resolved && (
              <Badge variant="secondary" className="text-xs">
                Resolved
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-1">
          {!alert.acknowledged && !alert.resolved && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAcknowledge(alert.id)}
            >
              Acknowledge
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDismiss(alert.id)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Alert>
  );
}

function getSeverityVariant(severity: string): 'default' | 'destructive' | 'outline' | 'secondary' {
  switch (severity?.toLowerCase()) {
    case 'critical':
      return 'destructive';
    case 'high':
      return 'outline';
    default:
      return 'secondary';
  }
}

function playAlertSound() {
  // Play a subtle alert sound
  if (typeof window !== 'undefined' && 'AudioContext' in window) {
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  }
}