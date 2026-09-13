import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import "./App.css";
import "./FrostPanel.css";
import "./InstructorControl.css";
import "./Classroom.css";
import "./LiveRoster.css";

import {
  closeRoom,
  createRoom,
  getInstructorStatus,
  getStudentStatus,
  heartbeat,
  joinRoom,
  leaveRoom,
  recordAttempt as recordClassroomAttempt,
  updateAssignment,
  updateStudentLiveStatus,
  type ClassroomParticipant,
} from "./lib/classroomApi";

import {
  createInitialRadioState,
} from "./models/radio";

import type {
  NumericDigit,
  RadioState,
  ShiftDirection,
  VFOSelection,
} from "./models/radio";

import {
  getCurrentReceiveFrequency,
  getCurrentTransmitFrequency,
  getCurrentTransmitTone,
  getMainMenuItems,
  getSectionItems,
  getSectionLabel,
  getSelectedMemoryChannel,
  getSelectedSectionItem,
  radioReducer,
} from "./engine/radioStateMachine";

import {
  evaluateFrostStatus,
} from "./engine/repeaterEngine";

/* =========================================
   LOCAL STORAGE
========================================= */

const STORAGE_KEY =
  "black-sky-virtual-ht-memory-v1";

const INSTRUCTOR_SCENARIOS_STORAGE_KEY =
  "black-sky-virtual-ht-instructor-scenarios-v1";

interface SavedRadioData {
  memories: RadioState["memories"];
  selectedMemoryChannel: number;
}

function loadInitialRadioState(): RadioState {
  const initial =
    createInitialRadioState();

  try {
    const raw =
      localStorage.getItem(
        STORAGE_KEY
      );

    if (!raw) {
      return initial;
    }

    const saved:
      Partial<SavedRadioData> =
      JSON.parse(raw);

    return {
      ...initial,

      memories:
        saved.memories ??
        {},

      selectedMemoryChannel:
        saved.selectedMemoryChannel ??
        1,
    };
  } catch {
    return initial;
  }
}

/* =========================================
   KEYPAD
========================================= */

type KeypadButton = {
  main: string;
  sub?: string;
};

const keypad: KeypadButton[] = [
  { main: "1", sub: "STEP" },
  { main: "2", sub: "TXP" },
  { main: "3", sub: "SAVE" },
  { main: "*", sub: "LOCK" },

  { main: "4", sub: "VOX" },
  { main: "5", sub: "W/N" },
  { main: "6", sub: "ABR" },
  { main: "0", sub: "FM" },

  { main: "7", sub: "TONE" },
  { main: "8", sub: "MEM" },
  { main: "9", sub: "SCAN" },
  { main: "#", sub: "BAND" },
];

/* =========================================
   FORMATTERS
========================================= */

function formatFrequency(
  hz: number,
  decimals = 5
): string {
  return (
    hz /
    1_000_000
  ).toFixed(decimals);
}

function formatTone(
  tone: number | null
): string {
  return tone === null
    ? "OFF"
    : `${tone.toFixed(1)} Hz`;
}

function formatShift(
  shift: ShiftDirection
): string {
  if (shift === "PLUS") {
    return "+";
  }

  if (shift === "MINUS") {
    return "-";
  }

  return "OFF";
}

function formatChannel(
  channel: number
): string {
  return channel
    .toString()
    .padStart(
      2,
      "0"
    );
}

function isNumericKey(
  value: string
): value is NumericDigit {
  return /^[0-9]$/.test(
    value
  );
}

function formatEntry(
  value: string
): string {
  if (
    value.length <= 3
  ) {
    return value;
  }

  return `${value.slice(
    0,
    3
  )}.${value.slice(3)}`;
}

function menuIcon(
  id: string
): string {
  switch (id) {
    case "ZONE":
      return "◎";

    case "SCAN":
      return "◉";

    case "RADIO_SETTING":
      return "⚙";

    case "PROGRAM_CHANNEL":
      return "▣";

    case "RADIO_INFORMATION":
      return "▤";

    case "GNSS":
      return "●";

    case "NOAA_WEATHER":
      return "☁";

    default:
      return "▪";
  }
}



type InstructorAssignmentMode =
  | "REPEATER"
  | "SIMPLEX";

interface InstructorDraft {
  scenarioName: string;
  scenarioDetails: string;
  mode: InstructorAssignmentMode;
  outputMHz: string;
  inputMHz: string;
  offsetMHz: string;
  shiftDirection: ShiftDirection;
  toneHz: string;
  simplexMHz: string;
}

interface AppliedInstructorAssignment {
  scenarioName: string;
  scenarioDetails: string;
  mode: InstructorAssignmentMode;
  rxFrequencyHz: number;
  txFrequencyHz: number;
  offsetHz: number;
  shiftDirection: ShiftDirection;
  requiredCtcssHz: number | null;
}

type GradingPassRequirement =
  | "ANY_SUCCESS"
  | "FINAL_SUCCESS"
  | "FIRST_ATTEMPT_SUCCESS";

interface InstructorGradingSettings {
  maxAttempts: number;
  enforceMaxAttempts: boolean;
  enforceTimeLimit: boolean;
  allowHints: boolean;
  passRequirement: GradingPassRequirement;
  requiredSuccessfulAttempts: number;
}

const DEFAULT_GRADING_SETTINGS: InstructorGradingSettings = {
  maxAttempts: 5,
  enforceMaxAttempts: true,
  enforceTimeLimit: true,
  allowHints: false,
  passRequirement: "ANY_SUCCESS",
  requiredSuccessfulAttempts: 1,
};

interface SavedInstructorScenario {
  id: string;
  name: string;
  draft: InstructorDraft;
  timerMinutes: number;
  grading?: InstructorGradingSettings;
}

type AttemptFailureElement =
  | "Fr"
  | "O"
  | "S"
  | "T"
  | null;

interface StudentAttemptRecord {
  id: number;
  attemptNumber: number;
  timestamp: string;
  timerDisplay: string;
  success: boolean;
  failureElement: AttemptFailureElement;
  accessStatus: string;
  sessionElapsedSeconds: number | null;
}

interface StudentSessionReport {
  studentName: string;
  className: string;
  scenarioName: string;
  assignmentMode: InstructorAssignmentMode;
  assignmentDurationSeconds: number;
  attempts: StudentAttemptRecord[];
  completionSeconds: number;
  passed: boolean;
  systemPassed: boolean;
  startedAt: number;
  endedAt: number;
  grading: InstructorGradingSettings;
  endReason: "INSTRUCTOR" | "TIME_LIMIT" | "MAX_ATTEMPTS";
  passReason: string;
  systemPassReason: string;
  instructorOverride: "PASS" | "FAIL" | null;
  instructorOverrideNote: string | null;
}

