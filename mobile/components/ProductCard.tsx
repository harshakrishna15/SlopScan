import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Product, CategoryIcon } from '../lib/types';
import { storeProduct } from '../lib/store';
import EcoScoreBadge from './EcoScoreBadge';
import { Colors } from '../constants/colors';

interface Props {
  product_code: string;
  product_name: string;
  brands: string;
  nutriscore_grade?: string | null;
  ecoscore_grade: string | null;
  confidence?: number;
  image_url?: string | null;
  fullProduct?: Product;
  categoryIcon?: CategoryIcon;
}

export default function ProductCard({
  product_code,
  product_name,
  brands,
  nutriscore_grade,
  ecoscore_grade,
  confidence,
  image_url,
  fullProduct,
  categoryIcon,
}: Props) {
  const router = useRouter();

  const handlePress = () => {
    if (fullProduct) {
      storeProduct(product_code, fullProduct);
    }
    router.push(`/product/${product_code}`);
  };

  return (
    <Pressable onPress={handlePress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      {image_url ? (
        <Image
          source={{ uri: image_url }}
          style={styles.image}
          contentFit="cover"
          placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
          transition={200}
        />
      ) : (
        <View style={styles.placeholder}>
          {categoryIcon ? (
            <Ionicons name={`${categoryIcon}-outline` as any} size={26} color={Colors.ink[500]} />
          ) : (
            <Text style={styles.placeholderText}>P</Text>
          )}
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{product_name}</Text>
        {brands ? <Text style={styles.brands} numberOfLines={1}>{brands}</Text> : null}
        {confidence != null && (
          <Text style={styles.confidence}>Match: {(confidence * 100).toFixed(0)}%</Text>
        )}
      </View>
      <View style={styles.badges}>
        <View style={styles.badgeRow}>
          <Text style={styles.badgeLabel}>Nutri</Text>
          <EcoScoreBadge grade={nutriscore_grade ?? null} size="sm" />
        </View>
        <View style={styles.badgeRow}>
          <Text style={styles.badgeLabel}>Eco</Text>
          <EcoScoreBadge grade={ecoscore_grade} size="sm" />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  image: {
    width: 56,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.line.soft,
  },
  placeholder: {
    width: 56,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.line.soft,
    backgroundColor: Colors.surface[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.ink[500],
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
    marginTop: 1,
  },
  confidence: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.ink[500],
    marginTop: 4,
  },
  badges: {
    alignItems: 'flex-end',
    gap: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeLabel: {
    fontSize: 10,
    color: Colors.ink[400],
  },
});
