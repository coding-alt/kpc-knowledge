import * as vscode from 'vscode';
import { TelemetryEvent } from '../types';

export class TelemetryService {
  private events: TelemetryEvent[] = [];
  private sessionId: string;
  private startTime: number;

  constructor(private context: vscode.ExtensionContext) {
    this.sessionId = this.generateSessionId();
    this.startTime = Date.now();
    
    // Track session start
    this.trackEvent('session.started', {
      version: context.extension.packageJSON.version,
      vscodeVersion: vscode.version
    });
  }

  trackEvent(name: string, properties?: { [key: string]: string | number | boolean }, measurements?: { [key: string]: number }): void {
    const event: TelemetryEvent = {
      name,
      properties: {
        sessionId: this.sessionId,
        timestamp: new Date().toISOString(),
        ...properties
      },
      measurements
    };

    this.events.push(event);
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Telemetry Event:', event);
    }

    // Send to telemetry service (if configured)
    this.sendEvent(event);
  }

  trackError(error: Error, context?: string): void {
    this.trackEvent('error.occurred', {
      errorMessage: error.message,
      errorStack: error.stack || '',
      context: context || 'unknown'
    });
  }

  trackPerformance(operation: string, duration: number, success: boolean = true): void {
    this.trackEvent('performance.measured', {
      operation,
      success: success.toString()
    }, {
      duration
    });
  }

  trackFeatureUsage(feature: string, action: string, properties?: { [key: string]: string | number | boolean }): void {
    this.trackEvent('feature.used', {
      feature,
      action,
      ...properties
    });
  }

  trackCommand(command: string, success: boolean = true, duration?: number): void {
    this.trackEvent('command.executed', {
      command,
      success: success.toString()
    }, duration ? { duration } : undefined);
  }

  trackConfiguration(setting: string, value: string): void {
    this.trackEvent('configuration.changed', {
      setting,
      value
    });
  }

  trackValidation(fileType: string, issuesFound: number, duration: number): void {
    this.trackEvent('validation.completed', {
      fileType
    }, {
      issuesFound,
      duration
    });
  }

  trackCompletion(trigger: string, accepted: boolean, framework: string): void {
    this.trackEvent('completion.triggered', {
      trigger,
      accepted: accepted.toString(),
      framework
    });
  }

  trackGeneration(requirement: string, framework: string, success: boolean, duration: number): void {
    this.trackEvent('generation.completed', {
      requirementLength: requirement.length.toString(),
      framework,
      success: success.toString()
    }, {
      duration
    });
  }

  private sendEvent(event: TelemetryEvent): void {
    // In a real implementation, this would send to a telemetry service
    // For now, we just store locally
    
    // Could send to Application Insights, Google Analytics, etc.
    // Example:
    // if (this.telemetryClient) {
    //   this.telemetryClient.trackEvent(event.name, event.properties, event.measurements);
    // }
  }

  private generateSessionId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  getSessionStatistics(): { sessionId: string; duration: number; eventsCount: number; startTime: number } {
    return {
      sessionId: this.sessionId,
      duration: Date.now() - this.startTime,
      eventsCount: this.events.length,
      startTime: this.startTime
    };
  }

  getEventsSummary(): { [eventName: string]: number } {
    const summary: { [eventName: string]: number } = {};
    
    this.events.forEach(event => {
      summary[event.name] = (summary[event.name] || 0) + 1;
    });

    return summary;
  }

  exportEvents(): TelemetryEvent[] {
    return [...this.events];
  }

  clearEvents(): void {
    this.events = [];
  }

  dispose(): void {
    // Track session end
    const sessionStats = this.getSessionStatistics();
    this.trackEvent('session.ended', {
      duration: sessionStats.duration.toString(),
      eventsCount: sessionStats.eventsCount.toString()
    });

    // Send any remaining events
    this.flush();
  }

  private flush(): void {
    // In a real implementation, this would ensure all events are sent
    // before the extension is deactivated
  }

  // Utility methods for common tracking patterns
  withPerformanceTracking<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    
    return fn()
      .then(result => {
        this.trackPerformance(operation, Date.now() - startTime, true);
        return result;
      })
      .catch(error => {
        this.trackPerformance(operation, Date.now() - startTime, false);
        this.trackError(error, operation);
        throw error;
      });
  }

  withFeatureTracking<T>(feature: string, action: string, fn: () => Promise<T>, properties?: { [key: string]: string | number | boolean }): Promise<T> {
    this.trackFeatureUsage(feature, action, properties);
    
    return fn()
      .catch(error => {
        this.trackError(error, `${feature}.${action}`);
        throw error;
      });
  }

  // Privacy and compliance methods
  setUserConsent(hasConsent: boolean): void {
    this.trackEvent('privacy.consent', {
      hasConsent: hasConsent.toString()
    });
    
    // Store consent in extension context
    this.context.globalState.update('telemetry.consent', hasConsent);
  }

  hasUserConsent(): boolean {
    return this.context.globalState.get('telemetry.consent', false);
  }

  anonymizeData(data: any): any {
    // Remove or hash any potentially sensitive data
    const anonymized = { ...data };
    
    // Remove file paths, user names, etc.
    if (anonymized.filePath) {
      anonymized.filePath = this.anonymizePath(anonymized.filePath);
    }
    
    if (anonymized.userName) {
      delete anonymized.userName;
    }
    
    return anonymized;
  }

  private anonymizePath(filePath: string): string {
    // Replace user-specific parts of file paths
    return filePath
      .replace(/\/Users\/[^\/]+/, '/Users/[user]')
      .replace(/C:\\Users\\[^\\]+/, 'C:\\Users\\[user]')
      .replace(/\/home\/[^\/]+/, '/home/[user]');
  }
}