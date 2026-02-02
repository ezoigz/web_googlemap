'use client';

import React, { useState, useEffect } from 'react';
// เพิ่ม DirectionsRenderer เข้ามา
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer } from '@react-google-maps/api';
import { ref, set, onValue } from 'firebase/database';
import { db } from '../../lib/firebase';

const containerStyle = { width: '100%', height: '100vh' };
const defaultCenter = { lat: 13.7563, lng: 100.5018 };

export default function CaregiverPage() {
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: "AIzaSyAzp3dsvPcpo6j91UXZn1lFn6zmyOfsv9A"
    });

    const [myPos, setMyPos] = useState<google.maps.LatLngLiteral | null>(null);
    const [patientPos, setPatientPos] = useState<google.maps.LatLngLiteral | null>(null);
    // เพิ่ม state สำหรับเส้นทาง
    const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);

    // 1. พิกัดตัวเอง (ผู้ดูแล)
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.watchPosition((position) => {
                const pos = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                };
                setMyPos(pos);
                set(ref(db, 'locations/Caregiver-Admin'), {
                    lat: pos.lat,
                    lng: pos.lng,
                    role: 'caregiver',
                    timestamp: Date.now()
                });
            },
                (err) => console.error(err),
                { enableHighAccuracy: true }
            );
        }
    }, []);

    // 2. พิกัดผู้ป่วย
    useEffect(() => {
        const patientRef = ref(db, 'locations/Patient-01');
        onValue(patientRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                setPatientPos({ lat: data.lat, lng: data.lng });
            }
        });
    }, []);

    // 3. (ใหม่) คำนวณเส้นทางให้ผู้ดูแลเห็นด้วย
    useEffect(() => {
        if (myPos && patientPos) {
            const service = new google.maps.DirectionsService();
            service.route(
                {
                    origin: patientPos, // เริ่มต้นจากผู้ป่วย
                    destination: myPos, // มาหาเรา (ผู้ดูแล)
                    travelMode: google.maps.TravelMode.DRIVING,
                },
                (result, status) => {
                    if (status === 'OK' && result) {
                        setDirections(result);
                    }
                }
            );
        }
    }, [myPos, patientPos]); // อัปเดตเส้นเมื่อใครขยับ

    if (!isLoaded) return <div>กำลังโหลด...</div>;

    return (
        <div style={{ position: 'relative', height: '100vh', width: '100%' }}>
            <GoogleMap
                mapContainerStyle={containerStyle}
                center={patientPos || myPos || defaultCenter} // ให้กล้องโฟกัสผู้ป่วยก่อน
                zoom={14}
            >
                {myPos && <Marker position={myPos} title="ฉัน (ผู้ดูแล)" />}

                {patientPos && (
                    <Marker
                        position={patientPos}
                        title="ผู้ป่วย"
                        animation={google.maps.Animation.BOUNCE}
                    // icon="http://maps.google.com/mapfiles/kml/pal3/icon46.png" // เปลี่ยนไอคอนได้
                    />
                )}

                {/* แสดงเส้นทาง */}
                {directions && (
                    <DirectionsRenderer
                        directions={directions}
                        options={{
                            suppressMarkers: true, // ไม่ใช้หมุด default ของ Google Maps
                            polylineOptions: { strokeColor: "#FF0000", strokeWeight: 4 } // เส้นสีแดง
                        }}
                    />
                )}
            </GoogleMap>

            <div style={{
                position: 'absolute', top: 20, left: 20,
                background: 'white', padding: 15, borderRadius: 10,
                boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
            }}>
                <h3>🏥 มอนิเตอร์แบบเรียลไทม์</h3>
                <p>เส้นสีแดง = เส้นทางที่ผู้ป่วยกำลังเดินทางมา</p>
            </div>
        </div>
    );
}