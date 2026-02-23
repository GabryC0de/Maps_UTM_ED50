// React
import { useEffect, useState } from "react";
import { Platform, Text, Linking, Alert, StyleSheet, View } from "react-native";

// Expo
import * as Location from "expo-location";
// Importiamo la nuova libreria stabile!
import MapView, {
  Marker,
  Circle,
  Polyline,
  PROVIDER_GOOGLE,
} from "react-native-maps";

// Definizione dei Tipi
type LocationData = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: string;
  heading?: number;
};

export default function App() {
  // Variabili
  const [location, setLocation] = useState<LocationData | null>(null);
  const [locLoader, setLocLoader] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [heading, setHeading] = useState<number>(0);

  // Funzione per generare le coordinate del cono di direzione
  const generateConeCoordinates = (
    lat: number,
    lon: number,
    heading: number,
    radiusMeters: number = 100,
  ) => {
    const R = 6371000; // Raggio della Terra in metri
    const d = radiusMeters / R;
    const brng1 = ((heading - 30) * Math.PI) / 180;
    const brng2 = ((heading + 30) * Math.PI) / 180;
    const lat1 = (lat * Math.PI) / 180;
    const lon1 = (lon * Math.PI) / 180;

    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(d) +
        Math.cos(lat1) * Math.sin(d) * Math.cos(brng1),
    );
    const lon2 =
      lon1 +
      Math.atan2(
        Math.sin(brng1) * Math.sin(d) * Math.cos(lat1),
        Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
      );

    const lat3 = Math.asin(
      Math.sin(lat1) * Math.cos(d) +
        Math.cos(lat1) * Math.sin(d) * Math.cos(brng2),
    );
    const lon3 =
      lon1 +
      Math.atan2(
        Math.sin(brng2) * Math.sin(d) * Math.cos(lat1),
        Math.cos(d) - Math.sin(lat1) * Math.sin(lat3),
      );

    return [
      { latitude: lat, longitude: lon },
      { latitude: (lat2 * 180) / Math.PI, longitude: (lon2 * 180) / Math.PI },
      { latitude: (lat3 * 180) / Math.PI, longitude: (lon3 * 180) / Math.PI },
      { latitude: lat, longitude: lon },
    ];
  };

  // Funzioni per Permessi e GPS
  const requestPermissions = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permesso negato",
        "Abilita i permessi di localizzazione nelle impostazioni.",
        [
          { text: "Annulla", style: "cancel" },
          { text: "Impostazioni", onPress: () => Linking.openSettings() },
        ],
      );
      return false;
    }
    return true;
  };

  const getCurrentLocation = async () => {
    setLocLoader(true);
    setError(null);

    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return;

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });

      const head = await Location.getHeadingAsync();

      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy,
        timestamp: new Date(loc.timestamp).toLocaleTimeString(),
        heading: head.trueHeading,
      });

      setHeading(head.trueHeading);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLocLoader(false);
    }
  };

  useEffect(() => {
    getCurrentLocation();
  }, []);

  // Se non abbiamo ancora la posizione iniziale, mostriamo un caricamento o una mappa di default
  const initialRegion = location
    ? {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.005, // Regola lo zoom (più è piccolo, più è zoomato)
        longitudeDelta: 0.005,
      }
    : {
        latitude: 41.9028, // Roma di default
        longitude: 12.4964,
        latitudeDelta: 5,
        longitudeDelta: 5,
      };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        // PROVIDER_GOOGLE forza l'uso di Google Maps anche su iOS se lo desideri
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        initialRegion={initialRegion}
        showsUserLocation={true} // Il pallino blu di default
        showsMyLocationButton={true} // Il bottone per centrare la mappa
      >
        {/* Usiamo i Componenti "Figli" di react-native-maps. Molto più pulito! */}
        {location && (
          <>
            {/* Cerchio di accuracy */}
            <Circle
              center={{
                latitude: location.latitude,
                longitude: location.longitude,
              }}
              radius={location.accuracy || 10}
              fillColor="rgba(66, 133, 244, 0.3)"
              strokeColor="rgba(66, 133, 244, 0.8)"
              strokeWidth={2}
            />

            {/* Cono di direzione visiva */}
            <Polyline
              coordinates={generateConeCoordinates(
                location.latitude,
                location.longitude,
                heading,
                100,
              )}
              strokeColor="rgba(255, 152, 0, 0.8)"
              strokeWidth={2}
              fillColor="rgba(255, 152, 0, 0.3)" // Su react-native-maps puoi anche riempire i poligoni!
            />
          </>
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: "100%",
    height: "100%",
  },
});
