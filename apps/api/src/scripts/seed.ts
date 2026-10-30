/**
 * Seed script — SYNTHETIC demonstration data for local development only.
 *
 *   npm run seed -w apps/api
 *
 * Hard behaviors:
 *  - Refuses to run with NODE_ENV=production (mistake-proofing).
 *  - Clears ONLY the doctors/patients collections of the configured database
 *    (MONGODB_DB_NAME) and repopulates them.
 *  - Deterministic PRNG: identical output across runs — reproducible for
 *    screenshots and pagination tests.
 *  - Document dates spread over ~90 days so date filters and dashboard
 *    charts operate on realistic material.
 *  - Prints per-collection created indexes (index deployment on the live
 *    cluster is observable without extra tooling).
 *  - Logs the connection with credentials redacted, never raw.
 */
import { DoctorModel } from "../models/doctor.model.js";
import { PatientModel, type PatientCondition } from "../models/patient.model.js";
import { connectDatabase, disconnectDatabase, describeMongoUri } from "../config/mongodb.js";
import { env } from "../config/env.js";
import { logger } from "../middleware/request-logger.js";

const FIRST_NAMES = [
  "Ayesha", "Farhana", "Tanjim", "Nusrat", "Rafid", "Sadia", "Mehedi", "Nabila",
  "Talha", "Sumaiya", "Ashik", "Rumana", "Sajid", "Mim", "Arif", "Priya", "Rezaul", "Sanjida",
];
const LAST_NAMES = [
  "Rahman", "Islam", "Hossain", "Akter", "Chowdhury", "Karim", "Ahmed", "Begum",
  "Siddique", "Mondal", "Sarker", "Ali", "Haque", "Kabir", "Nur", "Bhuiyan",
];
const SPECIALIZATIONS = [
  "General Medicine", "Cardiology", "Dermatology", "Orthopedics", "Pediatrics",
  "Neurology", "Gynecology", "ENT", "Ophthalmology", "Nephrology",
];
const HOSPITALS = [
  "United Care Hospital", "Greenlife Medical", "Night Moon Specialists",
  "Padma Health Hub", "Sunrise General", "Rivermoss People's Hospital",
];
// Condition distribution weights (sum = 100) — grouped, chart-friendly mix.
const CONDITION_WEIGHTS: Array<[PatientCondition, number]> = [
  ["general", 30], ["preventive", 20], ["chronic", 20],
  ["pediatric", 12], ["injury", 10], ["other", 8],
];
const AGE_RANGE_BY_CONDITION: Record<PatientCondition, [number, number]> = {
  general: [18, 78], preventive: [15, 70], chronic: [35, 85],
  pediatric: [1, 12], injury: [8, 60], other: [10, 80],
};

/** Tiny deterministic PRNG (mulberry32) — stable across runs and machines. */
function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng: () => number, list: readonly string[]): string {
  const index = Math.floor(rng() * list.length);
  return list[index] ?? list[list.length - 1] ?? "";
}

function weightedCondition(rng: () => number): PatientCondition {
  const roll = rng() * 100;
  let cursor = 0;
  for (const [condition, weight] of CONDITION_WEIGHTS) {
    cursor += weight;
    if (roll < cursor) return condition;
  }
  return "other";
}

function syntheticPhone(rng: () => number): string {
  return `+880 1${Math.floor(rng() * 9) + 1}${String(Math.floor(rng() * 90_000_000)).padStart(8, "0")}`;
}

function timestampDaysAgo(rng: () => number, maxDays: number): Date {
  return new Date(Date.now() - Math.floor(rng() * maxDays) * 24 * 60 * 60 * 1000);
}

function buildSyntheticDoctors(rng: () => number, count: number) {
  const usedEmails = new Set<string>();
  const doctors = [];
  for (let i = 0; i < count; i++) {
    const first = pick(rng, FIRST_NAMES);
    const last = pick(rng, LAST_NAMES);
    let email = `${first}.${last}${i}@mail.example.com`.toLowerCase();
    while (usedEmails.has(email)) {
      email = email.replace("@", `${Math.floor(rng() * 90) + 10}@`);
    }
    usedEmails.add(email);
    doctors.push({
      name: `Dr. ${first} ${last}`,
      specialization: pick(rng, SPECIALIZATIONS),
      hospital: pick(rng, HOSPITALS),
      phone: syntheticPhone(rng),
      email,
    });
  }
  return doctors;
}

export async function seed(): Promise<{ doctors: number; patients: number }> {
  if (env.nodeEnv === "production") {
    throw new Error("Seed refuses to run with NODE_ENV=production");
  }
  await connectDatabase();
  const rng = makeRng(20261031_1);

  await DoctorModel.init(); // indexes exist on this connection before inserts
  await PatientModel.init();

  await DoctorModel.deleteMany({}).exec();
  await PatientModel.deleteMany({}).exec();

  const doctorDocs = buildSyntheticDoctors(rng, 14);
  const insertedDoctors = await DoctorModel.insertMany(doctorDocs, { ordered: false });

  const patients = [];
  let patientTotal = 0;
  for (const doctor of insertedDoctors) {
    const perDoctor = 3 + Math.floor(rng() * 7); // 3–9 patients per doctor
    patientTotal += perDoctor;
    for (let i = 0; i < perDoctor; i++) {
      const first = pick(rng, FIRST_NAMES);
      const last = pick(rng, LAST_NAMES);
      const condition = weightedCondition(rng);
      const [minAge, maxAge] = AGE_RANGE_BY_CONDITION[condition];
      const when = timestampDaysAgo(rng, 90);
      patients.push({
        name: `${first} ${last}`,
        email:
          rng() < 0.7
            ? `${first.toLowerCase()}.${last.toLowerCase()}${patientTotal}@mail.example.com`
            : undefined,
        phone: rng() < 0.9 ? syntheticPhone(rng) : undefined,
        condition,
        doctor: doctor._id,
        age: Math.floor(rng() * (maxAge - minAge + 1)) + minAge,
        gender: (rng() < 0.5 ? "male" : rng() < 0.92 ? "female" : "other") as "male" | "female" | "other",
        createdAt: when,
        updatedAt: when,
      });
    }
  }

  // Raw collection insert bypasses mongoose document middleware entirely —
  // correct for seeding: generated timestamps pass through untouched and the
  // per-write doctor-existence check (an API-path concern) is not repeated
  // for ties that were just created from live _ids.
  await PatientModel.collection.insertMany(patients, { ordered: false });

  const doctorIndexes = await DoctorModel.listIndexes();
  const patientIndexes = await PatientModel.listIndexes();
  logger.info(
    {
      doctors: doctorDocs.length,
      patients: patients.length,
      doctorIndexes: doctorIndexes.map((index) => index.name),
      patientIndexes: patientIndexes.map((index) => index.name),
    },
    "Seed completed",
  );

  return { doctors: doctorDocs.length, patients: patients.length };
}

const isDirectRun = process.argv[1]?.endsWith("seed.ts") || process.argv[1]?.endsWith("seed.js");
if (isDirectRun) {
  seed()
    .then(async (summary) => {
      logger.info({ database: describeMongoUri(env.mongodbUri), summary }, "Seed finished");
      await disconnectDatabase();
    })
    .catch(async (err) => {
      logger.error({ err }, "Seed failed");
      await disconnectDatabase();
      process.exit(1);
    });
}
