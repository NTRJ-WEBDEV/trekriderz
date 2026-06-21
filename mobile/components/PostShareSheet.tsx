import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';

interface PostShareSheetProps {
  postId: string;
  content: string;
  onClose: () => void;
}

export default function PostShareSheet({ postId, content, onClose }: PostShareSheetProps) {
  const shareUrl = `https://trekriderz.app/post/${postId}`;

  const onShare = async () => {
    try {
      const result = await Share.share({
        message: `${content}\n\nCheck out this post on TrekRiderz: ${shareUrl}`,
        url: shareUrl,
        title: 'TrekRiderz Post',
      });
      if (result.action === Share.sharedAction) {
        onClose();
      }
    } catch (error: any) {
      Alert.alert(error.message);
    }
  };

  const copyLink = async () => {
    await Clipboard.setStringAsync(shareUrl);
    Alert.alert('Link Copied!', 'The link to this post has been copied to your clipboard.');
    onClose();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Share Post</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={24} color="#000" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.options}>
        <TouchableOpacity style={styles.option} onPress={onShare}>
          <View style={[styles.iconContainer, { backgroundColor: '#E1F5FE' }]}>
            <Ionicons name="share-social-outline" size={24} color="#0288D1" />
          </View>
          <Text style={styles.optionText}>Share via...</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.option} onPress={copyLink}>
          <View style={[styles.iconContainer, { backgroundColor: '#F3E5F5' }]}>
            <Ionicons name="copy-outline" size={24} color="#7B1FA2" />
          </View>
          <Text style={styles.optionText}>Copy Link</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    minHeight: 250,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  options: {
    flexDirection: 'row',
    gap: 30,
  },
  option: {
    alignItems: 'center',
    gap: 8,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
});
