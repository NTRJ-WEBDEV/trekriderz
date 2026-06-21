import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import * as Network from 'expo-network';
import { Ionicons } from '@expo/vector-icons';

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const slideAnim = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 5000); // Check every 5s
    return () => clearInterval(interval);
  }, []);

  const checkConnection = async () => {
    try {
      const state = await Network.getNetworkStateAsync();
      const offline = !state.isConnected || !state.isInternetReachable;
      
      if (offline !== isOffline) {
        setIsOffline(offline);
        Animated.timing(slideAnim, {
          toValue: offline ? 0 : -100,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    } catch (e) {
      console.error('Error checking network state:', e);
    }
  };

  return (
    <Animated.View style={[styles.banner, { transform: [{ translateY: slideAnim }] }]}>
      <Ionicons name="cloud-offline-outline" size={16} color="#FFF" />
      <Text style={styles.text}>Working Offline - Viewing Cached Data</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    position: 'absolute',
    top: 50, // Below potential safe area layout
    left: 0,
    right: 0,
    zIndex: 999,
  },
  text: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
