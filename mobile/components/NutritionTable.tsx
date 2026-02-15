import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';

interface Nutrition {
  'energy-kcal_100g'?: number | null;
  sugars_100g?: number | null;
  fat_100g?: number | null;
  'saturated-fat_100g'?: number | null;
  proteins_100g?: number | null;
  salt_100g?: number | null;
}

export default function NutritionTable({ nutrition }: { nutrition: Nutrition }) {
  const rows = [
    { label: 'Energy', value: nutrition['energy-kcal_100g'], unit: 'kcal' },
    { label: 'Sugars', value: nutrition.sugars_100g, unit: 'g' },
    { label: 'Fat', value: nutrition.fat_100g, unit: 'g' },
    { label: 'Saturated Fat', value: nutrition['saturated-fat_100g'], unit: 'g' },
    { label: 'Protein', value: nutrition.proteins_100g, unit: 'g' },
    { label: 'Salt', value: nutrition.salt_100g, unit: 'g' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Nutrient</Text>
        <Text style={[styles.headerText, styles.rightAlign]}>Per 100g</Text>
      </View>
      {rows.map((row) => (
        <View key={row.label} style={styles.row}>
          <Text style={styles.label}>{row.label}</Text>
          <Text style={styles.value}>
            {row.value != null ? `${Math.round(row.value * 10) / 10} ${row.unit}` : '\u2014'}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.line.soft,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f4f8f2',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerText: {
    fontWeight: '600',
    fontSize: 14,
    color: Colors.ink[700],
  },
  rightAlign: {
    textAlign: 'right',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#edf2ec',
  },
  label: {
    fontSize: 14,
    color: Colors.ink[700],
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.ink[900],
  },
});
