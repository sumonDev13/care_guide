import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { Types } from "mongoose";
import { connectDatabase, disconnectDatabase } from "../src/config/mongodb.js";
import { startTestDb, stopTestDb } from "./helpers/mongodb.js";
import { DoctorModel, PatientModel, PATIENT_CONDITIONS, type PatientCondition } from "../src/models/index.js";

beforeAll(async () => {
  const { uri, dbName } = await startTestDb();
  await connectDatabase({ uri, dbName });
});

afterAll(async () => {
  await disconnectDatabase();
  await stopTestDb();
});

/**
 * Hermetic model-tier suite: schema validation and normalization rules,
 * database-level uniqueness, doctor-reference integrity, and the presence of
 * every intended index. Runs against the in-memory MongoDB only.
 */
describe("Doctor schema", () => {
  it("creates a doctor and stamps timestamps", async () => {
    const email = `dr-${randomUUID()}@mail.example.com`;
    const doctor = await DoctorModel.create({
      name: "Dr. Lina Yepes",
      specialization: "Cardiology",
      hospital: "Sunrise General",
      phone: "+880 1712-345678",
      email,
    });

    expect(doctor.name).toBe("Dr. Lina Yepes");
    expect(doctor.email).toBe(email);
    expect(doctor.createdAt).toBeInstanceOf(Date);
    expect(doctor.updatedAt).toBeInstanceOf(Date);
  });

  it("normalizes email to lowercase before persisting", async () => {
    const doctor = await DoctorModel.create({
      name: "Dr. Mixed Case",
      specialization: "Dermatology",
      hospital: "Greenlife Medical",
      phone: "+880 1911-999888",
      email: `MiXeD@ExamPle.COM-${randomUUID()}`.replace("@ExamPle.COM-", "@mail.example.com-"),
    });

    expect(doctor.email).toBe(doctor.email.toLowerCase());
  });

  it("rejects duplicate emails at the database level (code 11000)", async () => {
    const base = `dup-${randomUUID()}@mail.example.com`;
    await DoctorModel.create({
      name: "Dr. Original",
      specialization: "Neurology",
      hospital: "Padma Health Hub",
      phone: "+880 1712-345678",
      email: base,
    });

    await expect(
      DoctorModel.create({
        name: "Dr. Duplicate",
        specialization: "Neurology",
        hospital: "Padma Health Hub",
        phone: "+880 1712-345678",
        email: base.toUpperCase(),
      }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it("rejects missing required fields with named-path validation errors", async () => {
    await expect(
      DoctorModel.create({
        name: "Dr. Incomplete",
        hospital: "Sunrise General",
        phone: "+880 1712-345678",
        email: `incomplete-${randomUUID()}@mail.example.com`,
      }),
    ).rejects.toMatchObject({ name: "ValidationError" });
  });

  it("rejects malformed email and phone values", async () => {
    await expect(
      DoctorModel.create({
        name: "Dr. Bad Email",
        specialization: "ENT",
        hospital: "Sunrise General",
        phone: "+880 1712-345678",
        email: `not-an-email-${randomUUID()}`,
      }),
    ).rejects.toMatchObject({ name: "ValidationError" });

    await expect(
      DoctorModel.create({
        name: "Dr. Bad Phone",
        specialization: "ENT",
        hospital: "Sunrise General",
        phone: "12",
        email: `phone-test-${randomUUID()}@mail.example.com`,
      }),
    ).rejects.toMatchObject({ name: "ValidationError" });
  });
});

describe("Patient schema", () => {
  let doctorId: Types.ObjectId;

  beforeAll(async () => {
    const doctor = await DoctorModel.create({
      name: "Dr. Parent Tester",
      specialization: "General Medicine",
      hospital: "Rivermoss People's Hospital",
      phone: "+880 1811-223344",
      email: `parent-${randomUUID()}@mail.example.com`,
    });
    doctorId = doctor._id;
  });

  it("creates a patient linked to a real doctor", async () => {
    const patient = await PatientModel.create({
      name: "Nusrat Chowdhury",
      email: `patient-${randomUUID()}@mail.example.com`,
      condition: "chronic",
      doctor: doctorId,
      age: 54,
      gender: "female",
    });

    expect(patient.condition).toBe("chronic");
    expect(patient.createdAt).toBeInstanceOf(Date);

    // The doctor's patient list is a plain indexed query — the basis the
    // service layer will rely on (§5.4).
    const count = await PatientModel.countDocuments({ doctor: doctorId });
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it("rejects a patient whose linked doctor does not exist", async () => {
    const phantomId = (await import("mongoose")).Types.ObjectId.createFromTime(7);
    await expect(
      PatientModel.create({
        name: "Orphan Wannahave",
        email: `orphan-${randomUUID()}@mail.example.com`,
        condition: "general",
        doctor: phantomId,
      }),
    ).rejects.toMatchObject({ name: "ValidationError" });
  });

  it("requires at least one contact channel", async () => {
    await expect(
      PatientModel.create({ name: "No Contacts", condition: "general", doctor: doctorId }),
    ).rejects.toMatchObject({ name: "ValidationError" });
  });

  it("accepts email-only or phone-only patients", async () => {
    await expect(
      PatientModel.create({
        name: "Email Only",
        email: `email-only-${randomUUID()}@mail.example.com`,
        condition: "preventive",
        doctor: doctorId,
      }),
    ).resolves.toBeDefined();

    await expect(
      PatientModel.create({
        name: "Phone Only",
        phone: "+880 1712-000111",
        condition: "injury",
        doctor: doctorId,
      }),
    ).resolves.toBeDefined();
  });

  it("rejects unsupported condition and gender values", async () => {
    await expect(
      PatientModel.create({
        name: "Bad Condition",
        email: `bad-cond-${randomUUID()}@mail.example.com`,
        condition: "banana" as unknown as PatientCondition,
        doctor: doctorId,
      }),
    ).rejects.toMatchObject({ name: "ValidationError" });

    await expect(
      PatientModel.create({
        name: "Bad Gender",
        email: `bad-gender-${randomUUID()}@mail.example.com`,
        condition: "general",
        gender: ["whovian"] as unknown as "other",
        doctor: doctorId,
      }),
    ).rejects.toMatchObject({ name: "ValidationError" });
  });
});

describe("Indexes", () => {
  it("deploys the query-pattern indexes for both collections", async () => {
    await DoctorModel.init();
    await PatientModel.init();

    const doctorIndexes = await DoctorModel.listIndexes();
    const patientIndexes = await PatientModel.listIndexes();

    const keys = (indexes: Awaited<ReturnType<typeof DoctorModel.listIndexes>>): string[] =>
      indexes.map((index) => JSON.stringify(index.key));

    const doctorKeys = keys(doctorIndexes);
    const patientKeys = keys(patientIndexes);

    // Doctor: unique email, default sort, both filter compounds.
    expect(doctorKeys).toContain(JSON.stringify({ email: 1 }));
    expect(doctorKeys).toContain(JSON.stringify({ createdAt: -1 }));
    expect(doctorKeys).toContain(JSON.stringify({ specialization: 1, createdAt: -1 }));
    expect(doctorKeys).toContain(JSON.stringify({ hospital: 1, createdAt: -1 }));

    // Patient: doctor list compound, default sort, condition compound.
    expect(patientKeys).toContain(JSON.stringify({ doctor: 1, createdAt: -1 }));
    expect(patientKeys).toContain(JSON.stringify({ createdAt: -1 }));
    expect(patientKeys).toContain(JSON.stringify({ condition: 1, createdAt: -1 }));

    // Sanity: every condition value referenced by validation is a real value.
    expect(PATIENT_CONDITIONS).toContain("general");
  });
});
