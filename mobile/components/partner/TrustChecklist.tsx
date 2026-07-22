import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '@/constants/theme';
import type { PartnerTrustChecklist } from '@/lib/services/TrustEngineService';

const GREEN = AppColors.primary;

interface Props {
  checklist: PartnerTrustChecklist | null;
}

const TONE_COLOR: Record<'ok' | 'warning' | 'attention', string> = {
  ok: GREEN,
  warning: '#F59E0B',
  attention: '#EF4444',
};

// Partner-facing half of the Internal Trust Engine — PARTNER_PLATFORM.md
// §7. Deliberately shows NO score, rank, or health label — only the
// concrete checklist the brief asks for: profile completion, verification
// progress, outstanding actions, audit status, pending documents, and
// recommendations. Every line here is something the partner can act on;
// none of it is a number they can't explain.
export default function TrustChecklist({ checklist }: Props) {
  if (!checklist) return null;

  return (
    <View style={s.card}>
      <Text style={s.title}>Your Trust Progress</Text>
      <Text style={s.subtitle}>How to become more trusted on TrekRiderz</Text>

      <View style={s.progressRow}>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${Math.min(100, checklist.profileCompletionPct)}%` }]} />
        </View>
        <Text style={s.progressLabel}>{checklist.profileCompletionPct}% profile complete</Text>
      </View>

      <View style={s.section}>
        <Text style={s.sectionLabel}>Verification</Text>
        {checklist.verification.map((v) => (
          <View key={v.label} style={s.checkRow}>
            <Ionicons name={v.done ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={v.done ? GREEN : 'rgba(255,255,255,0.3)'} />
            <Text style={[s.checkLabel, v.done && s.checkLabelDone]}>{v.label}</Text>
          </View>
        ))}
      </View>

      <View style={s.section}>
        <Text style={s.sectionLabel}>Audit Status</Text>
        <View style={s.checkRow}>
          <View style={[s.dot, { backgroundColor: TONE_COLOR[checklist.auditStatus.tone] }]} />
          <Text style={s.checkLabel}>{checklist.auditStatus.label}</Text>
        </View>
      </View>

      {checklist.pendingDocuments.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionLabel}>Pending Documents</Text>
          {checklist.pendingDocuments.map((d) => (
            <View key={d.label} style={s.checkRow}>
              <Ionicons name="document-text-outline" size={16} color="#F59E0B" />
              <Text style={s.checkLabel}>{d.label} ({d.count})</Text>
            </View>
          ))}
        </View>
      )}

      {checklist.outstandingActions.length > 0 && (
        <View style={s.actionsBox}>
          <Text style={s.actionsTitle}>Outstanding Actions</Text>
          {checklist.outstandingActions.map((a, i) => (
            <Text key={i} style={s.actionsItem}>• {a}</Text>
          ))}
        </View>
      )}

      <View style={s.section}>
        <Text style={s.sectionLabel}>Recommendations</Text>
        {checklist.recommendations.map((r, i) => (
          <View key={i} style={s.checkRow}>
            <Ionicons name="bulb-outline" size={16} color={GREEN} />
            <Text style={s.checkLabel}>{r}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 16 },
  title: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2, marginBottom: 14 },

  progressRow: { marginBottom: 16 },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: GREEN },
  progressLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 6 },

  section: { marginBottom: 14 },
  sectionLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  checkLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 13, flex: 1 },
  checkLabelDone: { color: '#FFF' },
  dot: { width: 8, height: 8, borderRadius: 4 },

  actionsBox: { backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)', marginBottom: 14 },
  actionsTitle: { color: '#F59E0B', fontSize: 12, fontWeight: '800', marginBottom: 6 },
  actionsItem: { color: 'rgba(255,255,255,0.65)', fontSize: 12.5, lineHeight: 18 },
});
