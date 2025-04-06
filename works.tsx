import React, { useEffect, useState } from 'react';
import {
  Button,
  PermissionsAndroid,
  Platform,
  Alert,
  SafeAreaView,
  Text,
  View,
  StyleSheet,
  FlatList,
  ScrollView,
  NativeEventEmitter,
  NativeModules,
} from 'react-native';
import BleAdvertiser from 'react-native-ble-advertiser';

const SERVICE_UUID = '0000180D-0000-1000-8000-00805F9B34FB'; // Heart Rate Service UUID

export default function App() {
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState([]);
  const [logs, setLogs] = useState([]);
  

  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prevLogs) => [`[${timestamp}] ${message}`, ...prevLogs.slice(0, 19)]);
    console.log(`[${timestamp}] ${message}`);
  };

  const handleDeviceFound = (device) => {
    setDevices((prevDevices) => {
      const exists = prevDevices.find((d) => d.id === device.id);
      if (!exists) return [...prevDevices, device];
      return prevDevices;
    });
  };

  useEffect(() => {
    const setup = async () => {
      try {
        addLog('Initializing BLE setup...');
        await BleAdvertiser.setCompanyId(0x004C);

        if (Platform.OS === 'android') {
          if (Platform.Version >= 31) {
            const result = await PermissionsAndroid.requestMultiple([
              PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
              PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
              PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
              PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            ]);
            addLog('Permissions requested');
          } else {
            const granted = await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
            );
            addLog(`Location permission: ${granted}`);
          }
        }

        const eventEmitter = new NativeEventEmitter(NativeModules.BLEAdvertiser);

        eventEmitter.addListener('onDeviceFound', handleDeviceFound);
        eventEmitter.addListener('onScanStarted', () => addLog('Scan started'));
        eventEmitter.addListener('onScanStopped', () => addLog('Scan stopped'));
        eventEmitter.addListener('onAdvertisingStarted', () => addLog('Advertising started'));
        eventEmitter.addListener('onAdvertisingStopped', () => addLog('Advertising stopped'));

      } catch (e) {
        addLog(`Setup error: ${e.message}`);
      }
    };

    setup();

    return () => {
      BleAdvertiser.stopBroadcast().catch(() => {});
      BleAdvertiser.stopScan().catch(() => {});
    };
  }, []);

  const startBroadcast = async () => {
    try {
      await BleAdvertiser.broadcast(SERVICE_UUID, [], {});
      setIsBroadcasting(true);
      addLog('Broadcast started');
    } catch (e) {
      addLog(`Broadcast error: ${e.message}`);
      Alert.alert('Error', 'Failed to start broadcasting');
    }
  };

  const stopBroadcast = async () => {
    try {
      await BleAdvertiser.stopBroadcast();
      setIsBroadcasting(false);
      addLog('Broadcast stopped');
    } catch (e) {
      addLog(`Stop broadcast error: ${e.message}`);
    }
  };

  const startScan = async () => {
    try {
      setDevices([]);
      await BleAdvertiser.scan([], {});
      setIsScanning(true);
      addLog('Scan started');
    } catch (e) {
      addLog(`Scan error: ${e.message}`);
      Alert.alert('Error', 'Failed to start scanning');
    }
  };

  const stopScan = async () => {
    try {
      await BleAdvertiser.stopScan();
      setIsScanning(false);
      addLog('Scan stopped');
    } catch (e) {
      addLog(`Stop scan error: ${e.message}`);
    }
  };

  const renderDeviceItem = ({ item }) => (
    <View style={styles.deviceItem}>
      <Text style={styles.deviceName}>{item.name || 'Unnamed Device'}</Text>
      <Text style={styles.deviceId}>ID: {item.id}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>BLE Advertiser + Scanner</Text>

      <View style={styles.section}>
        <Button
          title={isBroadcasting ? 'Stop Broadcasting' : 'Start Broadcasting'}
          onPress={isBroadcasting ? stopBroadcast : startBroadcast}
        />
      </View>

      <View style={styles.section}>
        <Button
          title={isScanning ? 'Stop Scanning' : 'Start Scanning'}
          onPress={isScanning ? stopScan : startScan}
        />
      </View>

      <Text style={styles.subTitle}>Devices Found:</Text>
      <FlatList
        data={devices}
        keyExtractor={(item) => item.id}
        renderItem={renderDeviceItem}
        contentContainerStyle={{ paddingBottom: 10 }}
      />

      <Text style={styles.subTitle}>Logs:</Text>
      <ScrollView style={styles.logsContainer}>
        {logs.map((log, index) => (
          <Text key={index} style={styles.logText}>
            {log}
          </Text>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 16 },
  subTitle: { fontSize: 16, fontWeight: 'bold', marginTop: 16 },
  section: { marginVertical: 10 },
  deviceItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    paddingVertical: 8,
  },
  deviceName: { fontWeight: 'bold' },
  deviceId: { color: '#555' },
  logsContainer: {
    marginTop: 10,
    backgroundColor: '#f0f0f0',
    padding: 10,
    maxHeight: 200,
    borderRadius: 6,
  },
  logText: { fontSize: 12, color: '#333' },
});
