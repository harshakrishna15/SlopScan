import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

export default function AboutTab() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.iconWrap}>
          <Ionicons name="leaf" size={48} color={Colors.brand[600]} />
        </View>
        <Text style={styles.title}>SlopScan</Text>
        <Text style={styles.subtitle}>Scan smarter. Eat greener.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>How it works</Text>
        <Step number="1" text="Take a photo of any food product" />
        <Step number="2" text="AI identifies the product instantly" />
        <Step number="3" text="View nutrition info and eco-score" />
        <Step number="4" text="Discover greener alternatives" />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>About</Text>
        <Text style={styles.body}>
          SlopScan uses Gemini AI vision to identify food products, then matches
          them against the OpenFoodFacts database to show nutrition data,
          eco-scores, and suggest greener alternatives.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Tech Stack</Text>
        <Tag label="Gemini 2.5 Flash" />
        <Tag label="Actian VectorDB" />
        <Tag label="OpenFoodFacts" />
        <Tag label="React Native + Expo" />
        <Tag label="FastAPI" />
      </View>

      <Text style={styles.footer}>Built at SF Hacks 2026</Text>
    </ScrollView>
  );
}

function Step({ number, text }: { number: string; text: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepBadge}>
        <Text style={styles.stepNumber}>{number}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface.bg,
  },
  content: {
    padding: 20,
    gap: 16,
    paddingBottom: 40,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.ink[900],
  },
  subtitle: {
    fontSize: 16,
    color: Colors.ink[500],
    marginTop: 4,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.ink[900],
    marginBottom: 12,
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    color: Colors.ink[700],
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.brand[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.brand[600],
  },
  stepText: {
    fontSize: 14,
    color: Colors.ink[700],
    flex: 1,
  },
  tag: {
    backgroundColor: Colors.surface[100],
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 6,
    alignSelf: 'flex-start',
  },
  tagText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.ink[700],
  },
  footer: {
    textAlign: 'center',
    fontSize: 13,
    color: Colors.ink[400],
    marginTop: 8,
  },
});
