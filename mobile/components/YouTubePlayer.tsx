import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import YoutubeIframe from 'react-native-youtube-iframe';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

interface YouTubePlayerProps {
  url: string;
  height?: number;
}

export default function YouTubePlayer({ url, height = 220 }: YouTubePlayerProps) {
  const [error, setError] = useState(false);
  const [playing, setPlaying] = useState(false);

  const videoId = extractYouTubeId(url);
  if (!videoId) return null;

  // YouTube Shorts frequently reject the standard /embed/ iframe with
  // "Error 153: Video player configuration error" — a YouTube-side restriction
  // confirmed even outside our app (plain browser hits the same error), not
  // something fixable via WebView config. Play the real watch page in an
  // in-app WebView screen instead, so viewers stay inside TrekRiderz rather
  // than being handed off to the external YouTube app.
  const isShort = /youtube\.com\/shorts\//.test(url);
  const openInApp = () => router.push({ pathname: '/watch-video', params: { url } });

  if (isShort) {
    return (
      <TouchableOpacity
        style={[styles.container, { height }]}
        activeOpacity={0.85}
        onPress={openInApp}
      >
        <Image
          source={{ uri: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` }}
          style={StyleSheet.absoluteFillObject as any}
          resizeMode="cover"
        />
        <View style={styles.shortsOverlay}>
          <Ionicons name="logo-youtube" size={40} color="#FF0000" />
          <Text style={styles.errorText}>Watch Short</Text>
        </View>
      </TouchableOpacity>
    );
  }

  if (error) {
    return (
      <TouchableOpacity style={[styles.container, { height }]} onPress={openInApp}>
        <Ionicons name="logo-youtube" size={32} color="#FF0000" />
        <Text style={styles.errorText}>Couldn't load video</Text>
        <Text style={styles.errorSub}>Tap to watch</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      <YoutubeIframe
        height={height}
        videoId={videoId}
        play={playing}
        onChangeState={(state: string) => { if (state === 'ended') setPlaying(false); }}
        onError={() => setError(true)}
        webViewProps={{ allowsInlineMediaPlayback: true, mediaPlaybackRequiresUserAction: false }}
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
  shortsOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
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
