'use client';

import React, { useState, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer, Polyline } from '@react-google-maps/api';
import { ref, set, onValue } from 'firebase/database';
import { db } from '../../lib/firebase';

const containerStyle = { width: '100%', height: '100vh' };
const defaultCenter = { lat: 13.7563, lng: 100.5018 };

export default function PatientMap() {
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string
    });

    const [myPos, setMyPos] = useState<google.maps.LatLngLiteral | null>(null);
    const [caregiverPos, setCaregiverPos] = useState<google.maps.LatLngLiteral | null>(null);
    const [directionsToCaregiver, setDirectionsToCaregiver] = useState<google.maps.DirectionsResult | null>(null);
    const [directionsToPatient, setDirectionsToPatient] = useState<google.maps.DirectionsResult | null>(null);
    const [caregiverPath, setCaregiverPath] = useState<google.maps.LatLngLiteral[] | null>(null);
    const [patientPath, setPatientPath] = useState<google.maps.LatLngLiteral[] | null>(null);

    // route display mode: single or both (default single: patient -> caregiver)
    const [routeMode] = useState<'toCaregiver' | 'toPatient' | 'both'>('toCaregiver');

    // Names for markers (can come from DB)
    const [patientName, setPatientName] = useState<string>('ผู้มีภาวะพึ่งพิง');
    const [caregiverName, setCaregiverName] = useState<string | null>(null);

    const editPatientName = () => {
        const n = prompt('ชื่อใหม่สำหรับคุณ:', patientName);
        if (n) {
            setPatientName(n);
            // store to DB under patient node (one-time update)
            set(ref(db, 'locations/Patient-01/name'), n);
        }
    };

    // 1. หาพิกัดตัวเอง
    useEffect(() => {
        if (navigator.geolocation) {
            const watchId = navigator.geolocation.watchPosition(
                (position) => {
                    const pos = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    };
                    setMyPos(pos);

                    // บันทึกพิกัด (ไม่เก็บชื่อทุกครั้งเพื่อลดการเขียน DB)
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
                if (data.name) setCaregiverName(data.name);
            }
        });
        return () => unsubscribe();
    }, []);

    // 3. คำนวณเส้นทาง (ตามโหมดการแสดง)
    useEffect(() => {
        if (isLoaded && myPos && caregiverPos && typeof window !== 'undefined' && (window as unknown as Window & { google?: typeof google }).google) {
            try {
                const G = (window as unknown as Window & { google: typeof google }).google;
                const service = new G.maps.DirectionsService();

                const requestRoute = (
                    origin: google.maps.LatLngLiteral,
                    destination: google.maps.LatLngLiteral,
                    setDirections: (r: google.maps.DirectionsResult | null) => void,
                    setPath: (p: google.maps.LatLngLiteral[] | null) => void,
                    label?: string
                ) => {
                    service.route({ origin, destination, travelMode: G.maps.TravelMode.DRIVING }, (result: google.maps.DirectionsResult | null, status: google.maps.DirectionsStatus) => {
                        if (status === 'OK' && result) {
                            setDirections(result);
                            const overview = result.routes?.[0]?.overview_path?.map((p: google.maps.LatLng) => ({ lat: p.lat(), lng: p.lng() }));
                            setPath(overview ?? null);
                        } else {
                            setDirections(null);
                            setPath(null);
                            console.warn('No route for', label, status);
                        }
                    });
                };

                // calculate only according to selected mode
                if (routeMode === 'toCaregiver' || routeMode === 'both') {
                    requestRoute(myPos, caregiverPos, setDirectionsToCaregiver, setCaregiverPath, 'toCaregiver');
                } else {
                    // avoid calling setState synchronously inside effect
                    Promise.resolve().then(() => { setDirectionsToCaregiver(null); setCaregiverPath(null); });
                }

                if (routeMode === 'toPatient' || routeMode === 'both') {
                    requestRoute(caregiverPos, myPos, setDirectionsToPatient, setPatientPath, 'toPatient');
                } else {
                    // avoid calling setState synchronously inside effect
                    Promise.resolve().then(() => { setDirectionsToPatient(null); setPatientPath(null); });
                }

            } catch (err) {
                console.error('DirectionsService error:', err);
            }
        }
    }, [isLoaded, myPos, caregiverPos, routeMode]);



    if (!isLoaded) return <div>กำลังโหลดแผนที่...</div>;

    // SVG person icon generator
    const personSvg = (color = '#1976D2') => `
        <svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 24 24'>
            <circle cx='12' cy='8' r='3' fill='${color}' />
            <path d='M12 14c-4 0-6 2-6 4v1h12v-1c0-2-2-4-6-4z' fill='${color}' />
        </svg>`;

    // Google namespace when map is loaded
    const G = isLoaded ? (window as unknown as Window & { google: typeof google }).google : undefined;

    const patientIcon = G ? { url: `data:image/svg+xml;utf8,${encodeURIComponent(personSvg('#1976D2'))}`, scaledSize: new G.maps.Size(36, 36), labelOrigin: new G.maps.Point(18, 40) } : undefined;
    const caregiverIcon = G ? { url: `data:image/svg+xml;utf8,${encodeURIComponent(personSvg('#D32F2F'))}`, scaledSize: new G.maps.Size(36, 36), labelOrigin: new G.maps.Point(18, 40) } : undefined;

    return (
        <div style={{ position: 'relative', height: '100vh', width: '100%' }}>
            <GoogleMap
                mapContainerStyle={containerStyle}
                center={myPos || defaultCenter}
                zoom={15}
            >
                {/* map content: markers and polylines are rendered here */}


                {/* 👇👇 หมุดฉัน (Patient) พร้อมชื่อแปะตลอดเวลา 👇👇 */}
                {myPos && (
                    <Marker
                        position={myPos}
                        icon={patientIcon}
                        label={{
                            text: patientName,
                            color: "black",
                            fontWeight: "bold",
                            fontSize: "14px",
                        }}
                        onClick={editPatientName}
                    />
                )}

                {/* 👇👇 หมุดผู้ดูแล (Caregiver) พร้อมชื่อแปะตลอดเวลา 👇👇 */}
                {caregiverPos && (
                    <Marker
                        position={caregiverPos}
                        icon={caregiverIcon}
                        label={{
                            text: caregiverName || 'ผู้ดูแล',
                            color: "black",
                            fontWeight: "bold",
                            fontSize: "14px"
                        }}
                    />
                )}

                {directionsToCaregiver && (
                    <DirectionsRenderer
                        directions={directionsToCaregiver}
                        options={{
                            suppressMarkers: true,
                            polylineOptions: { strokeOpacity: 0 } // hide default polyline, we render custom Polyline with arrows
                        }}
                    />
                )}

                {directionsToPatient && (
                    <DirectionsRenderer
                        directions={directionsToPatient}
                        options={{
                            suppressMarkers: true,
                            polylineOptions: { strokeOpacity: 0 }
                        }}
                    />
                )}

                {/* Custom polylines with outline + arrows for navigation-like routes */}
                {caregiverPath && G && (
                    <>
                        {/* outline (white) to make the blue route pop on the map */}
                        <Polyline
                            path={caregiverPath}
                            options={{
                                strokeColor: '#ffffff',
                                strokeOpacity: 0.92,
                                strokeWeight: 12,
                                clickable: false,
                                zIndex: 4
                            }}
                        />

                        {/* colored route with arrow icons */}
                        <Polyline
                            path={caregiverPath}
                            options={{
                                strokeColor: '#0088FF',
                                strokeOpacity: 1,
                                strokeWeight: 8,
                                clickable: false,
                                zIndex: 5
                            }}
                        />

                        {/* small white circles repeated along the route */}
                        <Polyline
                            path={caregiverPath}
                            options={{
                                strokeOpacity: 0,
                                clickable: false,
                                zIndex: 6,
                                icons: [
                                    {
                                        icon: {
                                            path: G.maps.SymbolPath.CIRCLE,
                                            scale: 6,
                                            strokeColor: '#ffffff',
                                            fillColor: '#ffffff'
                                        },
                                        offset: '0',
                                        repeat: '40px'
                                    }
                                ]
                            }}
                        />
                    </>
                )}

                {patientPath && G && (
                    <>
                        <Polyline
                            path={patientPath}
                            options={{
                                strokeColor: '#ffffff',
                                strokeOpacity: 0.92,
                                strokeWeight: 12,
                                clickable: false,
                                zIndex: 4
                            }}
                        />

                        <Polyline
                            path={patientPath}
                            options={{
                                strokeColor: '#22C55E',
                                strokeOpacity: 1,
                                strokeWeight: 8,
                                clickable: false,
                                zIndex: 5
                            }}
                        />

                        {/* small white circles repeated along the route */}
                        <Polyline
                            path={patientPath}
                            options={{
                                strokeOpacity: 0,
                                clickable: false,
                                zIndex: 6,
                                icons: [
                                    {
                                        icon: {
                                            path: G.maps.SymbolPath.CIRCLE,
                                            scale: 6,
                                            strokeColor: '#ffffff',
                                            fillColor: '#ffffff'
                                        },
                                        offset: '0',
                                        repeat: '40px'
                                    }
                                ]
                            }}
                        />
                    </>
                )}
            </GoogleMap>


        </div >
    );
}
