import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import AffiliateProductSheet, { AffiliateProduct } from '@/components/AffiliateProductSheet';

interface PackingItem {
  id: string;
  category: string;
  item: string;
  packed: boolean;
  essential: boolean;
}

interface PackingList {
  categories: {
    [key: string]: PackingItem[];
  };
}

const PACKING_SUGGESTIONS: Record<string, Record<string, { item: string; essential: boolean }[]>> = {
  trek: {
    'Essentials': [
      { item: 'Trekking shoes', essential: true },
      { item: 'Backpack (40-60L)', essential: true },
      { item: 'Water bottle (2L)', essential: true },
      { item: 'First aid kit', essential: true },
    ],
    'Clothing': [
      { item: 'Hiking pants', essential: true },
      { item: 'Thermal wear', essential: false },
      { item: 'Rain jacket', essential: true },
      { item: 'Extra socks (3-4 pairs)', essential: true },
      { item: 'Cap/Hat', essential: false },
    ],
    'Gear': [
      { item: 'Headlamp/Flashlight', essential: true },
      { item: 'Trekking poles', essential: false },
      { item: 'Sunglasses', essential: false },
      { item: 'Power bank', essential: true },
    ],
    'Toiletries': [
      { item: 'Sunscreen SPF 50+', essential: true },
      { item: 'Lip balm', essential: false },
      { item: 'Wet wipes', essential: true },
      { item: 'Hand sanitizer', essential: true },
    ],
  },
  bike: {
    'Essentials': [
      { item: 'Helmet', essential: true },
      { item: 'Bike toolkit', essential: true },
      { item: 'Spare tubes', essential: true },
      { item: 'Pump', essential: true },
    ],
    'Clothing': [
      { item: 'Riding jacket', essential: true },
      { item: 'Riding gloves', essential: true },
      { item: 'Comfortable pants', essential: true },
      { item: 'Extra clothes', essential: true },
    ],
    'Safety': [
      { item: 'First aid kit', essential: true },
      { item: 'Reflective vest', essential: false },
      { item: 'Phone holder', essential: false },
    ],
  },
  temple: {
    'Essentials': [
      { item: 'Comfortable walking shoes', essential: true },
      { item: 'Day bag', essential: true },
      { item: 'Water bottle', essential: true },
    ],
    'Clothing': [
      { item: 'Modest clothing', essential: true },
      { item: 'Shawl/Scarf', essential: false },
      { item: 'Extra clothes', essential: true },
    ],
    'Items': [
      { item: 'Prayer items (if needed)', essential: false },
      { item: 'Camera', essential: false },
      { item: 'Cash for donations', essential: false },
    ],
  },
  backpacking: {
    'Essentials': [
      { item: 'Backpack (50-70L)', essential: true },
      { item: 'Travel documents', essential: true },
      { item: 'Money belt', essential: false },
      { item: 'Padlock', essential: true },
    ],
    'Clothing': [
      { item: 'Quick-dry clothes', essential: true },
      { item: 'Comfortable shoes', essential: true },
      { item: 'Flip-flops', essential: false },
      { item: 'Jacket', essential: true },
    ],
    'Gear': [
      { item: 'Power bank', essential: true },
      { item: 'Universal adapter', essential: false },
      { item: 'Headlamp', essential: false },
    ],
  },
  weekend: {
    'Essentials': [
      { item: 'Small bag/backpack', essential: true },
      { item: 'Water bottle', essential: true },
    ],
    'Clothing': [
      { item: 'Casual clothes (2-3 sets)', essential: true },
      { item: 'Comfortable shoes', essential: true },
      { item: 'Jacket', essential: false },
    ],
    'Toiletries': [
      { item: 'Basic toiletries', essential: true },
      { item: 'Sunscreen', essential: false },
    ],
  },
};

const DEFAULT_SUGGESTIONS = {
  'Essentials': [
    { item: 'Valid ID/Passport', essential: true },
    { item: 'Cash & Cards', essential: true },
    { item: 'Water bottle', essential: true },
    { item: 'Phone charger', essential: true },
  ],
  'Clothing': [
    { item: 'Comfortable clothes', essential: true },
    { item: 'Comfortable shoes', essential: true },
    { item: 'Jacket', essential: false },
  ],
  'Toiletries': [
    { item: 'Basic toiletries', essential: true },
    { item: 'Hand sanitizer', essential: true },
  ],
};

