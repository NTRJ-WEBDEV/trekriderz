import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { supabase } from '@/lib/supabase';

interface Props {
  userId: string;
  size?: number;
  avatarUrl?: string;   // pass directly to skip fetch
  fullName?: string;    // pass directly to skip fetch
  style?: any;
}

const cache: Record<string, { avatar_url: string | null; full_name: string | null }> = {};

export default function UserAvatar({ userId, size = 40, avatarUrl, fullName, style }: Props) {
  const [data, setData] = useState<{ avatar_url: string | null; full_name: string | null }>({
    avatar_url: avatarUrl ?? null,
    full_name: fullName ?? null,
  });

  useEffect(() => {
    if (avatarUrl !== undefined || fullName !== undefined) return; // already provided
    if (cache[userId]) { setData(cache[userId]); return; }
    supabase
      .from('users')
      .select('full_name, avatar_url')
      .eq('id', userId)
      .single()
      .then(({ data: d }) => {
        if (d) {
          cache[userId] = { avatar_url: d.avatar_url, full_name: d.full_name };
          setData(cache[userId]);
        }
      });
  }, [userId, avatarUrl, fullName]);

  const initial = (data.full_name || '?').charAt(0).toUpperCase();
  const radius = size / 2;

  if (data.avatar_url) {
    return (
      <Image
        source={{ uri: data.avatar_url }}
        style={[{ width: size, height: size, borderRadius: radius }, style]}
      />
    );
  }

  return (
    <View style={[styles.placeholder, { width: size, height: size, borderRadius: radius }, style]}>
      <Text style={[styles.initial, { fontSize: size * 0.38 }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: 'rgba(140,198,63,0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(140,198,63,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initial: {
    color: '#8CC63F',
    fontWeight: '800',
  },
});
