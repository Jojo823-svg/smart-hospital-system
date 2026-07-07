// src/pages/SeedPage.jsx
import { useState } from 'react';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  writeBatch,
  serverTimestamp,
  Timestamp,
  addDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Spinner } from '../Spinner';
import { useToast } from '../Toast';

const STAFF = [
  { staffId: 'REC-001', email: 'receptionist@hospital.com', role: 'Receptionist', firstName: 'Mary', lastName: 'Wanjiru' },
  { staffId: 'TRN-001', email: 'triage@hospital.com', role: 'TriageNurse', firstName: 'John', lastName: 'Kamau' },
  { staffId: 'CLN-001', email: 'clinician@hospital.com', role: 'Clinician', firstName: 'Dr. James', lastName: 'Otieno' },
  { staffId: 'LAB-001', email: 'lab@hospital.com', role: 'LabTechnician', firstName: 'Grace', lastName: 'Muthoni' },
  { staffId: 'PHM-001', email: 'pharmacist@hospital.com', role: 'Pharmacist', firstName: 'Peter', lastName: 'Njoroge' },
];

const INVENTORY = [
  { medicationName: 'Paracetamol', category: 'Analgesic', stockLevel: 500, unit: 'tablets', reorderLevel: 50 },
  { medicationName: 'Amoxicillin', category: 'Antibiotic', stockLevel: 300, unit: 'capsules', reorderLevel: 50 },
  { medicationName: 'Metformin', category: 'Antidiabetic', stockLevel: 200, unit: 'tablets', reorderLevel: 50 },
  { medicationName: 'Omeprazole', category: 'Antacid', stockLevel: 150, unit: 'capsules', reorderLevel: 50 },
  { medicationName: 'Ibuprofen', category: 'Analgesic', stockLevel: 400, unit: 'tablets', reorderLevel: 50 },
  { medicationName: 'Ciprofloxacin', category: 'Antibiotic', stockLevel: 100, unit: 'tablets', reorderLevel: 50 },
  { medicationName: 'Atenolol', category: 'Antihypertensive', stockLevel: 120, unit: 'tablets', reorderLevel: 50 },
  { medicationName: 'Amlodipine', category: 'Antihypertensive', stockLevel: 80, unit: 'tablets', reorderLevel: 50 },
  { medicationName: 'Metronidazole', category: 'Antibiotic', stockLevel: 250, unit: 'tablets', reorderLevel: 50 },
  { medicationName: 'Doxycycline', category: 'Antibiotic', stockLevel: 180, unit: 'capsules', reorderLevel: 50 },
  { medicationName: 'Cotrimoxazole', category: 'Antibiotic', stockLevel: 300, unit: 'tablets', reorderLevel: 50 },
  { medicationName: 'Diclofenac', category: 'Analgesic', stockLevel: 200, unit: 'tablets', reorderLevel: 50 },
  { medicationName: 'Salbutamol Inhaler', category: 'Respiratory', stockLevel: 60, unit: 'inhalers', reorderLevel: 50 },
  { medicationName: 'ORS Sachets', category: 'Rehydration', stockLevel: 500, unit: 'sachets', reorderLevel: 50 },
  { medicationName: 'Zinc Tablets', category: 'Supplement', stockLevel: 400, unit: 'tablets', reorderLevel: 50 },
  { medicationName: 'Folic Acid', category: 'Supplement', stockLevel: 350, unit: 'tablets', reorderLevel: 50 },
  { medicationName: 'Iron Tablets', category: 'Supplement', stockLevel: 300, unit: 'tablets', reorderLevel: 50 },
  { medicationName: 'Vitamin C', category: 'Supplement', stockLevel: 500, unit: 'tablets', reorderLevel: 50 },
  { medicationName: 'Antacid Tablets', category: 'Antacid', stockLevel: 250, unit: 'tablets', reorderLevel: 50 },
  { medicationName: 'Oral Contraceptives', category: 'Contraceptive', stockLevel: 150, unit: 'packs', reorderLevel: 50 },
];

