import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Modal, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const GREEN = '#8CC63F';

export const COUNTRY_CODES = [
  { code: '+91', flag: '🇮🇳', name: 'India' },
  { code: '+977', flag: '🇳🇵', name: 'Nepal' },
  { code: '+975', flag: '🇧🇹', name: 'Bhutan' },
  { code: '+63', flag: '🇵🇭', name: 'Philippines' },
  { code: '+62', flag: '🇮🇩', name: 'Indonesia' },
  { code: '+855', flag: '🇰🇭', name: 'Cambodia' },
  { code: '+66', flag: '🇹🇭', name: 'Thailand' },
  { code: '+94', flag: '🇱🇰', name: 'Sri Lanka' },
  { code: '+1', flag: '🇺🇸', name: 'USA / Canada' },
  { code: '+44', flag: '🇬🇧', name: 'UK' },
  { code: '+61', flag: '🇦🇺', name: 'Australia' },
  { code: '+971', flag: '🇦🇪', name: 'UAE' },
  { code: '+65', flag: '🇸🇬', name: 'Singapore' },
  { code: '+60', flag: '🇲🇾', name: 'Malaysia' },
];

// Splits a full stored phone number (e.g. "+977981234567") into its country
// code and local number, so existing +91-only data still round-trips correctly.
export function splitPhone(full: string): { countryCode: string; number: string } {
  const sorted = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);
  for (const c of sorted) {
    if (full.startsWith(c.code)) {
      return { countryCode: c.code, number: full.slice(c.code.length).trim() };
    }
  }
  return { countryCode: '+91', number: full.replace(/^\+\d{1,4}\s?/, '') };
}

interface PhoneInputProps {
  countryCode: string;
  onChangeCountryCode: (code: string) => void;
  number: string;
  onChangeNumber: (v: string) => void;
  placeholder?: string;
}

export default function PhoneInput({ countryCode, onChangeCountryCode, number, onChangeNumber, placeholder }: PhoneInputProps) {
  const [showPicker, setShowPicker] = useState(false);
  const selected = COUNTRY_CODES.find(c => c.code === countryCode) || COUNTRY_CODES[0];

  return (
    <>
      <View style={styles.phoneRow}>
        <TouchableOpacity style={styles.countryCodeBtn} onPress={() => setShowPicker(true)}>
          <Text style={styles.countryFlag}>{selected.flag}</Text>
          <Text style={styles.countryCodeText}>{countryCode}</Text>
          <Ionicons name="chevron-down" size={14} color="#6B7280" />
        </TouchableOpacity>
        <TextInput
          style={[styles.input, styles.phoneInput]}
          placeholder={placeholder || '98765 43210'}
          placeholderTextColor="#6B7280"
          value={number}
          onChangeText={onChangeNumber}
          keyboardType="phone-pad"
          maxLength={15}
        />
      </View>

      <Modal visible={showPicker} transparent animationType="slide" onRequestClose={() => setShowPicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowPicker(false)}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Country Code</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={COUNTRY_CODES}
              keyExtractor={item => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.codeItem, item.code === countryCode && styles.codeItemActive]}
                  onPress={() => { onChangeCountryCode(item.code); setShowPicker(false); }}
                >
                  <Text style={styles.codeFlag}>{item.flag}</Text>
                  <Text style={styles.codeName}>{item.name}</Text>
                  <Text style={[styles.codeValue, item.code === countryCode && { color: GREEN }]}>
                    {item.code}
                  </Text>
                  {item.code === countryCode && (
                    <Ionicons name="checkmark" size={16} color={GREEN} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  phoneRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  countryCodeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12, height: 52,
  },
  countryFlag: { fontSize: 20 },
  countryCodeText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  input: { flex: 1, color: '#FFF', fontSize: 15 },
  phoneInput: { flex: 1 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '70%',
  },
  pickerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  pickerTitle: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  codeItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  codeItemActive: { backgroundColor: GREEN + '10' },
  codeFlag: { fontSize: 24 },
  codeName: { flex: 1, color: '#FFF', fontSize: 15 },
  codeValue: { color: 'rgba(255,255,255,0.45)', fontSize: 14, fontWeight: '600' },
});
