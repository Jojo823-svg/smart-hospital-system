// src/context/RealtimeProvider.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  setDoc, 
  deleteDoc,
  query,
  orderBy,
  Timestamp,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../firebase';

const RealtimeContext = createContext(undefined);

const COLLECTIONS = [
  'patients',
  'visits', 
  'payments',
  'triageRecords',
  'consultations',
  'labRequests',
  'labResults',
  'prescriptions',
  'inventory',
  'staff'
];

export function RealtimeProvider({ children }) {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const listeners = {};

    COLLECTIONS.forEach((collectionName) => {
      let q = query(collection(db, collectionName));
      
      if (collectionName === 'patients') {
        q = query(q, orderBy('registeredAt', 'desc'));
      } else if (collectionName === 'payments') {
        q = query(q, orderBy('processedAt', 'desc'));
      } else if (collectionName === 'visits') {
        q = query(q, orderBy('visitDate', 'desc'));
      }

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const items = [];
          snapshot.forEach((doc) => {
            items.push({ 
              id: doc.id, 
              ...doc.data() 
            });
          });

          setData((prev) => ({
            ...prev,
            [collectionName]: items
          }));
          
          setLoading(false);
          setError(null);
        },
        (err) => {
          console.error(`Error listening to ${collectionName}:`, err);
          setError(err.message);
          setLoading(false);
        }
      );

      listeners[collectionName] = unsubscribe;
    });

    return () => {
      Object.values(listeners).forEach((unsubscribe) => {
        if (unsubscribe) unsubscribe();
      });
    };
  }, []);

  const addDocument = async (collectionName, documentData) => {
    try {
      const docRef = doc(collection(db, collectionName));
      await setDoc(docRef, {
        ...documentData,
        id: docRef.id,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      return { success: true, id: docRef.id };
    } catch (error) {
      console.error('Error adding document:', error);
      return { success: false, error: error.message };
    }
  };

  const updateDocument = async (collectionName, docId, documentData) => {
    try {
      const docRef = doc(db, collectionName, docId);
      await updateDoc(docRef, {
        ...documentData,
        updatedAt: Timestamp.now()
      });
      return { success: true };
    } catch (error) {
      console.error('Error updating document:', error);
      return { success: false, error: error.message };
    }
  };

  const deleteDocument = async (collectionName, docId) => {
    try {
      const docRef = doc(db, collectionName, docId);
      await deleteDoc(docRef);
      return { success: true };
    } catch (error) {
      console.error('Error deleting document:', error);
      return { success: false, error: error.message };
    }
  };

  const processPayment = async (paymentData) => {
    try {
      let paymentId;
      
      if (paymentData.method === 'Insurance') {
        const result = await addDocument('payments', {
          ...paymentData,
          insuranceStatus: 'Pending',
          insuranceApprovalEmail: 'fatuma.omar@strathmore.edu',
          insuranceApprovalSent: true,
          insuranceApprovedAt: null,
          insuranceApprovedBy: null,
          status: 'Pending',
          processedAt: Timestamp.now()
        });
        
        if (result.success && result.id) {
          paymentId = result.id;
          setTimeout(async () => {
            await approveInsurancePayment(paymentId);
          }, 2000);
        }
        
        return { success: true, id: paymentId, status: 'Pending' };
      } else {
        const result = await addDocument('payments', {
          ...paymentData,
          status: 'Paid',
          processedAt: Timestamp.now()
        });
        
        return { success: true, id: result.id, status: 'Paid' };
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      return { success: false, error: error.message };
    }
  };

  const approveInsurancePayment = async (paymentId) => {
    try {
      await runTransaction(db, async (transaction) => {
        const paymentRef = doc(db, 'payments', paymentId);
        const paymentDoc = await transaction.get(paymentRef);
        
        if (!paymentDoc.exists()) {
          throw new Error('Payment not found');
        }

        transaction.update(paymentRef, {
          insuranceStatus: 'Approved',
          insuranceApprovedAt: Timestamp.now(),
          insuranceApprovedBy: 'System (Auto-Approval)',
          status: 'Paid',
          updatedAt: Timestamp.now()
        });

        const paymentData = paymentDoc.data();
        if (paymentData.visitId) {
          const visitRef = doc(db, 'visits', paymentData.visitId);
          transaction.update(visitRef, {
            paymentStatus: 'Completed',
            updatedAt: Timestamp.now()
          });
        }
      });
      
      return { success: true };
    } catch (error) {
      console.error('Error approving insurance:', error);
      return { success: false, error: error.message };
    }
  };

  const getFilteredData = (collectionName, filters = []) => {
    const collectionData = data[collectionName] || [];
    
    if (filters.length === 0) return collectionData;
    
    return collectionData.filter((item) => {
      return filters.every((filter) => {
        const value = item[filter.field];
        if (filter.operator === '==') return value === filter.value;
        if (filter.operator === '!=') return value !== filter.value;
        if (filter.operator === 'in') {
          return Array.isArray(filter.value) && filter.value.includes(value);
        }
        return true;
      });
    });
  };

  const searchData = (searchTerm, collectionName = null) => {
    const term = searchTerm.toLowerCase();
    const collections = collectionName ? [collectionName] : COLLECTIONS;
    
    const results = {};
    collections.forEach((key) => {
      const items = data[key] || [];
      results[key] = items.filter((item) => {
        return Object.entries(item).some(([field, value]) => {
          if (typeof value === 'string' && value.toLowerCase().includes(term)) {
            return true;
          }
          if (typeof value === 'number' && String(value).includes(term)) {
            return true;
          }
          return false;
        });
      });
    });
    
    return results;
  };

  const getCollection = (name) => data[name] || [];

  const value = {
    data,
    loading,
    error,
    patients: data.patients || [],
    visits: data.visits || [],
    payments: data.payments || [],
    triageRecords: data.triageRecords || [],
    consultations: data.consultations || [],
    labRequests: data.labRequests || [],
    labResults: data.labResults || [],
    prescriptions: data.prescriptions || [],
    inventory: data.inventory || [],
    staff: data.staff || [],
    addDocument,
    updateDocument,
    deleteDocument,
    processPayment,
    approveInsurancePayment,
    getFilteredData,
    searchData,
    getCollection
  };

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return context;
}

export default RealtimeProvider;