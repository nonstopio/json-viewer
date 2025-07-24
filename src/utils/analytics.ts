import { AnalyticsEvent, AnalyticsEventType, AnalyticsProperties } from '../types/analytics';

class AnalyticsService {
  private sessionId: string;
  private userId: string;
  private readonly STORAGE_KEY = 'json_viewer_analytics';
  private readonly USER_ID_KEY = 'json_viewer_user_id';
  private readonly SESSION_ID_KEY = 'json_viewer_session_id';

  constructor() {
    this.userId = this.getOrCreateUserId();
    this.sessionId = this.getOrCreateSessionId();
    this.initializeSession();
  }

  private getOrCreateUserId(): string {
    let userId = localStorage.getItem(this.USER_ID_KEY);
    if (!userId) {
      userId = 'user_' + this.generateId();
      localStorage.setItem(this.USER_ID_KEY, userId);
    }
    return userId;
  }

  private getOrCreateSessionId(): string {
    let sessionId = sessionStorage.getItem(this.SESSION_ID_KEY);
    if (!sessionId) {
      sessionId = 'session_' + this.generateId();
      sessionStorage.setItem(this.SESSION_ID_KEY, sessionId);
    }
    return sessionId;
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  private initializeSession(): void {
    this.track('session_started', {
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      referrer: document.referrer,
      url: window.location.href
    });
  }

  track(event: AnalyticsEventType, properties?: AnalyticsProperties): void {
    const analyticsEvent: AnalyticsEvent = {
      event,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      userId: this.userId,
      properties: properties || {}
    };

    this.storeEvent(analyticsEvent);
    
    // In production, you would send this to your analytics service
    console.log('Analytics Event:', analyticsEvent);
  }

  private storeEvent(event: AnalyticsEvent): void {
    try {
      const existingEvents = this.getStoredEvents();
      const updatedEvents = [...existingEvents, event];
      
      // Keep only the last 1000 events to prevent localStorage bloat
      if (updatedEvents.length > 1000) {
        updatedEvents.splice(0, updatedEvents.length - 1000);
      }
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedEvents));
    } catch (error) {
      console.warn('Failed to store analytics event:', error);
    }
  }

  getStoredEvents(): AnalyticsEvent[] {
    try {
      const events = localStorage.getItem(this.STORAGE_KEY);
      return events ? JSON.parse(events) : [];
    } catch (error) {
      console.warn('Failed to retrieve analytics events:', error);
      return [];
    }
  }

  clearEvents(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  getEventsByType(eventType: AnalyticsEventType): AnalyticsEvent[] {
    return this.getStoredEvents().filter(event => event.event === eventType);
  }

  getEventsByDateRange(startDate: Date, endDate: Date): AnalyticsEvent[] {
    return this.getStoredEvents().filter(event => {
      const eventDate = new Date(event.timestamp);
      return eventDate >= startDate && eventDate <= endDate;
    });
  }

  getSessionEvents(): AnalyticsEvent[] {
    return this.getStoredEvents().filter(event => event.sessionId === this.sessionId);
  }

  // Analytics insights methods
  getUniqueUsersCount(): number {
    const events = this.getStoredEvents();
    const uniqueUsers = new Set(events.map(event => event.userId));
    return uniqueUsers.size;
  }

  getAverageSessionDuration(): number {
    const sessionEvents = this.getSessionEvents();
    if (sessionEvents.length < 2) return 0;
    
    const startTime = new Date(sessionEvents[0].timestamp).getTime();
    const endTime = new Date(sessionEvents[sessionEvents.length - 1].timestamp).getTime();
    return (endTime - startTime) / 1000; // Return in seconds
  }

  getMostUsedFeatures(): Array<{ feature: string; count: number }> {
    const events = this.getStoredEvents();
    const featureCounts: Record<string, number> = {};
    
    events.forEach(event => {
      featureCounts[event.event] = (featureCounts[event.event] || 0) + 1;
    });
    
    return Object.entries(featureCounts)
      .map(([feature, count]) => ({ feature, count }))
      .sort((a, b) => b.count - a.count);
  }

  getThemePreferences(): { light: number; dark: number } {
    const themeEvents = this.getEventsByType('theme_changed');
    const preferences = { light: 0, dark: 0 };
    
    themeEvents.forEach(event => {
      const theme = event.properties?.theme as 'light' | 'dark';
      if (theme === 'light' || theme === 'dark') {
        preferences[theme]++;
      }
    });
    
    return preferences;
  }
}

// Create singleton instance
export const analytics = new AnalyticsService();

// Convenience function for tracking events
export const trackEvent = (event: AnalyticsEventType, properties?: AnalyticsProperties) => {
  analytics.track(event, properties);
};