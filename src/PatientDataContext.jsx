import { createContext, useContext, useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import { db } from './firebase';

const PatientDataContext = createContext(null);

export function PatientDataProvider({ children }) {
  const [patients, setPatients] = useState([]);
  const [visits, setVisits] = useState([]);
  const [triageRecords, setTriageRecords] = useState([]);
  const [labRequests, setLabRequests] = useState([]);
  const [labResults, setLabResults] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [payments, setPayments] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubs = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTs = Timestamp.fromDate(today);

    unsubs.push(
      onSnapshot(collection(db, 'patients'), (snap) => {
        setPatients(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      })
    );

    unsubs.push(
      onSnapshot(collection(db, 'visits'), (snap) => {
        setVisits(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      })
    );

    unsubs.push(
      onSnapshot(collection(db, 'triageRecords'), (snap) => {
        setTriageRecords(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      })
    );

    unsubs.push(
      onSnapshot(collection(db, 'labRequests'), (snap) => {
        setLabRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      })
    );

    unsubs.push(
      onSnapshot(collection(db, 'labResults'), (snap) => {
        setLabResults(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      })
    );

    unsubs.push(
      onSnapshot(collection(db, 'prescriptions'), (snap) => {
        setPrescriptions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      })
    );

    unsubs.push(
      onSnapshot(collection(db, 'inventory'), (snap) => {
        setInventory(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      })
    );

    unsubs.push(
      onSnapshot(collection(db, 'payments'), (snap) => {
        setPayments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      })
    );

    unsubs.push(
      onSnapshot(collection(db, 'consultations'), (snap) => {
        setConsultations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      })
    );

    setLoading(false);
    return () => unsubs.forEach((u) => u && u());
  }, []);

  return (
    <PatientDataContext.Provider
      value={{
        patients,
        visits,
        triageRecords,
        labRequests,
        labResults,
        prescriptions,
        inventory,
        payments,
        consultations,
        loading,
      }}
    >
      {children}
    </PatientDataContext.Provider>
  );
}

export function usePatientData() {
  return useContext(PatientDataContext);
}
