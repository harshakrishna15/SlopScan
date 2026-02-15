import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { identifyProduct } from '../lib/api';
import { storeProduct, storeCategoryIcon } from '../lib/store';
import type { IdentifyResponse } from '../lib/types';
import LoadingSpinner from '../components/LoadingSpinner';
import ProductCard from '../components/ProductCard';
import { Colors } from '../constants/colors';

export default function ResultsScreen() {
  const { imageUri } = useLocalSearchParams<{ imageUri: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IdentifyResponse | null>(null);

  useEffect(() => {
    if (!imageUri) {
      router.replace('/');
      return;
    }

    identifyProduct(imageUri)
      .then((data) => {
        setResult(data);
        if (data.category_icon) {
          storeCategoryIcon(data.category_icon);
        }
        // Auto-navigate if confident match
        if (!data.needs_confirmation && data.best_match && data.candidates.length > 0) {
          const product = data.candidates[0];
          storeProduct(data.best_match.product_code, product);
          router.replace(`/product/${data.best_match.product_code}`);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [imageUri]);

  if (loading) {
    return (
      <View style={styles.center}>
        <LoadingSpinner message="Identifying product..." />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
        <Pressable style={styles.primaryButton} onPress={() => router.back()}>
          <Text style={styles.primaryButtonText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  if (!result || !result.candidates.length) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>
          Product not found. Try a clearer photo or a different product.
        </Text>
        <Pressable style={styles.primaryButton} onPress={() => router.back()}>
          <Text style={styles.primaryButtonText}>Retake Photo</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Select your product</Text>
      {result.gemini_guesses.length > 0 && (
        <Text style={styles.hint}>Likely match: {result.gemini_guesses[0]}</Text>
      )}
      <View style={styles.list}>
        {result.candidates.map((c) => (
          <ProductCard
            key={c.product_code}
            product_code={c.product_code}
            product_name={c.product_name}
            brands={c.brands}
            nutriscore_grade={c.nutriscore_grade}
            ecoscore_grade={c.ecoscore_grade}
            confidence={c.confidence}
            image_url={c.image_url}
            fullProduct={c}
            categoryIcon={result.category_icon}
          />
        ))}
      </View>
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
  },
  hint: {
    fontSize: 14,
    color: Colors.ink[500],
    textAlign: 'center',
    marginTop: 4,
  },
  list: {
    marginTop: 16,
    gap: 10,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    color: Colors.ink[700],
    marginBottom: 16,
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
