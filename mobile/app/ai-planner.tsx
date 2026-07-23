import { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Dimensions, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { haptic } from '@/lib/haptics';
import { AppColors } from '@/constants/theme';

const { width } = Dimensions.get('window');
const GREEN = AppColors.primary;
const BG = AppColors.background;

const TRIP_TYPES = [
  { id: 'trek',       emoji: '🏔️', label: 'Trek',          desc: 'Mountain & trail adventure' },
  { id: 'weekend',    emoji: '🌄', label: 'Weekend',       desc: 'Quick relaxing getaway' },
  { id: 'birthday',   emoji: '🎂', label: 'Birthday',      desc: 'Celebrate in the mountains' },
  { id: 'anniversary',emoji: '💑', label: 'Anniversary',   desc: 'Romantic mountain escape' },
  { id: 'honeymoon',  emoji: '🥂', label: 'Honeymoon',     desc: 'Private & romantic' },
  { id: 'women_solo', emoji: '👩‍🦯', label: 'Solo Women',   desc: 'Women guides · Safe · Empowering' },
  { id: 'spiritual',  emoji: '🛕', label: 'Spiritual',     desc: 'Temples, ghats & meditation' },
  { id: 'wildlife',   emoji: '🦁', label: 'Wildlife',      desc: 'Safari & forest stays' },
  { id: 'bike',       emoji: '🏍️', label: 'Bike Tour',     desc: 'Mountain highway rides' },
  { id: 'photography',emoji: '📸', label: 'Photography',   desc: 'Golden hour & landscapes' },
] as const;

const DURATIONS = [2, 3, 5, 7, 10, 14];

const BUDGETS = [
  { id: 'budget',    label: 'Budget',   sub: 'Under ₹10,000/person' },
  { id: 'standard',  label: 'Standard', sub: '₹10,000 – ₹25,000' },
  { id: 'premium',   label: 'Premium',  sub: '₹25,000 – ₹50,000' },
  { id: 'luxury',    label: 'Luxury',   sub: '₹50,000+' },
];

const FITNESS = ['Easy', 'Moderate', 'Challenging'];

type TripType = typeof TRIP_TYPES[number]['id'];

interface PlanResult {
  title: string;
  tagline: string;
  highlights: string[];
  difficulty: string;
  best_season: string;
  itinerary: Array<{
    day: number; title: string; description: string;
    activities: string[]; accommodation: string; meals: string; tip: string;
  }>;
  recommended_guide: { id: string | null; name: string; reason: string };
  recommended_homestay: { id: string | null; name: string; reason: string };
  budget_breakdown: Record<string, number>;
  packing_essentials: string[];
  special_touches: string;
  trekriderz_promise: string;
}

const BUDGET_LABELS: Record<string, string> = {
  guide_fee: 'Guide Fee', accommodation: 'Accommodation',
  transport: 'Transport', meals: 'Meals',
  permits_entry: 'Permits / Entry', activities: 'Activities',
  miscellaneous: 'Miscellaneous', total_per_person: 'TOTAL / PERSON',
};

export default function AIPlannerScreen() {
  const { user } = useAuthStore();
  const scrollRef = useRef<ScrollView>(null);

  const [tripType, setTripType] = useState<TripType>('trek');
  const [destination, setDestination] = useState('');
  const [duration, setDuration] = useState(5);
  const [groupSize, setGroupSize] = useState(2);
  const [budget, setBudget] = useState('standard');
  const [fitness, setFitness] = useState('Moderate');
  const [specialNotes, setSpecialNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PlanResult | null>(null);
  const [guideData, setGuideData] = useState<any>(null);
  const [homestayData, setHomestayData] = useState<any>(null);

  const [expandedDay, setExpandedDay] = useState<number | null>(1);

  const selectedType = TRIP_TYPES.find((t) => t.id === tripType)!;
  const isTrek = ['trek', 'bike', 'women_solo'].includes(tripType);

  const fetchInventory = async () => {
    const dest = destination.toLowerCase();
    const [guidesRes, homestaysRes, packagesRes] = await Promise.all([
      supabase
        .from('guides')
        .select('id, name, specialties, regions, rate_per_day, rating, is_premium, photo_url, bio')
        .eq('status', 'approved')
        .limit(10),
      supabase
        .from('properties')
        .select('id, name, city, state, location_name, amenities, photos, room_types(base_price)')
        .eq('status', 'approved')
        .or(`city.ilike.%${dest}%,state.ilike.%${dest}%,location_name.ilike.%${dest}%`)
        .limit(8),
      supabase
        .from('guided_expeditions')
        .select('id, title, destination, difficulty')
        .eq('status', 'published')
        .ilike('destination', `%${dest}%`)
        .limit(5),
    ]);

    // filter guides by region loosely
    const guides = (guidesRes.data || []).filter((g) => {
      const regions = (g.regions || []).join(' ').toLowerCase();
      return regions.includes(dest) || dest.length < 4;
    });

    const homestays = (homestaysRes.data || []).map((p: any) => {
      const basePrices = (p.room_types || []).map((r: any) => r.base_price).filter((v: any) => typeof v === 'number');
      return {
        id: p.id,
        name: p.name,
        location: [p.city, p.state].filter(Boolean).join(', ') || p.location_name,
        price_per_night: basePrices.length > 0 ? Math.min(...basePrices) : undefined,
        amenities: p.amenities,
        photos: p.photos,
      };
    });

    return {
      guides: guides.length > 0 ? guides : (guidesRes.data || []).slice(0, 6),
      homestays,
      packages: packagesRes.data || [],
    };
  };

  const handleGenerate = async () => {
    if (!destination.trim()) {
      Alert.alert('Missing Destination', 'Please enter a destination or region to plan your trip.');
      return;
    }
    haptic.medium();
    setLoading(true);
    setResult(null);
    try {
      const { guides, homestays, packages } = await fetchInventory();
      const webUrl = process.env.EXPO_PUBLIC_WEB_API_URL || 'https://trekriderz.com';

      const res = await fetch(`${webUrl}/api/ai-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination: destination.trim(),
          tripType,
          duration,
          groupSize,
          budget: BUDGETS.find((b) => b.id === budget)?.sub ?? budget,
          fitnessLevel: isTrek ? fitness : undefined,
          specialNotes: specialNotes.trim() || undefined,
          guides,
          homestays,
          packages,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'Failed to generate plan');

      setResult(json.plan);
      // persist guide/homestay objects for card display
      const matchedGuide = guides.find((g: any) => g.id === json.plan.recommended_guide?.id);
      const matchedHomestay = homestays.find((h: any) => h.id === json.plan.recommended_homestay?.id);
      setGuideData(matchedGuide || null);
      setHomestayData(matchedHomestay || null);

      haptic.success();
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
    } catch (err: any) {
      haptic.error();
      Alert.alert('Could not generate plan', err.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTrip = async () => {
    if (!user || !result) return;
    haptic.medium();
    try {
      const { data, error } = await supabase.from('trips').insert({
        created_by: user.id,
        title: result.title,
        destination: destination.trim(),
        trip_type: tripType,
        status: 'planning',
        itinerary: result.itinerary,
        packing_list: result.packing_essentials,
        notes: result.special_touches,
        group_size: groupSize,
        // The AI plan always computes a per-person total — save it as such
        // rather than converting, so nothing here has to divide/multiply
        // and risk the same double-counting bug this budget_type column
        // exists to prevent elsewhere.
        budget: Math.round(result.budget_breakdown?.total_per_person ?? 0) || null,
        budget_type: 'per_person',
      }).select('id').single();

      if (error) throw error;
      haptic.success();
      Alert.alert('Trip Saved!', `"${result.title}" is now in your trips.`, [
        { text: 'View Trip', onPress: () => router.push(`/trip/${data.id}` as any) },
        { text: 'Stay Here', style: 'cancel' },
      ]);
    } catch (err: any) {
      Alert.alert('Error', 'Could not save trip: ' + err.message);
    }
  };

  const handleBookWhatsApp = () => {
    const msg = encodeURIComponent(
      `Hi TrekRiderz! I'd like to book this trip:\n\n🏔️ ${result?.title}\n📍 ${destination}\n👥 ${groupSize} people\n📅 ${duration} days\n💰 ${BUDGETS.find((b) => b.id === budget)?.sub}\n\nType: ${selectedType.label}${specialNotes ? `\nNotes: ${specialNotes}` : ''}\n\nPlease help me organise this!`
    );
    import('react-native').then(({ Linking }) => {
      Linking.openURL(`whatsapp://send?phone=${process.env.EXPO_PUBLIC_BUSINESS_WHATSAPP || '919999999999'}&text=${msg}`);
    });
  };

  return (
    <View style={s.container}>
      <LinearGradient
        colors={['rgba(140,198,63,0.15)', '#080C14']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.35 }}
      />

      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <View style={s.titleRow}>
              <Ionicons name="sparkles" size={18} color={GREEN} />
              <Text style={s.headerTitle}>AI Trip Planner</Text>
            </View>
            <Text style={s.headerSub}>Customised by TrekRiderz, powered by AI</Text>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── FORM ── */}
          {/* Trip Type */}
          <Text style={s.label}>What kind of trip?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.typeScroll}>
            <View style={s.typeRow}>
              {TRIP_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[s.typeCard, tripType === t.id && s.typeCardActive]}
                  onPress={() => { haptic.select(); setTripType(t.id); }}
                >
                  <Text style={s.typeEmoji}>{t.emoji}</Text>
                  <Text style={[s.typeLabel, tripType === t.id && s.typeLabelActive]}>{t.label}</Text>
                  {t.id === 'women_solo' && (
                    <View style={s.womenBadge}>
                      <Text style={s.womenBadgeText}>Women Guides</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Destination */}
          <Text style={s.label}>Destination or Region</Text>
          <View style={s.inputRow}>
            <Ionicons name="location-outline" size={18} color={GREEN} />
            <TextInput
              style={s.input}
              placeholder="e.g. Kedarnath, Spiti Valley, Coorg, Kerala..."
              placeholderTextColor="rgba(255,255,255,0.25)"
              value={destination}
              onChangeText={setDestination}
            />
          </View>

          {/* Duration */}
          <Text style={s.label}>Duration</Text>
          <View style={s.chipRow}>
            {DURATIONS.map((d) => (
              <TouchableOpacity
                key={d}
                style={[s.chip, duration === d && s.chipActive]}
                onPress={() => { haptic.select(); setDuration(d); }}
              >
                <Text style={[s.chipText, duration === d && s.chipTextActive]}>{d}D</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Group Size */}
          <Text style={s.label}>Group Size</Text>
          <View style={s.counterRow}>
            <TouchableOpacity
              style={s.counterBtn}
              onPress={() => { if (groupSize > 1) { haptic.select(); setGroupSize(g => g - 1); } }}
            >
              <Ionicons name="remove" size={20} color="#FFF" />
            </TouchableOpacity>
            <Text style={s.counterVal}>{groupSize} {groupSize === 1 ? 'person' : 'people'}</Text>
            <TouchableOpacity
              style={s.counterBtn}
              onPress={() => { if (groupSize < 30) { haptic.select(); setGroupSize(g => g + 1); } }}
            >
              <Ionicons name="add" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Budget */}
          <Text style={s.label}>Budget</Text>
          <View style={s.budgetGrid}>
            {BUDGETS.map((b) => (
              <TouchableOpacity
                key={b.id}
                style={[s.budgetCard, budget === b.id && s.budgetCardActive]}
                onPress={() => { haptic.select(); setBudget(b.id); }}
              >
                <Text style={[s.budgetLabel, budget === b.id && s.budgetLabelActive]}>{b.label}</Text>
                <Text style={[s.budgetSub, budget === b.id && { color: GREEN }]}>{b.sub}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Fitness (treks only) */}
          {isTrek && (
            <>
              <Text style={s.label}>Fitness Level</Text>
              <View style={s.chipRow}>
                {FITNESS.map((f) => (
                  <TouchableOpacity
                    key={f}
                    style={[s.chip, fitness === f && s.chipActive]}
                    onPress={() => { haptic.select(); setFitness(f); }}
                  >
                    <Text style={[s.chipText, fitness === f && s.chipTextActive]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Special Notes */}
          <Text style={s.label}>Special Requests <Text style={s.optional}>(optional)</Text></Text>
          <TextInput
            style={s.notesInput}
            placeholder={
              tripType === 'birthday' ? 'e.g. surprise decoration for the birthday girl, vegetarian food...' :
              tripType === 'anniversary' ? 'e.g. rose petals, candlelight dinner, couple massage...' :
              tripType === 'women_solo' ? 'e.g. solo traveler, need women guide, prefer group start...' :
              'Any specific requirements, dietary needs, interests...'
            }
            placeholderTextColor="rgba(255,255,255,0.2)"
            value={specialNotes}
            onChangeText={setSpecialNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          {/* Women Solo Info Banner */}
          {tripType === 'women_solo' && (
            <View style={s.womenBanner}>
              <Ionicons name="shield-checkmark" size={18} color="#FF69B4" />
              <Text style={s.womenBannerText}>
                TrekRiderz has verified women local guides across India — from Himachal to Kerala. Your safety and comfort are our priority.
              </Text>
            </View>
          )}

          {/* Generate Button */}
          <TouchableOpacity
            style={[s.generateBtn, loading && s.generateBtnDisabled]}
            onPress={handleGenerate}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="sparkles" size={18} color="#FFF" />
                <Text style={s.generateBtnText}>Plan My {selectedType.label} Trip</Text>
              </>
            )}
          </TouchableOpacity>

          {loading && (
            <View style={s.loadingCard}>
              <ActivityIndicator color={GREEN} size="large" />
              <Text style={s.loadingTitle}>Personalising your trip...</Text>
              <Text style={s.loadingText}>
                Matching verified guides · Finding best homestays · Building your itinerary
              </Text>
            </View>
          )}

          {/* ── RESULT ── */}
          {result && <PlanResult
            plan={result}
            guide={guideData}
            homestay={homestayData}
            expandedDay={expandedDay}
            setExpandedDay={setExpandedDay}
            onSave={handleSaveTrip}
            onBook={handleBookWhatsApp}
          />}

          <View style={{ height: 60 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Result Component ──────────────────────────────────────────────────────────

function PlanResult({ plan, guide, homestay, expandedDay, setExpandedDay, onSave, onBook }: {
  plan: PlanResult;
  guide: any;
  homestay: any;
  expandedDay: number | null;
  setExpandedDay: (d: number | null) => void;
  onSave: () => void;
  onBook: () => void;
}) {
  const totalBudget = plan.budget_breakdown.total_per_person;

  return (
    <View style={s.resultWrap}>
      {/* Divider */}
      <View style={s.divider}>
        <View style={s.dividerLine} />
        <Ionicons name="sparkles" size={16} color={GREEN} style={{ marginHorizontal: 10 }} />
        <View style={s.dividerLine} />
      </View>

      {/* Hero */}
      <LinearGradient
        colors={['rgba(140,198,63,0.12)', 'rgba(140,198,63,0.04)']}
        style={s.heroCard}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        <Text style={s.heroTitle}>{plan.title}</Text>
        <Text style={s.heroTagline}>{plan.tagline}</Text>
        <View style={s.heroBadges}>
          {plan.difficulty && (
            <View style={s.heroBadge}>
              <Ionicons name="fitness-outline" size={12} color={GREEN} />
              <Text style={s.heroBadgeText}>{plan.difficulty}</Text>
            </View>
          )}
          {plan.best_season && (
            <View style={s.heroBadge}>
              <Ionicons name="calendar-outline" size={12} color={GREEN} />
              <Text style={s.heroBadgeText}>{plan.best_season}</Text>
            </View>
          )}
          {totalBudget > 0 && (
            <View style={[s.heroBadge, { backgroundColor: 'rgba(140,198,63,0.18)' }]}>
              <Text style={[s.heroBadgeText, { color: GREEN, fontWeight: '800' }]}>₹{totalBudget.toLocaleString('en-IN')}/person</Text>
            </View>
          )}
        </View>
      </LinearGradient>

      {/* Highlights */}
      {plan.highlights?.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Trip Highlights</Text>
          <View style={s.highlightRow}>
            {plan.highlights.map((h, i) => (
              <View key={i} style={s.highlightChip}>
                <Text style={s.highlightText}>✦ {h}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Itinerary */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Day-by-Day Itinerary</Text>
        {plan.itinerary.map((day) => (
          <TouchableOpacity
            key={day.day}
            style={s.dayCard}
            onPress={() => setExpandedDay(expandedDay === day.day ? null : day.day)}
            activeOpacity={0.85}
          >
            <View style={s.dayHeader}>
              <View style={s.dayNum}>
                <Text style={s.dayNumText}>D{day.day}</Text>
              </View>
              <Text style={s.dayTitle} numberOfLines={expandedDay !== day.day ? 1 : 5}>{day.title}</Text>
              <Ionicons
                name={expandedDay === day.day ? 'chevron-up' : 'chevron-down'}
                size={16} color="rgba(255,255,255,0.35)"
              />
            </View>
            {expandedDay === day.day && (
              <View style={s.dayBody}>
                <Text style={s.dayDesc}>{day.description}</Text>
                {day.activities?.length > 0 && (
                  <View style={s.dayActivities}>
                    {day.activities.map((act, i) => (
                      <View key={i} style={s.actRow}>
                        <View style={s.actDot} />
                        <Text style={s.actText}>{act}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {day.accommodation && (
                  <View style={s.dayMeta}>
                    <Ionicons name="bed-outline" size={13} color={GREEN} />
                    <Text style={s.dayMetaText}>{day.accommodation}</Text>
                  </View>
                )}
                {day.meals && (
                  <View style={s.dayMeta}>
                    <Ionicons name="restaurant-outline" size={13} color={GREEN} />
                    <Text style={s.dayMetaText}>{day.meals}</Text>
                  </View>
                )}
                {day.tip && (
                  <View style={s.tipBox}>
                    <Text style={s.tipText}>💡 {day.tip}</Text>
                  </View>
                )}
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Our Pick: Guide */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Our Pick · Guide</Text>
        <TouchableOpacity
          style={s.pickCard}
          onPress={() => guide?.id && router.push(`/guide/${guide.id}` as any)}
          activeOpacity={guide?.id ? 0.85 : 1}
        >
          {guide?.photo_url ? (
            <Image source={{ uri: guide.photo_url }} style={s.pickAvatar} contentFit="cover" />
          ) : (
            <View style={[s.pickAvatar, s.pickAvatarFallback]}>
              <Ionicons name="person-outline" size={26} color="rgba(255,255,255,0.3)" />
            </View>
          )}
          <View style={s.pickInfo}>
            <View style={s.pickNameRow}>
              <Text style={s.pickName}>{plan.recommended_guide.name}</Text>
              {guide?.is_premium && <View style={s.proBadge}><Text style={s.proBadgeText}>PRO</Text></View>}
            </View>
            <Text style={s.pickReason}>{plan.recommended_guide.reason}</Text>
            {guide?.id && (
              <Text style={s.pickCta}>View full profile →</Text>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Our Pick: Homestay */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Our Pick · Homestay</Text>
        <TouchableOpacity
          style={s.pickCard}
          onPress={() => homestay?.id && router.push(`/homestay/${homestay.id}` as any)}
          activeOpacity={homestay?.id ? 0.85 : 1}
        >
          {homestay?.photos?.[0] ? (
            <Image source={{ uri: homestay.photos[0] }} style={s.pickAvatar} contentFit="cover" />
          ) : (
            <View style={[s.pickAvatar, s.pickAvatarFallback]}>
              <Ionicons name="home-outline" size={26} color="rgba(255,255,255,0.3)" />
            </View>
          )}
          <View style={s.pickInfo}>
            <View style={s.pickNameRow}>
              <Text style={s.pickName}>{plan.recommended_homestay.name}</Text>
              {homestay?.price_per_night && (
                <Text style={s.pickPrice}>₹{homestay.price_per_night.toLocaleString('en-IN')}/night</Text>
              )}
            </View>
            <Text style={s.pickReason}>{plan.recommended_homestay.reason}</Text>
            {homestay?.id && (
              <Text style={s.pickCta}>View details →</Text>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Budget Breakdown */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Budget Breakdown</Text>
        <View style={s.budgetBreakdown}>
          {Object.entries(plan.budget_breakdown)
            .filter(([k]) => k !== 'total_per_person')
            .map(([k, v]) => v > 0 ? (
              <View key={k} style={s.budgetRow}>
                <Text style={s.budgetRowLabel}>{BUDGET_LABELS[k] ?? k}</Text>
                <Text style={s.budgetRowVal}>₹{Number(v).toLocaleString('en-IN')}</Text>
              </View>
            ) : null)}
          <View style={s.budgetDivider} />
          <View style={s.budgetRow}>
            <Text style={[s.budgetRowLabel, { color: GREEN, fontWeight: '800' }]}>TOTAL / PERSON</Text>
            <Text style={[s.budgetRowVal, { color: GREEN, fontSize: 17, fontWeight: '900' }]}>
              ₹{Number(plan.budget_breakdown.total_per_person).toLocaleString('en-IN')}
            </Text>
          </View>
        </View>
      </View>

      {/* Packing */}
      {plan.packing_essentials?.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Packing Essentials</Text>
          <View style={s.packingRow}>
            {plan.packing_essentials.map((item, i) => (
              <View key={i} style={s.packingChip}>
                <Ionicons name="checkmark" size={12} color={GREEN} />
                <Text style={s.packingText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Special Touches */}
      {plan.special_touches && (
        <View style={s.specialBox}>
          <View style={s.specialHeader}>
            <Ionicons name="heart" size={16} color="#FF69B4" />
            <Text style={s.specialTitle}>TrekRiderz Special Touch</Text>
          </View>
          <Text style={s.specialText}>{plan.special_touches}</Text>
        </View>
      )}

      {/* Promise */}
      {plan.trekriderz_promise && (
        <View style={s.promiseBox}>
          <Ionicons name="shield-checkmark" size={16} color={GREEN} />
          <Text style={s.promiseText}>{plan.trekriderz_promise}</Text>
        </View>
      )}

      {/* CTAs */}
      <TouchableOpacity style={s.saveBtn} onPress={onSave} activeOpacity={0.85}>
        <Ionicons name="bookmark-outline" size={18} color="#FFF" />
        <Text style={s.saveBtnText}>Save as My Trip</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.bookBtn} onPress={onBook} activeOpacity={0.85}>
        <Ionicons name="logo-whatsapp" size={18} color="#FFF" />
        <Text style={s.bookBtnText}>Book This Trip with TrekRiderz</Text>
      </TouchableOpacity>

      <Text style={s.bottomNote}>
        Our team will personalise every detail and confirm within 24 hours.
      </Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#FFF' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 },

  content: { paddingHorizontal: 16, paddingBottom: 40 },

  label: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.7)', marginTop: 20, marginBottom: 10 },
  optional: { fontWeight: '400', color: 'rgba(255,255,255,0.3)' },

  typeScroll: { marginHorizontal: -16 },
  typeRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 4 },
  typeCard: {
    alignItems: 'center', gap: 6, padding: 14,
    borderRadius: 16, borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    minWidth: 90,
  },
  typeCardActive: { borderColor: GREEN, backgroundColor: GREEN + '18' },
  typeEmoji: { fontSize: 28 },
  typeLabel: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.55)' },
  typeLabelActive: { color: GREEN },
  womenBadge: {
    backgroundColor: 'rgba(255,105,180,0.2)', borderRadius: 6,
    paddingHorizontal: 5, paddingVertical: 2, marginTop: 2,
  },
  womenBadgeText: { fontSize: 8, color: '#FF69B4', fontWeight: '800' },

  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
  },
  input: { flex: 1, color: '#FFF', fontSize: 15 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  chipActive: { borderColor: GREEN, backgroundColor: GREEN + '18' },
  chipText: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
  chipTextActive: { color: GREEN },

  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  counterBtn: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  counterVal: { fontSize: 18, fontWeight: '700', color: '#FFF', minWidth: 100, textAlign: 'center' },

  budgetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  budgetCard: {
    width: (width - 42) / 2,
    padding: 14, borderRadius: 14,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  budgetCardActive: { borderColor: GREEN, backgroundColor: GREEN + '12' },
  budgetLabel: { fontSize: 14, fontWeight: '800', color: 'rgba(255,255,255,0.6)', marginBottom: 3 },
  budgetLabelActive: { color: GREEN },
  budgetSub: { fontSize: 11, color: 'rgba(255,255,255,0.35)' },

  notesInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14, padding: 14, color: '#FFF', fontSize: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
    minHeight: 80,
  },

  womenBanner: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: 'rgba(255,105,180,0.1)',
    borderRadius: 14, padding: 14, marginTop: 12,
    borderWidth: 1, borderColor: 'rgba(255,105,180,0.25)',
  },
  womenBannerText: { flex: 1, color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 18 },

  generateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: GREEN, borderRadius: 16, paddingVertical: 18, marginTop: 24,
  },
  generateBtnDisabled: { opacity: 0.6 },
  generateBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },

  loadingCard: {
    alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16, padding: 28, marginTop: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  loadingTitle: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  loadingText: { fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 18 },

  // Result
  resultWrap: { marginTop: 8 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 28 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },

  heroCard: { borderRadius: 20, padding: 20, marginBottom: 4, borderWidth: 1, borderColor: GREEN + '30' },
  heroTitle: { fontSize: 22, fontWeight: '900', color: '#FFF', marginBottom: 6 },
  heroTagline: { fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 19, marginBottom: 14 },
  heroBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(140,198,63,0.1)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  heroBadgeText: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },

  section: { marginTop: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: 'rgba(255,255,255,0.5)', letterSpacing: 0.8, marginBottom: 12, textTransform: 'uppercase' },

  highlightRow: { gap: 8 },
  highlightChip: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  highlightText: { color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 18 },

  dayCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dayNum: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: GREEN + '20', alignItems: 'center', justifyContent: 'center',
  },
  dayNumText: { fontSize: 11, fontWeight: '900', color: GREEN },
  dayTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: '#FFF' },
  dayBody: { marginTop: 12, gap: 8 },
  dayDesc: { color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 19 },
  dayActivities: { gap: 5 },
  actRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GREEN },
  actText: { flex: 1, color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  dayMeta: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dayMetaText: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  tipBox: {
    backgroundColor: 'rgba(140,198,63,0.1)', borderRadius: 10,
    padding: 10, borderLeftWidth: 3, borderLeftColor: GREEN,
  },
  tipText: { color: 'rgba(255,255,255,0.65)', fontSize: 12, lineHeight: 17 },

  pickCard: {
    flexDirection: 'row', gap: 14, alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  pickAvatar: { width: 64, height: 64, borderRadius: 14 },
  pickAvatarFallback: { backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  pickInfo: { flex: 1, gap: 4 },
  pickNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  pickName: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  proBadge: { backgroundColor: 'rgba(255,215,0,0.15)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,215,0,0.4)' },
  proBadgeText: { fontSize: 9, fontWeight: '900', color: '#FFD700' },
  pickPrice: { fontSize: 12, color: GREEN, fontWeight: '700' },
  pickReason: { fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 17 },
  pickCta: { fontSize: 12, color: GREEN, fontWeight: '700', marginTop: 4 },

  budgetBreakdown: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  budgetRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  budgetRowLabel: { fontSize: 13, color: 'rgba(255,255,255,0.55)' },
  budgetRowVal: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  budgetDivider: { height: 1, backgroundColor: 'rgba(140,198,63,0.25)', marginVertical: 4 },

  packingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  packingChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(140,198,63,0.1)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: GREEN + '30',
  },
  packingText: { fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },

  specialBox: {
    backgroundColor: 'rgba(255,105,180,0.08)',
    borderRadius: 16, padding: 16, marginTop: 20,
    borderWidth: 1, borderColor: 'rgba(255,105,180,0.2)',
  },
  specialHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  specialTitle: { fontSize: 13, fontWeight: '800', color: '#FF69B4' },
  specialText: { fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 19 },

  promiseBox: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: GREEN + '0F', borderRadius: 14, padding: 14, marginTop: 14,
    borderWidth: 1, borderColor: GREEN + '30',
  },
  promiseText: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 18, fontStyle: 'italic' },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: 'rgba(140,198,63,0.15)',
    borderRadius: 16, paddingVertical: 16, marginTop: 24,
    borderWidth: 1.5, borderColor: GREEN,
  },
  saveBtnText: { color: GREEN, fontSize: 15, fontWeight: '800' },

  bookBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: AppColors.whatsapp, borderRadius: 16, paddingVertical: 18, marginTop: 12,
  },
  bookBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },

  bottomNote: {
    color: 'rgba(255,255,255,0.25)', fontSize: 12,
    textAlign: 'center', marginTop: 14, lineHeight: 18,
  },
});
