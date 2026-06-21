import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExpeditionPackage } from '@/lib/expeditions';

interface PackageTierCardProps {
  pkg: ExpeditionPackage;
  isSelected: boolean;
  onSelect: () => void;
}

export default function PackageTierCard({ pkg, isSelected, onSelect }: PackageTierCardProps) {
  return (
    <TouchableOpacity
      style={[styles.card, isSelected && styles.cardSelected]}
      onPress={onSelect}
      activeOpacity={0.85}
    >
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.packageName}>{pkg.name}</Text>
          <View style={styles.priceRow}>
            <Text style={[styles.price, isSelected && styles.priceSelected]}>
              ₹{pkg.price_per_person.toLocaleString('en-IN')}
            </Text>
            <Text style={styles.perPerson}>/person</Text>
          </View>
        </View>
        <View style={[styles.selectCircle, isSelected && styles.selectCircleActive]}>
          {isSelected ? (
            <Ionicons name="checkmark" size={16} color="#FFF" />
          ) : (
            <View style={styles.emptyCircle} />
          )}
        </View>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Inclusions */}
      {Array.isArray(pkg.inclusions) && pkg.inclusions.length > 0 && (
        <View style={styles.listSection}>
          {pkg.inclusions.map((item, idx) => (
            <View key={idx} style={styles.listItem}>
              <Ionicons name="checkmark-circle" size={15} color="#8CC63F" />
              <Text style={styles.listText}>{item}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Exclusions */}
      {Array.isArray(pkg.exclusions) && pkg.exclusions.length > 0 && (
        <View style={[styles.listSection, { marginTop: 8 }]}>
          {pkg.exclusions.map((item, idx) => (
            <View key={idx} style={styles.listItem}>
              <Ionicons name="close-circle-outline" size={15} color="#6B7280" />
              <Text style={[styles.listText, styles.exclusionText]}>{item}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Select button */}
      {!isSelected && (
        <TouchableOpacity style={styles.selectBtn} onPress={onSelect}>
          <Text style={styles.selectBtnText}>Select This Package</Text>
        </TouchableOpacity>
      )}
      {isSelected && (
        <View style={styles.selectedIndicator}>
          <Ionicons name="checkmark-circle" size={16} color="#8CC63F" />
          <Text style={styles.selectedIndicatorText}>Selected</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginBottom: 12,
  },
  cardSelected: {
    borderColor: '#8CC63F',
    backgroundColor: 'rgba(140,198,63,0.08)',
    shadowColor: '#8CC63F',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  packageName: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  price: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: '800',
  },
  priceSelected: {
    color: '#8CC63F',
  },
  perPerson: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '400',
  },
  selectCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectCircleActive: {
    backgroundColor: '#8CC63F',
    borderColor: '#8CC63F',
  },
  emptyCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginBottom: 14,
  },
  listSection: {
    gap: 8,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  listText: {
    color: '#D1D5DB',
    fontSize: 13.5,
    flex: 1,
    lineHeight: 19,
  },
  exclusionText: {
    color: '#6B7280',
    textDecorationLine: 'line-through',
  },
  selectBtn: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#8CC63F',
    alignItems: 'center',
  },
  selectBtnText: {
    color: '#8CC63F',
    fontSize: 14,
    fontWeight: '600',
  },
  selectedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(140,198,63,0.1)',
    borderRadius: 14,
  },
  selectedIndicatorText: {
    color: '#8CC63F',
    fontSize: 14,
    fontWeight: '600',
  },
});
