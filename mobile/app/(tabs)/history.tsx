import { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ScanHistoryEntry, ExplanationResponse } from '../../lib/types';
import { getScanHistory, deleteScanHistoryItem, clearScanHistory } from '../../lib/history';
import { storeProduct, getPersistedExplanation } from '../../lib/store';
import EcoScoreBadge from '../../components/EcoScoreBadge';
import { Colors } from '../../constants/colors';

export default function HistoryTab() {
  const router = useRouter();
  const [history, setHistory] = useState<ScanHistoryEntry[]>([]);
  const [explanations, setExplanations] = useState<Record<string, ExplanationResponse>>({});

  useFocusEffect(
    useCallback(() => {
      getScanHistory().then((entries) => {
        setHistory(entries);
        // Load cached AI explanations for entries missing scores
        entries.forEach((entry) => {
          if (!entry.nutriscore_grade || !entry.ecoscore_grade) {
            getPersistedExplanation(entry.product_code).then((exp) => {
              if (exp) {
                setExplanations((prev) => ({ ...prev, [entry.product_code]: exp }));
              }
            });
          }
        });
      });
    }, [])
  );

  const handleDelete = async (id: string) => {
    await deleteScanHistoryItem(id);
    setHistory((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearAll = () => {
    Alert.alert('Clear History', 'Remove all scan history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All',
        style: 'destructive',
        onPress: async () => {
          await clearScanHistory();
          setHistory([]);
        },
      },
    ]);
  };

  const handlePress = (entry: ScanHistoryEntry) => {
    if (entry.product) {
      storeProduct(entry.product_code, entry.product);
    }
    router.push({ pathname: `/product/${entry.product_code}`, params: { fromHistory: '1' } });
  };

  const renderItem = ({ item }: { item: ScanHistoryEntry }) => {
    const exp = explanations[item.product_code];
    const nutriGrade = item.nutriscore_grade || exp?.predicted_nutriscore || null;
    const ecoGrade = item.ecoscore_grade || exp?.predicted_ecoscore || null;

    return (
      <Pressable
        onPress={() => handlePress(item)}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        {item.product_image_url ? (
          <Image
            source={{ uri: item.product_image_url }}
            style={styles.image}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="cube-outline" size={24} color={Colors.ink[400]} />
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{item.product_name}</Text>
          {item.brands ? <Text style={styles.brands} numberOfLines={1}>{item.brands}</Text> : null}
          <Text style={styles.date}>
            {new Date(item.saved_at).toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.actions}>
          <EcoScoreBadge grade={nutriGrade} size="sm" />
          <EcoScoreBadge grade={ecoGrade} size="sm" />
          <Pressable onPress={() => handleDelete(item.id)} hitSlop={8}>
            <Ionicons name="trash-outline" size={18} color={Colors.ink[400]} />
          </Pressable>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {history.length > 0 && (
        <View style={styles.headerRow}>
          <Text style={styles.headerText}>{history.length} scan{history.length !== 1 ? 's' : ''}</Text>
          <Pressable onPress={handleClearAll}>
            <Text style={styles.clearText}>Clear All</Text>
          </Pressable>
        </View>
      )}
      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={history.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="time-outline" size={64} color={Colors.ink[400]} />
            <Text style={styles.emptyTitle}>No scans yet</Text>
            <Text style={styles.emptyMessage}>
              Scan a product to see it here
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface.bg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerText: {
    fontSize: 14,
    color: Colors.ink[500],
    fontWeight: '500',
  },
  clearText: {
    fontSize: 14,
    color: Colors.error.text,
    fontWeight: '600',
  },
  list: {
    padding: 16,
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  image: {
    width: 48,
    height: 48,
    borderRadius: 10,
  },
  placeholder: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: Colors.surface[100],
    borderWidth: 1,
    borderColor: Colors.line.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontWeight: '600',
    fontSize: 15,
    color: Colors.ink[900],
  },
  brands: {
    fontSize: 13,
    color: Colors.ink[500],
  },
  date: {
    fontSize: 11,
    color: Colors.ink[400],
    marginTop: 2,
  },
  actions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  emptyContainer: {
    flex: 1,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.ink[700],
    marginTop: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: Colors.ink[500],
    textAlign: 'center',
  },
});
