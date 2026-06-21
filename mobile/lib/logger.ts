import { supabase } from './supabase';

/**
 * Universal Logging Utility for TrekRiderz
 */
export const logger = {
  info(msg: string, data?: any) {
    if (__DEV__) console.log(`[INFO] ${msg}`, data || '');
  },

  warn(msg: string, data?: any) {
    if (__DEV__) console.warn(`[WARN] ${msg}`, data || '');
  },

  async error(msg: string, err?: any, userId?: string) {
    console.error(`[ERROR] ${msg}`, err || '');
    
    // Remote logging to Supabase (Audit Logs)
    try {
      await supabase.from('app_logs').insert({
        user_id: userId,
        level: 'error',
        message: msg,
        details: err ? JSON.stringify(err) : null,
        created_at: new Date().toISOString()
      });
    } catch (e) {
      // Fail silently if remote logging fails
    }
  },

  async logEvent(name: string, data?: any, userId?: string) {
    if (__DEV__) console.log(`[EVENT] ${name}`, data || '');
    
    try {
      await supabase.from('app_events').insert({
        user_id: userId,
        event_name: name,
        payload: data,
        created_at: new Date().toISOString()
      });
    } catch (e) {
      // Fail silently
    }
  }
};
