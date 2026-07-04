import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CommunityListScreen from '../community/index';
import StoriesScreen from '../stories/index';

const BG = '#080C14';
const GREEN = '#8CC63F';

type Section = 'groups' | 'stories';

export default function CommunityTab() {
  const [section, setSection] = useState<Section>('groups');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.segmentRow}>
        <TouchableOpacity
          style={[styles.segmentBtn, section === 'groups' && styles.segmentBtnActive]}
          onPress={() => setSection('groups')}
        >
          <Text style={[styles.segmentLabel, section === 'groups' && styles.segmentLabelActive]}>Groups</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentBtn, section === 'stories' && styles.segmentBtnActive]}
          onPress={() => setSection('stories')}
        >
          <Text style={[styles.segmentLabel, section === 'stories' && styles.segmentLabelActive]}>Stories</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }}>
        {section === 'groups' ? <CommunityListScreen embedded /> : <StoriesScreen embedded />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  segmentRow: {
    flexDirection: 'row', marginHorizontal: 16, marginTop: 4, marginBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  segmentBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10 },
  segmentBtnActive: { backgroundColor: GREEN },
  segmentLabel: { color: 'rgba(255,255,255,0.5)', fontWeight: '700', fontSize: 13 },
  segmentLabelActive: { color: '#000' },
});
