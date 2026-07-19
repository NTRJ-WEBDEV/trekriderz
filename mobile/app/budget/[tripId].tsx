import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import EmptyState from '@/components/EmptyState';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

export default function BudgetScreen() {
  const { tripId } = useLocalSearchParams();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [trip, setTrip] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [addModalVisible, setAddModalVisible] = useState(false);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('food');

  const CATEGORIES = [
    { id: 'food', label: 'Food', icon: '🍔', color: '#F59E0B' },
    { id: 'transport', label: 'Travel', icon: '🚕', color: '#3B82F6' },
    { id: 'accommodation', label: 'Stay', icon: '🏨', color: '#8B5CF6' },
    { id: 'activities', label: 'Fun', icon: '🎢', color: '#EC4899' },
    { id: 'shopping', label: 'Shop', icon: '🛍️', color: '#10B981' },
    { id: 'other', label: 'Other', icon: '📝', color: '#6B7280' },
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: tripData, error: tripError } = await supabase
        .from('trips')
        .select('budget, budget_type, group_size, title, currency')
        .eq('id', tripId)
        .single();

      if (tripError) throw tripError;
      setTrip(tripData);

      const { data: expensesData, error: expensesError } = await supabase
        .from('trip_expenses')
        .select('*')
        .eq('trip_id', tripId)
        .order('date', { ascending: false });

      if (expensesError) throw expensesError;
      setExpenses(expensesData || []);

    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to load budget data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = async () => {
    if (!description || !amount) {
      Alert.alert('Missing fields', 'Please enter description and amount');
      return;
    }

    try {
      const { error } = await supabase.from('trip_expenses').insert({
        trip_id: tripId,
        user_id: user?.id,
        description,
        amount: parseFloat(amount),
        category,
        date: new Date().toISOString()
      });

      if (error) throw error;

      setAddModalVisible(false);
      setDescription('');
      setAmount('');
      fetchData();
    } catch (error) {
      Alert.alert('Error', 'Failed to add expense');
    }
  };

  const getCategoryInfo = (catId: string) => {
    return CATEGORIES.find(c => c.id === catId) || CATEGORIES[CATEGORIES.length - 1];
  };

  const totalSpent = expenses.reduce((sum, item) => sum + item.amount, 0);
  // Expenses are whole-trip amounts, so the tracker's ceiling must be the
  // full group pool — a 'per_person' budget needs multiplying by group_size
  // first, or a 2-person trip's real combined spend would read as blowing
  // the budget at half its actual usage.
  const budget = trip?.budget_type === 'per_person'
    ? (trip?.budget || 0) * (trip?.group_size || 1)
    : (trip?.budget || 0);
  const remaining = budget - totalSpent;
  const percentUsed = budget > 0 ? Math.min((totalSpent / budget) * 100, 100) : 0;

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#8CC63F" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color="#8CC63F" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trip Budget</Text>
        <TouchableOpacity onPress={fetchData} style={styles.backBtn}>
          <Ionicons name="refresh" size={24} color="#8CC63F" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Budget Overview Card */}
        <View style={styles.budgetCard}>
          <Text style={styles.budgetTitle}>Total Budget</Text>
          <Text style={styles.budgetValue}>₹{budget.toLocaleString()}</Text>

          {/* Progress Bar */}
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${percentUsed}%` as any },
                percentUsed > 80 && styles.progressBarDanger,
              ]}
            />
          </View>
          <Text style={styles.progressLabel}>{Math.round(percentUsed)}% used</Text>

          <View style={styles.budgetRow}>
            <View style={styles.budgetStat}>
              <Text style={styles.budgetStatLabel}>Spent</Text>
              <Text style={[styles.budgetStatValue, { color: '#EF4444' }]}>
                ₹{totalSpent.toLocaleString()}
              </Text>
            </View>
            <View style={styles.budgetDivider} />
            <View style={styles.budgetStat}>
              <Text style={styles.budgetStatLabel}>Remaining</Text>
              <Text style={[styles.budgetStatValue, { color: '#8CC63F' }]}>
                ₹{remaining.toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Category Breakdown */}
        {expenses.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>By Category</Text>
            <View style={styles.categoriesGrid}>
              {CATEGORIES.map((cat) => {
                const catTotal = expenses
                  .filter(e => e.category === cat.id)
                  .reduce((s, e) => s + e.amount, 0);
                if (catTotal === 0) return null;
                return (
                  <View key={cat.id} style={styles.categoryChip}>
                    <Text style={styles.categoryChipIcon}>{cat.icon}</Text>
                    <Text style={styles.categoryChipLabel}>{cat.label}</Text>
                    <Text style={[styles.categoryChipAmount, { color: cat.color }]}>
                      ₹{catTotal.toLocaleString()}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Expenses List */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Expenses</Text>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => setAddModalVisible(true)}
            >
              <Ionicons name="add" size={20} color="#080C14" />
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>

          {expenses.length === 0 ? (
            <EmptyState icon="wallet-outline" title="No expenses yet" subtitle="Track your trip spending here" />
          ) : (
            expenses.map((expense) => {
              const cat = getCategoryInfo(expense.category);
              return (
                <View key={expense.id} style={styles.expenseItem}>
                  <View style={[styles.expenseDot, { backgroundColor: cat.color }]}>
                    <Text style={styles.expenseDotIcon}>{cat.icon}</Text>
                  </View>
                  <View style={styles.expenseContent}>
                    <Text style={styles.expenseDesc}>{expense.description}</Text>
                    <Text style={styles.expenseMeta}>
                      {cat.label} · {new Date(expense.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                  <Text style={styles.expenseAmount}>₹{expense.amount.toLocaleString()}</Text>
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Add Expense Modal */}
      <Modal
        visible={addModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Expense</Text>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={styles.textInput}
              placeholder="What did you spend on?"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={description}
              onChangeText={setDescription}
            />

            <Text style={styles.inputLabel}>Amount (₹)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="0"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />

            <Text style={styles.inputLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryOption, category === cat.id && { borderColor: cat.color, backgroundColor: `${cat.color}22` }]}
                  onPress={() => setCategory(cat.id)}
                >
                  <Text style={styles.categoryOptionIcon}>{cat.icon}</Text>
                  <Text style={[styles.categoryOptionLabel, category === cat.id && { color: cat.color }]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.submitBtn} onPress={handleAddExpense}>
              <Text style={styles.submitBtnText}>Add Expense</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080C14',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  budgetCard: {
    margin: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  budgetTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  budgetValue: {
    color: 'white',
    fontSize: 32,
    fontWeight: '800',
    marginTop: 4,
    marginBottom: 16,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#8CC63F',
    borderRadius: 4,
  },
  progressBarDanger: {
    backgroundColor: '#EF4444',
  },
  progressLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    marginTop: 6,
    textAlign: 'right',
  },
  budgetRow: {
    flexDirection: 'row',
    marginTop: 16,
    alignItems: 'center',
  },
  budgetStat: {
    flex: 1,
    alignItems: 'center',
  },
  budgetStatLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    marginBottom: 4,
  },
  budgetStatValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  budgetDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8CC63F',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  addBtnText: {
    color: '#080C14',
    fontWeight: '700',
    fontSize: 14,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 2,
  },
  categoryChipIcon: {
    fontSize: 18,
  },
  categoryChipLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
  },
  categoryChipAmount: {
    fontSize: 13,
    fontWeight: '700',
  },
  expenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    gap: 12,
  },
  expenseDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.85,
  },
  expenseDotIcon: {
    fontSize: 18,
  },
  expenseContent: {
    flex: 1,
  },
  expenseDesc: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  expenseMeta: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    marginTop: 2,
  },
  expenseAmount: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0F1724',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  inputLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 4,
  },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 10,
    padding: 14,
    color: 'white',
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 12,
  },
  categoryScroll: {
    marginBottom: 20,
  },
  categoryOption: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginRight: 8,
    minWidth: 64,
  },
  categoryOptionIcon: {
    fontSize: 20,
  },
  categoryOptionLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    marginTop: 4,
  },
  submitBtn: {
    backgroundColor: '#8CC63F',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#080C14',
    fontSize: 16,
    fontWeight: '700',
  },
});
