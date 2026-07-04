import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';

export default function HostIndexRedirect() {
  useEffect(() => {
    router.replace('/host/my-properties' as any);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#080C14', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color="#8CC63F" />
    </View>
  );
}
