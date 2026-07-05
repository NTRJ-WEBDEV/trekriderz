import { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  Linking, Alert, TextInput, ScrollView, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { haptic } from '@/lib/haptics';

const CONTACTS_KEY = 'sos_emergency_contacts';

interface Contact {
  name: string;
  phone: string;
}

interface Props {
  tripName?: string;
  location?: string;
}

export default function SOSButton({ tripName, location }: Props) {
  const [showPanel, setShowPanel] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const loadContacts = async () => {
    try {
      const raw = await AsyncStorage.getItem(CONTACTS_KEY);
      if (raw) setContacts(JSON.parse(raw));
    } catch {}
  };

  const saveContacts = async (list: Contact[]) => {
    await AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(list));
    setContacts(list);
  };

  const addContact = () => {
    if (!newName.trim() || !newPhone.trim()) return;
    const updated = [...contacts, { name: newName.trim(), phone: newPhone.trim() }];
    saveContacts(updated);
    setNewName('');
    setNewPhone('');
  };

  const removeContact = (i: number) => {
    const updated = contacts.filter((_, idx) => idx !== i);
    saveContacts(updated);
  };

  const triggerSOS = async () => {
    haptic.error();
    const msg = `🆘 SOS from TrekRiderz!\nI need help${tripName ? ` on trek: ${tripName}` : ''}${location ? `\nLocation: ${location}` : ''}.\nPlease call me or contact rescue services immediately.`;

    Alert.alert(
      '🆘 Send SOS',
      contacts.length
        ? `This will call your first emergency contact (${contacts[0].name}) and open WhatsApp for others.`
        : 'No emergency contacts saved. Add contacts first, or call emergency services directly.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: contacts.length ? `Call ${contacts[0].name}` : 'Call 112',
          style: 'destructive',
          onPress: () => {
            const num = contacts.length ? contacts[0].phone : '112';
            Linking.openURL(`tel:${num}`);
            contacts.slice(1).forEach((c) => {
              setTimeout(() => {
                // Contact numbers are stored with their own country code (e.g. "+977...");
                // strip non-digits rather than hardcoding India's "91" prefix.
                const digits = c.phone.replace(/[^\d]/g, '');
                Linking.openURL(`whatsapp://send?phone=${digits}&text=${encodeURIComponent(msg)}`);
              }, 1500);
            });
          },
        },
      ]
    );
  };

  const openPanel = () => {
    haptic.medium();
    loadContacts();
    setShowPanel(true);
  };

  return (
    <>
      <TouchableOpacity style={styles.sosBtn} onLongPress={triggerSOS} onPress={openPanel} activeOpacity={0.85}>
        <Ionicons name="alert-circle" size={18} color="#FFF" />
        <Text style={styles.sosBtnText}>SOS</Text>
      </TouchableOpacity>

      <Modal visible={showPanel} animationType="slide" transparent onRequestClose={() => setShowPanel(false)}>
        <View style={styles.overlay}>
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Safety & Emergency</Text>
              <TouchableOpacity onPress={() => setShowPanel(false)}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>

            {/* Emergency numbers */}
            <View style={styles.emergencyRow}>
              {[
                { label: 'Police', num: '100', icon: 'shield' },
                { label: 'Ambulance', num: '108', icon: 'medical' },
                { label: 'Mountain\nRescue', num: '1800-180-1234', icon: 'flag' },
              ].map((e) => (
                <TouchableOpacity
                  key={e.num}
                  style={styles.emergencyCard}
                  onPress={() => { haptic.medium(); Linking.openURL(`tel:${e.num}`); }}
                >
                  <Ionicons name={e.icon as any} size={20} color="#EF4444" />
                  <Text style={styles.emergencyNum}>{e.num}</Text>
                  <Text style={styles.emergencyLabel}>{e.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* SOS trigger */}
            <TouchableOpacity style={styles.bigSOS} onPress={triggerSOS}>
              <Ionicons name="alert-circle" size={28} color="#FFF" />
              <View>
                <Text style={styles.bigSOSTitle}>SEND SOS ALERT</Text>
                <Text style={styles.bigSOSSub}>Calls first contact + WhatsApp alerts all</Text>
              </View>
            </TouchableOpacity>

            {/* Emergency contacts */}
            <View style={styles.contactsSection}>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>Emergency Contacts</Text>
                <TouchableOpacity onPress={() => setEditMode(!editMode)}>
                  <Text style={styles.editLink}>{editMode ? 'Done' : 'Edit'}</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 160 }}>
                {contacts.length === 0 && (
                  <Text style={styles.noContacts}>No contacts saved. Add someone who should be alerted in an emergency.</Text>
                )}
                {contacts.map((c, i) => (
                  <View key={i} style={styles.contactRow}>
                    <View style={styles.contactAvatar}>
                      <Text style={styles.contactInitial}>{c.name[0]?.toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.contactName}>{c.name}</Text>
                      <Text style={styles.contactPhone}>{c.phone}</Text>
                    </View>
                    {editMode ? (
                      <TouchableOpacity onPress={() => removeContact(i)}>
                        <Ionicons name="trash-outline" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity onPress={() => Linking.openURL(`tel:${c.phone}`)}>
                        <Ionicons name="call-outline" size={18} color="#8CC63F" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </ScrollView>

              {contacts.length < 5 && (
                <View style={styles.addRow}>
                  <TextInput
                    style={styles.addInput}
                    placeholder="Name"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={newName}
                    onChangeText={setNewName}
                  />
                  <TextInput
                    style={styles.addInput}
                    placeholder="+91 98765 43210"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    keyboardType="phone-pad"
                    value={newPhone}
                    onChangeText={setNewPhone}
                  />
                  <TouchableOpacity style={styles.addBtn} onPress={addContact}>
                    <Ionicons name="add" size={20} color="#080C14" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  sosBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#EF4444', paddingHorizontal: 14,
    paddingVertical: 8, borderRadius: 20,
    shadowColor: '#EF4444', shadowOpacity: 0.4, shadowRadius: 8, elevation: 4,
  },
  sosBtnText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  panel: {
    backgroundColor: '#0F1724',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 40,
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  panelTitle: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  emergencyRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  emergencyCard: {
    flex: 1, backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 14, padding: 14, alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
  },
  emergencyNum: { fontSize: 15, fontWeight: '800', color: '#EF4444' },
  emergencyLabel: { fontSize: 10, color: 'rgba(255,255,255,0.5)', textAlign: 'center' },
  bigSOS: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#EF4444', borderRadius: 16,
    padding: 18, marginBottom: 20,
  },
  bigSOSTitle: { fontSize: 16, fontWeight: '900', color: '#FFF', letterSpacing: 1 },
  bigSOSSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  contactsSection: { gap: 12 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  editLink: { fontSize: 13, color: '#8CC63F', fontWeight: '600' },
  noContacts: { fontSize: 12, color: 'rgba(255,255,255,0.3)', lineHeight: 17 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  contactAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(140,198,63,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  contactInitial: { color: '#8CC63F', fontWeight: '800', fontSize: 15 },
  contactName: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  contactPhone: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 1 },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  addInput: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    color: '#FFF', fontSize: 13,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  addBtn: {
    width: 42, height: 42, borderRadius: 10,
    backgroundColor: '#8CC63F', alignItems: 'center', justifyContent: 'center',
  },
});