function buildPackingList(tripType: string): PackingList {
  const suggestions = PACKING_SUGGESTIONS[tripType] || DEFAULT_SUGGESTIONS;
  const categories: Record<string, PackingItem[]> = {};

  Object.entries(suggestions).forEach(([cat, items]) => {
    categories[cat] = items.map((it, index) => ({
      id: `${cat}-${index}`,
      category: cat,
      item: it.item,
      packed: false,
      essential: it.essential,
    }));
  });

  return { categories };
}

export default function PackingListScreen() {
  const { tripId } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [packingList, setPackingList] = useState<PackingList>({ categories: {} });
  const [tripType, setTripType] = useState('weekend');
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [newCategory, setNewCategory] = useState('Essentials');
  const [affiliateProducts, setAffiliateProducts] = useState<AffiliateProduct[]>([]);
  const [sheetItem, setSheetItem] = useState<string | null>(null);

  useEffect(() => {
    loadPackingList();
    loadAffiliateProducts();
  }, [tripId]);

  const loadAffiliateProducts = async () => {
    try {
      const { data } = await supabase
        .from('affiliate_products')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: false });
      setAffiliateProducts(data || []);
    } catch (_) {}
  };

  const hasAffiliate = (itemName: string): boolean => {
    const words = itemName.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
    return affiliateProducts.some((p) => {
      const typeOk = p.trip_types.length === 0 || p.trip_types.includes(tripType);
      const kwOk = p.item_keywords.some((kw) => {
        const k = kw.toLowerCase();
        return words.some((w) => k.includes(w) || w.includes(k));
      });
      return typeOk && kwOk;
    });
  };

  const loadPackingList = async () => {
    try {
      const { data: trip, error } = await supabase
        .from('trips')
        .select('packing_list, trip_type')
        .eq('id', tripId)
        .single();

      if (error) throw error;

      const type = trip?.trip_type || 'weekend';
      setTripType(type);

      if (trip?.packing_list && trip.packing_list.categories) {
        setPackingList(trip.packing_list);
      } else {
        setPackingList(buildPackingList(type));
      }
    } catch (error) {
      console.error('Error loading packing list:', error);
      setPackingList(buildPackingList('weekend'));
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = async (categoryName: string, itemId: string) => {
    const updated: PackingList = {
      categories: {
        ...packingList.categories,
        [categoryName]: packingList.categories[categoryName].map(item =>
          item.id === itemId ? { ...item, packed: !item.packed } : item
        ),
      },
    };
    setPackingList(updated);
    savePackingList(updated);
  };

  const savePackingList = async (list: PackingList) => {
    setSaving(true);
    try {
      await supabase
        .from('trips')
        .update({ packing_list: list })
        .eq('id', tripId);
    } catch (error) {
      console.error('Error saving packing list:', error);
    } finally {
      setSaving(false);
    }
  };

  const addCustomItem = async () => {
    if (!newItem.trim()) {
      Alert.alert('Error', 'Please enter an item name');
      return;
    }

    const catItems = packingList.categories[newCategory] || [];
    const item: PackingItem = {
      id: `custom-${Date.now()}`,
      category: newCategory,
      item: newItem.trim(),
      packed: false,
      essential: false,
    };

    const updated: PackingList = {
      categories: {
        ...packingList.categories,
        [newCategory]: [...catItems, item],
      },
    };

    setPackingList(updated);
    savePackingList(updated);
    setNewItem('');
    setAddModalVisible(false);
  };

  const allItems = Object.values(packingList.categories).flat();
  const packedCount = allItems.filter(i => i.packed).length;
  const totalCount = allItems.length;
  const progress = totalCount > 0 ? (packedCount / totalCount) * 100 : 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8CC63F" />
          <Text style={styles.loadingText}>Loading packing list...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const categories = Object.keys(packingList.categories);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color="#8CC63F" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Packing Checklist</Text>
        {saving
          ? <ActivityIndicator size="small" color="#8CC63F" />
          : <TouchableOpacity onPress={() => setAddModalVisible(true)} style={styles.addHeaderBtn}>
              <Ionicons name="add" size={26} color="#8CC63F" />
            </TouchableOpacity>
        }
      </View>

      {/* Progress bar */}
      <View style={styles.progressSection}>
        <View style={styles.progressTop}>
          <Text style={styles.progressLabel}>{packedCount} / {totalCount} packed</Text>
          <Text style={styles.progressPercent}>{Math.round(progress)}%</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progress}%` as any }]} />
        </View>
        {progress === 100 && (
          <Text style={styles.progressComplete}>All packed! Ready to go! 🎒</Text>
        )}
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {categories.map((categoryName) => {
          const items = packingList.categories[categoryName];
          const catPacked = items.filter(i => i.packed).length;

          return (
            <View key={categoryName} style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryTitle}>{categoryName}</Text>
                <Text style={styles.categoryCount}>{catPacked}/{items.length}</Text>
              </View>
              {items.map((item) => {
                const canShop = hasAffiliate(item.item);
                return (
                  <View key={item.id} style={styles.itemRow}>
                    <TouchableOpacity
                      style={styles.itemRowInner}
                      onPress={() => toggleItem(categoryName, item.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.checkbox, item.packed && styles.checkboxChecked]}>
                        {item.packed && <Ionicons name="checkmark" size={14} color="#080C14" />}
                      </View>
                      <Text style={[styles.itemText, item.packed && styles.itemTextPacked]}>
                        {item.item}
                      </Text>
                      {item.essential && !item.packed && (
                        <View style={styles.essentialBadge}>
                          <Text style={styles.essentialText}>Essential</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                    {canShop && (
                      <TouchableOpacity
                        style={styles.shopBtn}
                        onPress={() => setSheetItem(item.item)}
                        activeOpacity={0.75}
                      >
                        <Ionicons name="cart-outline" size={15} color="#FF9900" />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Affiliate Shop Sheet */}
      <AffiliateProductSheet
        visible={sheetItem !== null}
        onClose={() => setSheetItem(null)}
        itemName={sheetItem || ''}
        tripType={tripType}
        tripId={typeof tripId === 'string' ? tripId : undefined}
        allProducts={affiliateProducts}
      />

      {/* Add Item Modal */}
      <Modal
        visible={addModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Item</Text>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Item Name</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Sunscreen"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={newItem}
              onChangeText={setNewItem}
              autoFocus
            />

            <Text style={styles.inputLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryPicker}>
              {[...categories, 'New Category'].map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryPickerItem, newCategory === cat && styles.categoryPickerItemActive]}
                  onPress={() => setNewCategory(cat === 'New Category' ? 'Custom' : cat)}
                >
                  <Text style={[styles.categoryPickerText, newCategory === cat && styles.categoryPickerTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.submitBtn} onPress={addCustomItem}>
              <Text style={styles.submitBtnText}>Add to List</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080C14',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  addHeaderBtn: {
    padding: 4,
  },
  progressSection: {
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  progressTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  progressPercent: {
    color: '#8CC63F',
    fontSize: 15,
    fontWeight: '700',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#8CC63F',
    borderRadius: 4,
  },
  progressComplete: {
    color: '#8CC63F',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  categorySection: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  categoryCount: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  itemRowInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    gap: 12,
  },
  shopBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: 'rgba(255,153,0,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,153,0,0.25)',
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#8CC63F',
    borderColor: '#8CC63F',
  },
  itemText: {
    color: 'white',
    fontSize: 15,
    flex: 1,
  },
  itemTextPacked: {
    color: 'rgba(255,255,255,0.35)',
    textDecorationLine: 'line-through',
  },
  essentialBadge: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  essentialText: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0F1724',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  inputLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 4,
  },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 10,
    padding: 14,
    color: 'white',
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 16,
  },
  categoryPicker: {
    marginBottom: 20,
  },
  categoryPickerItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginRight: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  categoryPickerItemActive: {
    backgroundColor: 'rgba(140,198,63,0.2)',
    borderColor: '#8CC63F',
  },
  categoryPickerText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
  },
  categoryPickerTextActive: {
    color: '#8CC63F',
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: '#8CC63F',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#080C14',
    fontSize: 16,
    fontWeight: '700',
  },
});
