// React
import { useEffect, useState, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// Expo & Librerie
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Location from "expo-location";
import proj4 from "proj4";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

// Componenti
import VMModal from "@/components/VMModal";

// -----------------------------------------
// 1. DEFINIZIONE DEI TIPI
// -----------------------------------------
type LocationData = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: string;
};

type ClickedPoint = {
  lat: number;
  lon: number;
  est: string;
  nord: string;
  fuso: number;
  emisfero: string;
};

export default function App() {
  // -----------------------------------------
  // 2. STATI DELL'APPLICAZIONE
  // -----------------------------------------
  const [location, setLocation] = useState<LocationData | null>(null);
  const [locLoader, setLocLoader] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [heading, setHeading] = useState<number>(0);
  const [clickedPoint, setClickedPoint] = useState<ClickedPoint | null>(null);

  // -----------------------------------------
  // 3. FUNZIONI MATEMATICHE E DI CONVERSIONE
  const [mapType, setMapType] = useState<string | null>("standard");
  const mapRef = useRef<MapView>(null);
  // -----------------------------------------

  // Calcola dinamicamente le coordinate UTM ED50 per qualsiasi punto nel mondo
  const handleMapPress = (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;

    // A. Calcolo Matematico del Fuso UTM (da 1 a 60)
    const fuso = Math.floor((longitude + 180) / 6) + 1;

    // B. Controllo dell'Emisfero (Nord o Sud)
    const isSouth = latitude < 0;
    const stringaEmisfero = isSouth ? " +south" : "";

    // C. Costruzione dinamica della stringa di proiezione ED50
    const proj4String = `+proj=utm +zone=${fuso}${stringaEmisfero} +ellps=intl +towgs84=-87,-98,-121,0,0,0,0 +units=m +no_defs`;

    // D. Conversione WGS84 -> UTM ED50
    const [x, y] = proj4("WGS84", proj4String, [longitude, latitude]);

    // E. Salvataggio nello stato
    setClickedPoint({
      lat: latitude,
      lon: longitude,
      est: x.toFixed(2),
      nord: y.toFixed(2),
      fuso: fuso,
      emisfero: isSouth ? "S" : "N",
    });
  };

  // -----------------------------------------
  // 4. GESTIONE PERMESSI E GPS (Real-Time)
  // -----------------------------------------
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

  const centerOnMe = () => {
    if (location && mapRef.current) {
      mapRef.current.animateCamera(
        {
          center: {
            latitude: location.latitude,
            longitude: location.longitude,
          },
          zoom: 17,
          pitch: 40,
        },
        { duration: 1000 },
      );
    }
  };

  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;
    let headingSubscription: Location.LocationSubscription | null = null;

    const startTracking = async () => {
      setError(null);

      try {
        const hasPermission = await requestPermissions();
        if (!hasPermission) {
          setLocLoader(false);
          return;
        }

        // Tracciamento Posizione
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 1000,
            distanceInterval: 1,
          },
          (newLocation) => {
            setLocation({
              latitude: newLocation.coords.latitude,
              longitude: newLocation.coords.longitude,
              accuracy: newLocation.coords.accuracy,
              timestamp: new Date(newLocation.timestamp).toLocaleTimeString(),
            });
            setLocLoader(false);
          },
        );

        // Tracciamento Bussola
        headingSubscription = await Location.watchHeadingAsync((newHeading) => {
          setHeading(newHeading.trueHeading);
        });
      } catch (err: any) {
        setError(err.message);
        setLocLoader(false);
      }
    };

    startTracking();

    // Cleanup alla chiusura
    return () => {
      if (locationSubscription) locationSubscription.remove();
      if (headingSubscription) headingSubscription.remove();
    };
  }, []);

  // -----------------------------------------
  // 5. RENDERIZZAZIONE INTERFACCIA
  // -----------------------------------------

  // Schermata di caricamento iniziale
  if (locLoader || !location) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 15, fontSize: 16 }}>
          Attesa del segnale GPS...
        </Text>
        {error && (
          <Text
            style={{
              color: "red",
              marginTop: 10,
              padding: 20,
              textAlign: "center",
            }}
          >
            {error}
          </Text>
        )}
      </View>
    );
  }

  // Mappa principale
  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }}
        showsUserLocation={true}
        showsCompass={true}
        onPress={handleMapPress} // Intercetta il tocco per le coordinate UTM
        mapType={mapType}
      >
        {/* Marker del punto cliccato dall'utente */}
        {clickedPoint && (
          <Marker
            coordinate={{
              latitude: clickedPoint.lat,
              longitude: clickedPoint.lon,
            }}
            pinColor="red"
            title={`UTM ED50 - Fuso ${clickedPoint.fuso}${clickedPoint.emisfero}`}
            description={`E: ${clickedPoint.est} | N: ${clickedPoint.nord}`}
          />
        )}
      </MapView>

      {/* Riquadro superiore: Info GPS */}
      <View style={styles.topBox}>
        <Text style={styles.infoText}>
          Precisione GPS: ±{location.accuracy?.toFixed(1)} m
        </Text>
      </View>

      {/* Riquadro inferiore: Risultato coordinate cliccate */}
      {clickedPoint && (
        <View style={styles.bottomBox}>
          <Text style={styles.boxTitle}>Punto Selezionato (ED50)</Text>
          <Text style={styles.boxText}>
            Fuso UTM: {clickedPoint.fuso} {clickedPoint.emisfero}
          </Text>
          <Text style={styles.boxText}>Est (X): {clickedPoint.est} m</Text>
          <Text style={styles.boxText}>Nord (Y): {clickedPoint.nord} m</Text>
        </View>
      )}

      <View style={styles.buttonsSidebar}>
        <TouchableOpacity
          style={[styles.touchable, { backgroundColor: "transparent" }]}
        >
          <Ionicons
            style={styles.icons}
            name="menu-outline"
            color={"rgba(0, 0, 0, 0.65)"}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.touchable]}
          onPress={() => {
            setMapType("satellite");
          }}
        >
          <Text>Apri la finestra</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.touchable]} onPress={centerOnMe}>
          <Ionicons
            style={styles.icons}
            name="locate-outline"
            color={"rgba(0, 0, 0, 0.65)"}
          />
        </TouchableOpacity>
        
      </View>
    </View>
  );
}

// -----------------------------------------
// 6. STILI CSS
// -----------------------------------------
const styles = StyleSheet.create({
  icons: {
    aspectRatio: 1,
    fontSize: 30,
  },
  buttonsSidebar: {
    position: "absolute",
    borderRadius: 15,
    top: 15,
    right: 15,
    backgroundColor: "rgb(255, 255, 255)",
    display: "flex",
    flexDirection: "column",
    padding: 5,
    gap: 5,
  },
  touchable: {
    borderRadius: 15,
    aspectRatio: 1,
    width: 45,
    backgroundColor: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "rgba(0, 0, 0, 0.6)",
  },
  container: {
    flex: 1,
  },
  map: {
    width: "100%",
    height: "100%",
  },
  topBox: {
    position: "absolute",
    top: 15,
    alignSelf: "center",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  infoText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
  },
  bottomBox: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
    backgroundColor: "rgba(30, 30, 30, 0.9)",
    padding: 20,
    borderRadius: 15,
    minWidth: "85%",
    alignItems: "center",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  boxTitle: {
    color: "#4DA8DA",
    fontWeight: "bold",
    fontSize: 18,
    marginBottom: 10,
  },
  boxText: {
    color: "white",
    fontSize: 16,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginBottom: 4,
  },
});
