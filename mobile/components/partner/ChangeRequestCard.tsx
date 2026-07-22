import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  addPartnerComment, stageDocumentReplacement, editRequestedField,
  type ChangeRequest, type ApprovalEntity,
} from '../../lib/services/ReviewWorkspaceService';

interface Props {
  request: ChangeRequest;
  entityType: ApprovalEntity;
  entityId: string;
  userId: string;
  onUpdated: () => void;
}

// Document-type field keys use the "upload a replacement photo" response;
// anything else is treated as a plain text/number field the partner can
// correct directly. Matches the document_key values the web admin's
// DocumentStatusPanel already uses for guides/properties.
const DOCUMENT_FIELDS = new Set(['identity_doc_front', 'identity_doc_back', 'ownership_proof', 'profile_photo', 'cover_photo']);

const STATUS_LABEL: Record<string, string> = {
  requested: 'Requested', partner_working: 'In Progress', ready_for_review: 'Ready For Review',
  resolved: 'Resolved', verified: 'Verified',
};
const STATUS_COLOR: Record<string, string> = {
  requested: '#F59E0B', partner_working: '#3897F0', ready_for_review: '#8B5CF6',
  resolved: '#22C55E', verified: '#22C55E',
};
const PRIORITY_COLOR: Record<string, string> = { low: '#9CA3AF', medium: '#F59E0B', high: '#EF4444' };

export default function ChangeRequestCard({ request, entityType, entityId, userId, onUpdated }: Props) {
  const [expanded, setExpanded] = useState(request.status !== 'resolved' && request.status !== 'verified');
  const [comment, setComment] = useState('');
  const [fieldValue, setFieldValue] = useState('');
  const [busy, setBusy] = useState(false);

  const isDone = request.status === 'resolved' || request.status === 'verified';
  const isDocument = request.field_key ? DOCUMENT_FIELDS.has(request.field_key) : false;

  const handleAddComment = async () => {
    if (!comment.trim()) return;
    setBusy(true);
    try {
      await addPartnerComment(request.id, comment.trim(), userId);
      setComment('');
      onUpdated();
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Could not save your comment.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveField = async () => {
    if (!request.field_key || !fieldValue.trim()) return;
    setBusy(true);
    try {
      await editRequestedField(entityType, entityId, request.field_key, fieldValue.trim(), userId);
      setFieldValue('');
      Alert.alert('Saved', 'Your update has been recorded.');
      onUpdated();
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Could not save this field.');
    } finally {
      setBusy(false);
    }
  };

  const handleUploadReplacement = async () => {
    if (!request.field_key) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission Required', 'Allow photo access to upload a replacement.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.85 });
    if (result.canceled || !result.assets[0]) return;
    setBusy(true);
    try {
      const uri = result.assets[0].uri;
      const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
      await stageDocumentReplacement(entityType, entityId, request.field_key, uri, `image/${ext}`, userId);
      Alert.alert('Uploaded', 'Your replacement has been sent for review.');
      onUpdated();
    } catch (e: any) {
      Alert.alert('Upload Failed', e.message || 'Could not upload your replacement.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.card, { borderColor: `${STATUS_COLOR[request.status]}40` }]}>
      <TouchableOpacity onPress={() => setExpanded((e) => !e)} activeOpacity={0.8} style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: `${PRIORITY_COLOR[request.priority]}20` }]}>
              <Text style={[styles.badgeText, { color: PRIORITY_COLOR[request.priority] }]}>{request.priority.toUpperCase()}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: `${STATUS_COLOR[request.status]}20` }]}>
              <Text style={[styles.badgeText, { color: STATUS_COLOR[request.status] }]}>{STATUS_LABEL[request.status]}</Text>
            </View>
          </View>
          <Text style={styles.issue}>{request.issue}</Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="rgba(255,255,255,0.4)" />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.body}>
          <Text style={styles.instructions}>{request.instructions}</Text>
          {request.partner_comment && (
            <Text style={styles.priorComment}>Your note: "{request.partner_comment}"</Text>
          )}

          {!isDone && (
            <>
              {request.field_key && isDocument && (
                <TouchableOpacity style={styles.actionBtn} onPress={handleUploadReplacement} disabled={busy}>
                  <Ionicons name="camera" size={16} color="#8CC63F" />
                  <Text style={styles.actionText}>Upload Replacement Photo</Text>
                </TouchableOpacity>
              )}

              {request.field_key && !isDocument && (
                <View style={styles.fieldEditRow}>
                  <TextInput
                    value={fieldValue}
                    onChangeText={setFieldValue}
                    placeholder={`Update: ${request.field_key}`}
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    style={styles.input}
                  />
                  <TouchableOpacity style={styles.saveBtn} onPress={handleSaveField} disabled={busy || !fieldValue.trim()}>
                    <Text style={styles.saveBtnText}>Save</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.fieldEditRow}>
                <TextInput
                  value={comment}
                  onChangeText={setComment}
                  placeholder="Add a comment or explanation…"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  style={styles.input}
                />
                <TouchableOpacity style={styles.saveBtn} onPress={handleAddComment} disabled={busy || !comment.trim()}>
                  {busy ? <ActivityIndicator size="small" color="#8CC63F" /> : <Text style={styles.saveBtnText}>Send</Text>}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, borderWidth: 1, marginBottom: 10, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  badgeRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  issue: { color: '#fff', fontSize: 14, fontWeight: '600' },
  body: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  instructions: { color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 18 },
  priorComment: { color: 'rgba(255,255,255,0.45)', fontSize: 12, fontStyle: 'italic' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(140,198,63,0.12)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, alignSelf: 'flex-start' },
  actionText: { color: '#8CC63F', fontSize: 13, fontWeight: '600' },
  fieldEditRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', color: '#fff', paddingHorizontal: 12, paddingVertical: 9, fontSize: 13 },
  saveBtn: { backgroundColor: 'rgba(140,198,63,0.15)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  saveBtnText: { color: '#8CC63F', fontSize: 13, fontWeight: '700' },
});
