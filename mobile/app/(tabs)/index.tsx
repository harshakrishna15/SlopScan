import { useState, useRef, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

export default function ScanTab() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [selectedLens, setSelectedLens] = useState<string | undefined>(undefined);
  const [zoom, setZoom] = useState(0);
  const zoomAtPinchStart = useRef(0);

  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      zoomAtPinchStart.current = zoom;
    })
    .onUpdate((e) => {
      const delta = (e.scale - 1) * 0.35;
      const next = Math.min(1, Math.max(0, zoomAtPinchStart.current + delta));
      setZoom(next);
    });

  // On iOS devices with ultra-wide cameras, the default virtual device starts at 0.5x.
  // We select the standard wide-angle ("Back Camera") to ensure 1x by default.
  const handleAvailableLensesChanged = useCallback((event: { lenses: string[] }) => {
    if (facing !== 'back') return;
    const lenses = event.lenses;
    // "Back Camera" is the localizedName for builtInWideAngleCamera on iOS
    const wideAngle = lenses.find(name => name === 'Back Camera')
      ?? lenses.find(name =>
        name.includes('Back') &&
        !name.includes('Ultra') &&
        !name.includes('Telephoto') &&
        !name.includes('Dual') &&
        !name.includes('Triple')
      );
    if (wideAngle && Platform.OS === 'ios') {
      setSelectedLens(wideAngle);
    }
  }, [facing]);

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
    if (photo?.uri) {
      router.push({ pathname: '/results', params: { imageUri: photo.uri } });
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      router.push({ pathname: '/results', params: { imageUri: result.assets[0].uri } });
    }
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Ionicons name="camera-outline" size={64} color={Colors.ink[400]} />
        <Text style={styles.message}>Camera access is needed to scan products</Text>
        <Pressable style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>Grant Permission</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={handlePickImage}>
          <Ionicons name="images-outline" size={20} color={Colors.brand[600]} />
          <Text style={styles.secondaryButtonText}>Pick from Gallery</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <GestureDetector gesture={pinchGesture}>
      <View style={styles.container}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          zoom={zoom}
          selectedLens={selectedLens}
          onAvailableLensesChanged={handleAvailableLensesChanged}
        />
        <View style={styles.overlay}>
          <View style={styles.topBar}>
            <Text style={styles.hint}>Point at a food product</Text>
          </View>
          <View style={styles.controls}>
            <Pressable style={styles.galleryButton} onPress={handlePickImage}>
              <Ionicons name="images-outline" size={24} color="#ffffff" />
            </Pressable>
            <Pressable style={styles.captureButton} onPress={handleCapture}>
              <View style={styles.captureInner} />
            </Pressable>
            <Pressable
              style={styles.galleryButton}
              onPress={() => {
                setFacing((f) => (f === 'back' ? 'front' : 'back'));
                setSelectedLens(undefined);
                setZoom(0);
              }}
            >
              <Ionicons name="camera-reverse-outline" size={24} color="#ffffff" />
            </Pressable>
          </View>
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topBar: {
    paddingTop: 16,
    alignItems: 'center',
  },
  hint: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 32,
    paddingBottom: 40,
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  captureInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ffffff',
  },
  galleryButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
    backgroundColor: Colors.surface.bg,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    color: Colors.ink[700],
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
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.brand[600],
  },
  secondaryButtonText: {
    color: Colors.brand[600],
    fontSize: 15,
    fontWeight: '600',
  },
});
