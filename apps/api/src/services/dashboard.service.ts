import mongoose from "mongoose";
import { DoctorModel, type DoctorDoc } from "../models/doctor.model.js";
import { PatientModel, type PatientDoc } from "../models/patient.model.js";

export type DashboardStats = {
  doctorsTotal: number;
  patientsTotal: number;
  patientsByCondition: Array<{ condition: string; count: number }>;
  patientsByDoctor: Array<{ doctorId: string; doctorName: string; count: number }>;
  doctorsBySpecialization: Array<{ specialization: string; count: number }>;
  doctorsByHospital: Array<{ hospital: string; count: number }>;
  recentDoctors: Array<{
    id: string;
    name: string;
    specialization: string;
    hospital: string;
    createdAt?: string;
  }>;
  recentPatients: Array<{
    id: string;
    name: string;
    condition: string;
    doctorId: string;
    createdAt?: string;
  }>;
};

type ConditionCount = { _id: string; count: number };
type DoctorCountRaw = { _id: mongoose.Types.ObjectId; count: number };
type DoctorCountProjected = {
  doctorId: mongoose.Types.ObjectId;
  doctorName: string;
  count: number;
};

type LeanWithId<T> = T & { _id: unknown };

export async function getDashboardStats(): Promise<DashboardStats> {
  const [doctorsTotal, patientsTotal] = await Promise.all([
    DoctorModel.countDocuments({}),
    PatientModel.countDocuments({}),
  ]);

  // Patients grouped by condition (for condition distribution chart)
  const patientsByConditionRaw = await PatientModel.aggregate<ConditionCount>([
    { $group: { _id: "$condition", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  const patientsByCondition = patientsByConditionRaw.map((row) => ({
    condition: row._id,
    count: row.count,
  }));

  // Patients grouped by doctor (for top-doctors chart), joined with doctor names
  const patientsByDoctorRaw = await PatientModel.aggregate<DoctorCountProjected>([
    { $group: { _id: "$doctor", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: "doctors",
        localField: "_id",
        foreignField: "_id",
        as: "doctor",
      },
    },
    { $unwind: "$doctor" },
    {
      $project: {
        _id: 0,
        doctorId: "$_id",
        doctorName: "$doctor.name",
        count: 1,
      },
    },
  ]);
  const patientsByDoctor = patientsByDoctorRaw.map((row) => ({
    doctorId: String(row.doctorId),
    doctorName: row.doctorName,
    count: row.count,
  }));

  // Doctors grouped by specialization
  const doctorsBySpecializationRaw = await DoctorModel.aggregate<ConditionCount>([
    { $group: { _id: "$specialization", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  const doctorsBySpecialization = doctorsBySpecializationRaw.map((row) => ({
    specialization: row._id,
    count: row.count,
  }));

  // Doctors grouped by hospital
  const doctorsByHospitalRaw = await DoctorModel.aggregate<ConditionCount>([
    { $group: { _id: "$hospital", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  const doctorsByHospital = doctorsByHospitalRaw.map((row) => ({
    hospital: row._id,
    count: row.count,
  }));

  // Recent doctors (newest first)
  const recentDoctorsRaw = await DoctorModel.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .lean<DoctorDoc[]>();
  const recentDoctors = recentDoctorsRaw.map((doc) => {
    const d = doc as unknown as LeanWithId<DoctorDoc>;
    return {
      id: String(d._id),
      name: doc.name,
      specialization: doc.specialization,
      hospital: doc.hospital,
      createdAt: doc.createdAt?.toISOString(),
    };
  });

  // Recent patients (newest first)
  const recentPatientsRaw = await PatientModel.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .lean<PatientDoc[]>();
  const recentPatients = recentPatientsRaw.map((doc) => {
    const d = doc as unknown as LeanWithId<PatientDoc>;
    return {
      id: String(d._id),
      name: doc.name,
      condition: doc.condition,
      doctorId: String(doc.doctor),
      createdAt: doc.createdAt?.toISOString(),
    };
  });

  return {
    doctorsTotal,
    patientsTotal,
    patientsByCondition,
    patientsByDoctor,
    doctorsBySpecialization,
    doctorsByHospital,
    recentDoctors,
    recentPatients,
  };
}