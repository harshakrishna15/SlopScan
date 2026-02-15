import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';

const GRADE_COLORS: Record<string, { bg: string; text: string }> = {
  a: { bg: '#1E8F4E', text: '#ffffff' },
  b: { bg: '#4DA924', text: '#ffffff' },
  c: { bg: '#DEB314', text: '#3f3200' },
  d: { bg: '#F6832A', text: '#ffffff' },
  e: { bg: '#DC4A1F', text: '#ffffff' },
};

interface Props {
  grade: string | null;
  score?: number | null;
  size?: 'sm' | 'md' | 'lg';
  predicted?: boolean;
}

export default function EcoScoreBadge({ grade, score, size = 'md', predicted = false }: Props) {
  if (!grade) {
    return (
      <View style={[styles.badge, styles.naBadge, sizeStyles[size]]}>
        <Text style={[styles.naText, textSizeStyles[size]]}>N/A</Text>
      </View>
    );
  }

  const g = grade.toLowerCase();
  const colors = GRADE_COLORS[g] || { bg: '#d1d5db', text: '#4b5563' };

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }, sizeStyles[size]]}>
      <Text style={[styles.gradeText, { color: colors.text }, textSizeStyles[size]]}>
        {g.toUpperCase()}
      </Text>
      {score != null && (
        <Text style={[styles.scoreText, { color: colors.text }]}>({score})</Text>
      )}
      {predicted && <Text style={styles.predictedIcon}>AI</Text>}
    </View>
  );
}

const sizeStyles = StyleSheet.create({
  sm: { paddingHorizontal: 8, paddingVertical: 2 },
  md: { paddingHorizontal: 12, paddingVertical: 4 },
  lg: { paddingHorizontal: 16, paddingVertical: 6 },
});

const textSizeStyles = StyleSheet.create({
  sm: { fontSize: 12 },
  md: { fontSize: 14 },
  lg: { fontSize: 16 },
});

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    gap: 4,
  },
  naBadge: {
    backgroundColor: '#f0f4ef',
    borderWidth: 1,
    borderColor: Colors.line.soft,
  },
  naText: {
    fontWeight: '600',
    color: Colors.ink[500],
  },
  gradeText: {
    fontWeight: '800',
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '400',
    opacity: 0.8,
  },
  predictedIcon: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
    opacity: 0.9,
    marginLeft: 2,
  },
});