// 8 dummy patients with full visit flow
const DUMMY_PATIENTS = [
  { firstName: 'Grace', lastName: 'Achieng', dateOfBirth: '1990-04-12', gender: 'Female', phoneNumber: '0712345678', insuranceNumber: 'NHIF-1029384', visitReason: 'Fever and headache for 3 days', method: 'Cash', amount: 1500, triage: { bloodPressure: '120/80', temperature: 38.2, weight: 65, height: 165, pulse: 78, oxygenSaturation: 98, bloodSugar: 5.4, chiefComplaint: 'High fever, severe headache, body weakness', priority: 'Urgent' }, consultation: { presentingComplaint: 'Fever and headache for 3 days', historyOfPresentingIllness: 'Onset gradual, worse at night. No vomiting. Mild joint pains.', examinationFindings: 'Temperature elevated. Throat slightly red. No chest crackles.', diagnosis: 'Malaria (suspected)', treatmentPlan: 'Antimalarial therapy, rest, hydration' }, labs: ['Malaria RDT', 'Full Blood Count'], labResults: [{ testType: 'Malaria RDT', resultDetails: 'Positive for P. falciparum', referenceRange: 'Negative', resultStatus: 'Abnormal', notes: 'High parasitemia' }, { testType: 'Full Blood Count', resultDetails: 'Hb 9.2 g/dL, WBC 11.3, Platelets 89', referenceRange: 'Hb 12-16, WBC 4-11, Plt 150-450', resultStatus: 'Abnormal', notes: 'Thrombocytopenia and anemia noted' }], meds: [{ medicationName: 'Artemether/Lumefantrine', dosage: '4 tablets', frequency: 'Twice Daily', duration: '3 days', instructions: 'Take with food' }, { medicationName: 'Paracetamol', dosage: '1000mg', frequency: 'Three Times Daily', duration: '5 days', instructions: 'For fever' }] },
  { firstName: 'Brian', lastName: 'Omondi', dateOfBirth: '1985-09-23', gender: 'Male', phoneNumber: '0722333444', insuranceNumber: '', visitReason: 'Persistent cough and chest pain', method: 'Cash', amount: 2000, triage: { bloodPressure: '130/85', temperature: 37.1, weight: 72, height: 178, pulse: 88, oxygenSaturation: 96, bloodSugar: null, chiefComplaint: 'Cough for 2 weeks, worse in morning', priority: 'Semi-Urgent' }, consultation: { presentingComplaint: 'Persistent productive cough', historyOfPresentingIllness: '2 weeks duration, yellow sputum, night sweats, weight loss', examinationFindings: 'Reduced breath sounds right lower zone', diagnosis: 'Lower respiratory tract infection', treatmentPlan: 'Antibiotics, sputum culture, review in 1 week' }, labs: ['Sputum Culture', 'Full Blood Count'], labResults: [{ testType: 'Sputum Culture', resultDetails: 'Streptococcus pneumoniae isolated', referenceRange: 'No growth', resultStatus: 'Abnormal', notes: 'Sensitive to penicillin' }, { testType: 'Full Blood Count', resultDetails: 'WBC 13.5, Neutrophils 82%', referenceRange: 'WBC 4-11', resultStatus: 'Abnormal', notes: 'Bacterial infection pattern' }], meds: [{ medicationName: 'Amoxicillin', dosage: '500mg', frequency: 'Three Times Daily', duration: '7 days', instructions: 'Complete full course' }, { medicationName: 'Ibuprofen', dosage: '400mg', frequency: 'Twice Daily', duration: '5 days', instructions: 'After meals' }] },
  { firstName: 'Faith', lastName: 'Wanjiku', dateOfBirth: '1995-01-30', gender: 'Female', phoneNumber: '0733444555', insuranceNumber: 'AAR-5566778', visitReason: 'Abdominal pain and nausea', method: 'Insurance', insuranceProvider: 'AAR', amount: 0, triage: { bloodPressure: '110/70', temperature: 36.8, weight: 58, height: 160, pulse: 72, oxygenSaturation: 99, bloodSugar: 4.8, chiefComplaint: 'Lower abdominal pain, 4 days', priority: 'Semi-Urgent' }, consultation: { presentingComplaint: 'Lower abdominal pain', historyOfPresentingIllness: '4 days, cramping, worse after eating. Nausea. No diarrhea.', examinationFindings: 'Tenderness in right iliac fossa, no rebound', diagnosis: 'Suspected appendicitis', treatmentPlan: 'Urinalysis, abdominal review, possible referral' }, labs: ['Urinalysis', 'Full Blood Count'], labResults: [{ testType: 'Urinalysis', resultDetails: 'Leucocytes ++, blood +, protein trace', referenceRange: 'Negative', resultStatus: 'Abnormal', notes: 'Possible UTI' }, { testType: 'Full Blood Count', resultDetails: 'WBC 14.2, Neutrophils 85%', referenceRange: 'WBC 4-11', resultStatus: 'Abnormal', notes: 'Inflammatory response' }], meds: [{ medicationName: 'Ciprofloxacin', dosage: '500mg', frequency: 'Twice Daily', duration: '5 days', instructions: 'Drink plenty water' }, { medicationName: 'Metronidazole', dosage: '400mg', frequency: 'Three Times Daily', duration: '5 days', instructions: 'Avoid alcohol' }] },
  { firstName: 'Samuel', lastName: 'Kiptoo', dateOfBirth: '1978-06-15', gender: 'Male', phoneNumber: '0744555666', insuranceNumber: 'SHA-9988776', visitReason: 'Routine diabetes check-up', method: 'Insurance', insuranceProvider: 'SHA/NHIF', amount: 0, triage: { bloodPressure: '145/92', temperature: 36.5, weight: 85, height: 172, pulse: 82, oxygenSaturation: 97, bloodSugar: 11.2, chiefComplaint: 'Routine diabetes follow-up', priority: 'Non-Urgent' }, consultation: { presentingComplaint: 'Routine diabetes review', historyOfPresentingIllness: 'Known diabetic for 5 years. On metformin. Reports increased thirst.', examinationFindings: 'BP elevated. No pedal edema. Feet intact.', diagnosis: 'Type 2 Diabetes Mellitus, uncontrolled', treatmentPlan: 'Continue metformin, add lifestyle advice, HbA1c check' }, labs: ['Blood Glucose', 'Renal Function Test'], labResults: [{ testType: 'Blood Glucose', resultDetails: 'Random 11.2 mmol/L', referenceRange: '3.9-7.8 mmol/L', resultStatus: 'Abnormal', notes: 'Poor glycemic control' }, { testType: 'Renal Function Test', resultDetails: 'Urea 5.2, Creatinine 88, eGFR 92', referenceRange: 'Urea 2.5-7.0, Cr 60-120', resultStatus: 'Normal', notes: 'Renal function preserved' }], meds: [{ medicationName: 'Metformin', dosage: '1000mg', frequency: 'Twice Daily', duration: '30 days', instructions: 'With meals' }] },
  { firstName: 'Mercy', lastName: 'Njeri', dateOfBirth: '2000-11-08', gender: 'Female', phoneNumber: '0755666777', insuranceNumber: '', visitReason: 'Pregnancy test and antenatal', method: 'Cash', amount: 1000, triage: { bloodPressure: '115/75', temperature: 36.7, weight: 62, height: 168, pulse: 80, oxygenSaturation: 99, bloodSugar: 4.5, chiefComplaint: 'Missed period, nausea, wants pregnancy confirmation', priority: 'Non-Urgent' }, consultation: { presentingComplaint: 'Suspected pregnancy', historyOfPresentingIllness: 'LMP 8 weeks ago. Morning nausea. Fatigue.', examinationFindings: 'Abdomen soft, non-tender', diagnosis: 'Pregnancy, 8 weeks gestation', treatmentPlan: 'Antenatal care, folic acid, iron supplement' }, labs: ['Pregnancy Test', 'Full Blood Count'], labResults: [{ testType: 'Pregnancy Test', resultDetails: 'Positive hCG', referenceRange: 'Negative', resultStatus: 'Normal', notes: 'Confirmed pregnancy' }, { testType: 'Full Blood Count', resultDetails: 'Hb 11.8, WBC 9.5', referenceRange: 'Hb 12-16', resultStatus: 'Normal', notes: 'Mild anemia of pregnancy' }], meds: [{ medicationName: 'Folic Acid', dosage: '5mg', frequency: 'Once Daily', duration: '90 days', instructions: 'Throughout pregnancy' }, { medicationName: 'Iron Tablets', dosage: '300mg', frequency: 'Once Daily', duration: '90 days', instructions: 'With vitamin C' }] },
  { firstName: 'Daniel', lastName: 'Mwangi', dateOfBirth: '2015-03-20', gender: 'Male', phoneNumber: '0766777888', insuranceNumber: '', visitReason: 'Child with diarrhea and vomiting', method: 'Cash', amount: 800, triage: { bloodPressure: '100/65', temperature: 37.8, weight: 18, height: 110, pulse: 95, oxygenSaturation: 98, bloodSugar: null, chiefComplaint: 'Watery diarrhea 2 days, vomiting, lethargic', priority: 'Urgent' }, consultation: { presentingComplaint: 'Acute gastroenteritis', historyOfPresentingIllness: '2 days watery diarrhea, 5-6 episodes. Vomiting after feeds. Mild dehydration.', examinationFindings: 'Sunken eyes, dry mucous membranes, reduced skin turgor', diagnosis: 'Acute gastroenteritis with moderate dehydration', treatmentPlan: 'ORS, zinc, monitor hydration' }, labs: ['Stool Analysis'], labResults: [{ testType: 'Stool Analysis', resultDetails: 'No ova/parasites, no blood, reducing substances +', referenceRange: 'Negative', resultStatus: 'Abnormal', notes: 'Viral gastroenteritis likely' }], meds: [{ medicationName: 'ORS Sachets', dosage: '1 sachet', frequency: 'As Needed', duration: '3 days', instructions: 'After every loose stool' }, { medicationName: 'Zinc Tablets', dosage: '20mg', frequency: 'Once Daily', duration: '10 days', instructions: 'Dissolve in water' }] },
  { firstName: 'Esther', lastName: 'Atieno', dateOfBirth: '1988-07-04', gender: 'Female', phoneNumber: '0777888999', insuranceNumber: 'Britam-445566', visitReason: 'Hypertension review', method: 'Insurance', insuranceProvider: 'Britam', amount: 0, triage: { bloodPressure: '155/100', temperature: 36.6, weight: 78, height: 165, pulse: 76, oxygenSaturation: 98, bloodSugar: 5.0, chiefComplaint: 'Headaches and dizziness, known hypertensive', priority: 'Urgent' }, consultation: { presentingComplaint: 'Uncontrolled hypertension', historyOfPresentingIllness: 'On amlodipine for 2 years. Reports persistent morning headaches.', examinationFindings: 'BP 155/100, no edema, heart sounds normal', diagnosis: 'Essential hypertension, stage 2', treatmentPlan: 'Add atenolol, lifestyle modification' }, labs: ['Renal Function Test', 'Liver Function Test'], labResults: [{ testType: 'Renal Function Test', resultDetails: 'Urea 4.8, Creatinine 76, eGFR 98', referenceRange: 'Urea 2.5-7.0, Cr 60-120', resultStatus: 'Normal', notes: 'Normal renal function' }, { testType: 'Liver Function Test', resultDetails: 'ALT 28, AST 22, Bilirubin 12', referenceRange: 'ALT <40, AST <40, Bili <21', resultStatus: 'Normal', notes: 'Liver function normal' }], meds: [{ medicationName: 'Amlodipine', dosage: '10mg', frequency: 'Once Daily', duration: '30 days', instructions: 'Morning' }, { medicationName: 'Atenolol', dosage: '50mg', frequency: 'Once Daily', duration: '30 days', instructions: 'Monitor pulse' }] },
  { firstName: 'Peter', lastName: 'Kariuki', dateOfBirth: '1992-12-19', gender: 'Male', phoneNumber: '0788999000', insuranceNumber: '', visitReason: 'Skin rash and itching', method: 'Cash', amount: 1200, triage: { bloodPressure: '118/78', temperature: 36.9, weight: 70, height: 175, pulse: 70, oxygenSaturation: 99, bloodSugar: null, chiefComplaint: 'Itchy rash on arms and chest for 1 week', priority: 'Non-Urgent' }, consultation: { presentingComplaint: 'Allergic dermatitis', historyOfPresentingIllness: 'Started 1 week ago. Itchy. New soap used recently.', examinationFindings: 'Erythematous papular rash on forearms and chest', diagnosis: 'Contact dermatitis', treatmentPlan: 'Antihistamine, topical steroid, avoid irritant' }, labs: [], labResults: [], meds: [{ medicationName: 'Cetirizine', dosage: '10mg', frequency: 'Once Daily', duration: '7 days', instructions: 'At night' }, { medicationName: 'Hydrocortisone Cream', dosage: 'Apply thin layer', frequency: 'Twice Daily', duration: '7 days', instructions: 'To affected areas' }] },
];

