// AdvertiserApp.js
import React, { useEffect, useState } from 'react';
import {
  Button,
  PermissionsAndroid,
  Platform,
  SafeAreaView,
  Text,
  View,
  StyleSheet,
  Alert,
  FlatList,
} from 'react-native';
import BleAdvertiser from 'react-native-ble-advertiser';
import { BleManager } from 'react-native-ble-plx';

const SERVICE_UUID = '0000180D-0000-1000-8000-00805F9B34FB'; // Heart Rate Service UUID
const bleManager = new BleManager();

export default function AdvertiserApp() {
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [devices, setDevices] = useState({}); // device.id => { device, lastSeen, rssi }

  useEffect(() => {
    const requestPermissions = async () => {
      if (Platform.OS === 'android') {
        if (Platform.Version >= 31) {
          await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ]);
        } else {
          await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
          );
        }
      }

      try {
        await BleAdvertiser.setCompanyId(0x004C); // Apple company ID for iBeacon
      } catch (e) {
        Alert.alert('Error', `BLE init error: ${e.message}`);
      }
    };

    requestPermissions();

    return () => {
      BleAdvertiser.stopBroadcast().catch(() => {});
      bleManager.stopDeviceScan();
    };
  }, []);

  const startBroadcasting = async () => {
    try {
      await BleAdvertiser.broadcast(SERVICE_UUID, [], {
        includeDeviceName: true,
        includeTxPowerLevel: true,
      });
      setIsBroadcasting(true);
    } catch (e) {
      Alert.alert('Error', `Broadcast failed: ${e.message}`);
    }
  };

  const stopBroadcasting = async () => {
    try {
      await BleAdvertiser.stopBroadcast();
      setIsBroadcasting(false);
    } catch (e) {
      Alert.alert('Error', `Stop failed: ${e.message}`);
    }
  };

  useEffect(() => {
    bleManager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.warn(error);
        return;
      }

      if (device?.name && device.rssi !== null) {
        setDevices(prev => ({
          ...prev,
          [device.id]: {
            ...device,
            lastSeen: Date.now(),
            rssi: device.rssi,
          },
        }));
      }
    });

    return () => {
      bleManager.stopDeviceScan();
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setDevices(prev => {
        const now = Date.now();
        const updated = Object.fromEntries(
          Object.entries(prev).filter(([_, dev]) => now - dev.lastSeen < 3000)
        );
        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const estimateDistance = (rssi, txPower = -59) => {
    if (!rssi) return null;
    const ratio = (txPower - rssi) / 20.0;
    const distance = Math.pow(10, ratio);
    return distance.toFixed(2); // meters
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>BLE Advertiser & Scanner</Text>
      <Text>Status: {isBroadcasting ? 'Broadcasting' : 'Idle'}</Text>
      <View style={styles.button}>
        <Button
          title={isBroadcasting ? 'Stop Broadcasting' : 'Start Broadcasting'}
          onPress={isBroadcasting ? stopBroadcasting : startBroadcasting}
        />
      </View>

      <Text style={{ marginTop: 30, fontWeight: 'bold' }}>Nearby Devices:</Text>
      <FlatList
        data={Object.values(devices)}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const distance = estimateDistance(item.rssi);
          return (
            <View style={styles.deviceItem}>
              <Text style={{ fontWeight: 'bold' }}>{item.name}</Text>
              <Text>ID: {item.id}</Text>
              <Text>RSSI: {item.rssi} dBm</Text>
              <Text>Estimated Distance: {distance} meters</Text>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 16 },
  button: { marginTop: 20 },
  deviceItem: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    width: 300,
  },
});
