import { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  ActivityIndicator, SafeAreaView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

export interface PickedLocation {
  lat: number;
  lng: number;
  label?: string;
}

interface Props {
  visible: boolean;
  initialLat?: number;
  initialLng?: number;
  onConfirm: (loc: PickedLocation) => void;
  onClose: () => void;
}

function buildHtml(lat: number, lng: number) {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body, #map { width:100%; height:100%; }
  #info {
    position:absolute; bottom:16px; left:50%; transform:translateX(-50%);
    background:rgba(8,12,20,0.92); color:#8CC63F; font-family:sans-serif;
    font-size:12px; font-weight:700; padding:8px 18px; border-radius:20px;
    z-index:1000; border:1px solid rgba(140,198,63,0.3); white-space:nowrap;
  }
</style>
</head>
<body>
<div id="map"></div>
<div id="info">Drag pin to exact location</div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('map', { zoomControl:true }).setView([${lat},${lng}], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 19
  }).addTo(map);

  var icon = L.divIcon({
    html: '<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:#8CC63F;transform:rotate(-45deg);border:3px solid #080C14;box-shadow:0 2px 8px rgba(0,0,0,0.5)"></div>',
    iconSize:[28,28], iconAnchor:[14,28], className:''
  });

  var marker = L.marker([${lat},${lng}], { icon:icon, draggable:true }).addTo(map);

  function sendCoords(latlng) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ lat:latlng.lat, lng:latlng.lng }));
    document.getElementById('info').textContent = latlng.lat.toFixed(5) + ', ' + latlng.lng.toFixed(5);
  }

  marker.on('dragend', function(e) { sendCoords(e.target.getLatLng()); });
  map.on('click', function(e) { marker.setLatLng(e.latlng); sendCoords(e.latlng); });

  sendCoords(marker.getLatLng());
</script>
</body>
</html>`;
}

const DEFAULT_LAT = 28.6139;
const DEFAULT_LNG = 77.2090;

export default function MapPickerModal({ visible, initialLat, initialLng, onConfirm, onClose }: Props) {
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: initialLat ?? DEFAULT_LAT,
    lng: initialLng ?? DEFAULT_LNG,
  });
  const [mapReady, setMapReady] = useState(false);

  const lat = initialLat ?? DEFAULT_LAT;
  const lng = initialLng ?? DEFAULT_LNG;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <Ionicons name="close" size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pin Exact Location</Text>
          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={() => onConfirm(coords)}
          >
            <Text style={styles.confirmText}>Confirm</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tip}>
          <Ionicons name="information-circle-outline" size={14} color="rgba(255,255,255,0.5)" />
          <Text style={styles.tipText}>Tap on map or drag the pin to your exact location</Text>
        </View>

        {/* Map */}
        <View style={styles.mapWrap}>
          {!mapReady && (
            <View style={styles.loader}>
              <ActivityIndicator color="#8CC63F" size="large" />
              <Text style={styles.loaderText}>Loading map…</Text>
            </View>
          )}
          <WebView
            source={{ html: buildHtml(lat, lng) }}
            style={[styles.map, !mapReady && { opacity: 0 }]}
            onLoad={() => setMapReady(true)}
            onMessage={(e) => {
              try {
                const data = JSON.parse(e.nativeEvent.data);
                setCoords({ lat: data.lat, lng: data.lng });
              } catch {}
            }}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState={false}
          />
        </View>

        {/* Coords display */}
        <View style={styles.coordsBar}>
          <Ionicons name="location" size={14} color="#8CC63F" />
          <Text style={styles.coordsText}>
            {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080C14' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#FFF' },
  confirmBtn: {
    backgroundColor: '#8CC63F', paddingHorizontal: 18,
    paddingVertical: 8, borderRadius: 20,
  },
  confirmText: { color: '#080C14', fontWeight: '800', fontSize: 13 },
  tip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  tipText: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  mapWrap: { flex: 1, position: 'relative' },
  map: { flex: 1 },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center', gap: 12,
    backgroundColor: '#080C14', zIndex: 1,
  },
  loaderText: { color: 'rgba(255,255,255,0.4)', fontSize: 14 },
  coordsBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: 'rgba(140,198,63,0.08)',
    borderTopWidth: 1, borderTopColor: 'rgba(140,198,63,0.2)',
  },
  coordsText: { color: '#8CC63F', fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
