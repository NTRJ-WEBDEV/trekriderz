import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  FlatList, ActivityIndicator, Linking, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

const STORE_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  amazon:    { color: '#FF9900', bg: 'rgba(255,153,0,0.15)',  icon: '📦' },
  decathlon: { color: '#0082C3', bg: 'rgba(0,130,195,0.15)', icon: '🏃' },
  flipkart:  { color: '#2874F0', bg: 'rgba(40,116,240,0.15)',icon: '🛍️' },
  myntra:    { color: '#FF3F6C', bg: 'rgba(255,63,108,0.15)',icon: '👕' },
  offline:   { color: '#8CC63F', bg: 'rgba(140,198,63,0.15)',icon: '🏪' },
  other:     { color: '#A78BFA', bg: 'rgba(167,139,250,0.15)',icon: '🔗' },
};

export interface AffiliateProduct {
  id: string;
  product_name: string;
  brand: string | null;
  store: string;
  store_label: string;
  image_url: string | null;
  price_inr: number | null;
  affiliate_url: string;
  item_keywords: string[];
  trip_types: string[];
  category: string | null;
  sort_order: number;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  itemName: string;
  tripType: string;
  tripId?: string;
  allProducts: AffiliateProduct[];
}

function matchProducts(itemName: string, tripType: string, products: AffiliateProduct[]): AffiliateProduct[] {
  const words = itemName.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  return products
    .filter((p) => {
      // trip_types empty array = applies to all trip types
      const typeOk = p.trip_types.length === 0 || p.trip_types.includes(tripType);
      const keywordOk = p.item_keywords.some((kw) => {
        const k = kw.toLowerCase();
        return words.some((w) => k.includes(w) || w.includes(k));
      });
      return typeOk && keywordOk;
    })
    .sort((a, b) => b.sort_order - a.sort_order);
}

export default function AffiliateProductSheet({
  visible, onClose, itemName, tripType, tripId, allProducts,
}: Props) {
  const { user } = useAuthStore();
  const [opening, setOpening] = useState<string | null>(null);

  const matched = matchProducts(itemName, tripType, allProducts);

  const handleBuy = async (product: AffiliateProduct) => {
    setOpening(product.id);
    try {
      // Record click for revenue tracking (fire-and-forget)
      supabase.from('affiliate_clicks').insert({
        product_id: product.id,
        user_id: user?.id || null,
        trip_id: tripId || null,
        item_name: itemName,
      }).then(() => {});

      const canOpen = await Linking.canOpenURL(product.affiliate_url);
      if (canOpen) {
        await Linking.openURL(product.affiliate_url);
      } else {
        Alert.alert('Cannot open link', 'Please visit the store manually.');
      }
    } catch {
      Alert.alert('Error', 'Could not open product link.');
    } finally {
      setOpening(null);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Shop for Gear</Text>
              <Text style={styles.headerSub} numberOfLines={1}>
                {itemName}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>

          <Text style={styles.commissionNote}>
            🤝 Purchases through these links support TrekRiderz at no extra cost to you
          </Text>

          {matched.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyText}>No products found for this item yet.</Text>
              <Text style={styles.emptySubText}>Check back soon as we add more recommendations!</Text>
            </View>
          ) : (
            <FlatList
              data={matched}
              keyExtractor={(item) => item.id}
              horizontal={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.list}
              renderItem={({ item: product }) => {
                const store = STORE_CONFIG[product.store] || STORE_CONFIG.other;
                const isLoading = opening === product.id;
                return (
                  <View style={styles.productCard}>
                    {/* Product Image */}
                    <View style={styles.imageWrap}>
                      {product.image_url ? (
                        <Image
                          source={{ uri: product.image_url }}
                          style={styles.productImage}
                          contentFit="contain"
                        />
                      ) : (
                        <View style={styles.imagePlaceholder}>
                          <Text style={styles.imagePlaceholderEmoji}>🎒</Text>
                        </View>
                      )}
                    </View>

                    {/* Product Info */}
                    <View style={styles.productInfo}>
                      {product.brand && (
                        <Text style={styles.brand}>{product.brand}</Text>
                      )}
                      <Text style={styles.productName} numberOfLines={2}>
                        {product.product_name}
                      </Text>

                      {/* Store + Price */}
                      <View style={styles.metaRow}>
                        <View style={[styles.storeBadge, { backgroundColor: store.bg }]}>
                          <Text style={styles.storeIcon}>{store.icon}</Text>
                          <Text style={[styles.storeLabel, { color: store.color }]}>
                            {product.store_label}
                          </Text>
                        </View>
                        {product.price_inr && (
                          <Text style={styles.price}>
                            ₹{product.price_inr.toLocaleString()}
                          </Text>
                        )}
                      </View>

                      {/* CTA */}
                      <TouchableOpacity
                        style={[styles.buyBtn, { backgroundColor: store.color }]}
                        onPress={() => handleBuy(product)}
                        disabled={isLoading}
                        activeOpacity={0.8}
                      >
                        {isLoading ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Ionicons name="cart-outline" size={15} color="#fff" />
                            <Text style={styles.buyBtnText}>Buy Now</Text>
                            <Ionicons name="open-outline" size={13} color="rgba(255,255,255,0.7)" />
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0F1724',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 36,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center', marginTop: 10, marginBottom: 4,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  commissionNote: {
    fontSize: 11, color: 'rgba(255,255,255,0.35)',
    paddingHorizontal: 20, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  list: { padding: 16, gap: 12 },

  productCard: {
    flexDirection: 'row', gap: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  imageWrap: {
    width: 90, height: 90, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden', flexShrink: 0,
  },
  productImage: { width: '100%', height: '100%' },
  imagePlaceholder: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
  },
  imagePlaceholderEmoji: { fontSize: 32 },

  productInfo: { flex: 1, gap: 4 },
  brand: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 0.8 },
  productName: { fontSize: 14, fontWeight: '700', color: '#FFF', lineHeight: 19 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  storeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  storeIcon: { fontSize: 11 },
  storeLabel: { fontSize: 11, fontWeight: '700' },
  price: { fontSize: 14, fontWeight: '800', color: '#8CC63F', marginLeft: 'auto' },

  buyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 9, borderRadius: 10, marginTop: 6,
  },
  buyBtnText: { fontSize: 13, fontWeight: '800', color: '#fff' },

  empty: { alignItems: 'center', padding: 40, gap: 10 },
  emptyEmoji: { fontSize: 40 },
  emptyText: { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.5)', textAlign: 'center' },
  emptySubText: { fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center' },
});