function calcStatus(level, reorder) {
  if (level === 0) return 'Out of Stock';
  if (level <= reorder) return 'Low Stock';
  return 'In Stock';
}

function hoursAgo(h) {
  return Timestamp.fromDate(new Date(Date.now() - h * 60 * 60 * 1000));
}

export default function SeedPage() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [done, setDone] = useState(null);
  const toast = useToast();

  const seedAll = async () => {
    setLoading(true);
    setDone(null);
    try {
      // 1. Staff
      setProgress('Seeding staff collection...');
      for (const s of STAFF) {
        await setDoc(doc(db, 'staff', s.email), s);
      }

      // 2. Inventory
      setProgress('Seeding inventory collection...');
      const invSnap = await getDocs(collection(db, 'inventory'));
      const invBatch = writeBatch(db);
      INVENTORY.forEach((item) => {
        const ref = doc(db, 'inventory', item.medicationName);
        invBatch.set(ref, {
          ...item,
          status: calcStatus(item.stockLevel, item.reorderLevel),
        });
      });
      await invBatch.commit();

      // 3. Patients, visits, payments, triage, consultations, labs, prescriptions
      let patNum = 1;
      let visNum = 1;
      let trgNum = 1;
      let conNum = 1;
      let labNum = 1;
      let resNum = 1;
      let rxNum = 1;

      for (let i = 0; i < DUMMY_PATIENTS.length; i++) {
        const d = DUMMY_PATIENTS[i];
        const patientId = `PAT-${String(patNum++).padStart(3, '0')}`;
        const visitId = `VIS-${String(visNum++).padStart(3, '0')}`;
        const registeredAt = hoursAgo(8 - i * 0.5);

        setProgress(`Creating patient ${patientId} (${d.firstName} ${d.lastName})...`);

        // Patient
        await setDoc(doc(db, 'patients', patientId), {
          patientId,
          firstName: d.firstName,
          lastName: d.lastName,
          dateOfBirth: new Date(d.dateOfBirth),
          gender: d.gender,
          phoneNumber: d.phoneNumber,
          insuranceNumber: d.insuranceNumber || '',
          visitReason: d.visitReason,
          registeredAt,
          registeredBy: 'REC-001',
        });

        // Visit
        const visitRef = await addDoc(collection(db, 'visits'), {
          visitId,
          patientId,
          status: 'Discharged',
          visitDate: registeredAt,
          createdBy: 'REC-001',
        });

        // Registration Payment
        await addDoc(collection(db, 'payments'), {
          patientId,
          visitId,
          method: d.method,
          insuranceProvider: d.insuranceProvider || '',
          insuranceNumber: d.insuranceNumber || '',
          insuranceStatus: d.method === 'Insurance' ? 'Pending' : '',
          insuranceApprovalEmail: d.method === 'Insurance' ? 'fatuma.omar@strathmore.edu' : '',
          insuranceApprovalSent: d.method === 'Insurance' ? true : false,
          insuranceApprovedAt: null,
          insuranceApprovedBy: null,
          mpesaPhone: d.method === 'Mpesa' ? d.phoneNumber : '',
          mpesaCode: d.method === 'Mpesa' ? 'DEMO123456' : '',
          amount: d.amount,
          status: 'Paid',
          paymentType: 'Registration Fee',
          receiptNumber: `RCP-${String(i + 1).padStart(3, '0')}`,
          processedBy: 'REC-001',
          processedAt: registeredAt,
          description: 'Patient registration and consultation fee',
        });

        // Lab fee payment
        if (d.labs.length > 0) {
          const labFee = d.labs.length * 500;
          await addDoc(collection(db, 'payments'), {
            patientId,
            visitId,
            method: d.method,
            insuranceProvider: d.insuranceProvider || '',
            insuranceNumber: d.insuranceNumber || '',
            insuranceStatus: d.method === 'Insurance' ? 'Pending' : '',
            insuranceApprovalEmail: d.method === 'Insurance' ? 'fatuma.omar@strathmore.edu' : '',
            insuranceApprovalSent: d.method === 'Insurance' ? true : false,
            insuranceApprovedAt: null,
            insuranceApprovedBy: null,
            mpesaPhone: d.method === 'Mpesa' ? d.phoneNumber : '',
            mpesaCode: d.method === 'Mpesa' ? 'DEMO789012' : '',
            amount: labFee,
            status: 'Paid',
            paymentType: 'Lab Fee',
            receiptNumber: `RCP-${String(i + 10).padStart(3, '0')}`,
            processedBy: 'REC-001',
            processedAt: hoursAgo(5.8 - i * 0.5),
            description: `Lab fees for ${d.labs.length} test(s): ${d.labs.join(', ')}`,
          });
        }

        // Triage record
        const triageId = `TRG-${String(trgNum++).padStart(3, '0')}`;
        const triageAt = hoursAgo(7.5 - i * 0.5);
        const bmi = +(d.triage.weight / Math.pow(d.triage.height / 100, 2)).toFixed(1);
        await setDoc(doc(db, 'triageRecords', triageId), {
          triageId,
          patientId,
          visitId,
          bloodPressure: d.triage.bloodPressure,
          temperature: d.triage.temperature,
          weight: d.triage.weight,
          height: d.triage.height,
          bmi,
          pulse: d.triage.pulse,
          oxygenSaturation: d.triage.oxygenSaturation,
          bloodSugar: d.triage.bloodSugar,
          chiefComplaint: d.triage.chiefComplaint,
          priority: d.triage.priority,
          recordedBy: 'TRN-001',
          recordedAt: triageAt,
        });

        // Consultation
        const consultRef = await addDoc(collection(db, 'consultations'), {
          patientId,
          visitId,
          presentingComplaint: d.consultation.presentingComplaint,
          historyOfPresentingIllness: d.consultation.historyOfPresentingIllness,
          examinationFindings: d.consultation.examinationFindings,
          diagnosis: d.consultation.diagnosis,
          treatmentPlan: d.consultation.treatmentPlan,
          consultedBy: 'CLN-001',
          consultedAt: hoursAgo(6 - i * 0.5),
        });

        // Lab requests + results
        for (let j = 0; j < d.labs.length; j++) {
          const labRequestRef = await addDoc(collection(db, 'labRequests'), {
            patientId,
            visitId,
            consultationId: consultRef.id,
            testType: d.labs[j],
            status: 'Completed',
            requestedBy: 'CLN-001',
            requestedAt: hoursAgo(5.5 - i * 0.5),
          });

          const result = d.labResults[j];
          if (result) {
            await addDoc(collection(db, 'labResults'), {
              labRequestId: labRequestRef.id,
              patientId,
              resultDetails: result.resultDetails,
              referenceRange: result.referenceRange,
              resultStatus: result.resultStatus,
              notes: result.notes,
              uploadedBy: 'LAB-001',
              uploadedAt: hoursAgo(3 - i * 0.3),
            });
          }
        }

        // Prescription
        if (d.meds.length > 0) {
          const prescriptionRef = await addDoc(collection(db, 'prescriptions'), {
            patientId,
            visitId,
            consultationId: consultRef.id,
            medications: d.meds,
            issuedBy: 'CLN-001',
            issuedAt: hoursAgo(2.5 - i * 0.3),
            dispensed: true,
            dispensedBy: 'PHM-001',
            dispensedAt: hoursAgo(1.5 - i * 0.3),
          });

          // Medication fee payment
          const medFee = d.meds.length * 200;
          await addDoc(collection(db, 'payments'), {
            patientId,
            visitId,
            method: d.method,
            insuranceProvider: d.insuranceProvider || '',
            insuranceNumber: d.insuranceNumber || '',
            insuranceStatus: d.method === 'Insurance' ? 'Pending' : '',
            insuranceApprovalEmail: d.method === 'Insurance' ? 'fatuma.omar@strathmore.edu' : '',
            insuranceApprovalSent: d.method === 'Insurance' ? true : false,
            insuranceApprovedAt: null,
            insuranceApprovedBy: null,
            mpesaPhone: d.method === 'Mpesa' ? d.phoneNumber : '',
            mpesaCode: d.method === 'Mpesa' ? 'DEMO345678' : '',
            amount: medFee,
            status: 'Paid',
            paymentType: 'Medication Fee',
            receiptNumber: `RCP-${String(i + 20).padStart(3, '0')}`,
            processedBy: 'REC-001',
            processedAt: hoursAgo(1.2 - i * 0.3),
            description: `Medication fees for ${d.meds.length} item(s): ${d.meds.map((m) => m.medicationName).join(', ')}`,
          });
        }
      }

      // 4. Add in-flight demo patients
      setProgress('Adding in-flight demo patients...');

      // Patient waiting for triage
      const wfpId = 'PAT-009';
      const wfVisitId = 'VIS-009';
      const wfTime = hoursAgo(0.3);
      await setDoc(doc(db, 'patients', wfpId), {
        patientId: wfpId,
        firstName: 'Lucy',
        lastName: 'Kamotho',
        dateOfBirth: new Date('1993-02-14'),
        gender: 'Female',
        phoneNumber: '0799111222',
        insuranceNumber: '',
        visitReason: 'Severe lower back pain',
        registeredAt: wfTime,
        registeredBy: 'REC-001',
      });
      await addDoc(collection(db, 'visits'), {
        visitId: wfVisitId,
        patientId: wfpId,
        status: 'Waiting for Triage',
        visitDate: wfTime,
        createdBy: 'REC-001',
      });
      await addDoc(collection(db, 'payments'), {
        patientId: wfpId,
        visitId: wfVisitId,
        method: 'Cash',
        insuranceProvider: '',
        insuranceNumber: '',
        insuranceStatus: '',
        insuranceApprovalEmail: '',
        insuranceApprovalSent: false,
        insuranceApprovedAt: null,
        insuranceApprovedBy: null,
        mpesaPhone: '',
        mpesaCode: '',
        amount: 1500,
        status: 'Paid',
        paymentType: 'Registration Fee',
        receiptNumber: 'RCP-009',
        processedBy: 'REC-001',
        processedAt: wfTime,
        description: 'Patient registration and consultation fee',
      });

      // Patient waiting for consultation
      const wcpId = 'PAT-010';
      const wcVisitId = 'VIS-010';
      const wcTime = hoursAgo(1.5);
      await setDoc(doc(db, 'patients', wcpId), {
        patientId: wcpId,
        firstName: 'Joseph',
        lastName: 'Mutua',
        dateOfBirth: new Date('1980-08-25'),
        gender: 'Male',
        phoneNumber: '0711222333',
        insuranceNumber: 'NHIF-445566',
        visitReason: 'Chest tightness and shortness of breath',
        registeredAt: wcTime,
        registeredBy: 'REC-001',
      });
      await addDoc(collection(db, 'visits'), {
        visitId: wcVisitId,
        patientId: wcpId,
        status: 'Waiting for Consultation',
        visitDate: wcTime,
        createdBy: 'REC-001',
      });
      await addDoc(collection(db, 'payments'), {
        patientId: wcpId,
        visitId: wcVisitId,
        method: 'Insurance',
        insuranceProvider: 'SHA/NHIF',
        insuranceNumber: 'NHIF-445566',
        insuranceStatus: 'Pending',
        insuranceApprovalEmail: 'fatuma.omar@strathmore.edu',
        insuranceApprovalSent: true,
        insuranceApprovedAt: null,
        insuranceApprovedBy: null,
        mpesaPhone: '',
        mpesaCode: '',
        amount: 1500,
        status: 'Paid',
        paymentType: 'Registration Fee',
        receiptNumber: 'RCP-010',
        processedBy: 'REC-001',
        processedAt: wcTime,
        description: 'Patient registration and consultation fee',
      });
      const wcTriage = `TRG-${String(trgNum++).padStart(3, '0')}`;
      await setDoc(doc(db, 'triageRecords', wcTriage), {
        triageId: wcTriage,
        patientId: wcpId,
        visitId: wcVisitId,
        bloodPressure: '140/90',
        temperature: 37.0,
        weight: 80,
        height: 170,
        bmi: 27.7,
        pulse: 92,
        oxygenSaturation: 94,
        bloodSugar: null,
        chiefComplaint: 'Chest tightness, breathlessness on exertion',
        priority: 'Urgent',
        recordedBy: 'TRN-001',
        recordedAt: hoursAgo(1.2),
      });

      // ===== PATIENT IN LAB - FIXED =====
      const lbpId = 'PAT-011';
      const lbVisitId = 'VIS-011';
      const lbTime = hoursAgo(2);
      
      await setDoc(doc(db, 'patients', lbpId), {
        patientId: lbpId,
        firstName: 'Ann',
        lastName: 'Wambui',
        dateOfBirth: new Date('1998-05-10'),
        gender: 'Female',
        phoneNumber: '0722333444',
        insuranceNumber: '',
        visitReason: 'Fatigue and weight loss',
        registeredAt: lbTime,
        registeredBy: 'REC-001',
      });
      
      // Visit with status 'In Lab'
      await addDoc(collection(db, 'visits'), {
        visitId: lbVisitId,
        patientId: lbpId,
        status: 'In Lab',  // ← Status must be 'In Lab'
        visitDate: lbTime,
        createdBy: 'REC-001',
      });
      
      // Registration payment (Paid)
      await addDoc(collection(db, 'payments'), {
        patientId: lbpId,
        visitId: lbVisitId,
        method: 'Cash',
        insuranceProvider: '',
        insuranceNumber: '',
        insuranceStatus: '',
        insuranceApprovalEmail: '',
        insuranceApprovalSent: false,
        insuranceApprovedAt: null,
        insuranceApprovedBy: null,
        mpesaPhone: '',
        mpesaCode: '',
        amount: 1500,
        status: 'Paid',
        paymentType: 'Registration Fee',
        receiptNumber: 'RCP-011',
        processedBy: 'REC-001',
        processedAt: lbTime,
        description: 'Patient registration and consultation fee',
      });
      
      // Lab fee payment (Paid - this is what makes it 'In Lab')
      await addDoc(collection(db, 'payments'), {
        patientId: lbpId,
        visitId: lbVisitId,
        method: 'Cash',
        insuranceProvider: '',
        insuranceNumber: '',
        insuranceStatus: '',
        insuranceApprovalEmail: '',
        insuranceApprovalSent: false,
        insuranceApprovedAt: null,
        insuranceApprovedBy: null,
        mpesaPhone: '',
        mpesaCode: '',
        amount: 1000,
        status: 'Paid',  // ← Must be Paid
        paymentType: 'Lab Fee',
        receiptNumber: 'RCP-012',
        processedBy: 'REC-001',
        processedAt: hoursAgo(1.9),
        description: 'Lab fees for 2 test(s): Full Blood Count, HIV Test',
      });
      
      // Triage
      const lbTriage = `TRG-${String(trgNum++).padStart(3, '0')}`;
      await setDoc(doc(db, 'triageRecords', lbTriage), {
        triageId: lbTriage,
        patientId: lbpId,
        visitId: lbVisitId,
        bloodPressure: '105/68',
        temperature: 36.5,
        weight: 52,
        height: 163,
        bmi: 19.6,
        pulse: 88,
        oxygenSaturation: 97,
        bloodSugar: null,
        chiefComplaint: 'Persistent fatigue, unintentional weight loss',
        priority: 'Semi-Urgent',
        recordedBy: 'TRN-001',
        recordedAt: hoursAgo(1.8),
      });
      
      // Consultation with visitId
      const lbCon = await addDoc(collection(db, 'consultations'), {
        patientId: lbpId,
        visitId: lbVisitId,  // ← Must have visitId
        presentingComplaint: 'Fatigue and weight loss',
        historyOfPresentingIllness: '3 months progressive fatigue, 6kg weight loss, night sweats',
        examinationFindings: 'Pallor, thin, no lymphadenopathy',
        diagnosis: 'Anemia — investigate cause',
        treatmentPlan: 'Lab workup for anemia and HIV',
        consultedBy: 'CLN-001',
        consultedAt: hoursAgo(1.5),
      });
      
      // ===== CRITICAL: Lab Requests with visitId and status 'Pending' =====
      await addDoc(collection(db, 'labRequests'), {
        patientId: lbpId,
        visitId: lbVisitId,  // ← CRITICAL: Must have visitId
        consultationId: lbCon.id,
        testType: 'Full Blood Count',
        status: 'Pending',  // ← Must be 'Pending' for lab dashboard
        requestedBy: 'CLN-001',
        requestedAt: hoursAgo(1.4),
      });
      
      await addDoc(collection(db, 'labRequests'), {
        patientId: lbpId,
        visitId: lbVisitId,  // ← CRITICAL: Must have visitId
        consultationId: lbCon.id,
        testType: 'HIV Test',
        status: 'Pending',  // ← Must be 'Pending' for lab dashboard
        requestedBy: 'CLN-001',
        requestedAt: hoursAgo(1.4),
      });

      // Patient waiting for pharmacy
      const phpId = 'PAT-012';
      const phVisitId = 'VIS-012';
      const phTime = hoursAgo(3);
      await setDoc(doc(db, 'patients', phpId), {
        patientId: phpId,
        firstName: 'David',
        lastName: 'Ochieng',
        dateOfBirth: new Date('1987-11-03'),
        gender: 'Male',
        phoneNumber: '0733444555',
        insuranceNumber: '',
        visitReason: 'Throat infection',
        registeredAt: phTime,
        registeredBy: 'REC-001',
      });
      await addDoc(collection(db, 'visits'), {
        visitId: phVisitId,
        patientId: phpId,
        status: 'Waiting for Pharmacy',
        visitDate: phTime,
        createdBy: 'REC-001',
      });
      await addDoc(collection(db, 'payments'), {
        patientId: phpId,
        visitId: phVisitId,
        method: 'Cash',
        insuranceProvider: '',
        insuranceNumber: '',
        insuranceStatus: '',
        insuranceApprovalEmail: '',
        insuranceApprovalSent: false,
        insuranceApprovedAt: null,
        insuranceApprovedBy: null,
        mpesaPhone: '',
        mpesaCode: '',
        amount: 1500,
        status: 'Paid',
        paymentType: 'Registration Fee',
        receiptNumber: 'RCP-013',
        processedBy: 'REC-001',
        processedAt: phTime,
        description: 'Patient registration and consultation fee',
      });
      await addDoc(collection(db, 'payments'), {
        patientId: phpId,
        visitId: phVisitId,
        method: 'Cash',
        insuranceProvider: '',
        insuranceNumber: '',
        insuranceStatus: '',
        insuranceApprovalEmail: '',
        insuranceApprovalSent: false,
        insuranceApprovedAt: null,
        insuranceApprovedBy: null,
        mpesaPhone: '',
        mpesaCode: '',
        amount: 0,
        status: 'Paid',
        paymentType: 'Lab Fee',
        receiptNumber: 'RCP-014',
        processedBy: 'REC-001',
        processedAt: hoursAgo(2.5),
        description: 'No lab tests required',
      });
      const phTriage = `TRG-${String(trgNum++).padStart(3, '0')}`;
      await setDoc(doc(db, 'triageRecords', phTriage), {
        triageId: phTriage,
        patientId: phpId,
        visitId: phVisitId,
        bloodPressure: '122/80',
        temperature: 38.0,
        weight: 75,
        height: 180,
        bmi: 23.1,
        pulse: 84,
        oxygenSaturation: 98,
        bloodSugar: null,
        chiefComplaint: 'Sore throat, difficulty swallowing, fever',
        priority: 'Semi-Urgent',
        recordedBy: 'TRN-001',
        recordedAt: hoursAgo(2.7),
      });
      const phCon = await addDoc(collection(db, 'consultations'), {
        patientId: phpId,
        visitId: phVisitId,
        presentingComplaint: 'Sore throat and fever',
        historyOfPresentingIllness: '3 days sore throat, painful swallowing, no cough',
        examinationFindings: 'Tonsils inflamed with exudate, cervical lymph nodes enlarged',
        diagnosis: 'Streptococcal pharyngitis',
        treatmentPlan: 'Antibiotics and analgesics',
        consultedBy: 'CLN-001',
        consultedAt: hoursAgo(2.2),
      });
      await addDoc(collection(db, 'prescriptions'), {
        patientId: phpId,
        visitId: phVisitId,
        consultationId: phCon.id,
        medications: [
          { medicationName: 'Amoxicillin', dosage: '500mg', frequency: 'Three Times Daily', duration: '7 days', instructions: 'Complete full course' },
          { medicationName: 'Paracetamol', dosage: '1000mg', frequency: 'Three Times Daily', duration: '5 days', instructions: 'For pain and fever' },
        ],
        issuedBy: 'CLN-001',
        issuedAt: hoursAgo(2),
        dispensed: false,
        dispensedBy: null,
        dispensedAt: null,
      });

      // Patient with results ready for clinician review
      const rrpId = 'PAT-013';
      const rrVisitId = 'VIS-013';
      const rrTime = hoursAgo(2.5);
      await setDoc(doc(db, 'patients', rrpId), {
        patientId: rrpId,
        firstName: 'Caroline',
        lastName: 'Adhiambo',
        dateOfBirth: new Date('1994-03-18'),
        gender: 'Female',
        phoneNumber: '0712555999',
        insuranceNumber: 'NHIF-778899',
        visitReason: 'Persistent fever and joint pain',
        registeredAt: rrTime,
        registeredBy: 'REC-001',
      });
      await addDoc(collection(db, 'visits'), {
        visitId: rrVisitId,
        patientId: rrpId,
        status: 'Results Ready',
        visitDate: rrTime,
        createdBy: 'REC-001',
      });
      await addDoc(collection(db, 'payments'), {
        patientId: rrpId,
        visitId: rrVisitId,
        method: 'Insurance',
        insuranceProvider: 'SHA/NHIF',
        insuranceNumber: 'NHIF-778899',
        insuranceStatus: 'Pending',
        insuranceApprovalEmail: 'fatuma.omar@strathmore.edu',
        insuranceApprovalSent: true,
        insuranceApprovedAt: null,
        insuranceApprovedBy: null,
        mpesaPhone: '',
        mpesaCode: '',
        amount: 1500,
        status: 'Paid',
        paymentType: 'Registration Fee',
        receiptNumber: 'RCP-015',
        processedBy: 'REC-001',
        processedAt: rrTime,
        description: 'Patient registration and consultation fee',
      });
      await addDoc(collection(db, 'payments'), {
        patientId: rrpId,
        visitId: rrVisitId,
        method: 'Insurance',
        insuranceProvider: 'SHA/NHIF',
        insuranceNumber: 'NHIF-778899',
        insuranceStatus: 'Pending',
        insuranceApprovalEmail: 'fatuma.omar@strathmore.edu',
        insuranceApprovalSent: true,
        insuranceApprovedAt: null,
        insuranceApprovedBy: null,
        mpesaPhone: '',
        mpesaCode: '',
        amount: 1000,
        status: 'Paid',
        paymentType: 'Lab Fee',
        receiptNumber: 'RCP-016',
        processedBy: 'REC-001',
        processedAt: hoursAgo(2.2),
        description: 'Lab fees for 2 test(s): Full Blood Count, Blood Glucose',
      });
      const rrTriage = `TRG-${String(trgNum++).padStart(3, '0')}`;
      await setDoc(doc(db, 'triageRecords', rrTriage), {
        triageId: rrTriage,
        patientId: rrpId,
        visitId: rrVisitId,
        bloodPressure: '118/76',
        temperature: 38.5,
        weight: 60,
        height: 162,
        bmi: 22.9,
        pulse: 90,
        oxygenSaturation: 97,
        bloodSugar: null,
        chiefComplaint: 'Fever for 5 days, joint pain, body weakness',
        priority: 'Urgent',
        recordedBy: 'TRN-001',
        recordedAt: hoursAgo(2.3),
      });
      const rrCon = await addDoc(collection(db, 'consultations'), {
        patientId: rrpId,
        visitId: rrVisitId,
        presentingComplaint: 'Persistent fever and joint pain',
        historyOfPresentingIllness: '5 days fever, worse in evening. Joint pains in knees and wrists. No rash.',
        examinationFindings: 'Temperature 38.5, mild joint tenderness, no swelling',
        diagnosis: 'Suspected brucellosis or viral arthropathy',
        treatmentPlan: 'Lab workup — blood culture, brucella serology',
        consultedBy: 'CLN-001',
        consultedAt: hoursAgo(2),
      });
      const rrLab1Ref = await addDoc(collection(db, 'labRequests'), {
        patientId: rrpId,
        visitId: rrVisitId,
        consultationId: rrCon.id,
        testType: 'Full Blood Count',
        status: 'Completed',
        requestedBy: 'CLN-001',
        requestedAt: hoursAgo(1.8),
      });
      const rrLab2Ref = await addDoc(collection(db, 'labRequests'), {
        patientId: rrpId,
        visitId: rrVisitId,
        consultationId: rrCon.id,
        testType: 'Blood Glucose',
        status: 'Completed',
        requestedBy: 'CLN-001',
        requestedAt: hoursAgo(1.8),
      });
      await addDoc(collection(db, 'labResults'), {
        labRequestId: rrLab1Ref.id,
        patientId: rrpId,
        resultDetails: 'WBC 9.8, Hb 11.5, Platelets 180, Lymphocytes 45%',
        referenceRange: 'WBC 4-11, Hb 12-16, Plt 150-450',
        resultStatus: 'Normal',
        notes: 'Within normal limits',
        uploadedBy: 'LAB-001',
        uploadedAt: hoursAgo(1),
      });
      await addDoc(collection(db, 'labResults'), {
        labRequestId: rrLab2Ref.id,
        patientId: rrpId,
        resultDetails: 'Random glucose 5.2 mmol/L',
        referenceRange: '3.9-7.8 mmol/L',
        resultStatus: 'Normal',
        notes: 'Normal blood sugar',
        uploadedBy: 'LAB-001',
        uploadedAt: hoursAgo(1),
      });

      // Patient waiting for lab payment
      const wlpId = 'PAT-014';
      const wlVisitId = 'VIS-014';
      const wlTime = hoursAgo(1.5);
      await setDoc(doc(db, 'patients', wlpId), {
        patientId: wlpId,
        firstName: 'Victor',
        lastName: 'Ochieng',
        dateOfBirth: new Date('1982-07-22'),
        gender: 'Male',
        phoneNumber: '0713444566',
        insuranceNumber: '',
        visitReason: 'Severe headache and blurred vision',
        registeredAt: wlTime,
        registeredBy: 'REC-001',
      });
      await addDoc(collection(db, 'visits'), {
        visitId: wlVisitId,
        patientId: wlpId,
        status: 'Waiting for Lab Payment',
        visitDate: wlTime,
        createdBy: 'REC-001',
      });
      await addDoc(collection(db, 'payments'), {
        patientId: wlpId,
        visitId: wlVisitId,
        method: 'Cash',
        insuranceProvider: '',
        insuranceNumber: '',
        insuranceStatus: '',
        insuranceApprovalEmail: '',
        insuranceApprovalSent: false,
        insuranceApprovedAt: null,
        insuranceApprovedBy: null,
        mpesaPhone: '',
        mpesaCode: '',
        amount: 1500,
        status: 'Paid',
        paymentType: 'Registration Fee',
        receiptNumber: 'RCP-017',
        processedBy: 'REC-001',
        processedAt: wlTime,
        description: 'Patient registration and consultation fee',
      });
      const wlTriage = `TRG-${String(trgNum++).padStart(3, '0')}`;
      await setDoc(doc(db, 'triageRecords', wlTriage), {
        triageId: wlTriage,
        patientId: wlpId,
        visitId: wlVisitId,
        bloodPressure: '160/100',
        temperature: 36.7,
        weight: 82,
        height: 175,
        bmi: 26.8,
        pulse: 88,
        oxygenSaturation: 97,
        bloodSugar: null,
        chiefComplaint: 'Severe headache, blurred vision, dizziness',
        priority: 'Urgent',
        recordedBy: 'TRN-001',
        recordedAt: hoursAgo(1.3),
      });
      const wlCon = await addDoc(collection(db, 'consultations'), {
        patientId: wlpId,
        visitId: wlVisitId,
        presentingComplaint: 'Severe headache and blurred vision',
        historyOfPresentingIllness: '3 days progressive headache, worse in morning. Blurred vision. No trauma.',
        examinationFindings: 'BP 160/100, papilledema noted on fundoscopy',
        diagnosis: 'Hypertensive urgency — investigate for secondary causes',
        treatmentPlan: 'Lab workup — renal function, lipid profile',
        phase: 1,
        consultedBy: 'CLN-001',
        consultedAt: hoursAgo(1.1),
      });
      await addDoc(collection(db, 'labRequests'), {
        patientId: wlpId,
        visitId: wlVisitId,
        consultationId: wlCon.id,
        testType: 'Renal Function Test',
        status: 'Pending',
        requestedBy: 'CLN-001',
        requestedAt: hoursAgo(1.0),
      });
      await addDoc(collection(db, 'labRequests'), {
        patientId: wlpId,
        visitId: wlVisitId,
        consultationId: wlCon.id,
        testType: 'Full Blood Count',
        status: 'Pending',
        requestedBy: 'CLN-001',
        requestedAt: hoursAgo(1.0),
      });
      await addDoc(collection(db, 'payments'), {
        patientId: wlpId,
        visitId: wlVisitId,
        method: '',
        insuranceProvider: '',
        insuranceNumber: '',
        insuranceStatus: '',
        insuranceApprovalEmail: '',
        insuranceApprovalSent: false,
        insuranceApprovedAt: null,
        insuranceApprovedBy: null,
        mpesaPhone: '0713444566',
        mpesaCode: '',
        amount: 1000,
        status: 'Pending',
        paymentType: 'Lab Fee',
        receiptNumber: 'RCP-018',
        processedBy: '',
        processedAt: null,
        description: 'Lab fees for 2 test(s): Renal Function Test, Full Blood Count',
      });

      // Patient waiting for final payment
      const fppId = 'PAT-015';
      const fpVisitId = 'VIS-015';
      const fpTime = hoursAgo(3);
      await setDoc(doc(db, 'patients', fppId), {
        patientId: fppId,
        firstName: 'Janet',
        lastName: 'Wairimu',
        dateOfBirth: new Date('1991-04-15'),
        gender: 'Female',
        phoneNumber: '0714555677',
        insuranceNumber: 'AAR-334455',
        visitReason: 'Urinary tract infection',
        registeredAt: fpTime,
        registeredBy: 'REC-001',
      });
      await addDoc(collection(db, 'visits'), {
        visitId: fpVisitId,
        patientId: fppId,
        status: 'Waiting for Final Payment',
        visitDate: fpTime,
        createdBy: 'REC-001',
      });
      await addDoc(collection(db, 'payments'), {
        patientId: fppId,
        visitId: fpVisitId,
        method: 'Insurance',
        insuranceProvider: 'AAR',
        insuranceNumber: 'AAR-334455',
        insuranceStatus: 'Pending',
        insuranceApprovalEmail: 'fatuma.omar@strathmore.edu',
        insuranceApprovalSent: true,
        insuranceApprovedAt: null,
        insuranceApprovedBy: null,
        mpesaPhone: '',
        mpesaCode: '',
        amount: 1500,
        status: 'Paid',
        paymentType: 'Registration Fee',
        receiptNumber: 'RCP-019',
        processedBy: 'REC-001',
        processedAt: fpTime,
        description: 'Patient registration and consultation fee',
      });
      const fpTriage = `TRG-${String(trgNum++).padStart(3, '0')}`;
      await setDoc(doc(db, 'triageRecords', fpTriage), {
        triageId: fpTriage,
        patientId: fppId,
        visitId: fpVisitId,
        bloodPressure: '118/75',
        temperature: 37.2,
        weight: 55,
        height: 160,
        bmi: 21.5,
        pulse: 78,
        oxygenSaturation: 99,
        bloodSugar: null,
        chiefComplaint: 'Burning urination, lower abdominal pain, frequency',
        priority: 'Semi-Urgent',
        recordedBy: 'TRN-001',
        recordedAt: hoursAgo(2.8),
      });
      const fpCon = await addDoc(collection(db, 'consultations'), {
        patientId: fppId,
        visitId: fpVisitId,
        presentingComplaint: 'Burning urination and abdominal pain',
        historyOfPresentingIllness: '3 days dysuria, frequency, lower abdominal discomfort',
        examinationFindings: 'Suprapubic tenderness, no rebound',
        diagnosis: 'Uncomplicated UTI',
        treatmentPlan: 'Antibiotics and hydration',
        phase: 2,
        consultedBy: 'CLN-001',
        consultedAt: hoursAgo(2.5),
      });
      await addDoc(collection(db, 'prescriptions'), {
        patientId: fppId,
        visitId: fpVisitId,
        consultationId: fpCon.id,
        medications: [
          { medicationName: 'Ciprofloxacin', dosage: '500mg', frequency: 'Twice Daily', duration: '5 days', instructions: 'Drink plenty water' },
          { medicationName: 'Metronidazole', dosage: '400mg', frequency: 'Three Times Daily', duration: '5 days', instructions: 'Avoid alcohol' },
        ],
        issuedBy: 'CLN-001',
        issuedAt: hoursAgo(2.2),
        dispensed: true,
        dispensedBy: 'PHM-001',
        dispensedAt: hoursAgo(1.5),
      });
      await addDoc(collection(db, 'payments'), {
        patientId: fppId,
        visitId: fpVisitId,
        method: '',
        insuranceProvider: '',
        insuranceNumber: 'AAR-334455',
        insuranceStatus: '',
        insuranceApprovalEmail: '',
        insuranceApprovalSent: false,
        insuranceApprovedAt: null,
        insuranceApprovedBy: null,
        mpesaPhone: '0714555677',
        mpesaCode: '',
        amount: 400,
        status: 'Pending',
        paymentType: 'Medication Fee',
        receiptNumber: 'RCP-020',
        processedBy: '',
        processedAt: null,
        description: 'Medication fees for 2 item(s): Ciprofloxacin, Metronidazole',
      });

      setDone({
        staff: STAFF.length,
        inventory: INVENTORY.length,
        patients: 15,
        visits: 15,
        payments: 'Multiple',
        triage: 13,
        consultations: 12,
        labRequests: 'Multiple',
        labResults: 'Multiple',
        prescriptions: 10,
      });
      toast.show('All dummy data seeded successfully!', 'success');
    } catch (err) {
      console.error(err);
      toast.show(err.message || 'Seed failed', 'error');
      setDone({ error: err.message });
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  const counts = done && !done.error ? Object.entries(done).filter(([k]) => k !== 'error') : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4 py-10">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 max-w-2xl w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Firestore Dummy Data Seeder</h1>
        <p className="text-sm text-gray-600 mb-6">
          Populates <strong>all</strong> Firestore collections with realistic interconnected
          dummy data so every dashboard has live content immediately.
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">What gets created:</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• <strong>5 staff</strong> members (for auth + role lookup)</li>
            <li>• <strong>20 inventory</strong> items (medications with stock levels)</li>
            <li>• <strong>8 fully-flowed patients</strong> — registered → paid → triaged → consulted → lab tested → prescribed → dispensed → discharged</li>
            <li>• <strong>7 in-flight patients</strong> at different stages</li>
            <li>• Matching <strong>visits, payments, triage records, consultations, lab requests, lab results, and prescriptions</strong> for each patient</li>
          </ul>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-sm text-amber-800">
          <p className="font-medium mb-1">Important — Firebase Auth users</p>
          <p>
            You must also create the 5 user accounts in Firebase Authentication manually
            (Firebase Console → Authentication → Users → Add User). Use the emails below
            with password <code className="bg-amber-100 px-1 rounded">Hospital@2026</code>.
          </p>
          <ul className="mt-2 list-disc list-inside text-xs">
            {STAFF.map((s) => (
              <li key={s.staffId}>{s.email} ({s.role})</li>
            ))}
          </ul>
        </div>

        <button
          onClick={seedAll}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg disabled:opacity-60 transition-colors"
        >
          {loading && <Spinner size={20} />}
          {loading ? (progress || 'Seeding...') : 'Seed All Dummy Data'}
        </button>

        {done && !done.error && (
          <div className="mt-6 px-4 py-4 rounded-lg bg-green-50 border border-green-200">
            <p className="text-sm font-semibold text-green-900 mb-3">
              Successfully seeded all collections:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm text-green-800">
              {counts.map(([k, v]) => (
                <div key={k} className="bg-green-100 rounded px-3 py-2">
                  <span className="font-bold">{v}</span> {k}
                </div>
              ))}
            </div>
            <p className="text-xs text-green-700 mt-3">
              Visit any dashboard to see the live data. Log in at <code className="bg-green-100 px-1 rounded">/login</code>.
            </p>
          </div>
        )}
        {done?.error && (
          <div className="mt-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
            Error: {done.error}
          </div>
        )}
      </div>
    </div>
  );
}