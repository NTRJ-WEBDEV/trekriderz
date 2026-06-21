import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';

interface SearchModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: SearchFilters) => void;
  initialFilters: SearchFilters;
}

export interface SearchFilters {
  location: string;
  minPrice: string;
  maxPrice: string;
  amenities: string[];
}

const LOCATIONS = ['Manali', 'Jibhi', 'Spiti', 'Coorg', 'Kerala', 'Goa', 'Rishikesh'];
const AMENITIES = ['WiFi', 'Kitchen', 'Heater', 'Parking', 'Bonfire', 'Breakfast', 'Pool'];

export default function SearchModal({ visible, onClose, onApply, initialFilters }: SearchModalProps) {
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);

  const toggleAmenity = (amenity: string) => {
    let newAmenities = [...filters.amenities];
    if (newAmenities.includes(amenity)) {
      newAmenities = newAmenities.filter(a => a !== amenity);
    } else {
      newAmenities.push(amenity);
    }
    setFilters({ ...filters, amenities: newAmenities });
  };

  const handleApply = () => {
    onApply(filters);
    onClose();
  };

  const handleClear = () => {
    setFilters({
      location: '',
      minPrice: '',
      maxPrice: '',
      amenities: [],
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>Filters</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Location */}
            <Text style={styles.sectionTitle}>Location</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {LOCATIONS.map((loc) => (
                <TouchableOpacity
                  key={loc}
                  style={[
                    styles.chip,
                    filters.location === loc && styles.activeChip,
                  ]}
                  onPress={() => setFilters({ ...filters, location: filters.location === loc ? '' : loc })}
                >
                  <Text style={[styles.chipText, filters.location === loc && styles.activeChipText]}>
                    {loc}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Price Range */}
            <Text style={styles.sectionTitle}>Price Range (₹)</Text>
            <View style={styles.priceRow}>
              <TextInput
                style={styles.priceInput}
                placeholder="Min"
                placeholderTextColor="#6B7280"
                keyboardType="numeric"
                value={filters.minPrice}
                onChangeText={(t) => setFilters({ ...filters, minPrice: t })}
              />
              <Text style={styles.priceDash}>–</Text>
              <TextInput
                style={styles.priceInput}
                placeholder="Max"
                placeholderTextColor="#6B7280"
                keyboardType="numeric"
                value={filters.maxPrice}
                onChangeText={(t) => setFilters({ ...filters, maxPrice: t })}
              />
            </View>

            {/* Amenities */}
            <Text style={styles.sectionTitle}>Amenities</Text>
            <View style={styles.amenitiesGrid}>
              {AMENITIES.map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[
                    styles.chip,
                    filters.amenities.includes(item) && styles.activeChip,
                  ]}
                  onPress={() => toggleAmenity(item)}
                >
                  <Text style={[styles.chipText, filters.amenities.includes(item) && styles.activeChipText]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ height: 24 }} />
          </ScrollView>

          {/* Footer Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
              <Text style={styles.clearBtnText}>Clear All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyBtn} onPress={handleApply}>
              <Text style={styles.applyBtnText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
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
  modalContent: {
    backgroundColor: '#0F1520',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 34,
    maxHeight: '85%',
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  title: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  sectionTitle: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 10,
  },
  chipScroll: {
    flexGrow: 0,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginRight: 8,
    marginBottom: 8,
  },
  activeChip: {
    backgroundColor: 'rgba(140,198,63,0.15)',
    borderColor: '#8CC63F',
  },
  chipText: {
    color: '#9CA3AF',
    fontSize: 13.5,
    fontWeight: '500',
  },
  activeChipText: {
    color: '#8CC63F',
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  priceInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFF',
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  priceDash: {
    color: '#6B7280',
    fontSize: 18,
    fontWeight: '300',
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  clearBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
  },
  clearBtnText: {
    color: '#9CA3AF',
    fontSize: 15,
    fontWeight: '600',
  },
  applyBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#8CC63F',
    alignItems: 'center',
  },
  applyBtnText: {
    color: '#0A0E27',
    fontSize: 15,
    fontWeight: '700',
  },
});
