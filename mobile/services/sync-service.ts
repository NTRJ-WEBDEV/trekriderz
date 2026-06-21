/**
 * Sync Service - Offline-First Data Synchronization
 *
 * This service manages offline data storage and synchronization
 * with Supabase when the app comes back online.
 */

import * as NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const SYNC_QUEUE_KEY = 'sync_queue';
const LAST_SYNC_KEY = 'last_sync_timestamp';
const CACHE_PREFIX = 'cache_';

export interface SyncItem {
  id: string;
  table: string;
  operation: 'insert' | 'update' | 'delete';
  data: any;
  timestamp: number;
  retryCount: number;
}

export interface CacheEntry {
  data: any;
  timestamp: number;
  expiresAt: number;
}

class SyncService {
  private queue: SyncItem[] = [];
  private isOnline: boolean = true;
  private syncInProgress: boolean = false;
  private listeners: Array<(isOnline: boolean) => void> = [];

  constructor() {
    this.loadQueue();
    this.setupNetworkListener();
  }

  private setupNetworkListener() {
    NetInfo.addEventListener(state => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected ?? false;

      if (wasOnline !== this.isOnline) {
        console.log(`Network status changed: ${this.isOnline ? 'online' : 'offline'}`);
        this.notifyListeners();

        if (this.isOnline) {
          this.sync();
        }
      }
    });
  }

  async checkConnection(): Promise<boolean> {
    const state = await NetInfo.fetch();
    this.isOnline = state.isConnected ?? false;
    return this.isOnline;
  }

  async addToQueue(item: Omit<SyncItem, 'timestamp' | 'retryCount'>): Promise<void> {
    const syncItem: SyncItem = {
      ...item,
      timestamp: Date.now(),
      retryCount: 0,
    };

    this.queue.push(syncItem);
    await this.saveQueue();

    if (this.isOnline) {
      this.sync();
    }
  }

  async sync(): Promise<void> {
    if (this.syncInProgress || this.queue.length === 0 || !this.isOnline) {
      return;
    }

    this.syncInProgress = true;
    console.log(`Syncing ${this.queue.length} items...`);

    const failedItems: SyncItem[] = [];

    for (const item of this.queue) {
      try {
        await this.syncItem(item);
        await this.updateLastSyncTime();
      } catch (error) {
        console.error(`Failed to sync item ${item.id}:`, error);
        item.retryCount++;

        if (item.retryCount < 3) {
          failedItems.push(item);
        }
      }
    }

    this.queue = failedItems;
    await this.saveQueue();
    this.syncInProgress = false;

    console.log(`Sync complete. ${failedItems.length} items failed.`);
  }

  private async syncItem(item: SyncItem): Promise<void> {
    switch (item.operation) {
      case 'insert':
        await supabase.from(item.table).insert(item.data);
        break;
      case 'update':
        await supabase.from(item.table).update(item.data).eq('id', item.id);
        break;
      case 'delete':
        await supabase.from(item.table).delete().eq('id', item.id);
        break;
    }

    await this.clearCache(item.table);
  }

  async setCache(key: string, data: any, ttl: number = 3600000): Promise<void> {
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl,
    };

    try {
      await AsyncStorage.setItem(
        `${CACHE_PREFIX}${key}`,
        JSON.stringify(entry)
      );
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async getCache(key: string): Promise<any | null> {
    try {
      const item = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
      if (!item) return null;

      const entry: CacheEntry = JSON.parse(item);

      if (Date.now() > entry.expiresAt) {
        await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async clearCache(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  async clearAllCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.error('Clear all cache error:', error);
    }
  }

  onNetworkChange(listener: (isOnline: boolean) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(l => l(this.isOnline));
  }

  private async loadQueue(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
      if (data) {
        this.queue = JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading sync queue:', error);
    }
  }

  private async saveQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('Error saving sync queue:', error);
    }
  }

  private async updateLastSyncTime(): Promise<void> {
    try {
      await AsyncStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
    } catch (error) {
      console.error('Error updating last sync time:', error);
    }
  }

  async getLastSyncTime(): Promise<number | null> {
    try {
      const ts = await AsyncStorage.getItem(LAST_SYNC_KEY);
      return ts ? parseInt(ts, 10) : null;
    } catch {
      return null;
    }
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  getOnlineStatus(): boolean {
    return this.isOnline;
  }
}

export const syncService = new SyncService();
