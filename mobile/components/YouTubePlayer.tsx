import { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

interface YouTubePlayerProps {
  url: string;
  height?: number;
}

export default function YouTubePlayer({ url, height = 220 }: YouTubePlayerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const videoId = extractYouTubeId(url);
  if (!videoId) return null;

  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0&modestbranding=1&playsinline=1`;

  if (error) {
    return (
      <View style={[styles.container, { height }]}>
        <Ionicons name="logo-youtube" size={32} color="#FF0000" />
        <Text style={styles.errorText}>Couldn't load video</Text>
        <Text style={styles.errorSub}>Check your internet connection</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FF0000" />
        </View>
      )}
      <WebView
        source={{ uri: embedUrl }}
        style={styles.webview}
        allowsFullscreenVideo
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        onLoadEnd={() => setLoading(false)}
        onError={() => { setLoading(false); setError(true); }}
        scrollEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginVertical: 10,
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    zIndex: 1,
  },
  errorText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
  },
  errorSub: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    marginTop: 4,
  },
});
