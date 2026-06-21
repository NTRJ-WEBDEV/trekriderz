import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

export async function shareTripItinerary(trip: any) {
  try {
    const itinerary = trip.itinerary;
    let shareText = `🌍 TREKRIDERZ: ${trip.title.toUpperCase()}\n`;
    shareText += `📍 Destination: ${trip.destination}\n`;
    shareText += `📅 Dates: ${trip.start_date} to ${trip.end_date}\n\n`;
    
    shareText += `📝 ITINERARY:\n`;
    
    if (itinerary?.days) {
      itinerary.days.forEach((day: any, idx: number) => {
        shareText += `\nDAY ${idx + 1}:\n`;
        day.activities.forEach((act: any) => {
          shareText += `• ${act.time || ''} ${act.title}: ${act.description}\n`;
        });
      });
    } else {
      shareText += `Plan is currently being generated...\n`;
    }

    shareText += `\n🎒 PACKING LIST:\n`;
    (trip.packing_list || []).forEach((item: any) => {
      shareText += `• ${item}\n`;
    });

    shareText += `\n🚀 Planned with TrekRiderz App`;

    // 1. Save to temporary text file
    const cacheDir = (FileSystem as any).cacheDirectory || '/tmp/';
    const fileUri = `${cacheDir}${trip.id}_itinerary.txt`;
    if (!fileUri.startsWith('file://')) {
      // Use document directory as fallback
      const fileUri2 = `file:///data/local/tmp/${trip.id}_itinerary.txt`;
      try {
        await FileSystem.writeAsStringAsync(fileUri2, shareText);
        
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri2, {
            mimeType: 'text/plain',
            dialogTitle: `${trip.title} - Trip Itinerary`,
            UTI: 'public.plain-text',
          });
        }
        return;
      } catch (fallbackError) {
        console.error('Fallback share failed', fallbackError);
      }
    }
    
    await FileSystem.writeAsStringAsync(fileUri, shareText);

    // 2. Share
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/plain',
        dialogTitle: `${trip.title} - Trip Itinerary`,
        UTI: 'public.plain-text',
      });
    } else {
      console.log('Sharing not available, copying to clipboard instead?');
      // Clipboard could be fallback
    }
  } catch (error) {
    console.error('Export error:', error);
  }
}
