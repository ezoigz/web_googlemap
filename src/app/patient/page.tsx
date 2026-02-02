'use client';

import React, { useState, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer } from '@react-google-maps/api';
import { ref, set, onValue } from 'firebase/database';
import { db } from '../../lib/firebase';

const containerStyle = { width: '100%', height: '100vh' };
const defaultCenter = { lat: 13.7563, lng: 100.5018 };

export default function PatientPage() {
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: "AIzaSyAzp3dsvPcpo6j91UXZn1lFn6zmyOfsv9A" // ใช้ Key เดิมของคุณ
    });

    const [myPos, setMyPos] = useState<google.maps.LatLngLiteral | null>(null);
    const [caregiverPos, setCaregiverPos] = useState<google.maps.LatLngLiteral | null>(null);
    const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
    const [statusText, setStatusText] = useState("กำลังค้นหาพิกัด GPS...");

    // 1. หาพิกัดตัวเอง (อัปเดตตลอดเวลา)
    useEffect(() => {
        if (navigator.geolocation) {
            const watchId = navigator.geolocation.watchPosition(
                (position) => {
                    const pos = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    };
                    setMyPos(pos);
                    setStatusText("✅ กำลังเดินทาง... (อัปเดตเรียลไทม์)");

                    // ส่งขึ้น Firebase
                    set(ref(db, 'locations/Patient-01'), {
                        lat: pos.lat,
                        lng: pos.lng,
                        role: 'patient',
                        timestamp: Date.now()
                    });
                },
                (err) => console.error("GPS Error:", err),
                { enableHighAccuracy: true }
            );
            return () => navigator.geolocation.clearWatch(watchId);
        }
    }, []);

    // 2. ฟังพิกัดผู้ดูแล
    useEffect(() => {
        const caregiverRef = ref(db, 'locations/Caregiver-Admin');
        const unsubscribe = onValue(caregiverRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                setCaregiverPos({ lat: data.lat, lng: data.lng });
            }
        });
        return () => unsubscribe();
    }, []);

    // 3. (ใหม่) คำนวณเส้นทางอัตโนมัติ เมื่อพิกัดเปลี่ยน!
    useEffect(() => {
        if (myPos && caregiverPos) {
            const service = new google.maps.DirectionsService();
            service.route(
                {
                    origin: myPos,
                    destination: caregiverPos,
                    travelMode: google.maps.TravelMode.DRIVING, // หรือ WALKING
                },
                (result, status) => {
                    if (status === 'OK' && result) {
                        setDirections(result);
                    }
                }
            );
        }
    }, [myPos, caregiverPos]); // สั่งให้รันใหม่ทุกครั้งที่ myPos หรือ caregiverPos เปลี่ยน

    if (!isLoaded) return <div>กำลังโหลดแผนที่...</div>;

    return (
        <div style={{ position: 'relative', height: '100vh', width: '100%' }}>
            <GoogleMap
                mapContainerStyle={containerStyle}
                center={myPos || defaultCenter}
                zoom={15}
            >
                {myPos && <Marker position={myPos} title="ฉัน" />}
                {caregiverPos && <Marker position={caregiverPos} title="ผู้ดูแล" />}

                {/* แสดงเส้นทาง */}
                {directions && (
                    <DirectionsRenderer
                        directions={directions}
                        options={{
                            suppressMarkers: true, // ซ่อนหมุด A/B ของ Google (ใช้หมุดเราแทน)
                            polylineOptions: { strokeColor: "#0088FF", strokeWeight: 5 }
                        }}
                    />
                )}
            </GoogleMap>

            <div style={{
                position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)',
                background: 'white', padding: 15, borderRadius: 20,
                boxShadow: '0 4px 10px rgba(0,0,0,0.2)', textAlign: 'center', width: '80%'
            }}>
                <h3>🚗 ระบบนำทางอัตโนมัติ</h3>
                <p>{statusText}</p>
                <small style={{ color: 'gray' }}>เส้นทางจะปรับตามตำแหน่งจริง</small>
            </div>
        </div>
    );
}