import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getRecommendations, getRecommendationsFromProduct } from '../../lib/api';
import { getStoredProduct, getCategoryIcon } from '../../lib/store';
import type { Product } from '../../lib/types';
import LoadingSpinner from '../../components/LoadingSpinner';
import ProductCard from '../../components/ProductCard';
import { Colors } from '../../constants/colors';

export default function AlternativesScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const [alternatives, setAlternatives] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;

    const storedProduct = getStoredProduct(code);
    const request = storedProduct
      ? getRecommendationsFromProduct(storedProduct)
      : getRecommendations(code);

    request
      .then(setAlternatives)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [code]);

  if (loading) {
    return (
      <View style={styles.center}>
        <LoadingSpinner message="Finding greener alternatives..." />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Greener Alternatives</Text>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {alternatives.length === 0 && !error ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            No greener alternatives found for this product category.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {alternatives.map((alt) => (
            <ProductCard
              key={alt.product_code}
              product_code={alt.product_code}
              product_name={alt.product_name}
              brands={alt.brands}
              nutriscore_grade={alt.nutriscore_grade}
              ecoscore_grade={alt.ecoscore_grade}
              confidence={alt.similarity_score}
              image_url={alt.image_url}
              fullProduct={alt}
              categoryIcon={getCategoryIcon()}
            />
          ))}
        </View>
      )}
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
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: Colors.surface.bg,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.ink[900],
    textAlign: 'center',
    marginBottom: 16,
  },
  list: {
    gap: 10,
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: Colors.ink[500],
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: Colors.error.bg,
    borderWidth: 1,
    borderColor: Colors.error.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    color: Colors.error.text,
    fontSize: 14,
  },
});
