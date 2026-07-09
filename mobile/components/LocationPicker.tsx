import { useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import statesAndDistricts from '@/lib/india-states-districts.json';
import { getStateCenter } from '@/lib/state-centers';

const GREEN = '#8CC63F';

export interface LocationPickerValue {
  state: string;
  district: string;
}

interface Props {
  value: LocationPickerValue;
  onChange: (value: LocationPickerValue) => void;
  /** Extra top-level options (e.g. non-India countries) with no district list. */
  extraStateOptions?: string[];
  stateLabel?: string;
  districtLabel?: string;
}

const DISTRICTS_BY_STATE: Record<string, string[]> = Object.fromEntries(
  (statesAndDistricts as { state: string; districts: string[] }[]).map((s) => [s.state, s.districts])
);
const STATE_NAMES = (statesAndDistricts as { state: string }[]).map((s) => s.state);

export { getStateCenter };

export default function LocationPicker({
  value, onChange, extraStateOptions = [], stateLabel = 'State', districtLabel = 'District',
}: Props) {
  const [showStateModal, setShowStateModal] = useState(false);
  const [showDistrictModal, setShowDistrictModal] = useState(false);
  const [stateQuery, setStateQuery] = useState('');
  const [districtQuery, setDistrictQuery] = useState('');

  const allStateOptions = useMemo(() => [...extraStateOptions, ...STATE_NAMES], [extraStateOptions]);
  const filteredStates = useMemo(
    () => allStateOptions.filter((s) => s.toLowerCase().includes(stateQuery.trim().toLowerCase())),
    [allStateOptions, stateQuery]
  );

  const districtsForState = value.state ? DISTRICTS_BY_STATE[value.state] : undefined;
  const filteredDistricts = useMemo(
    () => (districtsForState || []).filter((d) => d.toLowerCase().includes(districtQuery.trim().toLowerCase())),
    [districtsForState, districtQuery]
  );

  const districtDisabled = !districtsForState || districtsForState.length === 0;

  const selectState = (state: string) => {
    onChange({ state, district: '' });
    setStateQuery('');
    setShowStateModal(false);
  };

  const selectDistrict = (district: string) => {
    onChange({ ...value, district });
    setDistrictQuery('');
    setShowDistrictModal(false);
  };

  return (
    <View style={styles.row2}>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{stateLabel}</Text>
        <TouchableOpacity style={styles.selectBox} onPress={() => setShowStateModal(true)}>
          <Text style={[styles.selectBoxText, !value.state && styles.placeholder]} numberOfLines={1}>
            {value.state || `Select ${stateLabel.toLowerCase()}`}
          </Text>
          <Ionicons name="chevron-down" size={16} color="rgba(255,255,255,0.4)" />
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{districtLabel}</Text>
        <TouchableOpacity
          style={[styles.selectBox, districtDisabled && styles.selectBoxDisabled]}
          onPress={() => !districtDisabled && setShowDistrictModal(true)}
          disabled={districtDisabled}
        >
          <Text style={[styles.selectBoxText, !value.district && styles.placeholder]} numberOfLines={1}>
            {value.district || (districtDisabled ? '—' : `Select ${districtLabel.toLowerCase()}`)}
          </Text>
          <Ionicons name="chevron-down" size={16} color="rgba(255,255,255,0.4)" />
        </TouchableOpacity>
      </View>

      <PickerModal
        visible={showStateModal}
        title={`Select ${stateLabel}`}
        query={stateQuery}
        onQueryChange={setStateQuery}
        items={filteredStates}
        selected={value.state}
        onSelect={selectState}
        onClose={() => { setShowStateModal(false); setStateQuery(''); }}
      />

      <PickerModal
        visible={showDistrictModal}
        title={`Select ${districtLabel}`}
        query={districtQuery}
        onQueryChange={setDistrictQuery}
        items={filteredDistricts}
        selected={value.district}
        onSelect={selectDistrict}
        onClose={() => { setShowDistrictModal(false); setDistrictQuery(''); }}
      />
    </View>
  );
}

function PickerModal({
  visible, title, query, onQueryChange, items, selected, onSelect, onClose,
}: {
  visible: boolean; title: string; query: string; onQueryChange: (q: string) => void;
  items: string[]; selected: string; onSelect: (item: string) => void; onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.modalSheet} edges={['bottom']}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={16} color="rgba(255,255,255,0.4)" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search..."
              placeholderTextColor="#555"
              value={query}
              onChangeText={onQueryChange}
              autoFocus
            />
          </View>
          <FlatList
            data={items}
            keyExtractor={(item) => item}
            style={{ maxHeight: 380 }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.emptyText}>No matches</Text>}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={[styles.optionRow, index < items.length - 1 && styles.optionBorder]}
                onPress={() => onSelect(item)}
              >
                <Text style={[styles.optionText, selected === item && styles.optionTextActive]}>{item}</Text>
                {selected === item && <Ionicons name="checkmark" size={16} color={GREEN} />}
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row2: { flexDirection: 'row', gap: 12 },
  label: {
    fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.6)',
    marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  selectBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13,
  },
  selectBoxDisabled: { opacity: 0.4 },
  selectBoxText: { color: '#FFF', fontSize: 14, flex: 1 },
  placeholder: { color: '#555' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#0E1420', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 8, maxHeight: '80%',
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center', marginBottom: 12,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 12,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#FFF' },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 20, marginBottom: 12, paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  searchInput: { flex: 1, color: '#FFF', fontSize: 14 },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14,
  },
  optionBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  optionText: { color: '#FFF', fontSize: 14 },
  optionTextActive: { color: GREEN, fontWeight: '800' },
  emptyText: { color: 'rgba(255,255,255,0.4)', textAlign: 'center', paddingVertical: 24, fontSize: 13 },
});
