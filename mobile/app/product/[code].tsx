import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getProduct, getExplanation, getExplanationFromProduct } from '../../lib/api';
import { getStoredProduct, storeProduct, getPersistedExplanation, storeExplanation, getCategoryIcon } from '../../lib/store';
import { saveScanHistory } from '../../lib/history';
import type { Product, ExplanationResponse } from '../../lib/types';
import LoadingSpinner from '../../components/LoadingSpinner';
import EcoScoreBadge from '../../components/EcoScoreBadge';
import NutritionTable from '../../components/NutritionTable';
import { Colors } from '../../constants/colors';

export default function ProductDetailScreen() {
  const { code, fromHistory } = useLocalSearchParams<{ code: string; fromHistory?: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [explanation, setExplanation] = useState<ExplanationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const historySavedRef = useRef(false);

  useEffect(() => {
    if (!code) return;
    historySavedRef.current = false;
    setLoading(true);
    setError(null);
    setExplanation(null);
    setProduct(null);

    // Check in-memory store first
    const stored = getStoredProduct(code);
    if (stored) {
      setProduct(stored);
      setLoading(false);
      return;
    }

    getProduct(code)
      .then(setProduct)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [code]);

  // Load explanation: check persistent cache first, then fetch from API
  useEffect(() => {
    if (!code || !product) return;

    let cancelled = false;

    (async () => {
      const cached = await getPersistedExplanation(code);
      if (cached && !cancelled) {
        setExplanation(cached);
        return;
      }

      try {
        const result = await (product
          ? getExplanationFromProduct(product)
          : getExplanation(code));
        if (!cancelled) {
          setExplanation(result);
          storeExplanation(code, result);
        }
      } catch {
        if (!cancelled) setExplanation(null);
      }
    })();

    return () => { cancelled = true; };
  }, [code, product]);

  // Save to history (skip if navigated from history page)
  useEffect(() => {
    if (!product || historySavedRef.current || fromHistory === '1') return;
    historySavedRef.current = true;
    saveScanHistory(product);
  }, [product]);

  if (loading) {
    return (
      <View style={styles.center}>
        <LoadingSpinner message="Loading product..." />
      </View>
    );
  }

  if (error || !product) {
    return (
      <View style={styles.center}>
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error || 'Product not found'}</Text>
        </View>
        <Pressable style={styles.primaryButton} onPress={() => router.back()}>
          <Text style={styles.primaryButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  let nutrition: Record<string, unknown> = {};
  if (typeof product.nutrition_json === 'string') {
    try { nutrition = JSON.parse(product.nutrition_json || '{}'); } catch { /* empty */ }
  } else {
    nutrition = (product.nutrition_json as any) || {};
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Product Header */}
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          {product.image_url ? (
            <Image
              source={{ uri: product.image_url }}
              style={styles.productImage}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={styles.productPlaceholder}>
              {getCategoryIcon() ? (
                <Ionicons name={`${getCategoryIcon()}-outline` as any} size={36} color={Colors.ink[500]} />
              ) : (
                <Text style={styles.productPlaceholderText}>P</Text>
              )}
            </View>
          )}
          <View style={styles.headerInfo}>
            <Text style={styles.productName}>{product.product_name}</Text>
            {product.brands ? <Text style={styles.productBrands}>{product.brands}</Text> : null}
          </View>
        </View>
      </View>

      {/* Scores */}
      <View style={styles.scoresRow}>
        <View style={styles.scoreCard}>
          <Text style={styles.scoreLabel}>Nutri-Score</Text>
          <EcoScoreBadge
            grade={product.nutriscore_grade || explanation?.predicted_nutriscore || null}
            size="md"
            predicted={!product.nutriscore_grade && !!explanation?.predicted_nutriscore}
          />
        </View>
        <View style={styles.scoreCard}>
          <Text style={styles.scoreLabel}>Eco-Score</Text>
          <EcoScoreBadge
            grade={product.ecoscore_grade || explanation?.predicted_ecoscore || null}
            score={product.ecoscore_score}
            size="md"
            predicted={!product.ecoscore_grade && !!explanation?.predicted_ecoscore}
          />
        </View>
      </View>

      {/* Explanation */}
      {explanation ? (
        <>
          {explanation.ingredient_flags.length > 0 && (
            <View style={[styles.section, styles.warningCard]}>
              <View style={styles.flagHeader}>
                <Ionicons name="warning" size={20} color={Colors.warning.text} />
                <Text style={[styles.sectionTitle, { color: Colors.warning.text, marginBottom: 0 }]}>
                  Ingredient Flags
                </Text>
              </View>
              {explanation.ingredient_flags.map((flag, i) => (
                <Text key={i} style={styles.flagText}>{'\u2022'} {flag}</Text>
              ))}
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nutrition Summary</Text>
            <Text style={styles.bodyText}>{explanation.nutrition_summary}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Eco-Score Explained</Text>
            <Text style={styles.bodyText}>{explanation.eco_explanation}</Text>
          </View>

          {/* Nutrition */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nutrition per 100g</Text>
            <NutritionTable nutrition={nutrition as any} />
          </View>

          <View style={[styles.section, styles.adviceCard]}>
            <Text style={[styles.sectionTitle, { color: Colors.success.text }]}>Advice</Text>
            <Text style={[styles.bodyText, { color: Colors.success.text }]}>{explanation.advice}</Text>
          </View>
        </>
      ) : (
        <View style={styles.section}>
          <LoadingSpinner message="Generating AI analysis..." />
        </View>
      )}

      {/* Alternatives Button */}
      <Pressable
        style={({ pressed }) => [styles.alternativesButton, pressed && { opacity: 0.8 }]}
        onPress={() => {
          storeProduct(code!, product);
          router.push(`/alternatives/${code}`);
        }}
      >
        <Ionicons name="leaf" size={20} color="#ffffff" />
        <Text style={styles.alternativesButtonText}>Find Greener Alternatives</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface.bg,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: Colors.surface.bg,
  },
  headerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  productImage: {
    width: 72,
    height: 72,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.line.soft,
  },
  productPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.line.soft,
    backgroundColor: Colors.surface[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  productPlaceholderText: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.ink[500],
  },
  headerInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.ink[900],
  },
  productBrands: {
    fontSize: 14,
    color: Colors.ink[500],
    marginTop: 2,
  },
  scoresRow: {
    flexDirection: 'row',
    gap: 10,
  },
  scoreCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  scoreLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.ink[700],
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.ink[900],
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 22,
    color: Colors.ink[700],
  },
  warningCard: {
    backgroundColor: Colors.warning.bg,
    borderWidth: 1,
    borderColor: Colors.warning.border,
  },
  flagHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  flagText: {
    fontSize: 14,
    lineHeight: 22,
    color: Colors.warning.text,
    paddingLeft: 4,
  },
  adviceCard: {
    backgroundColor: Colors.success.bg,
    borderWidth: 1,
    borderColor: Colors.success.border,
  },
  alternativesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.brand[600],
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 4,
  },
  alternativesButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: Colors.error.bg,
    borderWidth: 1,
    borderColor: Colors.error.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: Colors.error.text,
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: Colors.brand[600],
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
