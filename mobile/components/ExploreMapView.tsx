import { useRef, useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

export type MarkerKind = 'homestay' | 'guide' | 'expedition' | 'member' | 'destination';

export interface MapMarker {
  id: string;
  kind: MarkerKind;
  name: string;
  lat: number;
  lng: number;
  sublabel?: string;
  price?: string;
  rating?: number;
  imageUrl?: string;
  extra?: Record<string, unknown>;
}

interface Props {
  markers: MapMarker[];
  userLat?: number | null;
  userLng?: number | null;
  onMarkerTap?: (marker: MapMarker) => void;
  centerLat?: number;
  centerLng?: number;
  zoom?: number;
}

function buildMapHtml(
  markers: MapMarker[],
  userLat: number | null,
  userLng: number | null,
  centerLat: number,
  centerLng: number,
  zoom: number
): string {
  const markersJson = JSON.stringify(markers);
  const hasUser = userLat != null && userLng != null;

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body, #map { width:100%; height:100%; background:#080C14; }

  .marker-wrap {
    display:flex; align-items:center; justify-content:center;
    width:36px; height:36px; border-radius:50%;
    font-size:18px;
    box-shadow:0 3px 10px rgba(0,0,0,0.5);
    border:2.5px solid rgba(0,0,0,0.25);
    cursor:pointer;
  }
  .mk-homestay  { background:#F97316; }
  .mk-guide     { background:#8B5CF6; }
  .mk-expedition{ background:#8CC63F; }
  .mk-destination{ background:#8CC63F; }
  .mk-member    { background:#3B82F6; animation:pulse 2s infinite; }
  .mk-user      {
    background:#3B82F6; width:20px; height:20px; border-radius:50%;
    border:3px solid #fff; box-shadow:0 0 0 6px rgba(59,130,246,0.25);
    animation:pulse 2s infinite;
  }

  @keyframes pulse {
    0%  { box-shadow:0 0 0 0   rgba(59,130,246,0.4); }
    70% { box-shadow:0 0 0 10px rgba(59,130,246,0); }
    100%{ box-shadow:0 0 0 0   rgba(59,130,246,0); }
  }

  .leaflet-popup-content-wrapper {
    background:#0F1724; color:#fff;
    border:1px solid rgba(255,255,255,0.12); border-radius:14px;
    box-shadow:0 8px 24px rgba(0,0,0,0.6); padding:0;
  }
  .leaflet-popup-content { margin:0; }
  .leaflet-popup-tip-container { display:none; }
  .leaflet-popup-close-button { color:rgba(255,255,255,0.5)!important; font-size:18px!important; top:6px!important; right:8px!important; }

  .pop { padding:14px 16px 14px 16px; min-width:180px; max-width:240px; }
  .pop-kind { font-size:10px; font-weight:700; letter-spacing:0.8px; text-transform:uppercase; margin-bottom:5px; }
  .pop-name { font-size:14px; font-weight:800; color:#fff; line-height:1.3; }
  .pop-sub  { font-size:12px; color:rgba(255,255,255,0.55); margin-top:3px; }
  .pop-price{ font-size:13px; font-weight:700; color:#8CC63F; margin-top:6px; }
  .pop-rating{ font-size:11px; color:#F59E0B; margin-top:3px; }
  .pop-btn  {
    display:block; margin-top:10px; padding:7px 0; border-radius:20px;
    background:#8CC63F; color:#080C14; font-size:12px; font-weight:800;
    text-align:center; border:none; cursor:pointer; width:100%;
  }
  .kind-homestay  { color:#F97316; }
  .kind-guide     { color:#8B5CF6; }
  .kind-expedition{ color:#8CC63F; }
  .kind-destination{ color:#8CC63F; }
  .kind-member    { color:#3B82F6; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function() {
  var MARKERS = ${markersJson};
  var hasUser = ${hasUser};
  var userLat = ${userLat ?? 0};
  var userLng = ${userLng ?? 0};
  var centerLat = ${centerLat};
  var centerLng = ${centerLng};
  var zoom = ${zoom};

  var map = L.map('map', { zoomControl:true, attributionControl:false }).setView([centerLat, centerLng], zoom);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19 }).addTo(map);

  // User location
  if (hasUser) {
    var userIcon = L.divIcon({ html:'<div class="mk-user"></div>', iconSize:[20,20], iconAnchor:[10,10], className:'' });
    L.marker([userLat, userLng], { icon:userIcon, zIndexOffset:1000 }).addTo(map);
  }

  var EMOJI = { homestay:'🏠', guide:'👤', expedition:'⛰️', destination:'📍', member:'🧑' };
  var KIND_LABEL = { homestay:'Homestay', guide:'Guide', expedition:'Expedition', destination:'Destination', member:'Member' };

  MARKERS.forEach(function(m) {
    if (!m.lat || !m.lng) return;

    var emoji = EMOJI[m.kind] || '📍';
    var mkClass = 'mk-' + m.kind;

    var icon = L.divIcon({
      html: '<div class="marker-wrap ' + mkClass + '">' + emoji + '</div>',
      iconSize:[36,36], iconAnchor:[18,18], className:''
    });

    var starsHtml = '';
    if (m.rating) {
      starsHtml = '<div class="pop-rating">' + '★'.repeat(Math.round(m.rating)) + ' ' + m.rating.toFixed(1) + '</div>';
    }

    var popupHtml =
      '<div class="pop">' +
        '<div class="pop-kind kind-' + m.kind + '">' + (KIND_LABEL[m.kind] || m.kind) + '</div>' +
        '<div class="pop-name">' + m.name + '</div>' +
        (m.sublabel ? '<div class="pop-sub">' + m.sublabel + '</div>' : '') +
        (m.price    ? '<div class="pop-price">' + m.price + '</div>' : '') +
        starsHtml +
        '<button class="pop-btn" onclick="tapMarker(' + JSON.stringify(JSON.stringify(m)) + ')">View Details →</button>' +
      '</div>';

    var marker = L.marker([m.lat, m.lng], { icon:icon }).addTo(map);
    marker.bindPopup(popupHtml, { maxWidth:260, closeButton:true });
    marker.on('click', function() { marker.openPopup(); });
  });

  window.tapMarker = function(jsonStr) {
    var m = JSON.parse(jsonStr);
    window.ReactNativeWebView.postMessage(JSON.stringify({ type:'markerTap', marker:m }));
  };

  // Fit bounds if there are markers
  if (MARKERS.length > 0) {
    var latlngs = MARKERS.filter(function(m){ return m.lat && m.lng; }).map(function(m){ return [m.lat, m.lng]; });
    if (hasUser) latlngs.push([userLat, userLng]);
    if (latlngs.length > 1) {
      try { map.fitBounds(latlngs, { padding:[30,30], maxZoom:14 }); } catch(e){}
    }
  }
})();
</script>
</body>
</html>`;
}

export default function ExploreMapView({
  markers,
  userLat,
  userLng,
  onMarkerTap,
  centerLat,
  centerLng,
  zoom = 6,
}: Props) {
  const [ready, setReady] = useState(false);
  const webRef = useRef<WebView>(null);

  const defaultCenterLat = userLat ?? 12.9716;
  const defaultCenterLng = userLng ?? 77.5946;

  const html = buildMapHtml(
    markers,
    userLat ?? null,
    userLng ?? null,
    centerLat ?? defaultCenterLat,
    centerLng ?? defaultCenterLng,
    zoom
  );

  const onMessage = (e: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'markerTap' && onMarkerTap) {
        onMarkerTap(msg.marker as MapMarker);
      }
    } catch {}
  };

  return (
    <View style={styles.container}>
      {!ready && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#8CC63F" />
          <Text style={styles.loaderText}>Loading map…</Text>
        </View>
      )}
      <WebView
        ref={webRef}
        source={{ html }}
        style={[styles.map, !ready && { opacity: 0 }]}
        onLoad={() => setReady(true)}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState={false}
        mixedContentMode="always"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, position: 'relative' },
  map: { flex: 1 },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center', gap: 12,
    backgroundColor: '#080C14', zIndex: 1,
  },
  loaderText: { color: 'rgba(255,255,255,0.4)', fontSize: 14 },
});