function loadSavedInstructorScenarios(): SavedInstructorScenario[] {
  try {
    const raw = localStorage.getItem(
      INSTRUCTOR_SCENARIOS_STORAGE_KEY
    );

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch {
    return [];
  }
}

function formatAssignmentTimer(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

function formatSessionDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

const DEFAULT_INSTRUCTOR_DRAFT: InstructorDraft = {
  scenarioName: "Training Scenario 1",
  scenarioDetails:
    "Your team has been directed to establish communications using the assigned channel. Program the virtual HT, verify Fr.O.S.T, and key PTT when you believe the radio is ready.",
  mode: "REPEATER",
  outputMHz: "146.940",
  inputMHz: "146.340",
  offsetMHz: "0.600",
  shiftDirection: "MINUS",
  toneHz: "100.0",
  simplexMHz: "146.520",
};

function mhzToHz(value: string): number | null {
  const parsed = Number(value.trim());

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.round(parsed * 1_000_000);
}

function offsetMhzToHz(value: string): number | null {
  const parsed = Number(value.trim());

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.round(parsed * 1_000_000);
}

function parseInstructorTone(value: string): number | null | undefined {
  const normalized = value.trim().toUpperCase();

  if (normalized === "" || normalized === "NONE" || normalized === "OFF") {
    return null;
  }

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

type ClassroomRole = "NONE" | "INSTRUCTOR" | "STUDENT";


interface ClassroomAssignmentPayload {
  assignment: AppliedInstructorAssignment | null;
  grading: InstructorGradingSettings;
  timerMinutes: number;
  assignmentDetailsVisible: boolean;
  locked: boolean;
}


/* =========================================
   APP
========================================= */

function App() {
  const [
    radio,
    dispatch,
  ] = useReducer(
    radioReducer,
    undefined,
    loadInitialRadioState
  );

  const audioContextRef =
    useRef<AudioContext | null>(
      null
    );

  const pttActiveRef =
    useRef(false);

  const [instructorDraft, setInstructorDraft] =
    useState<InstructorDraft>(DEFAULT_INSTRUCTOR_DRAFT);

  const [appliedAssignment, setAppliedAssignment] =
    useState<AppliedInstructorAssignment | null>(null);

  const [assignmentLocked, setAssignmentLocked] =
    useState(false);

  const [assignmentDetailsVisible, setAssignmentDetailsVisible] =
    useState(true);

  const [assignmentMessage, setAssignmentMessage] =
    useState("No instructor assignment is active.");

  const [instructorConsoleOpen, setInstructorConsoleOpen] =
    useState(false);


  const [savedScenarios, setSavedScenarios] =
    useState<SavedInstructorScenario[]>(
      loadSavedInstructorScenarios
    );

  const [selectedScenarioId, setSelectedScenarioId] =
    useState("");

  const [timerMinutes, setTimerMinutes] =
    useState(10);

  const [timerSecondsRemaining, setTimerSecondsRemaining] =
    useState(10 * 60);

  const [timerRunning, setTimerRunning] =
    useState(false);

  const [gradingSettings, setGradingSettings] =
    useState<InstructorGradingSettings>(DEFAULT_GRADING_SETTINGS);

  const [studentAttempts, setStudentAttempts] =
    useState<StudentAttemptRecord[]>([]);

  const studentAttemptsRef =
    useRef<StudentAttemptRecord[]>([]);

  const [studentName, setStudentName] =
    useState("");

  const [studentClass, setStudentClass] =
    useState("");

  const [studentSessionActive, setStudentSessionActive] =
    useState(false);

  const [studentSessionStartedAt, setStudentSessionStartedAt] =
    useState<number | null>(null);

  const [studentSessionReport, setStudentSessionReport] =
    useState<StudentSessionReport | null>(null);

  const [instructorOverrideNote, setInstructorOverrideNote] =
    useState("");

  const [instructorReopenedSession, setInstructorReopenedSession] =
    useState(false);

  const [studentSessionMessage, setStudentSessionMessage] =
    useState("Enter the student name and class, then begin the session.");

  const [classroomRole, setClassroomRole] =
    useState<ClassroomRole>("NONE");

  const [roomCode, setRoomCode] =
    useState(() => {
      const params = new URLSearchParams(window.location.search);
      return (params.get("room") ?? "").toUpperCase();
    });

  const [roomId, setRoomId] =
    useState<string | null>(null);

  const [participantId, setParticipantId] =
    useState<string | null>(null);

  const [participantToken, setParticipantToken] =
    useState<string | null>(null);

  const [instructorToken, setInstructorToken] =
    useState<string | null>(null);

  const [classroomMessage, setClassroomMessage] =
    useState("Create an instructor room or join with a six-character room code.");

  const [connectedStudents, setConnectedStudents] =
    useState<ClassroomParticipant[]>([]);

  const [classroomBusy, setClassroomBusy] =
    useState(false);

  /* =======================================
     SAVE MEMORIES
  ======================================= */

  useEffect(
    () => {
      try {
        const data:
          SavedRadioData = {
          memories:
            radio.memories,

          selectedMemoryChannel:
            radio.selectedMemoryChannel,
        };

        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(
            data
          )
        );
      } catch {
        // keep simulator running
      }
    },
    [
      radio.memories,
      radio.selectedMemoryChannel,
    ]
  );

  useEffect(
    () => {
      try {
        localStorage.setItem(
          INSTRUCTOR_SCENARIOS_STORAGE_KEY,
          JSON.stringify(savedScenarios)
        );
      } catch {
        // Scenario persistence is optional.
      }
    },
    [savedScenarios]
  );

  useEffect(
    () => {
      if (!timerRunning) {
        return;
      }

      const intervalId = window.setInterval(
        () => {
          setTimerSecondsRemaining(current => {
            if (current <= 1) {
              window.clearInterval(intervalId);
              setTimerRunning(false);
              return 0;
            }

            return current - 1;
          });
        },
        1000
      );

      return () =>
        window.clearInterval(intervalId);
    },
    [timerRunning]
  );


  useEffect(
    () => {
      if (
        studentSessionActive &&
        !instructorReopenedSession &&
        gradingSettings.enforceTimeLimit &&
        timerSecondsRemaining === 0
      ) {
        endStudentSession("TIME_LIMIT");
      }
    },
    [
      timerSecondsRemaining,
      studentSessionActive,
      gradingSettings.enforceTimeLimit,
      instructorReopenedSession,
    ]
  );


  useEffect(() => {
    if (
      !roomId ||
      !instructorToken ||
      classroomRole !== "INSTRUCTOR"
    ) {
      return;
    }

    const activeRoomId = roomId;
    const activeInstructorToken = instructorToken;
    let cancelled = false;

    async function refreshInstructorRoom() {
      try {
        const status = await getInstructorStatus(
          activeRoomId,
          activeInstructorToken
        );

        if (cancelled) {
          return;
        }

        setConnectedStudents(status.students ?? []);

        if (status.room.status === "CLOSED") {
          setClassroomMessage(`Room ${roomCode} is closed.`);
        }
      } catch (error) {
        if (!cancelled) {
          setClassroomMessage(
            error instanceof Error
              ? error.message
              : "Could not refresh classroom roster."
          );
        }
      }
    }

    void refreshInstructorRoom();

    const intervalId = window.setInterval(
      () => {
        void refreshInstructorRoom();
      },
      1500
    );

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    roomId,
    instructorToken,
    classroomRole,
    roomCode,
  ]);

  useEffect(() => {
    if (
      !participantId ||
      !participantToken ||
      classroomRole !== "STUDENT"
    ) {
      return;
    }

    const activeParticipantId = participantId;
    const activeParticipantToken = participantToken;
    let cancelled = false;

    async function refreshStudentRoom() {
      try {
        const status = await getStudentStatus(
          activeParticipantId,
          activeParticipantToken
        );

        if (cancelled) {
          return;
        }

        if (status.room.status === "CLOSED") {
          setClassroomMessage(
            "This classroom has been closed by the instructor."
          );
          setTimerRunning(false);
          return;
        }

        const payload =
          status.room.active_assignment as
            | ClassroomAssignmentPayload
            | null;

        if (!payload) {
          setAppliedAssignment(null);
          setAssignmentMessage(
            "Waiting for the instructor to apply an assignment."
          );
          return;
        }

        setAppliedAssignment(
          payload.assignment ?? null
        );

        setGradingSettings({
          ...DEFAULT_GRADING_SETTINGS,
          ...(payload.grading ?? {}),
        });

        setTimerMinutes(
          payload.timerMinutes ?? 10
        );

        setTimerSecondsRemaining(
          status.room.timer_seconds ??
            (payload.timerMinutes ?? 10) * 60
        );

        setAssignmentDetailsVisible(
          Boolean(
            payload.assignmentDetailsVisible
          )
        );

        setAssignmentLocked(
          Boolean(payload.locked)
        );

        setAssignmentMessage(
          payload.assignment
            ? `Live classroom assignment: ${payload.assignment.scenarioName}`
            : "Waiting for the instructor to apply an assignment."
        );
      } catch (error) {
        if (!cancelled) {
          setClassroomMessage(
            error instanceof Error
              ? error.message
              : "Could not refresh classroom assignment."
          );
        }
      }
    }

    void refreshStudentRoom();

    const intervalId = window.setInterval(
      () => {
        void refreshStudentRoom();
      },
      1500
    );

    const heartbeatId = window.setInterval(
      () => {
        void heartbeat(
          activeParticipantId,
          activeParticipantToken
        );
      },
      15000
    );

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.clearInterval(heartbeatId);
    };
  }, [
    participantId,
    participantToken,
    classroomRole,
  ]);

  useEffect(() => {
    if (
      !roomId ||
      !instructorToken ||
      classroomRole !== "INSTRUCTOR"
    ) {
      return;
    }

    const payload: ClassroomAssignmentPayload = {
      assignment: appliedAssignment,
      grading: normalizeGradingSettings(
        gradingSettings
      ),
      timerMinutes,
      assignmentDetailsVisible,
      locked: assignmentLocked,
    };

    const timeoutId =
      window.setTimeout(() => {
        void updateAssignment(
          roomId,
          instructorToken,
          payload,
          Math.max(
            0,
            timerSecondsRemaining
          )
        ).catch(error => {
          setClassroomMessage(
            error instanceof Error
              ? error.message
              : "Could not synchronize assignment."
          );
        });
      }, 250);

    return () =>
      window.clearTimeout(timeoutId);
  }, [
    roomId,
    instructorToken,
    classroomRole,
    appliedAssignment,
    gradingSettings,
    timerMinutes,
    timerSecondsRemaining,
    assignmentDetailsVisible,
    assignmentLocked,
  ]);

  async function createClassroomRoom() {
    setClassroomBusy(true);
    setClassroomMessage(
      "Creating Black Sky classroom..."
    );

    try {
      const createdRoom =
        await createRoom(
          timerMinutes * 60
        );

      setRoomId(createdRoom.id);
      setInstructorToken(
        createdRoom.instructor_token
      );
      setParticipantId(null);
      setParticipantToken(null);
      setRoomCode(
        createdRoom.room_code
      );
      setClassroomRole(
        "INSTRUCTOR"
      );
      setConnectedStudents([]);
      setClassroomMessage(
        `Room ${createdRoom.room_code} is open. Share the room code or student link.`
      );

      sessionStorage.setItem(
        "black-sky-instructor-room",
        JSON.stringify({
          roomId: createdRoom.id,
          roomCode:
            createdRoom.room_code,
          instructorToken:
            createdRoom.instructor_token,
        })
      );

      const nextUrl =
        new URL(
          window.location.href
        );

      nextUrl.searchParams.delete(
        "room"
      );

      window.history.replaceState(
        {},
        "",
        nextUrl
      );
    } catch (error) {
      setClassroomMessage(
        error instanceof Error
          ? error.message
          : "Could not create classroom."
      );
    } finally {
      setClassroomBusy(false);
    }
  }

  async function joinClassroomRoom() {
    const normalizedCode =
      roomCode
        .trim()
        .toUpperCase();

    if (
      normalizedCode.length !== 6
    ) {
      setClassroomMessage(
        "Enter the six-character classroom room code."
      );
      return;
    }

    if (!studentName.trim()) {
      setClassroomMessage(
        "Enter the student name before joining the classroom."
      );
      return;
    }

    setClassroomBusy(true);
    setClassroomMessage(
      `Joining room ${normalizedCode}...`
    );

    try {
      const joined =
        await joinRoom(
          normalizedCode,
          studentName.trim(),
          studentClass.trim()
        );

      setRoomId(
        joined.room.id
      );

      setParticipantId(
        joined.participant.id
      );

      setParticipantToken(
        joined.participant
          .participant_token
      );

      setInstructorToken(null);

      setRoomCode(
        normalizedCode
      );

      setClassroomRole(
        "STUDENT"
      );

      setClassroomMessage(
        `Connected to classroom ${normalizedCode}.`
      );

      const payload =
        joined.room
          .active_assignment as
            | ClassroomAssignmentPayload
            | null;

      if (payload) {
        setAppliedAssignment(
          payload.assignment ?? null
        );

        setGradingSettings({
          ...DEFAULT_GRADING_SETTINGS,
          ...(payload.grading ?? {}),
        });

        setTimerMinutes(
          payload.timerMinutes ?? 10
        );

        setTimerSecondsRemaining(
          joined.room
            .timer_seconds ??
            (payload.timerMinutes ??
              10) *
              60
        );

        setAssignmentDetailsVisible(
          Boolean(
            payload.assignmentDetailsVisible
          )
        );

        setAssignmentLocked(
          Boolean(payload.locked)
        );
      }

      sessionStorage.setItem(
        "black-sky-student-room",
        JSON.stringify({
          roomId:
            joined.room.id,
          roomCode:
            normalizedCode,
          participantId:
            joined.participant.id,
          participantToken:
            joined.participant
              .participant_token,
        })
      );

      const nextUrl =
        new URL(
          window.location.href
        );

      nextUrl.searchParams.set(
        "room",
        normalizedCode
      );

      window.history.replaceState(
        {},
        "",
        nextUrl
      );
    } catch (error) {
      setClassroomMessage(
        error instanceof Error
          ? error.message
          : "Could not join classroom."
      );
    } finally {
      setClassroomBusy(false);
    }
  }

  async function leaveClassroomRoom() {
    if (
      participantId &&
      participantToken
    ) {
      try {
        await leaveRoom(
          participantId,
          participantToken
        );
      } catch {
        // local disconnect still proceeds
      }
    }

    setParticipantId(null);
    setParticipantToken(null);
    setInstructorToken(null);
    setRoomId(null);
    setClassroomRole("NONE");
    setConnectedStudents([]);
    setClassroomMessage(
      "Disconnected from classroom."
    );

    sessionStorage.removeItem(
      "black-sky-student-room"
    );

    sessionStorage.removeItem(
      "black-sky-instructor-room"
    );

    const nextUrl =
      new URL(
        window.location.href
      );

    nextUrl.searchParams.delete(
      "room"
    );

    window.history.replaceState(
      {},
      "",
      nextUrl
    );
  }

  async function closeClassroomRoom() {
    if (
      !roomId ||
      !instructorToken ||
      classroomRole !== "INSTRUCTOR"
    ) {
      return;
    }

    try {
      await closeRoom(
        roomId,
        instructorToken
      );

      setClassroomMessage(
        `Room ${roomCode} is closed.`
      );
    } catch (error) {
      setClassroomMessage(
        error instanceof Error
          ? error.message
          : "Could not close classroom."
      );
    }
  }

  async function copyStudentRoomLink() {
    const url =
      new URL(
        window.location.href
      );

    url.searchParams.set(
      "room",
      roomCode
    );

    await navigator.clipboard.writeText(
      url.toString()
    );

    setClassroomMessage(
      "Student classroom link copied to clipboard."
    );
  }

  /* =======================================
     SOUND
  ======================================= */

  function getAudioContext():
    AudioContext | null {
    try {
      if (
        !audioContextRef.current
      ) {
        audioContextRef.current =
          new AudioContext();
      }

      const context =
        audioContextRef.current;

      if (
        context.state ===
        "suspended"
      ) {
        void context.resume();
      }

      return context;
    } catch {
      return null;
    }
  }

  function playTone(
    frequency: number,
    duration: number,
    volume = 0.045,
    delay = 0
  ) {
    const context =
      getAudioContext();

    if (!context) {
      return;
    }

    const oscillator =
      context.createOscillator();

    const gain =
      context.createGain();

    oscillator.type =
      "sine";

    oscillator.frequency.value =
      frequency;

    const now =
      context.currentTime +
      delay;

    gain.gain.setValueAtTime(
      0.0001,
      now
    );

    gain.gain.exponentialRampToValueAtTime(
      volume,
      now + 0.005
    );

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + duration
    );

    oscillator.connect(
      gain
    );

    gain.connect(
      context.destination
    );

    oscillator.start(now);

    oscillator.stop(
      now +
        duration +
        0.02
    );
  }

  function playRadioNoiseBurst(
    duration = 0.08,
    volume = 0.028,
    delay = 0
  ) {
    const context =
      getAudioContext();

    if (!context) {
      return;
    }

    const frameCount =
      Math.max(
        1,
        Math.floor(
          context.sampleRate *
            duration
        )
      );

    const buffer =
      context.createBuffer(
        1,
        frameCount,
        context.sampleRate
      );

    const data =
      buffer.getChannelData(0);

    for (
      let index = 0;
      index < data.length;
      index += 1
    ) {
      data[index] =
        (Math.random() * 2 - 1) *
        0.7;
    }

    const source =
      context.createBufferSource();

    const filter =
      context.createBiquadFilter();

    const gain =
      context.createGain();

    source.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.value = 1800;
    filter.Q.value = 0.75;

    const start =
      context.currentTime +
      delay;

    gain.gain.setValueAtTime(
      0.0001,
      start
    );

    gain.gain.linearRampToValueAtTime(
      volume,
      start + 0.008
    );

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      start + duration
    );

    source.connect(filter);
    filter.connect(gain);
    gain.connect(
      context.destination
    );

    source.start(start);
    source.stop(
      start + duration
    );
  }

  function playButtonBeep() {
    playTone(
      900,
      0.055,
      0.04
    );
  }

  function playKeypadBeep() {
    playTone(
      1100,
      0.065,
      0.045
    );
  }

  function playPttDownSound() {
    // Short key-click + RF hiss + low carrier chirp.
    playTone(
      1450,
      0.018,
      0.05
    );

    playRadioNoiseBurst(
      0.075,
      0.035,
      0.008
    );

    playTone(
      430,
      0.045,
      0.035,
      0.025
    );
  }

  function playPttUpSound() {
    // Squelch-tail style release noise followed by a short radio chirp.
    playRadioNoiseBurst(
      0.12,
      0.042
    );

    playTone(
      760,
      0.035,
      0.04,
      0.07
    );

    playTone(
      520,
      0.04,
      0.03,
      0.105
    );
  }

  /* =======================================
     SPEECH
  ======================================= */

  function speakMode(
    mode: "VFO" | "MR"
  ) {
    try {
      if (
        !(
          "speechSynthesis" in
          window
        )
      ) {
        return;
      }

      window
        .speechSynthesis
        .cancel();

      const message =
        new SpeechSynthesisUtterance(
          mode === "VFO"
            ? "Frequency mode"
            : "Channel mode"
        );

      message.rate =
        0.92;

      message.pitch =
        0.85;

      message.volume =
        0.9;

      window
        .speechSynthesis
        .speak(message);
    } catch {
      // no voice available
    }
  }

  function speakAccessDecision(
    status: string
  ) {
    try {
      if (
        !(
          "speechSynthesis" in
          window
        )
      ) {
        return;
      }

      let words =
        "Access not granted";

      if (
        status ===
        "NO ASSIGNMENT"
      ) {
        words =
          "No instructor assignment";
      } else if (
        status ===
        "ACCESS GRANTED"
      ) {
        words =
          "Access granted";
      } else if (
        status ===
        "SIMPLEX TX"
      ) {
        words =
          "Simplex transmit";
      } else if (
        status ===
        "WRONG FREQUENCY"
      ) {
        words =
          "Access not granted. Wrong frequency";
      } else if (
        status ===
        "WRONG OFFSET"
      ) {
        words =
          "Access not granted. Wrong offset";
      } else if (
        status ===
        "WRONG SHIFT"
      ) {
        words =
          "Access not granted. Wrong shift";
      } else if (
        status ===
        "WRONG TONE"
      ) {
        words =
          "Access not granted. Wrong tone";
      }

      window
        .speechSynthesis
        .cancel();

      const message =
        new SpeechSynthesisUtterance(
          words
        );

      message.rate = 0.96;
      message.pitch = 0.76;
      message.volume = 0.95;

      window
        .speechSynthesis
        .speak(message);
    } catch {
      // voice feedback is optional
    }
  }

  /* =======================================
     RADIO STATE
  ======================================= */

  const isTx =
    radio.radioActivity ===
    "TX";

  const isAActive =
    radio.selectedVfo ===
    "A";

  const isBActive =
    radio.selectedVfo ===
    "B";

  const mainMenuItems =
    getMainMenuItems(
      radio.operatingMode
    );

  const selectedMemory =
    getSelectedMemoryChannel(
      radio
    );

  const rxFrequency =
    getCurrentReceiveFrequency(
      radio
    );

  const txFrequency =
    getCurrentTransmitFrequency(
      radio
    );

  const txTone =
    getCurrentTransmitTone(
      radio
    );

  const sectionItems =
    getSectionItems(
      radio.menu.section
    );

  const selectedSectionItem =
    getSelectedSectionItem(
      radio
    );

  const pendingMemoryChannel =
    radio.menu.edit
      .pendingMemoryChannel ??
    radio.selectedMemoryChannel;

  const pendingMemory =
    radio.memories[
      pendingMemoryChannel
    ] ?? null;

  /* =======================================
     INSTRUCTOR ASSIGNMENT + Fr.O.S.T ENGINE
  ======================================= */

  const programmedOffsetHz =
    radio.operatingMode === "MR"
      ? selectedMemory?.offsetHz ?? 0
      : radio.vfoA.offsetHz;

  const programmedShiftDirection:
    ShiftDirection =
    radio.operatingMode === "MR"
      ? selectedMemory?.shiftDirection ??
        "OFF"
      : radio.vfoA.shiftDirection;

  useEffect(() => {
    if (
      !participantId ||
      !participantToken ||
      classroomRole !== "STUDENT"
    ) {
      return;
    }

    const activeParticipantId = participantId;
    const activeParticipantToken = participantToken;

    const timeoutId = window.setTimeout(() => {
      const liveResult =
        evaluateInstructorAssignment(false);

      const liveStatus =
        liveResult?.accessStatus ??
        (appliedAssignment
          ? "NOT READY"
          : "WAITING FOR ASSIGNMENT");

      void updateStudentLiveStatus(
        activeParticipantId,
        activeParticipantToken,
        {
          frequency:
            liveResult?.frequency ?? null,
          observation:
            liveResult?.offset ?? null,
          signal:
            liveResult?.shift ?? null,
          transmission:
            liveResult?.tone ?? null,

          offset:
            liveResult?.offset ?? null,
          shift:
            liveResult?.shift ?? null,
          tone:
            liveResult?.tone ?? null,

          accessStatus:
            liveStatus,

          programmedRxHz:
            rxFrequency,
          programmedTxHz:
            txFrequency,
          programmedOffsetHz,
          programmedShiftDirection,
          programmedToneHz:
            txTone,
        },
        studentSessionActive
          ? "IN EXERCISE"
          : appliedAssignment
          ? "CONNECTED"
          : "WAITING"
      ).catch(() => {
        // Classroom telemetry must never interrupt the radio simulator.
      });
    }, 250);

    return () =>
      window.clearTimeout(timeoutId);
  }, [
    participantId,
    participantToken,
    classroomRole,
    appliedAssignment,
    studentSessionActive,
    rxFrequency,
    txFrequency,
    txTone,
    programmedOffsetHz,
    programmedShiftDirection,
  ]);

  function getRosterFrost(
    student: ClassroomParticipant
  ): Record<string, unknown> {
    return (
      student.frost_status ??
      {}
    ) as Record<string, unknown>;
  }

  function getRosterNumber(
    student: ClassroomParticipant,
    key: string
  ): number | null {
    const value =
      getRosterFrost(student)[key];

    return typeof value === "number" &&
      Number.isFinite(value)
      ? value
      : null;
  }

  function getRosterString(
    student: ClassroomParticipant,
    key: string
  ): string | null {
    const value =
      getRosterFrost(student)[key];

    return typeof value === "string"
      ? value
      : null;
  }

  function rosterMatchClass(
    value: string | null
  ): string {
    if (value === "MATCH") {
      return "roster-match";
    }

    if (value === "NO MATCH") {
      return "roster-no-match";
    }

    return "roster-unknown";
  }

  function formatRosterFrequency(
    student: ClassroomParticipant
  ): string {
    const rx =
      getRosterNumber(
        student,
        "programmedRxHz"
      );

    const tx =
      getRosterNumber(
        student,
        "programmedTxHz"
      );

    if (
      rx === null &&
      tx === null
    ) {
      return "—";
    }

    const rxText =
      rx === null
        ? "—"
        : (
            rx /
            1_000_000
          ).toFixed(3);

    const txText =
      tx === null
        ? "—"
        : (
            tx /
            1_000_000
          ).toFixed(3);

    return `${rxText} / ${txText}`;
  }

  function formatRosterObservation(
    student: ClassroomParticipant
  ): string {
    const offset =
      getRosterNumber(
        student,
        "programmedOffsetHz"
      );

    if (offset === null) {
      return "—";
    }

    return `${(
      offset /
      1_000_000
    ).toFixed(3)} MHz`;
  }

  function formatRosterSignal(
    student: ClassroomParticipant
  ): string {
    return (
      getRosterString(
        student,
        "programmedShiftDirection"
      ) ??
      "—"
    );
  }

  function formatRosterTransmission(
    student: ClassroomParticipant
  ): string {
    const tone =
      getRosterNumber(
        student,
        "programmedToneHz"
      );

    if (tone === null) {
      const raw =
        getRosterFrost(student)[
          "programmedToneHz"
        ];

      return raw === null
        ? "OFF"
        : "—";
    }

    return `${tone.toFixed(1)} Hz`;
  }

  function rosterCurrentStatus(
    student: ClassroomParticipant
  ): string {
    if (!student.connected) {
      return "DISCONNECTED";
    }

    return (
      getRosterString(
        student,
        "accessStatus"
      ) ??
      student.session_status ??
      "CONNECTED"
    );
  }

  function saveCurrentScenario() {
    const scenarioName =
      instructorDraft.scenarioName.trim() ||
      "Untitled Scenario";

    const id =
      selectedScenarioId ||
      `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;

    const nextScenario: SavedInstructorScenario = {
      id,
      name: scenarioName,
      draft: { ...instructorDraft },
      timerMinutes,
      grading: normalizeGradingSettings(gradingSettings),
    };

    setSavedScenarios(current => {
      const existingIndex = current.findIndex(
        scenario => scenario.id === id
      );

      if (existingIndex === -1) {
        return [...current, nextScenario];
      }

      return current.map(scenario =>
        scenario.id === id
          ? nextScenario
          : scenario
      );
    });

    setSelectedScenarioId(id);
    setAssignmentMessage(
      `Saved scenario + grading preset: ${scenarioName}`
    );
  }

  function loadScenario(id: string) {
    setSelectedScenarioId(id);

    const scenario = savedScenarios.find(
      item => item.id === id
    );

    if (!scenario) {
      return;
    }

    setInstructorDraft({ ...scenario.draft });
    setTimerMinutes(scenario.timerMinutes);
    setTimerSecondsRemaining(
      scenario.timerMinutes * 60
    );
    setGradingSettings({
      ...DEFAULT_GRADING_SETTINGS,
      ...(scenario.grading ?? {}),
    });
    setTimerRunning(false);
    setAssignmentMessage(
      `Loaded scenario + grading preset: ${scenario.name}`
    );
  }

  function scenarioGradingSummary(
    scenario: SavedInstructorScenario | undefined
  ): string {
    if (!scenario) {
      return "No saved grading preset selected.";
    }

    const preset = {
      ...DEFAULT_GRADING_SETTINGS,
      ...(scenario.grading ?? {}),
    };

    const attemptsText = preset.enforceMaxAttempts
      ? `${preset.maxAttempts} max attempts`
      : `${preset.maxAttempts} attempts advisory`;

    const timeText = preset.enforceTimeLimit
      ? "time enforced"
      : "time advisory";

    const hintsText = preset.allowHints
      ? "hints allowed"
      : "hints blocked";

    return `${attemptsText} • ${timeText} • ${hintsText} • ${passRequirementLabel(
      preset.passRequirement
    )} • ${preset.requiredSuccessfulAttempts} successful PTT${
      preset.requiredSuccessfulAttempts === 1 ? "" : "s"
    } required`;
  }

  function deleteSelectedScenario() {
    if (!selectedScenarioId) {
      return;
    }

    const scenario = savedScenarios.find(
      item => item.id === selectedScenarioId
    );

    setSavedScenarios(current =>
      current.filter(
        item => item.id !== selectedScenarioId
      )
    );
    setSelectedScenarioId("");
    setAssignmentMessage(
      scenario
        ? `Deleted saved scenario: ${scenario.name}`
        : "Saved scenario deleted."
    );
  }

  function setAssignmentTimerLength(value: number) {
    const safeMinutes = Math.max(1, Math.min(180, value || 1));
    setTimerMinutes(safeMinutes);

    if (!timerRunning) {
      setTimerSecondsRemaining(
        safeMinutes * 60
      );
    }
  }

  function startAssignmentTimer() {
    if (timerSecondsRemaining <= 0) {
      setTimerSecondsRemaining(
        timerMinutes * 60
      );
    }

    setTimerRunning(true);
  }

  function pauseAssignmentTimer() {
    setTimerRunning(false);
  }

  function resetAssignmentTimer() {
    setTimerRunning(false);
    setTimerSecondsRemaining(
      timerMinutes * 60
    );
  }

  function resetStudentSessionForAssignmentChange() {
    setStudentSessionActive(false);
    setStudentSessionStartedAt(null);
    setStudentSessionReport(null);
    setStudentSessionMessage(
      "Enter the student name and class, then begin the session."
    );
  }

  function applyInstructorAssignment() {
    if (assignmentLocked) {
      return;
    }

    const scenarioName =
      instructorDraft.scenarioName.trim() ||
      "Untitled Scenario";

    const scenarioDetails =
      instructorDraft.scenarioDetails.trim();

    const tone =
      parseInstructorTone(
        instructorDraft.toneHz
      );

    if (tone === undefined) {
      setAssignmentMessage(
        "Enter a valid tone in Hz, or use NONE."
      );
      return;
    }

    if (
      instructorDraft.mode ===
      "SIMPLEX"
    ) {
      const frequencyHz =
        mhzToHz(
          instructorDraft.simplexMHz
        );

      if (frequencyHz === null) {
        setAssignmentMessage(
          "Enter a valid simplex frequency in MHz."
        );
        return;
      }

      setAppliedAssignment({
        scenarioName,
        scenarioDetails,
        mode: "SIMPLEX",
        rxFrequencyHz: frequencyHz,
        txFrequencyHz: frequencyHz,
        offsetHz: 0,
        shiftDirection: "OFF",
        requiredCtcssHz: tone,
      });

      setTimerRunning(false);
      setTimerSecondsRemaining(
        timerMinutes * 60
      );
      setStudentAttempts([]);
    studentAttemptsRef.current = [];
      resetStudentSessionForAssignmentChange();
      setAssignmentMessage(
        `Applied: ${scenarioName}`
      );
      return;
    }

    const outputHz =
      mhzToHz(
        instructorDraft.outputMHz
      );

    const inputHz =
      mhzToHz(
        instructorDraft.inputMHz
      );

    const offsetHz =
      offsetMhzToHz(
        instructorDraft.offsetMHz
      );

    if (
      outputHz === null ||
      inputHz === null ||
      offsetHz === null
    ) {
      setAssignmentMessage(
        "Enter valid repeater output, input, and offset values."
      );
      return;
    }

    setAppliedAssignment({
      scenarioName,
      scenarioDetails,
      mode: "REPEATER",
      rxFrequencyHz: outputHz,
      txFrequencyHz: inputHz,
      offsetHz,
      shiftDirection:
        instructorDraft.shiftDirection,
      requiredCtcssHz: tone,
    });

    setTimerRunning(false);
    setTimerSecondsRemaining(
      timerMinutes * 60
    );
    setStudentAttempts([]);
    studentAttemptsRef.current = [];
    resetStudentSessionForAssignmentChange();
    setAssignmentMessage(
      `Applied: ${scenarioName}`
    );
  }

  function clearInstructorAssignment() {
    if (assignmentLocked) {
      return;
    }

    setAppliedAssignment(null);
    setTimerRunning(false);
    setTimerSecondsRemaining(
      timerMinutes * 60
    );
    setStudentAttempts([]);
    studentAttemptsRef.current = [];
    resetStudentSessionForAssignmentChange();
    setAssignmentMessage(
      "No instructor assignment is active."
    );
  }

  function evaluateInstructorAssignment(
    pttHeld: boolean
  ) {
    if (
      !appliedAssignment ||
      rxFrequency === null ||
      txFrequency === null
    ) {
      return null;
    }

    if (
      appliedAssignment.mode ===
      "REPEATER"
    ) {
      return evaluateFrostStatus({
        mode: "REPEATER",
        rxFrequencyHz: rxFrequency,
        txFrequencyHz: txFrequency,
        offsetHz:
          programmedOffsetHz,
        shiftDirection:
          programmedShiftDirection,
        txCtcssHz: txTone,
        pttHeld,
        repeater: {
          id: "instructor-assignment",
          name:
            appliedAssignment.scenarioName,
          outputFrequencyHz:
            appliedAssignment.rxFrequencyHz,
          inputFrequencyHz:
            appliedAssignment.txFrequencyHz,
          offsetHz:
            appliedAssignment.offsetHz,
          shiftDirection:
            appliedAssignment.shiftDirection,
          requiredCtcssHz:
            appliedAssignment.requiredCtcssHz,
          enabled: true,
        },
      });
    }

    const base =
      evaluateFrostStatus({
        mode: "SIMPLEX",
        rxFrequencyHz: rxFrequency,
        txFrequencyHz: txFrequency,
        offsetHz:
          programmedOffsetHz,
        shiftDirection:
          programmedShiftDirection,
        txCtcssHz: txTone,
        pttHeld,
        repeater: null,
      });

    const rxMatch =
      Math.abs(
        rxFrequency -
          appliedAssignment.rxFrequencyHz
      ) <= 500;

    const txMatch =
      Math.abs(
        txFrequency -
          appliedAssignment.txFrequencyHz
      ) <= 500;

    const frequencyMatch =
      rxMatch && txMatch;

    const toneMatch =
      appliedAssignment.requiredCtcssHz ===
      null
        ? txTone === null
        : txTone !== null &&
          Math.abs(
            txTone -
              appliedAssignment.requiredCtcssHz
          ) <= 0.1;

    const offsetMatch =
      programmedOffsetHz === 0;

    const shiftMatch =
      programmedShiftDirection ===
      "OFF";

    const allMatch =
      frequencyMatch &&
      offsetMatch &&
      shiftMatch &&
      toneMatch;

    let accessStatus =
      pttHeld
        ? "SIMPLEX TX"
        : "SIMPLEX READY";

    if (!allMatch) {
      if (!pttHeld) {
        accessStatus =
          "SIMPLEX NOT READY";
      } else if (!frequencyMatch) {
        accessStatus =
          "WRONG FREQUENCY";
      } else if (!offsetMatch) {
        accessStatus =
          "WRONG OFFSET";
      } else if (!shiftMatch) {
        accessStatus =
          "WRONG SHIFT";
      } else {
        accessStatus =
          "WRONG TONE";
      }
    }

    return {
      ...base,
      frequency:
        frequencyMatch
          ? "MATCH" as const
          : "NO MATCH" as const,
      offset:
        offsetMatch
          ? "MATCH" as const
          : "NO MATCH" as const,
      shift:
        shiftMatch
          ? "MATCH" as const
          : "NO MATCH" as const,
      tone:
        toneMatch
          ? "MATCH" as const
          : "NO MATCH" as const,
      rxOutputMatch:
        rxMatch
          ? "MATCH" as const
          : "NO MATCH" as const,
      txInputMatch:
        txMatch
          ? "MATCH" as const
          : "NO MATCH" as const,
      accessStatus,
      repeaterTx: "OFF" as const,
      requiredToneDisplay:
        appliedAssignment.requiredCtcssHz ===
        null
          ? "NONE"
          : `${appliedAssignment.requiredCtcssHz.toFixed(1)} Hz`,
      radioToneDisplay:
        txTone === null
          ? "OFF"
          : `${txTone.toFixed(1)} Hz`,
      requiredOffsetHz: 0,
      requiredShiftDirection: "OFF" as const,
      repeaterInputHz:
        appliedAssignment.txFrequencyHz,
      repeaterOutputHz:
        appliedAssignment.rxFrequencyHz,
      repeaterName:
        appliedAssignment.scenarioName,
    };
  }

  const frostOperatingMode =
    appliedAssignment?.mode ?? null;

  const frostResult =
    useMemo(
      () =>
        evaluateInstructorAssignment(
          isTx
        ),
      [
        appliedAssignment,
        isTx,
        programmedOffsetHz,
        programmedShiftDirection,
        rxFrequency,
        txFrequency,
        txTone,
      ]
    );

  /* =======================================
     KEYPAD
  ======================================= */

  function pressDigit(
    key: string
  ) {
    playKeypadBeep();

    if (
      !isNumericKey(
        key
      )
    ) {
      return;
    }

    dispatch({
      type:
        "KEYPAD_DIGIT",

      digit:
        key,
    });
  }

  /* =======================================
     VFO DISPLAY
  ======================================= */

  function getVfoDisplay(
    vfo: VFOSelection
  ): string {
    if (
      radio.frequencyEntry
        .targetVfo ===
        vfo &&
      radio.frequencyEntry
        .buffer
    ) {
      return formatEntry(
        radio.frequencyEntry
          .buffer
      );
    }

    return formatFrequency(
      vfo === "A"
        ? radio.vfoA
            .frequencyHz
        : radio.vfoB
            .frequencyHz
    );
  }

  function visibleSectionItems() {
    if (
      sectionItems.length <=
      5
    ) {
      return sectionItems;
    }

    const index =
      sectionItems.findIndex(
        item =>
          item.number ===
          radio.menu
            .selectedItemNumber
      );

    let start =
      index - 2;

    if (
      start < 0
    ) {
      start = 0;
    }

    if (
      start >
      sectionItems.length -
        5
    ) {
      start =
        sectionItems.length -
        5;
    }

    return sectionItems.slice(
      start,
      start + 5
    );
  }

  function editValue():
    string {
    const edit =
      radio.menu.edit;

    if (
      edit.kind ===
      "TX_CTCSS"
    ) {
      return formatTone(
        edit.pendingToneHz
      );
    }

    if (
      edit.kind ===
      "SHIFT_DIRECTION"
    ) {
      return formatShift(
        edit.pendingShiftDirection ??
          "OFF"
      );
    }

    if (
      edit.kind ===
      "OFFSET"
    ) {
      if (
        edit.offsetEntryBuffer
      ) {
        return edit
          .offsetEntryBuffer;
      }

      return (
        (
          edit.pendingOffsetHz ??
          0
        ) /
        1_000_000
      ).toFixed(3);
    }

    if (
      edit.kind ===
      "CH_MEMORY"
    ) {
      return `CH ${formatChannel(
        pendingMemoryChannel
      )}`;
    }

    return "";
  }

  /* =======================================
     MAIN MENU
  ======================================= */

  function renderMainMenu() {
    return (
      <div className="real-menu-screen">

        <div className="real-menu-title">
          Menu
        </div>

        <div className="real-menu-list">

          {mainMenuItems.map(
            (
              item,
              index
            ) => {
              const selected =
                index ===
                radio.menu
                  .mainSelectedIndex;

              return (
                <div
                  key={
                    item.id
                  }

                  className={
                    selected
                      ? "real-menu-row real-menu-row-selected"
                      : "real-menu-row"
                  }
                >

                  <div className="real-menu-icon">
                    {menuIcon(
                      item.id
                    )}
                  </div>

                  <div className="real-menu-label">
                    {item.label}
                  </div>

                </div>
              );
            }
          )}

        </div>

        <div className="real-menu-footer">

          <span>
            Confirm
          </span>

          <span>
            Back
          </span>

        </div>

      </div>
    );
  }

  /* =======================================
     SECTION MENU
  ======================================= */

  function renderSectionMenu() {
    return (
      <div className="real-menu-screen">

        <div className="real-menu-title">
          {getSectionLabel(
            radio.menu.section
          )}
        </div>

        <div className="real-menu-list">

          {visibleSectionItems().map(
            item => {
              const selected =
                item.number ===
                radio.menu
                  .selectedItemNumber;

              return (
                <div
                  key={
                    item.number
                  }

                  className={
                    selected
                      ? "real-menu-row real-menu-row-selected"
                      : "real-menu-row"
                  }
                >

                  <div className="real-menu-number">
                    {item.number
                      .toString()
                      .padStart(
                        2,
                        "0"
                      )}
                  </div>

                  <div className="real-menu-label">
                    {item.label}
                  </div>

                  <div className="real-menu-arrow">
                    {item.editable
                      ? "›"
                      : ""}
                  </div>

                </div>
              );
            }
          )}

        </div>

        {radio.menu.message && (
          <div className="real-menu-message">
            {radio.menu.message}
          </div>
        )}

        <div className="real-menu-footer">

          <span>
            Confirm
          </span>

          <span>
            Back
          </span>

        </div>

      </div>
    );
  }

  /* =======================================
     EDIT
  ======================================= */

  function renderEdit() {
    return (
      <div className="real-menu-screen">

        <div className="real-menu-title">
          {selectedSectionItem
            ?.label ??
            "Setting"}
        </div>

        <div className="real-edit-body">

          <div className="real-edit-caption">
            SELECT VALUE
          </div>

          <div className="real-edit-value">
            {editValue()}
          </div>

          {radio.menu.edit
            .kind ===
            "CH_MEMORY" && (

            <div className="memory-save-preview">

              {!pendingMemory && (
                <div>

                  <span>
                    STATUS
                  </span>

                  <strong>
                    EMPTY
                  </strong>

                </div>
              )}

              {pendingMemory && (
                <>

                  <div>

                    <span>
                      STATUS
                    </span>

                    <strong>
                      OCCUPIED
                    </strong>

                  </div>

                  <div>

                    <span>
                      SAVED A / RX
                    </span>

                    <strong>
                      {formatFrequency(
                        pendingMemory
                          .rxFrequencyHz,
                        3
                      )}
                    </strong>

                  </div>

                  <div>

                    <span>
                      SAVED B / TX
                    </span>

                    <strong>
                      {formatFrequency(
                        pendingMemory
                          .txFrequencyHz,
                        3
                      )}
                    </strong>

                  </div>

                  <div>

                    <span>
                      SHIFT
                    </span>

                    <strong>
                      {formatShift(
                        pendingMemory
                          .shiftDirection
                      )}
                    </strong>

                  </div>

                  <div>

                    <span>
                      OFFSET
                    </span>

                    <strong>
                      {(
                        pendingMemory
                          .offsetHz /
                        1_000_000
                      ).toFixed(3)}
                    </strong>

                  </div>

                </>
              )}

            </div>
          )}

        </div>

        <div className="real-menu-footer">

          <span>
            Confirm
          </span>

          <span>
            Back
          </span>

        </div>

      </div>
    );
  }

  /* =======================================
     FREQUENCY MODE
  ======================================= */

  function renderVfo() {
    return (
      <div
        className={
          isTx
            ? "normal-screen screen-is-tx"
            : "normal-screen"
        }
      >

        <div className="screen-status">

          <span
            className={
              isTx
                ? "activity-indicator activity-tx"
                : "activity-indicator activity-rx"
            }
          >
            {isTx
              ? "TX"
              : "RX"}
          </span>

          <div className="status-right">

            <span>
              {formatShift(
                radio.vfoA
                  .shiftDirection
              )}
            </span>

            <span>
              {(
                radio.vfoA
                  .offsetHz /
                1_000_000
              ).toFixed(3)}
            </span>

            <span>
              FREQUENCY MODE
            </span>

          </div>

        </div>

        <div
          className={
            isAActive
              ? "frequency-block active-frequency rx-vfo-line"
              : "frequency-block rx-vfo-line"
          }
        >

          <div className="frequency-meta">

            <div className="vfo-role-group">

              <span className="channel-box channel-a">
                A
              </span>

              <span className="role-badge role-rx">
                RX
              </span>

            </div>

            <span>
              {isAActive
                ? "▶ RECEIVE"
                : "RECEIVE"}
            </span>

          </div>

          <div className="frequency-line">

            <span
              className={
                isAActive
                  ? "frequency-value rx-frequency-active"
                  : "frequency-value"
              }
            >
              {getVfoDisplay(
                "A"
              )}
            </span>

          </div>

          <div className="signal-scale">

            <span>1</span>
            <span>3</span>
            <span>5</span>
            <span>7</span>
            <span>9</span>

            <div className="signal-bar">

              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />

            </div>

          </div>

        </div>

        <div className="screen-divider" />

        <div
          className={
            isBActive
              ? "frequency-block active-frequency tx-vfo-line"
              : "frequency-block tx-vfo-line"
          }
        >

          <div className="frequency-meta">

            <div className="vfo-role-group">

              <span className="channel-box channel-b">
                B
              </span>

              <span className="role-badge role-tx">
                TX
              </span>

            </div>

            <span>
              {isBActive
                ? "▶ TRANSMIT"
                : "TRANSMIT"}
            </span>

          </div>

          <div className="frequency-line">

            <span
              className={
                isTx
                  ? "frequency-value transmitting-frequency"
                  : "frequency-value"
              }
            >
              {getVfoDisplay(
                "B"
              )}
            </span>

          </div>

          <div className="signal-scale">

            <span>1</span>
            <span>3</span>
            <span>5</span>
            <span>7</span>
            <span>9</span>

            <div
              className={
                isTx
                  ? "signal-bar tx-signal-bar"
                  : "signal-bar secondary-signal"
              }
            >

              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />

            </div>

          </div>

        </div>

      </div>
    );
  }

  /* =======================================
     CHANNEL MODE
  ======================================= */

  function renderMemory() {
    const storedRx =
      selectedMemory
        ? formatFrequency(
            selectedMemory
              .rxFrequencyHz
          )
        : "EMPTY";

    const storedTx =
      selectedMemory
        ? formatFrequency(
            selectedMemory
              .txFrequencyHz
          )
        : "EMPTY";

    return (
      <div
        className={
          isTx
            ? "mr-screen screen-is-tx"
            : "mr-screen"
        }
      >

        <div className="mr-top-status">

          <span
            className={
              isTx
                ? "activity-indicator activity-tx"
                : "activity-indicator activity-rx"
            }
          >
            {isTx
              ? "TX"
              : "RX"}
          </span>

          <span>
            CHANNEL MODE
          </span>

        </div>

        <div className="mr-line">

          <div className="mr-line-top">

            <div className="mr-zone-block">

              <span className="mr-zone">
                Zone01
              </span>

              <span className="mr-channel-number">
                {formatChannel(
                  radio.selectedMemoryChannel
                )}
              </span>

            </div>

            <span className="mr-icon-power">
              H
            </span>

          </div>

          <div
            className={
              isAActive
                ? "frequency-block active-frequency rx-vfo-line"
                : "frequency-block rx-vfo-line"
            }
          >

            <div className="frequency-meta">

              <div className="vfo-role-group">

                <span className="channel-box channel-a">
                  A
                </span>

                <span className="role-badge role-rx">
                  RX
                </span>

              </div>

              <span>
                {isAActive
                  ? "▶ RECEIVE"
                  : "RECEIVE"}
              </span>

            </div>

            <div className="frequency-line">

              <span
                className={
                  isAActive
                    ? "frequency-value mr-frequency rx-frequency-active"
                    : "frequency-value mr-frequency"
                }
              >
                {storedRx}
              </span>

            </div>

          </div>

        </div>

        <div className="screen-divider" />

        <div className="mr-line">

          <div
            className={
              isBActive
                ? "frequency-block active-frequency tx-vfo-line"
                : "frequency-block tx-vfo-line"
            }
          >

            <div className="frequency-meta">

              <div className="vfo-role-group">

                <span className="channel-box channel-b">
                  B
                </span>

                <span className="role-badge role-tx">
                  TX
                </span>

              </div>

              <span>
                {isBActive
                  ? "▶ TRANSMIT"
                  : "TRANSMIT"}
              </span>

            </div>

            <div className="frequency-line">

              <span
                className={
                  isTx
                    ? "frequency-value mr-frequency transmitting-frequency"
                    : "frequency-value mr-frequency"
                }
              >
                {storedTx}
              </span>

            </div>

          </div>

        </div>

      </div>
    );
  }

  function renderScreen() {
    if (
      radio.menu.mode ===
      "MAIN"
    ) {
      return renderMainMenu();
    }

    if (
      radio.menu.mode ===
      "SECTION"
    ) {
      return renderSectionMenu();
    }

    if (
      radio.menu.mode ===
      "EDIT"
    ) {
      return renderEdit();
    }

    if (
      radio.operatingMode ===
      "MR"
    ) {
      return renderMemory();
    }

    return renderVfo();
  }

  function normalizeGradingSettings(
    settings: InstructorGradingSettings
  ): InstructorGradingSettings {
    return {
      ...settings,
      maxAttempts: Math.max(1, Math.min(50, Math.floor(settings.maxAttempts || 1))),
      requiredSuccessfulAttempts: Math.max(
        1,
        Math.min(20, Math.floor(settings.requiredSuccessfulAttempts || 1))
      ),
    };
  }

  function evaluateSessionPass(
    attempts: StudentAttemptRecord[],
    settings: InstructorGradingSettings,
    endReason: StudentSessionReport["endReason"]
  ): { passed: boolean; reason: string } {
    const normalized = normalizeGradingSettings(settings);
    const successfulAttempts = attempts.filter(attempt => attempt.success);
    const firstAttempt = attempts[0];
    const finalAttempt = attempts[attempts.length - 1];

    let requirementMet = false;
    let requirementText = "";

    switch (normalized.passRequirement) {
      case "FIRST_ATTEMPT_SUCCESS":
        requirementMet = Boolean(firstAttempt?.success);
        requirementText = "first PTT attempt must succeed";
        break;

      case "FINAL_SUCCESS":
        requirementMet = Boolean(finalAttempt?.success);
        requirementText = "final PTT attempt must succeed";
        break;

      case "ANY_SUCCESS":
      default:
        requirementMet = successfulAttempts.length > 0;
        requirementText = "at least one PTT attempt must succeed";
        break;
    }

    const successCountMet =
      successfulAttempts.length >= normalized.requiredSuccessfulAttempts;

    const timeMet =
      !normalized.enforceTimeLimit || endReason !== "TIME_LIMIT";

    const attemptsMet =
      !normalized.enforceMaxAttempts ||
      attempts.length <= normalized.maxAttempts;

    if (!timeMet) {
      return {
        passed: false,
        reason: "Time limit expired before the exercise was completed.",
      };
    }

    if (!attemptsMet) {
      return {
        passed: false,
        reason: `Maximum attempt limit of ${normalized.maxAttempts} was exceeded.`,
      };
    }

    if (!requirementMet) {
      return {
        passed: false,
        reason: `Pass requirement not met: ${requirementText}.`,
      };
    }

    if (!successCountMet) {
      return {
        passed: false,
        reason: `Requires ${normalized.requiredSuccessfulAttempts} successful PTT ${
          normalized.requiredSuccessfulAttempts === 1 ? "attempt" : "attempts"
        }.`,
      };
    }

    return {
      passed: true,
      reason: `Pass requirements met: ${requirementText}; ${successfulAttempts.length} successful PTT ${
        successfulAttempts.length === 1 ? "attempt" : "attempts"
      }.`,
    };
  }

  function passRequirementLabel(
    requirement: GradingPassRequirement
  ): string {
    switch (requirement) {
      case "FIRST_ATTEMPT_SUCCESS":
        return "FIRST ATTEMPT SUCCESS";
      case "FINAL_SUCCESS":
        return "FINAL ATTEMPT SUCCESS";
      case "ANY_SUCCESS":
      default:
        return "ANY SUCCESSFUL ACCESS";
    }
  }

  function getAttemptFailureElement(
    result: ReturnType<typeof evaluateInstructorAssignment>
  ): AttemptFailureElement {
    if (!result) {
      return null;
    }

    if (result.frequency !== "MATCH") {
      return "Fr";
    }

    if (result.offset !== "MATCH") {
      return "O";
    }

    if (result.shift !== "MATCH") {
      return "S";
    }

    if (result.tone !== "MATCH") {
      return "T";
    }

    return null;
  }

  function recordStudentAttempt(
    result: ReturnType<typeof evaluateInstructorAssignment>
  ): StudentAttemptRecord | null {
    if (!appliedAssignment || !result) {
      return null;
    }

    const success =
      result.accessStatus === "ACCESS GRANTED" ||
      result.accessStatus === "SIMPLEX TX";

    const nextAttemptNumber =
      studentAttemptsRef.current.length + 1;

    const nextRecord: StudentAttemptRecord = {
      id: Date.now(),
      attemptNumber: nextAttemptNumber,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      timerDisplay: formatAssignmentTimer(
        timerSecondsRemaining
      ),
      success,
      failureElement:
        success
          ? null
          : getAttemptFailureElement(result),
      accessStatus: result.accessStatus,
      sessionElapsedSeconds:
        studentSessionActive && studentSessionStartedAt !== null
          ? Math.max(0, Math.floor((Date.now() - studentSessionStartedAt) / 1000))
          : null,
    };

    const nextAttempts = [
      ...studentAttemptsRef.current,
      nextRecord,
    ];

    studentAttemptsRef.current = nextAttempts;
    setStudentAttempts(nextAttempts);

    if (
      participantId &&
      participantToken &&
      classroomRole === "STUDENT"
    ) {
      void recordClassroomAttempt(
        participantId,
        participantToken,
        {
          attemptNumber:
            nextRecord.attemptNumber,
          success:
            nextRecord.success,
          failureElement:
            nextRecord.failureElement,
          accessStatus:
            nextRecord.accessStatus,
          details: {
            timerDisplay:
              nextRecord.timerDisplay,
            timestamp:
              nextRecord.timestamp,
            sessionElapsedSeconds:
              nextRecord.sessionElapsedSeconds,
          },
        },
        {
          frequency: result.frequency,
          observation: result.offset,
          signal: result.shift,
          transmission: result.tone,
          offset: result.offset,
          shift: result.shift,
          tone: result.tone,
          accessStatus:
            result.accessStatus,
          programmedRxHz:
            rxFrequency,
          programmedTxHz:
            txFrequency,
          programmedOffsetHz,
          programmedShiftDirection,
          programmedToneHz:
            txTone,
        }
      ).catch(() => {
        // Keep local training session running even if the room update fails.
      });
    }

    return nextRecord;
  }

  function beginStudentSession() {
    const cleanName = studentName.trim();
    const cleanClass = studentClass.trim();

    if (!cleanName) {
      setStudentSessionMessage("Enter the student name before beginning the session.");
      return;
    }

    if (!cleanClass) {
      setStudentSessionMessage("Enter the class or cohort before beginning the session.");
      return;
    }

    if (!appliedAssignment) {
      setStudentSessionMessage("Apply an instructor assignment before beginning the student session.");
      return;
    }

    const startedAt = Date.now();
    const normalizedGrading = normalizeGradingSettings(gradingSettings);

    setGradingSettings(normalizedGrading);
    if (!normalizedGrading.allowHints) {
      setAssignmentDetailsVisible(false);
    }

    setStudentAttempts([]);
    studentAttemptsRef.current = [];
    setStudentSessionReport(null);
    setInstructorOverrideNote("");
    setInstructorReopenedSession(false);
    setStudentSessionStartedAt(startedAt);
    setStudentSessionActive(true);
    setTimerSecondsRemaining(timerMinutes * 60);
    setTimerRunning(true);
    setStudentSessionMessage(
      `Session active: ${cleanName} • ${cleanClass}`
    );
  }

  function endStudentSession(
    endReason: StudentSessionReport["endReason"] = "INSTRUCTOR"
  ) {
    if (!studentSessionActive || studentSessionStartedAt === null || !appliedAssignment) {
      return;
    }

    const endedAt = Date.now();
    const attemptsSnapshot = [...studentAttemptsRef.current];
    const firstSuccessfulAttempt = attemptsSnapshot.find(attempt => attempt.success);
    const elapsedToEnd = Math.max(
      0,
      Math.floor((endedAt - studentSessionStartedAt) / 1000)
    );

    const completionSeconds =
      firstSuccessfulAttempt?.sessionElapsedSeconds ?? elapsedToEnd;

    const gradingSnapshot =
      normalizeGradingSettings(gradingSettings);

    const passEvaluation =
      evaluateSessionPass(
        attemptsSnapshot,
        gradingSnapshot,
        endReason
      );

    setStudentSessionReport({
      studentName: studentName.trim(),
      className: studentClass.trim(),
      scenarioName: appliedAssignment.scenarioName,
      assignmentMode: appliedAssignment.mode,
      assignmentDurationSeconds: timerMinutes * 60,
      attempts: attemptsSnapshot,
      completionSeconds,
      passed: passEvaluation.passed,
      systemPassed: passEvaluation.passed,
      startedAt: studentSessionStartedAt,
      endedAt,
      grading: gradingSnapshot,
      endReason,
      passReason: passEvaluation.reason,
      systemPassReason: passEvaluation.reason,
      instructorOverride: null,
      instructorOverrideNote: null,
    });

    setStudentSessionActive(false);
    setTimerRunning(false);
    setStudentSessionMessage(
      passEvaluation.passed
        ? `Exercise complete. Performance report: PASSED. ${passEvaluation.reason}`
        : `Exercise complete. Performance report: NOT PASSED. ${passEvaluation.reason}`
    );
  }

  function applyInstructorOverride(
    decision: "PASS" | "FAIL"
  ) {
    if (!studentSessionReport) {
      return;
    }

    const note = instructorOverrideNote.trim();

    setStudentSessionReport(current => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        passed: decision === "PASS",
        instructorOverride: decision,
        instructorOverrideNote: note || null,
        passReason:
          decision === "PASS"
            ? "Instructor override: student manually passed after performance review."
            : "Instructor override: student manually failed after performance review.",
      };
    });

    setStudentSessionMessage(
      decision === "PASS"
        ? "Instructor override applied: PASSED."
        : "Instructor override applied: NOT PASSED."
    );
  }

  function reopenStudentSession() {
    if (!studentSessionReport) {
      return;
    }

    const report = studentSessionReport;
    const restoredAttempts = [...report.attempts];

    setStudentName(report.studentName);
    setStudentClass(report.className);
    setStudentAttempts(restoredAttempts);
    studentAttemptsRef.current = restoredAttempts;
    setStudentSessionStartedAt(Date.now());
    setStudentSessionReport(null);
    setInstructorOverrideNote("");
    setInstructorReopenedSession(true);
    setStudentSessionActive(true);

    const remainingSeconds = Math.max(
      0,
      report.assignmentDurationSeconds - report.completionSeconds
    );

    setTimerSecondsRemaining(
      remainingSeconds > 0
        ? remainingSeconds
        : report.assignmentDurationSeconds
    );
    setTimerRunning(false);

    setStudentSessionMessage(
      "Session reopened by instructor. Existing attempts are preserved. Automatic time and maximum-attempt enforcement are suspended for this reopened session until it is ended again."
    );
  }

  function startNewStudentSession() {
    setStudentSessionActive(false);
    setStudentSessionStartedAt(null);
    setStudentSessionReport(null);
    setInstructorOverrideNote("");
    setInstructorReopenedSession(false);
    setStudentAttempts([]);
    studentAttemptsRef.current = [];
    setStudentName("");
    setStudentClass("");
    setTimerRunning(false);
    setTimerSecondsRemaining(timerMinutes * 60);
    setStudentSessionMessage(
      "Enter the student name and class, then begin the session."
    );
  }

  function describeAttempt(attempt: StudentAttemptRecord | undefined): string {
    if (!attempt) {
      return "NO ATTEMPT";
    }

    return attempt.success
      ? `#${attempt.attemptNumber} ACCESS GRANTED`
      : `#${attempt.attemptNumber} FAILED ${attempt.failureElement ?? "—"}`;
  }

  function getFailureCount(
    attempts: StudentAttemptRecord[],
    element: Exclude<AttemptFailureElement, null>
  ): number {
    return attempts.filter(
      attempt => !attempt.success && attempt.failureElement === element
    ).length;
  }

  function getPttFrostResult() {
    return evaluateInstructorAssignment(
      true
    );
  }

  /* =======================================
     PTT
  ======================================= */

  function startPtt(
    event:
      ReactPointerEvent<HTMLButtonElement>
  ) {
    if (
      pttActiveRef.current
    ) {
      return;
    }

    const normalizedGrading =
      normalizeGradingSettings(gradingSettings);

    if (
      studentSessionActive &&
      !instructorReopenedSession &&
      normalizedGrading.enforceMaxAttempts &&
      studentAttemptsRef.current.length >= normalizedGrading.maxAttempts
    ) {
      setStudentSessionMessage(
        `Maximum of ${normalizedGrading.maxAttempts} PTT attempts reached.`
      );
      endStudentSession("MAX_ATTEMPTS");
      return;
    }

    pttActiveRef.current =
      true;

    playPttDownSound();

    const accessDecision =
      getPttFrostResult();

    const recordedAttempt =
      recordStudentAttempt(
        accessDecision
      );

    if (
      recordedAttempt &&
      studentSessionActive &&
      !instructorReopenedSession &&
      normalizedGrading.enforceMaxAttempts &&
      recordedAttempt.attemptNumber >= normalizedGrading.maxAttempts
    ) {
      window.setTimeout(
        () => endStudentSession("MAX_ATTEMPTS"),
        0
      );
    }

    window.setTimeout(
      () => {
        speakAccessDecision(
          accessDecision
            ?.accessStatus ??
            "NO ASSIGNMENT"
        );
      },
      145
    );

    event.currentTarget
      .setPointerCapture(
        event.pointerId
      );

    dispatch({
      type:
        "PTT_DOWN",
    });
  }

  function stopPtt() {
    if (
      !pttActiveRef.current
    ) {
      return;
    }

    pttActiveRef.current =
      false;

    playPttUpSound();

    dispatch({
      type:
        "PTT_UP",
    });
  }

  /* =======================================
     VFO/MR
  ======================================= */

  function switchOperatingMode() {
    playButtonBeep();

    if (
      radio.menu.mode !==
        "CLOSED" ||
      isTx
    ) {
      return;
    }

    const nextMode =
      radio.operatingMode ===
      "VFO"
        ? "MR"
        : "VFO";

    dispatch({
      type:
        "VFO_MR_PRESSED",
    });

    speakMode(nextMode);
  }

  /* =======================================
     Fr.O.S.T STATUS TEXT
  ======================================= */

  function frostInstructionText() {
    if (!frostResult) {
      return "Waiting for the instructor to apply an assignment.";
    }

    switch (
      frostResult.accessStatus
    ) {
      case "READY":
        return "Fr.O.S.T matches. Press PTT to access the virtual repeater.";

      case "ACCESS GRANTED":
        return "Fr.O.S.T matches. Virtual repeater access is granted and the repeater transmitter is active.";

      case "SIMPLEX READY":
        return "Simplex programming is ready. A and B match, Offset is zero, and Shift is OFF.";

      case "SIMPLEX TX":
        return "Simplex transmit is active. No repeater transmitter is used.";

      case "WRONG FREQUENCY":
        return "Frequency check failed. Verify A/RX matches the repeater output and B/TX matches the repeater input.";

      case "WRONG OFFSET":
        return "Offset check failed. Verify the programmed offset amount.";

      case "WRONG SHIFT":
        return "Shift check failed. Verify PLUS, MINUS, or OFF.";

      case "WRONG TONE":
        return "Tone check failed. Verify the transmit CTCSS requirement.";

      case "SIMPLEX NOT READY":
        return "Simplex is not ready. A and B should match, Offset should be 0.000 MHz, and Shift should be OFF.";

      case "NOT READY":
      default:
        return "Correct each Fr.O.S.T row marked NO MATCH before transmitting.";
    }
  }

  const selectedSavedScenario =
    savedScenarios.find(
      scenario => scenario.id === selectedScenarioId
    );

  return (
    <main className="simulator-page">

      <header className="page-header">

        <div>

          <p className="eyebrow">
            BLACK SKY TRAINING SYSTEMS
          </p>

          <h1>
            Virtual HT Simulator
          </h1>

          <p className="subtitle">
            VHF / UHF Emergency Communications Training
          </p>

        </div>

        <div className="training-badge">
          TRAINING MODE
        </div>

      </header>

      <section className="classroom-layout">

        <section className="classroom-connection-panel">
          <div className="classroom-connection-header">
            <div>
              <p className="panel-label">BLACK SKY LIVE CLASSROOM</p>
              <h2>Student Join Room</h2>
              <p>
                Create a live instructor room or join an existing classroom from another device.
              </p>
            </div>

            <div className={`classroom-live-badge ${classroomRole !== "NONE" ? "is-live" : ""}`}>
              {classroomRole === "INSTRUCTOR"
                ? `INSTRUCTOR • ${roomCode}`
                : classroomRole === "STUDENT"
                ? `STUDENT • ${roomCode}`
                : "OFFLINE"}
            </div>
          </div>

          {classroomRole === "NONE" ? (
            <div className="classroom-entry-grid">
              <div className="classroom-entry-card">
                <span>INSTRUCTOR</span>
                <strong>Create Training Room</strong>
                <p>
                  Open a six-character room and share the code or link with your students.
                </p>
                <button
                  type="button"
                  disabled={classroomBusy}
                  onClick={createClassroomRoom}
                >
                  {classroomBusy ? "WORKING..." : "CREATE INSTRUCTOR ROOM"}
                </button>
              </div>

              <div className="classroom-entry-card">
                <span>STUDENT</span>
                <strong>Join Classroom</strong>

                <label>
                  Student Name
                  <input
                    value={studentName}
                    onChange={event => setStudentName(event.target.value)}
                    placeholder="Student name"
                  />
                </label>

                <label>
                  Class / Cohort
                  <input
                    value={studentClass}
                    onChange={event => setStudentClass(event.target.value)}
                    placeholder="Class or cohort"
                  />
                </label>

                <label>
                  Room Code
                  <input
                    value={roomCode}
                    maxLength={6}
                    onChange={event =>
                      setRoomCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
                    }
                    placeholder="ABC123"
                  />
                </label>

                <button
                  type="button"
                  disabled={classroomBusy}
                  onClick={joinClassroomRoom}
                >
                  {classroomBusy ? "JOINING..." : "JOIN CLASSROOM"}
                </button>
              </div>
            </div>
          ) : classroomRole === "INSTRUCTOR" ? (
            <div className="classroom-instructor-room">
              <div className="classroom-room-code">
                <span>ROOM CODE</span>
                <strong>{roomCode}</strong>
                <small>{connectedStudents.filter(student => student.connected).length} students connected</small>
              </div>

              <div className="classroom-room-actions">
                <button type="button" onClick={copyStudentRoomLink}>
                  COPY STUDENT LINK
                </button>
                <button type="button" onClick={closeClassroomRoom}>
                  CLOSE ROOM
                </button>
                <button type="button" onClick={leaveClassroomRoom}>
                  LEAVE ROOM
                </button>
              </div>

              <div className="classroom-roster live-instructor-roster">
                <div className="live-roster-titlebar">
                  <div>
                    <span>LIVE INSTRUCTOR ROSTER</span>
                    <strong>Student Radio Programming Monitor</strong>
                  </div>
                  <small>
                    Updates automatically while students program their virtual HTs.
                  </small>
                </div>

                <div className="classroom-roster-header live-roster-grid">
                  <span>Student</span>
                  <span>Frequency</span>
                  <span>Observation</span>
                  <span>Signal</span>
                  <span>Transmission</span>
                  <span>Attempts</span>
                  <span>Status</span>
                </div>

                {connectedStudents.length === 0 ? (
                  <div className="classroom-roster-empty">
                    Waiting for students to join room {roomCode}.
                  </div>
                ) : (
                  connectedStudents.map(student => {
                    const frost =
                      getRosterFrost(student);

                    const frequencyMatch =
                      typeof frost.frequency === "string"
                        ? frost.frequency
                        : null;

                    const observationMatch =
                      typeof frost.observation === "string"
                        ? frost.observation
                        : typeof frost.offset === "string"
                        ? frost.offset
                        : null;

                    const signalMatch =
                      typeof frost.signal === "string"
                        ? frost.signal
                        : typeof frost.shift === "string"
                        ? frost.shift
                        : null;

                    const transmissionMatch =
                      typeof frost.transmission === "string"
                        ? frost.transmission
                        : typeof frost.tone === "string"
                        ? frost.tone
                        : null;

                    const currentStatus =
                      rosterCurrentStatus(student);

                    return (
                      <div
                        className="classroom-roster-row live-roster-grid"
                        key={student.id}
                      >
                        <div className="live-roster-student">
                          <strong>{student.student_name}</strong>
                          <small>{student.class_name || "No class entered"}</small>
                        </div>

                        <div className="live-roster-reading">
                          <span
                            className={`live-roster-dot ${rosterMatchClass(
                              frequencyMatch
                            )}`}
                          />
                          <strong>{formatRosterFrequency(student)}</strong>
                          <small>RX / TX MHz</small>
                        </div>

                        <div className="live-roster-reading">
                          <span
                            className={`live-roster-dot ${rosterMatchClass(
                              observationMatch
                            )}`}
                          />
                          <strong>{formatRosterObservation(student)}</strong>
                          <small>Offset</small>
                        </div>

                        <div className="live-roster-reading">
                          <span
                            className={`live-roster-dot ${rosterMatchClass(
                              signalMatch
                            )}`}
                          />
                          <strong>{formatRosterSignal(student)}</strong>
                          <small>Shift</small>
                        </div>

                        <div className="live-roster-reading">
                          <span
                            className={`live-roster-dot ${rosterMatchClass(
                              transmissionMatch
                            )}`}
                          />
                          <strong>{formatRosterTransmission(student)}</strong>
                          <small>TX Tone</small>
                        </div>

                        <div className="live-roster-attempts">
                          <strong>{student.attempt_count}</strong>
                          <small>PTT</small>
                        </div>

                        <div
                          className={`live-roster-status ${
                            currentStatus === "READY" ||
                            currentStatus === "ACCESS GRANTED" ||
                            currentStatus === "SIMPLEX READY" ||
                            currentStatus === "SIMPLEX TX"
                              ? "status-ready"
                              : currentStatus === "DISCONNECTED"
                              ? "status-offline"
                              : "status-not-ready"
                          }`}
                        >
                          <strong>{currentStatus}</strong>
                          <small>
                            {student.connected ? "LIVE" : "OFFLINE"}
                          </small>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="classroom-student-connected">
              <div>
                <span>CONNECTED TO ROOM</span>
                <strong>{roomCode}</strong>
                <small>{studentName || "Student"} • {studentClass || "No class entered"}</small>
              </div>
              <button type="button" onClick={leaveClassroomRoom}>
                LEAVE CLASSROOM
              </button>
            </div>
          )}

          <div className="classroom-connection-message">
            {classroomMessage}
          </div>
        </section>

        <section className="mission-zone">
          {/* ====================================
              STUDENT ASSIGNMENT VIEW
          ==================================== */}

          <aside className="student-assignment-panel mission-brief-panel">
            <div className="student-assignment-header mission-brief-header">
              <div className="mission-heading-block">
                <p className="panel-label">BLACK SKY TRAINING MISSION</p>
                <div className="mission-title-row">
                  <span className="mission-kicker">MISSION BRIEF</span>
                  <h2>
                    {appliedAssignment?.scenarioName || "Awaiting Assignment"}
                  </h2>
                </div>
              </div>

              <div className="mission-status-cluster">
                <span className={`student-mode-badge ${
                  appliedAssignment?.mode === "SIMPLEX"
                    ? "student-mode-simplex"
                    : appliedAssignment?.mode === "REPEATER"
                    ? "student-mode-repeater"
                    : "student-mode-waiting"
                }`}>
                  {appliedAssignment?.mode ?? "WAITING"}
                </span>

                <span className={`mission-detail-badge ${
                  assignmentDetailsVisible
                    ? "details-revealed"
                    : "details-hidden"
                }`}>
                  {assignmentDetailsVisible
                    ? "DETAILS REVEALED"
                    : "DETAILS HIDDEN"}
                </span>
              </div>
            </div>

            {!appliedAssignment ? (
              <div className="student-assignment-empty mission-waiting-state">
                <strong>WAITING FOR INSTRUCTOR</strong>
                <span>The next communications mission will appear here when the instructor applies an assignment.</span>
              </div>
            ) : (
              <>
                <div className="mission-narrative-grid">
                  <div className="student-scenario-card mission-situation-card">
                    <span>SITUATION / SCENARIO</span>
                    <p>
                      {appliedAssignment.scenarioDetails ||
                        "Program the assigned communications channel and use the Fr.O.S.T meter to verify your setup."}
                    </p>
                  </div>

                  <div className="student-task-strip mission-task-card">
                    <span>YOUR OBJECTIVE</span>
                    <strong>Program the virtual HT, verify all four Fr.O.S.T checks, then press PTT when you believe the radio is ready.</strong>
                  </div>
                </div>

                <div className="mission-channel-heading">
                  <span>COMMUNICATIONS ASSIGNMENT</span>
                  <small>Use only the information the instructor has chosen to reveal.</small>
                </div>

                <div className="student-assignment-readout">
                  <div>
                    <span>Assignment Type</span>
                    <strong>{appliedAssignment.mode}</strong>
                  </div>

                  <div>
                    <span>Target Details</span>
                    <strong>
                      {assignmentDetailsVisible
                        ? "REVEALED"
                        : "HIDDEN — PROGRAM FROM THE BRIEF"}
                    </strong>
                  </div>

                  {appliedAssignment.mode === "SIMPLEX" ? (
                    <div className="student-assignment-full">
                      <span>Assigned Simplex Frequency</span>
                      <strong>
                        {assignmentDetailsVisible
                          ? `${formatFrequency(appliedAssignment.rxFrequencyHz, 3)} MHz`
                          : "HIDDEN"}
                      </strong>
                    </div>
                  ) : (
                    <>
                      <div>
                        <span>Repeater Output / RX</span>
                        <strong>
                          {assignmentDetailsVisible
                            ? `${formatFrequency(appliedAssignment.rxFrequencyHz, 3)} MHz`
                            : "HIDDEN"}
                        </strong>
                      </div>

                      <div>
                        <span>Repeater Input / TX</span>
                        <strong>
                          {assignmentDetailsVisible
                            ? `${formatFrequency(appliedAssignment.txFrequencyHz, 3)} MHz`
                            : "HIDDEN"}
                        </strong>
                      </div>

                      <div>
                        <span>Offset</span>
                        <strong>
                          {assignmentDetailsVisible
                            ? `${(appliedAssignment.offsetHz / 1_000_000).toFixed(3)} MHz`
                            : "HIDDEN"}
                        </strong>
                      </div>

                      <div>
                        <span>Shift</span>
                        <strong>
                          {assignmentDetailsVisible
                            ? appliedAssignment.shiftDirection
                            : "HIDDEN"}
                        </strong>
                      </div>
                    </>
                  )}

                  <div className="student-assignment-full">
                    <span>TX Tone</span>
                    <strong>
                      {assignmentDetailsVisible
                        ? appliedAssignment.requiredCtcssHz === null
                          ? "NONE"
                          : `${appliedAssignment.requiredCtcssHz.toFixed(1)} Hz`
                        : "HIDDEN"}
                    </strong>
                  </div>
                </div>

              </>
            )}
          </aside>
        </section>

        <section className={`student-session-shell ${
          studentSessionActive ? "session-active" : ""
        } ${studentSessionReport ? "session-complete" : ""}`} aria-label="Student training session">
          <div className="student-session-header">
            <div>
              <p className="panel-label">STUDENT TRAINING SESSION</p>
              <h2>{studentSessionActive ? "Session In Progress" : studentSessionReport ? "Exercise Complete" : "Begin Student Session"}</h2>
            </div>

            <div className="student-session-state">
              <span>{studentSessionActive ? "LIVE SESSION" : studentSessionReport ? "REPORT READY" : "NOT STARTED"}</span>
              <strong>{studentSessionActive ? formatAssignmentTimer(timerSecondsRemaining) : studentSessionReport ? (studentSessionReport.passed ? "PASSED" : "NOT PASSED") : "READY"}</strong>
            </div>
          </div>

          <div className="student-session-controls">
            <label>
              <span>Student Name</span>
              <input
                type="text"
                value={studentName}
                disabled={studentSessionActive}
                placeholder="Student name"
                onChange={event => setStudentName(event.target.value)}
              />
            </label>

            <label>
              <span>Class / Cohort</span>
              <input
                type="text"
                value={studentClass}
                disabled={studentSessionActive}
                placeholder="Example: Emergency Communications Cohort 3"
                onChange={event => setStudentClass(event.target.value)}
              />
            </label>

            <div className="student-session-actions">
              {!studentSessionActive ? (
                <button
                  type="button"
                  className="begin-session-button"
                  disabled={!appliedAssignment}
                  onClick={beginStudentSession}
                >
                  BEGIN SESSION
                </button>
              ) : (
                <button
                  type="button"
                  className="end-session-button"
                  onClick={() => endStudentSession("INSTRUCTOR")}
                >
                  END EXERCISE
                </button>
              )}

              {studentSessionReport && !studentSessionActive && (
                <button
                  type="button"
                  className="new-session-button"
                  onClick={startNewStudentSession}
                >
                  NEW STUDENT / RESET SESSION
                </button>
              )}
            </div>
          </div>

          <div className="student-session-message">
            <span>SESSION STATUS</span>
            <strong>{studentSessionMessage}</strong>
          </div>

          {studentSessionReport && (
            <section className={`performance-report ${
              studentSessionReport.passed ? "report-pass" : "report-fail"
            }`} aria-label="End of exercise performance report">
              <div className="performance-report-header">
                <div>
                  <p className="panel-label">BLACK SKY TRAINING RESULTS</p>
                  <h2>End-of-Exercise Performance Report</h2>
                  <span>{studentSessionReport.studentName} • {studentSessionReport.className}</span>
                </div>

                <div className="performance-result-badge">
                  <span>FINAL STATUS</span>
                  <strong>
                    {studentSessionReport.passed ? "PASSED" : "NOT PASSED"}
                    {studentSessionReport.instructorOverride ? " — OVERRIDE" : ""}
                  </strong>
                </div>
              </div>

              <div className="performance-overview-grid">
                <div>
                  <span>Selected Scenario</span>
                  <strong>{studentSessionReport.scenarioName}</strong>
                  <small>{studentSessionReport.assignmentMode}</small>
                </div>
                <div>
                  <span>Assignment Duration</span>
                  <strong>{formatSessionDuration(studentSessionReport.assignmentDurationSeconds)}</strong>
                </div>
                <div>
                  <span>Completion Time</span>
                  <strong>{formatSessionDuration(studentSessionReport.completionSeconds)}</strong>
                </div>
                <div>
                  <span>PTT Attempts</span>
                  <strong>{studentSessionReport.attempts.length}</strong>
                </div>
                <div>
                  <span>Successful Attempts</span>
                  <strong>{studentSessionReport.attempts.filter(attempt => attempt.success).length}</strong>
                </div>
                <div>
                  <span>Failed Attempts</span>
                  <strong>{studentSessionReport.attempts.filter(attempt => !attempt.success).length}</strong>
                </div>
              </div>

              <div className="performance-grading-summary">
                <div>
                  <span>Pass Rule</span>
                  <strong>{passRequirementLabel(studentSessionReport.grading.passRequirement)}</strong>
                </div>
                <div>
                  <span>Successful PTTs Required</span>
                  <strong>{studentSessionReport.grading.requiredSuccessfulAttempts}</strong>
                </div>
                <div>
                  <span>Maximum Attempts</span>
                  <strong>
                    {studentSessionReport.grading.enforceMaxAttempts
                      ? studentSessionReport.grading.maxAttempts
                      : "ADVISORY"}
                  </strong>
                </div>
                <div>
                  <span>Time Limit</span>
                  <strong>
                    {studentSessionReport.grading.enforceTimeLimit
                      ? "ENFORCED"
                      : "ADVISORY"}
                  </strong>
                </div>
                <div>
                  <span>Hints</span>
                  <strong>
                    {studentSessionReport.grading.allowHints
                      ? "ALLOWED"
                      : "NOT ALLOWED"}
                  </strong>
                </div>
                <div>
                  <span>Exercise End</span>
                  <strong>
                    {studentSessionReport.endReason === "TIME_LIMIT"
                      ? "TIME EXPIRED"
                      : studentSessionReport.endReason === "MAX_ATTEMPTS"
                      ? "MAX ATTEMPTS"
                      : "INSTRUCTOR"}
                  </strong>
                </div>
              </div>

              <div className="performance-pass-reason">
                <span>GRADING DECISION</span>
                <strong>{studentSessionReport.passReason}</strong>
              </div>

              <div className="performance-frost-grid">
                <div className="performance-frost-card performance-fr">
                  <span>Fr</span>
                  <strong>{getFailureCount(studentSessionReport.attempts, "Fr")}</strong>
                  <small>Frequency Failures</small>
                </div>
                <div className="performance-frost-card performance-o">
                  <span>O</span>
                  <strong>{getFailureCount(studentSessionReport.attempts, "O")}</strong>
                  <small>Offset Failures</small>
                </div>
                <div className="performance-frost-card performance-s">
                  <span>S</span>
                  <strong>{getFailureCount(studentSessionReport.attempts, "S")}</strong>
                  <small>Shift Failures</small>
                </div>
                <div className="performance-frost-card performance-t">
                  <span>T</span>
                  <strong>{getFailureCount(studentSessionReport.attempts, "T")}</strong>
                  <small>Tone Failures</small>
                </div>
              </div>

              <div className="performance-attempt-bookends">
                <div>
                  <span>First Attempt</span>
                  <strong>{describeAttempt(studentSessionReport.attempts[0])}</strong>
                  <small>{studentSessionReport.attempts[0]?.accessStatus ?? "No PTT attempt recorded"}</small>
                </div>
                <div>
                  <span>Final Attempt</span>
                  <strong>{describeAttempt(studentSessionReport.attempts[studentSessionReport.attempts.length - 1])}</strong>
                  <small>{studentSessionReport.attempts[studentSessionReport.attempts.length - 1]?.accessStatus ?? "No PTT attempt recorded"}</small>
                </div>
              </div>

              <section className="instructor-override-panel" aria-label="Instructor override controls">
                <div className="instructor-override-header">
                  <div>
                    <span>INSTRUCTOR OVERRIDE</span>
                    <strong>Review the performance report and make a final training decision</strong>
                  </div>

                  <span
                    className={`override-status-chip ${
                      studentSessionReport.instructorOverride === "PASS"
                        ? "override-pass"
                        : studentSessionReport.instructorOverride === "FAIL"
                        ? "override-fail"
                        : ""
                    }`}
                  >
                    {studentSessionReport.instructorOverride === "PASS"
                      ? "MANUAL PASS"
                      : studentSessionReport.instructorOverride === "FAIL"
                      ? "MANUAL FAIL"
                      : "NO OVERRIDE"}
                  </span>
                </div>

                <div className="override-system-result">
                  <div>
                    <span>System Result</span>
                    <strong>{studentSessionReport.systemPassed ? "PASSED" : "NOT PASSED"}</strong>
                  </div>
                  <div>
                    <span>System Decision</span>
                    <strong>{studentSessionReport.systemPassReason}</strong>
                  </div>
                </div>

                <label className="override-note-field">
                  <span>Instructor Note / Reason</span>
                  <textarea
                    value={instructorOverrideNote}
                    onChange={event =>
                      setInstructorOverrideNote(event.target.value)
                    }
                    placeholder="Optional: explain why you are overriding the grade or reopening the exercise."
                  />
                </label>

                <div className="instructor-override-actions">
                  <button
                    type="button"
                    className="override-pass-button"
                    onClick={() => applyInstructorOverride("PASS")}
                  >
                    MANUAL PASS
                  </button>

                  <button
                    type="button"
                    className="override-fail-button"
                    onClick={() => applyInstructorOverride("FAIL")}
                  >
                    MANUAL FAIL
                  </button>

                  <button
                    type="button"
                    className="override-reopen-button"
                    onClick={reopenStudentSession}
                  >
                    REOPEN SESSION
                  </button>
                </div>

                {studentSessionReport.instructorOverrideNote && (
                  <div className="override-note-display">
                    <span>Recorded Instructor Note</span>
                    <strong>{studentSessionReport.instructorOverrideNote}</strong>
                  </div>
                )}
              </section>
            </section>
          )}
        </section>

        <section className="simulator-layout classroom-workspace">

        <div className="radio-stage">

          <div className="radio-top">

            <div className="antenna-base">
              <div className="antenna" />
            </div>

            <div />

            <div className="power-knob">

              <div className="knob-cap" />

              <span>
                VOL
              </span>

            </div>

          </div>

          <div
            className={
              isTx
                ? "radio-shell radio-shell-tx"
                : "radio-shell"
            }
          >

            <div className="side-controls">

              <button
                className="side-key sk1"
                type="button"
                onClick={
                  playButtonBeep
                }
              >
                SK1
              </button>

              <button
                className={
                  isTx
                    ? "side-key ptt ptt-active"
                    : "side-key ptt"
                }

                type="button"

                onPointerDown={
                  startPtt
                }

                onPointerUp={
                  stopPtt
                }

                onPointerCancel={
                  stopPtt
                }

                onLostPointerCapture={
                  stopPtt
                }
              >
                {isTx
                  ? "TX"
                  : "PTT"}
              </button>

              <button
                className="side-key sk2"
                type="button"
                onClick={
                  playButtonBeep
                }
              >
                SK2
              </button>

            </div>

            <section className="screen-bezel">

              <div className="radio-screen">
                {renderScreen()}
              </div>

            </section>

            <section className="upper-controls">

              <div className="upper-left">

                <button
                  className="mode-button vfo-button"
                  type="button"
                  onClick={
                    switchOperatingMode
                  }
                >
                  VFO/MR
                </button>

                <button
                  className="small-function-button"
                  type="button"
                  onClick={
                    playButtonBeep
                  }
                >
                  MON
                </button>

              </div>

              <div className="speaker-area">

                {Array.from({
                  length: 56,
                }).map(
                  (
                    _,
                    index
                  ) => (
                    <span
                      key={index}
                    />
                  )
                )}

              </div>

              <div className="upper-right">

                <button
                  className="search-button"
                  type="button"
                  onClick={
                    playButtonBeep
                  }
                >
                  ⌕
                </button>

              </div>

            </section>

            <section className="brand-control-row">

              <button
                className="mode-button ab-button"
                type="button"

                onClick={() => {
                  playButtonBeep();

                  dispatch({
                    type:
                      "TOGGLE_VFO",
                  });
                }}
              >
                A/B
              </button>

              <div className="brand-panel">

                <strong>
                  BLACK SKY
                </strong>

                <span>
                  BS-5
                </span>

              </div>

              <button
                className="search-function-button"
                type="button"
                onClick={
                  playButtonBeep
                }
              >
                SEARCH
              </button>

            </section>

            <section className="control-deck">

              <div className="navigation-row">

                <button
                  className="nav-button menu-button"
                  type="button"

                  onClick={() => {
                    playButtonBeep();

                    dispatch({
                      type:
                        "MENU_PRESSED",
                    });
                  }}
                >
                  ☰

                  <span className="nav-label">
                    MENU
                  </span>

                </button>

                <button
                  className="nav-button"
                  type="button"

                  onClick={() => {
                    playButtonBeep();

                    dispatch({
                      type:
                        "MENU_UP",
                    });
                  }}
                >
                  ▲

                  <span className="nav-label">
                    UP
                  </span>

                </button>

                <button
                  className="nav-button"
                  type="button"

                  onClick={() => {
                    playButtonBeep();

                    dispatch({
                      type:
                        "MENU_DOWN",
                    });
                  }}
                >
                  ▼

                  <span className="nav-label">
                    DOWN
                  </span>

                </button>

                <button
                  className="nav-button exit-button"
                  type="button"

                  onClick={() => {
                    playButtonBeep();

                    dispatch({
                      type:
                        "EXIT_PRESSED",
                    });
                  }}
                >
                  ↩

                  <span className="nav-label">
                    EXIT
                  </span>

                </button>

              </div>

              <div className="keypad">

                {keypad.map(
                  key => (
                    <button
                      key={
                        key.main
                      }

                      className="keypad-button"

                      type="button"

                      onClick={() =>
                        pressDigit(
                          key.main
                        )
                      }
                    >

                      <span className="key-main">
                        {key.main}
                      </span>

                      <span className="key-sub">
                        {key.sub}
                      </span>

                    </button>
                  )
                )}

              </div>

            </section>

            <footer className="radio-footer">

              <span>
                BS-5
              </span>

              <span>
                VHF / UHF VIRTUAL TRAINER
              </span>

            </footer>

          </div>

        </div>

        <div className="right-control-column classroom-right-stack">

        {/* ====================================
            Fr.O.S.T TRAINING PANEL
        ==================================== */}

        <aside className="training-panel frost-panel">

        <p className="panel-label">
          BLACK SKY VIRTUAL HT
        </p>

        <h2 className="frost-panel-title">
          <span className="frost-title-fr">Fr</span>
          <span className="frost-dot">.</span>
          <span className="frost-title-o">O</span>
          <span className="frost-dot">.</span>
          <span className="frost-title-s">S</span>
          <span className="frost-dot">.</span>
          <span className="frost-title-t">T</span>
          <span className="frost-title-text"> Repeater Check</span>
        </h2>

        <p className="panel-description">
          Fr.O.S.T checks Frequency, Offset, Shift, and Tone independently so a correct B / TX frequency cannot hide an incorrect repeater setting.
        </p>

        <div
          className={`activity-card ${
            frostResult?.repeaterTx ===
            "ACTIVE"
              ? "tx-card"
              : "rx-card"
          } ${
            frostResult?.accessStatus ===
            "ACCESS GRANTED" ||
            frostResult?.accessStatus ===
            "SIMPLEX TX"
              ? "access-granted-card"
              : isTx
              ? "access-denied-card"
              : ""
          }`}
        >

          <span>
            ACCESS STATUS
          </span>

          <strong>
            {frostResult
              ?.accessStatus ??
              "NOT READY"}
          </strong>

        </div>

        <section className="frost-primary-section" aria-label="Fr.O.S.T primary checks">

          <div className="frost-primary-heading">
            <span>PRIMARY CHECKS</span>
            <strong>All four must match</strong>
          </div>

          <div className="frost-primary-grid">

            <div
              className={`frost-primary-card frost-primary-fr ${
                !appliedAssignment
                  ? "is-idle"
                  : frostResult?.frequency === "MATCH"
                  ? "is-match"
                  : "is-fail"
              }`}
            >
              <div className="frost-primary-letter frost-fr">Fr</div>
              <div className="frost-primary-copy">
                <span>Frequency</span>
                <strong>{frostResult?.frequency ?? "WAITING"}</strong>
              </div>
              <span className="frost-status-lamp" aria-hidden="true" />
            </div>

            <div
              className={`frost-primary-card frost-primary-o ${
                !appliedAssignment
                  ? "is-idle"
                  : frostResult?.offset === "MATCH"
                  ? "is-match"
                  : "is-fail"
              }`}
            >
              <div className="frost-primary-letter frost-o">O</div>
              <div className="frost-primary-copy">
                <span>Offset</span>
                <strong>{frostResult?.offset ?? "WAITING"}</strong>
              </div>
              <span className="frost-status-lamp" aria-hidden="true" />
            </div>

            <div
              className={`frost-primary-card frost-primary-s ${
                !appliedAssignment
                  ? "is-idle"
                  : frostResult?.shift === "MATCH"
                  ? "is-match"
                  : "is-fail"
              }`}
            >
              <div className="frost-primary-letter frost-s">S</div>
              <div className="frost-primary-copy">
                <span>Shift</span>
                <strong>{frostResult?.shift ?? "WAITING"}</strong>
              </div>
              <span className="frost-status-lamp" aria-hidden="true" />
            </div>

            <div
              className={`frost-primary-card frost-primary-t ${
                !appliedAssignment
                  ? "is-idle"
                  : frostResult?.tone === "MATCH"
                  ? "is-match"
                  : "is-fail"
              }`}
            >
              <div className="frost-primary-letter frost-t">T</div>
              <div className="frost-primary-copy">
                <span>Tone</span>
                <strong>{frostResult?.tone ?? "WAITING"}</strong>
              </div>
              <span className="frost-status-lamp" aria-hidden="true" />
            </div>

          </div>

        </section>

        <details className="frost-details">
          <summary>Technical Details</summary>

          <div className="frost-details-grid">

            <div>
              <span>Radio Mode</span>
              <strong>
                {radio.operatingMode === "VFO"
                  ? "FREQUENCY MODE"
                  : "CHANNEL MODE"}
              </strong>
            </div>

            <div>
              <span>Operating Path</span>
              <strong>{frostOperatingMode ?? "NONE"}</strong>
            </div>

            <div>
              <span>A / RX</span>
              <strong>
                {rxFrequency === null
                  ? "EMPTY"
                  : `${formatFrequency(rxFrequency, 3)} MHz`}
              </strong>
            </div>

            <div>
              <span>B / TX</span>
              <strong>
                {txFrequency === null
                  ? "EMPTY"
                  : `${formatFrequency(txFrequency, 3)} MHz`}
              </strong>
            </div>

            <div>
              <span>RX Output Check</span>
              <strong>{frostResult?.rxOutputMatch ?? "NO MATCH"}</strong>
            </div>

            <div>
              <span>TX Input Check</span>
              <strong>{frostResult?.txInputMatch ?? "NO MATCH"}</strong>
            </div>

            <div>
              <span>Radio Offset</span>
              <strong>{(programmedOffsetHz / 1_000_000).toFixed(3)} MHz</strong>
            </div>

            <div>
              <span>Required Offset</span>
              <strong>
                {frostResult?.requiredOffsetHz === null ||
                frostResult?.requiredOffsetHz === undefined
                  ? frostOperatingMode === "SIMPLEX"
                    ? assignmentDetailsVisible
                      ? "0.000 MHz"
                      : "HIDDEN"
                    : "—"
                  : assignmentDetailsVisible
                  ? `${(frostResult.requiredOffsetHz / 1_000_000).toFixed(3)} MHz`
                  : "HIDDEN"}
              </strong>
            </div>

            <div>
              <span>Radio Shift</span>
              <strong>{programmedShiftDirection}</strong>
            </div>

            <div>
              <span>Required Shift</span>
              <strong>
                {assignmentDetailsVisible
                  ? frostResult?.requiredShiftDirection ??
                    (frostOperatingMode === "SIMPLEX" ? "OFF" : "—")
                  : appliedAssignment
                  ? "HIDDEN"
                  : "—"}
              </strong>
            </div>

            <div>
              <span>Radio TX Tone</span>
              <strong>
                {frostResult?.radioToneDisplay ?? formatTone(txTone)}
              </strong>
            </div>

            <div>
              <span>Required Tone</span>
              <strong>
                {assignmentDetailsVisible
                  ? frostResult?.requiredToneDisplay ?? "—"
                  : appliedAssignment
                  ? "HIDDEN"
                  : "—"}
              </strong>
            </div>

            <div>
              <span>Programming Consistency</span>
              <strong>{frostResult?.programmingConsistency ?? "NO MATCH"}</strong>
            </div>

            <div>
              <span>Expected B / TX</span>
              <strong>
                {frostResult?.expectedTxHz === null ||
                frostResult?.expectedTxHz === undefined
                  ? "—"
                  : `${formatFrequency(frostResult.expectedTxHz, 3)} MHz`}
              </strong>
            </div>

            <div>
              <span>Repeater TX</span>
              <strong className={frostResult?.repeaterTx === "ACTIVE" ? "readout-tx" : ""}>
                {frostResult?.repeaterTx ?? "OFF"}
              </strong>
            </div>

            <div>
              <span>Assignment</span>
              <strong>
                {frostOperatingMode === "SIMPLEX"
                  ? "SIMPLEX"
                  : appliedAssignment?.scenarioName ?? "NONE"}
              </strong>
            </div>

            <div>
              <span>Repeater Output</span>
              <strong>
                {frostResult?.repeaterOutputHz === null ||
                frostResult?.repeaterOutputHz === undefined
                  ? "—"
                  : assignmentDetailsVisible
                  ? `${formatFrequency(frostResult.repeaterOutputHz, 3)} MHz`
                  : "HIDDEN"}
              </strong>
            </div>

            <div>
              <span>Repeater Input</span>
              <strong>
                {frostResult?.repeaterInputHz === null ||
                frostResult?.repeaterInputHz === undefined
                  ? "—"
                  : assignmentDetailsVisible
                  ? `${formatFrequency(frostResult.repeaterInputHz, 3)} MHz`
                  : "HIDDEN"}
              </strong>
            </div>

            <div>
              <span>Stored Channels</span>
              <strong>{Object.keys(radio.memories).length}</strong>
            </div>

          </div>
        </details>

        <div className="next-step">

          Fr.O.S.T STATUS

          <strong>
            {frostInstructionText()}
          </strong>

        </div>

        </aside>

        {classroomRole !== "STUDENT" && (
        <section className={`instructor-console-shell compact-instructor-console ${
          instructorConsoleOpen
            ? "is-open"
            : "is-collapsed"
        }`}>
          <button
            className="instructor-console-toggle"
            type="button"
            aria-expanded={instructorConsoleOpen}
            onClick={() =>
              setInstructorConsoleOpen(
                value => !value
              )
            }
          >
            <span className="instructor-console-toggle-left">
              <span className="instructor-console-title-row">
                <b>INSTRUCTOR CONTROL</b>
                <span className={`console-live-dot ${
                  appliedAssignment
                    ? "is-live"
                    : "is-idle"
                }`} />
                <em>
                  {appliedAssignment
                    ? "ASSIGNMENT LIVE"
                    : "NO ACTIVE ASSIGNMENT"}
                </em>
              </span>

              <small>
                {appliedAssignment
                  ? appliedAssignment.scenarioName
                  : "Open the console to build and apply the next exercise."}
              </small>
            </span>

            <span className="instructor-console-summary">
              <span className={`console-chip ${assignmentLocked ? "chip-locked" : "chip-unlocked"}`}>
                {assignmentLocked ? "LOCKED" : "EDITABLE"}
              </span>
              <span className={`console-chip ${assignmentDetailsVisible ? "chip-revealed" : "chip-hidden"}`}>
                {assignmentDetailsVisible ? "ANSWER REVEALED" : "ANSWER HIDDEN"}
              </span>
              <span className="console-chip chip-mode">
                {appliedAssignment?.mode ?? instructorDraft.mode}
              </span>
              <span className={`console-chip chip-timer ${
                timerRunning ? "is-running" : ""
              } ${timerSecondsRemaining === 0 ? "is-expired" : ""}`}>
                ⏱ {formatAssignmentTimer(timerSecondsRemaining)}
              </span>
            </span>

            <span className="instructor-console-toggle-action">
              <span>{instructorConsoleOpen ? "HIDE CONSOLE" : "OPEN CONSOLE"}</span>
              <b className="console-chevron" aria-hidden="true">
                {instructorConsoleOpen ? "▲" : "▼"}
              </b>
            </span>
          </button>

          {instructorConsoleOpen && (
            <div className="instructor-console-body">
              {/* ====================================
                  INSTRUCTOR CONTROL v1
              ==================================== */}

              <aside className="instructor-control-panel">

                <div className="instructor-control-header">
                  <div>
                    <p className="panel-label">
                      INSTRUCTOR CONTROL v1
                    </p>

                    <h2>
                      Assignment Console
                    </h2>
                  </div>

                  <button
                    className={`lock-assignment-button ${
                      assignmentLocked
                        ? "is-locked"
                        : ""
                    }`}
                    type="button"
                    onClick={() =>
                      setAssignmentLocked(
                        value => !value
                      )
                    }
                  >
                    {assignmentLocked
                      ? "🔒 LOCKED"
                      : "🔓 LOCK ASSIGNMENT"}
                  </button>
                </div>

                <div className="instructor-tools-row">
                  <section className="saved-scenarios-tool" aria-label="Saved instructor scenarios">
                    <div className="instructor-tool-heading">
                      <span>SAVED SCENARIOS</span>
                      <strong>{savedScenarios.length}</strong>
                    </div>

                    <div className="saved-scenario-controls">
                      <select
                        value={selectedScenarioId}
                        disabled={assignmentLocked}
                        onChange={event =>
                          loadScenario(event.target.value)
                        }
                      >
                        <option value="">Select saved scenario…</option>
                        {savedScenarios.map(scenario => (
                          <option key={scenario.id} value={scenario.id}>
                            {scenario.name}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        disabled={assignmentLocked}
                        onClick={saveCurrentScenario}
                      >
                        SAVE SCENARIO + GRADING
                      </button>

                      <button
                        type="button"
                        disabled={assignmentLocked || !selectedScenarioId}
                        onClick={deleteSelectedScenario}
                      >
                        DELETE
                      </button>
                    </div>

                    <div className="saved-grading-preset-preview">
                      <div className="saved-grading-preset-heading">
                        <span>SCENARIO GRADING PRESET</span>
                        <strong>
                          {selectedSavedScenario
                            ? "STORED WITH SCENARIO"
                            : "WAITING FOR SCENARIO"}
                        </strong>
                      </div>

                      <p>
                        {scenarioGradingSummary(selectedSavedScenario)}
                      </p>

                      {selectedSavedScenario && (
                        <div className="saved-grading-preset-grid">
                          <div>
                            <span>Max Attempts</span>
                            <strong>
                              {(
                                selectedSavedScenario.grading ??
                                DEFAULT_GRADING_SETTINGS
                              ).maxAttempts}
                            </strong>
                          </div>

                          <div>
                            <span>Attempt Limit</span>
                            <strong>
                              {(
                                selectedSavedScenario.grading ??
                                DEFAULT_GRADING_SETTINGS
                              ).enforceMaxAttempts
                                ? "ENFORCED"
                                : "ADVISORY"}
                            </strong>
                          </div>

                          <div>
                            <span>Time Limit</span>
                            <strong>
                              {(
                                selectedSavedScenario.grading ??
                                DEFAULT_GRADING_SETTINGS
                              ).enforceTimeLimit
                                ? "ENFORCED"
                                : "ADVISORY"}
                            </strong>
                          </div>

                          <div>
                            <span>Hints</span>
                            <strong>
                              {(
                                selectedSavedScenario.grading ??
                                DEFAULT_GRADING_SETTINGS
                              ).allowHints
                                ? "ALLOWED"
                                : "BLOCKED"}
                            </strong>
                          </div>

                          <div>
                            <span>Pass Requirement</span>
                            <strong>
                              {passRequirementLabel(
                                (
                                  selectedSavedScenario.grading ??
                                  DEFAULT_GRADING_SETTINGS
                                ).passRequirement
                              )}
                            </strong>
                          </div>

                          <div>
                            <span>Successful PTTs</span>
                            <strong>
                              {(
                                selectedSavedScenario.grading ??
                                DEFAULT_GRADING_SETTINGS
                              ).requiredSuccessfulAttempts}
                            </strong>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="assignment-timer-tool" aria-label="Assignment timer">
                    <div className="instructor-tool-heading">
                      <span>ASSIGNMENT TIMER</span>
                      <strong className={timerSecondsRemaining === 0 ? "timer-expired" : ""}>
                        {formatAssignmentTimer(timerSecondsRemaining)}
                      </strong>
                    </div>

                    <div className="timer-controls">
                      <label>
                        <span>Minutes</span>
                        <input
                          type="number"
                          min="1"
                          max="180"
                          value={timerMinutes}
                          disabled={assignmentLocked || timerRunning}
                          onChange={event =>
                            setAssignmentTimerLength(
                              Number(event.target.value)
                            )
                          }
                        />
                      </label>

                      <button
                        type="button"
                        onClick={timerRunning ? pauseAssignmentTimer : startAssignmentTimer}
                      >
                        {timerRunning ? "PAUSE" : "START"}
                      </button>

                      <button
                        type="button"
                        onClick={resetAssignmentTimer}
                      >
                        RESET
                      </button>
                    </div>
                  </section>
                </div>

                <section className="grading-controls-tool" aria-label="Instructor grading controls">
                  <div className="grading-controls-header">
                    <div>
                      <span>INSTRUCTOR GRADING CONTROLS</span>
                      <strong>Define what counts as a passing exercise</strong>
                      <small>
                        These settings are stored with the scenario when you choose SAVE SCENARIO + GRADING.
                      </small>
                    </div>
                    <span className="grading-mode-chip">
                      {gradingSettings.enforceTimeLimit ? "TIME ENFORCED" : "TIME ADVISORY"}
                    </span>
                  </div>

                  <div className="grading-controls-grid">
                    <label className="grading-control-card">
                      <span>Maximum Attempts</span>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={gradingSettings.maxAttempts}
                        disabled={assignmentLocked || studentSessionActive}
                        onChange={event =>
                          setGradingSettings(current => ({
                            ...current,
                            maxAttempts: Math.max(
                              1,
                              Math.min(50, Number(event.target.value) || 1)
                            ),
                          }))
                        }
                      />
                      <small>PTT attempts allowed before the session ends.</small>
                    </label>

                    <label className="grading-toggle-card">
                      <span>Enforce Attempt Limit</span>
                      <input
                        type="checkbox"
                        checked={gradingSettings.enforceMaxAttempts}
                        disabled={assignmentLocked || studentSessionActive}
                        onChange={event =>
                          setGradingSettings(current => ({
                            ...current,
                            enforceMaxAttempts: event.target.checked,
                          }))
                        }
                      />
                      <strong>{gradingSettings.enforceMaxAttempts ? "ENFORCED" : "ADVISORY"}</strong>
                    </label>

                    <label className="grading-toggle-card">
                      <span>Time Limit</span>
                      <input
                        type="checkbox"
                        checked={gradingSettings.enforceTimeLimit}
                        disabled={assignmentLocked || studentSessionActive}
                        onChange={event =>
                          setGradingSettings(current => ({
                            ...current,
                            enforceTimeLimit: event.target.checked,
                          }))
                        }
                      />
                      <strong>{gradingSettings.enforceTimeLimit ? "ENFORCED" : "ADVISORY"}</strong>
                    </label>

                    <label className="grading-toggle-card">
                      <span>Hints / Reveal Answer</span>
                      <input
                        type="checkbox"
                        checked={gradingSettings.allowHints}
                        disabled={assignmentLocked || studentSessionActive}
                        onChange={event =>
                          setGradingSettings(current => ({
                            ...current,
                            allowHints: event.target.checked,
                          }))
                        }
                      />
                      <strong>{gradingSettings.allowHints ? "ALLOWED" : "NOT ALLOWED"}</strong>
                    </label>

                    <label className="grading-control-card grading-pass-rule">
                      <span>Pass Requirement</span>
                      <select
                        value={gradingSettings.passRequirement}
                        disabled={assignmentLocked || studentSessionActive}
                        onChange={event =>
                          setGradingSettings(current => ({
                            ...current,
                            passRequirement:
                              event.target.value as GradingPassRequirement,
                          }))
                        }
                      >
                        <option value="ANY_SUCCESS">Any successful access</option>
                        <option value="FINAL_SUCCESS">Final attempt must succeed</option>
                        <option value="FIRST_ATTEMPT_SUCCESS">First attempt must succeed</option>
                      </select>
                      <small>{passRequirementLabel(gradingSettings.passRequirement)}</small>
                    </label>

                    <label className="grading-control-card">
                      <span>Required Successful PTTs</span>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={gradingSettings.requiredSuccessfulAttempts}
                        disabled={assignmentLocked || studentSessionActive}
                        onChange={event =>
                          setGradingSettings(current => ({
                            ...current,
                            requiredSuccessfulAttempts: Math.max(
                              1,
                              Math.min(20, Number(event.target.value) || 1)
                            ),
                          }))
                        }
                      />
                      <small>Minimum number of successful accesses needed to pass.</small>
                    </label>
                  </div>
                </section>

                <div className="instructor-control-grid">

                  <label className="instructor-field instructor-field-wide scenario-name-field">
                    <span>Scenario Name</span>
                    <input
                      type="text"
                      value={instructorDraft.scenarioName}
                      disabled={assignmentLocked}
                      placeholder="Example: Hospital Backup Repeater Exercise"
                      onChange={event =>
                        setInstructorDraft(
                          current => ({
                            ...current,
                            scenarioName:
                              event.target.value,
                          })
                        )
                      }
                    />
                  </label>

                  <label className="instructor-field instructor-field-wide scenario-details-field">
                    <span>Scenario Brief / Student Instructions</span>
                    <textarea
                      value={instructorDraft.scenarioDetails}
                      disabled={assignmentLocked}
                      placeholder="Describe the situation, mission, operating conditions, and what you want the students to accomplish. Do not put the answer here unless you want students to see it."
                      onChange={event =>
                        setInstructorDraft(
                          current => ({
                            ...current,
                            scenarioDetails:
                              event.target.value,
                          })
                        )
                      }
                    />
                  </label>

                  <label className="instructor-field instructor-field-wide">
                    <span>Assignment Type</span>
                    <select
                      value={instructorDraft.mode}
                      disabled={assignmentLocked}
                      onChange={event =>
                        setInstructorDraft(
                          current => ({
                            ...current,
                            mode:
                              event.target.value as InstructorAssignmentMode,
                          })
                        )
                      }
                    >
                      <option value="REPEATER">REPEATER</option>
                      <option value="SIMPLEX">SIMPLEX</option>
                    </select>
                  </label>

                  {instructorDraft.mode ===
                  "REPEATER" ? (
                    <>
                      <label className="instructor-field">
                        <span>Output / RX MHz</span>
                        <input
                          type={assignmentDetailsVisible ? "text" : "password"}
                          value={instructorDraft.outputMHz}
                          disabled={assignmentLocked}
                          onChange={event =>
                            setInstructorDraft(
                              current => ({
                                ...current,
                                outputMHz:
                                  event.target.value,
                              })
                            )
                          }
                        />
                      </label>

                      <label className="instructor-field">
                        <span>Input / TX MHz</span>
                        <input
                          type={assignmentDetailsVisible ? "text" : "password"}
                          value={instructorDraft.inputMHz}
                          disabled={assignmentLocked}
                          onChange={event =>
                            setInstructorDraft(
                              current => ({
                                ...current,
                                inputMHz:
                                  event.target.value,
                              })
                            )
                          }
                        />
                      </label>

                      <label className="instructor-field">
                        <span>Offset MHz</span>
                        <input
                          type={assignmentDetailsVisible ? "text" : "password"}
                          value={instructorDraft.offsetMHz}
                          disabled={assignmentLocked}
                          onChange={event =>
                            setInstructorDraft(
                              current => ({
                                ...current,
                                offsetMHz:
                                  event.target.value,
                              })
                            )
                          }
                        />
                      </label>

                      <label className="instructor-field">
                        <span>Shift</span>
                        <select
                          value={instructorDraft.shiftDirection}
                          disabled={assignmentLocked}
                          onChange={event =>
                            setInstructorDraft(
                              current => ({
                                ...current,
                                shiftDirection:
                                  event.target.value as ShiftDirection,
                              })
                            )
                          }
                        >
                          <option value="MINUS">MINUS</option>
                          <option value="PLUS">PLUS</option>
                          <option value="OFF">OFF</option>
                        </select>
                      </label>
                    </>
                  ) : (
                    <label className="instructor-field instructor-field-wide">
                      <span>Simplex Frequency MHz</span>
                      <input
                        type={assignmentDetailsVisible ? "text" : "password"}
                        value={instructorDraft.simplexMHz}
                        disabled={assignmentLocked}
                        onChange={event =>
                          setInstructorDraft(
                            current => ({
                              ...current,
                              simplexMHz:
                                event.target.value,
                            })
                          )
                        }
                      />
                    </label>
                  )}

                  <label className="instructor-field instructor-field-wide">
                    <span>TX Tone Hz</span>
                    <input
                      type={assignmentDetailsVisible ? "text" : "password"}
                      value={instructorDraft.toneHz}
                      disabled={assignmentLocked}
                      placeholder="100.0 or NONE"
                      onChange={event =>
                        setInstructorDraft(
                          current => ({
                            ...current,
                            toneHz:
                              event.target.value,
                          })
                        )
                      }
                    />
                  </label>

                </div>

                <div className="instructor-actions">
                  <button
                    className="apply-assignment-button"
                    type="button"
                    disabled={assignmentLocked}
                    onClick={applyInstructorAssignment}
                  >
                    APPLY ASSIGNMENT
                  </button>

                  <button
                    className="clear-assignment-button"
                    type="button"
                    disabled={assignmentLocked}
                    onClick={clearInstructorAssignment}
                  >
                    CLEAR ASSIGNMENT
                  </button>

                  <button
                    className="details-toggle-button"
                    type="button"
                    disabled={
                      studentSessionActive &&
                      !gradingSettings.allowHints
                    }
                    onClick={() =>
                      setAssignmentDetailsVisible(
                        value => !value
                      )
                    }
                  >
                    {studentSessionActive && !gradingSettings.allowHints
                      ? "HINTS DISABLED"
                      : assignmentDetailsVisible
                      ? "HIDE ASSIGNMENT DETAILS"
                      : "REVEAL ANSWER"}
                  </button>
                </div>

                <section className="student-attempt-tool" aria-label="Student PTT attempt history">
                  <div className="student-attempt-heading">
                    <div>
                      <span>STUDENT ATTEMPTS</span>
                      <strong>{studentAttempts.length} PTT {studentAttempts.length === 1 ? "ATTEMPT" : "ATTEMPTS"}</strong>
                    </div>

                    <div className="student-attempt-summary">
                      <span className="attempt-summary-success">✓ {studentAttempts.filter(attempt => attempt.success).length}</span>
                      <span className="attempt-summary-fail">✕ {studentAttempts.filter(attempt => !attempt.success).length}</span>
                      <button type="button" disabled={studentAttempts.length === 0} onClick={() => setStudentAttempts([])}>
                        CLEAR
                      </button>
                    </div>
                  </div>

                  {studentAttempts.length === 0 ? (
                    <div className="student-attempt-empty">
                      No PTT attempts recorded for this assignment yet.
                    </div>
                  ) : (
                    <div className="student-attempt-history">
                      {[...studentAttempts].reverse().map(attempt => (
                        <div
                          key={attempt.id}
                          className={`student-attempt-row ${attempt.success ? "attempt-success" : "attempt-fail"}`}
                        >
                          <span className="attempt-number">#{attempt.attemptNumber}</span>
                          <span className="attempt-result">
                            {attempt.success ? "ACCESS GRANTED" : `FAILED ${attempt.failureElement ?? "—"}`}
                          </span>
                          <span className="attempt-status">{attempt.accessStatus}</span>
                          <span className="attempt-time">{attempt.timestamp}</span>
                          <span className="attempt-timer">⏱ {attempt.timerDisplay}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <div className={`assignment-state ${
                  appliedAssignment
                    ? "assignment-active"
                    : "assignment-idle"
                }`}>
                  <span>ASSIGNMENT STATUS</span>
                  <strong>{assignmentMessage}</strong>
                  {appliedAssignment && (
                    <small>
                      {appliedAssignment.scenarioName} • {appliedAssignment.mode}
                      {assignmentLocked ? " • LOCKED" : ""}
                      {` • TIMER ${formatAssignmentTimer(timerSecondsRemaining)}`}
                    </small>
                  )}
                </div>

              </aside>
            </div>
          )}
        </section>
        )}

        </div>

        </section>

      </section>

    </main>
  );
}

export default App;