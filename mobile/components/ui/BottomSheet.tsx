import React from 'react';
import { Modal, View, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { AppColors, Radius, Spacing } from '@/constants/theme';

// One shared sheet chrome (backdrop, drag handle, rounded top, slide-up
// animation) instead of every sheet (Edit Caption, Report, Share, ...)
// rebuilding its own Modal + overlay styling independently.
interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  avoidKeyboard?: boolean;
}

export default function BottomSheet({ visible, onClose, children, avoidKeyboard }: BottomSheetProps) {
  const content = (
    <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
      <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={(e) => e.stopPropagation()}>
        <View style={styles.handle} />
        {children}
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {avoidKeyboard ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          {content}
        </KeyboardAvoidingView>
      ) : content}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: AppColors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
});
