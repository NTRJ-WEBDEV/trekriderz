import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

const KEY = 'app_open_count';
const PROMPTED_KEY = 'review_prompted';
const THRESHOLD = 5;

export async function maybeRequestReview() {
  try {
    const prompted = await AsyncStorage.getItem(PROMPTED_KEY);
    if (prompted) return;

    const raw = await AsyncStorage.getItem(KEY);
    const count = raw ? parseInt(raw) + 1 : 1;
    await AsyncStorage.setItem(KEY, String(count));

    if (count >= THRESHOLD && await StoreReview.isAvailableAsync()) {
      await StoreReview.requestReview();
      await AsyncStorage.setItem(PROMPTED_KEY, '1');
    }
  } catch {}
}
