import React, { forwardRef } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors, Radius, Spacing } from '@/constants/theme';

interface Props {
  value: string;
  onChangeText: (v: string) => void;
  onFilterPress?: () => void;
  placeholder?: string;
}

// Large rounded search bar — filters the already-fetched treks/guides/
// homestays/rentals client-side today (same pattern DiscoverSection used).
// Ready to point at a real search endpoint (across categories/cities) later
// without changing this component's shape.
const SearchBar = forwardRef<TextInput, Props>(
  ({ value, onChangeText, onFilterPress, placeholder = 'Where do you want to go?' }, ref) => (
    <View style={styles.row}>
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={19} color={AppColors.subtext} />
        <TextInput
          ref={ref}
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={AppColors.subtext}
          value={value}
          onChangeText={onChangeText}
        />
        {value.length > 0 && (
          <TouchableOpacity onPress={() => onChangeText('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={AppColors.subtext} />
          </TouchableOpacity>
        )}
      </View>
      {onFilterPress && (
        <TouchableOpacity style={styles.filterBtn} onPress={onFilterPress} hitSlop={6}>
          <Ionicons name="options-outline" size={20} color={AppColors.primary} />
        </TouchableOpacity>
      )}
    </View>
  )
);
SearchBar.displayName = 'SearchBar';
export default SearchBar;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: AppColors.card,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: AppColors.border,
    paddingHorizontal: Spacing.lg,
    height: 50,
  },
  input: { flex: 1, color: AppColors.text, fontSize: 14.5 },
  filterBtn: {
    width: 50, height: 50, borderRadius: Radius.pill,
    backgroundColor: 'rgba(140,198,63,0.12)',
    borderWidth: 1, borderColor: 'rgba(140,198,63,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
});
