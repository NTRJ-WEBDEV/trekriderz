import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

// Hides YouTube's own header, subscribe bar, comments and recommended-videos
// shelf so viewers only see the single posted video — nothing to browse away
// to, like a WhatsApp/Instagram status viewer rather than the full YouTube app.
const HIDE_CHROME_CSS = `
  (function() {
    const style = document.createElement('style');
    style.innerHTML = \`
      .mobile-topbar-header, #header, ytm-mobile-topbar-renderer,
      #comments, ytm-comment-section-renderer,
      #related, ytm-item-section-renderer, ytm-single-column-watch-next-results-renderer,
      ytm-slim-owner-renderer, ytm-subscribe-button-renderer,
      ytm-app-promo-renderer, ytm-mealbar-promo-renderer,
      .ytm-shorts-shelf, ytm-reel-shelf-renderer {
        display: none !important;
      }
      html, body { background: #000 !important; }
    \`;
    document.head.appendChild(style);
  })();
  true;
`;

export default function WatchVideoScreen() {
  const { url } = useLocalSearchParams<{ url: string }>();
  const [loading, setLoading] = useState(true);
  const videoId = extractYouTubeId(url);
  const watchUrl = videoId ? `https://m.youtube.com/watch?v=${videoId}` : url;

  const handleNavigationChange = (navState: WebViewNavigation) => {
    // Block hopping to any other video/channel/search — keep the viewer pinned
    // to this one video, similar to a status/story viewer rather than a full browser.
    if (videoId && !navState.url.includes(`v=${videoId}`) && navState.url !== watchUrl) {
      if (router.canGoBack()) router.back(); else router.replace('/(tabs)');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={styles.closeBtn}>
          <Ionicons name="close" size={28} color="#FFF" />
        </TouchableOpacity>
      </View>
      <View style={styles.playerWrap}>
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#FF0000" />
          </View>
        )}
        <WebView
          source={{ uri: watchUrl }}
          style={styles.webview}
          allowsFullscreenVideo
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          injectedJavaScript={HIDE_CHROME_CSS}
          onLoadEnd={() => setLoading(false)}
          onNavigationStateChange={handleNavigationChange}
          onShouldStartLoadWithRequest={(req) => {
            if (!videoId) return true;
            return req.url.includes(`v=${videoId}`) || req.url === watchUrl;
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  closeBtn: { padding: 4 },
  playerWrap: { flex: 1 },
  webview: { flex: 1, backgroundColor: '#000' },
  loadingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    zIndex: 1,
  },
});
