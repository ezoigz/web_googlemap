'use client';
import dynamic from 'next/dynamic';
import React from 'react';

const PatientMap = dynamic(() => import('./PatientMap.client'), { ssr: false, loading: () => <div>กำลังโหลดแผนที่...</div> });

export default function PatientPage() {
    return <PatientMap />;
}
