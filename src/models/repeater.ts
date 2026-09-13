import type {
  ShiftDirection,
} from "./radio";

/* =========================================================
   Fr.O.S.T MATCH STATES
========================================================= */

export type FrostMatchStatus =
  | "MATCH"
  | "NO MATCH";

/* =========================================================
   OPERATING MODE
========================================================= */

export type FrostOperatingMode =
  | "REPEATER"
  | "SIMPLEX";

/* =========================================================
   STUDENT-FACING ACCESS STATUS
========================================================= */

export type FrostAccessStatus =
  | "READY"
  | "NOT READY"
  | "ACCESS GRANTED"
  | "WRONG FREQUENCY"
  | "WRONG OFFSET"
  | "WRONG SHIFT"
  | "WRONG TONE"
  | "SIMPLEX READY"
  | "SIMPLEX NOT READY"
  | "SIMPLEX TX";

/* =========================================================
   REPEATER TRANSMITTER STATE
========================================================= */

export type RepeaterTxStatus =
  | "OFF"
  | "ACTIVE";

/* =========================================================
   PROGRAMMING CONSISTENCY
========================================================= */

export type ProgrammingConsistencyStatus =
  | "MATCH"
  | "NO MATCH";

/* =========================================================
   ENGINE ERROR
========================================================= */

export type FrostEvaluationError =
  | "REPEATER CONFIGURATION INCOMPLETE"
  | null;

/* =========================================================
   REPEATER DEFINITION
========================================================= */

export interface RepeaterDefinition {
  id: string;

  name: string;

  /*
    Repeater OUTPUT.

    Student listens here.

    This should match:
    A / RX
  */
  outputFrequencyHz: number;

  /*
    Repeater INPUT.

    Student transmits here.

    This should match:
    B / TX
  */
  inputFrequencyHz: number;

  /*
    Published repeater offset.

    Examples:

    600_000
    = 0.600 MHz

    5_000_000
    = 5.000 MHz
  */
  offsetHz: number;

  /*
    Published shift direction.

    PLUS
    MINUS
    OFF
  */
  shiftDirection: ShiftDirection;

  /*
    Required transmit CTCSS.

    null means:
    repeater requires NO tone.
  */
  requiredCtcssHz: number | null;

  /*
    Allows an instructor or scenario
    to take a repeater offline.
  */
  enabled: boolean;
}

/* =========================================================
   Fr.O.S.T EVALUATION INPUT
========================================================= */

export interface FrostEvaluationInput {
  mode: FrostOperatingMode;

  /*
    A / RX
  */
  rxFrequencyHz: number;

  /*
    B / TX
  */
  txFrequencyHz: number;

  /*
    Programmed radio offset.
  */
  offsetHz: number;

  /*
    Programmed radio shift.
  */
  shiftDirection: ShiftDirection;

  /*
    Programmed TX CTCSS.

    null means radio TX tone is OFF.
  */
  txCtcssHz: number | null;

  /*
    false = PTT released
    true  = PTT held
  */
  pttHeld: boolean;

  /*
    Repeater being evaluated.

    Simplex may omit it.
  */
  repeater?: RepeaterDefinition | null;
}

/* =========================================================
   Fr.O.S.T EVALUATION RESULT
========================================================= */

export interface FrostEvaluationResult {
  /*
    Was the repeater definition
    complete enough to evaluate?
  */
  configurationValid: boolean;

  /*
    Fr.O.S.T
  */
  frequency: FrostMatchStatus;
  offset: FrostMatchStatus;
  shift: FrostMatchStatus;
  tone: FrostMatchStatus;

  /*
    Frequency detail.

    Fr is MATCH only if BOTH are MATCH.
  */
  rxOutputMatch: FrostMatchStatus;
  txInputMatch: FrostMatchStatus;

  /*
    Expected B / TX based on:

    A / RX
    Offset
    Shift
  */
  expectedTxHz: number | null;

  programmingConsistency:
    ProgrammingConsistencyStatus;

  /*
    Main panel status.
  */
  accessStatus: FrostAccessStatus;

  /*
    Virtual repeater transmitter.
  */
  repeaterTx: RepeaterTxStatus;

  /*
    Display strings.

    Repeater:
    NONE

    Radio:
    OFF
  */
  requiredToneDisplay: string;
  radioToneDisplay: string;

  /*
    Repeater settings for panel display.
  */
  requiredOffsetHz: number | null;

  requiredShiftDirection:
    ShiftDirection | null;

  repeaterInputHz: number | null;
  repeaterOutputHz: number | null;
  repeaterName: string | null;

  /*
    Instructor/debug information.
  */
  error: FrostEvaluationError;
}

/* =========================================================
   LEGACY REPEATER TYPES

   Kept so the existing App.tsx can continue using the
   earlier repeater API while we transition the panel to
   the full Fr.O.S.T engine.
========================================================= */

export type RepeaterAccessStatus =
  | "IDLE"
  | "ACCESS_GRANTED"
  | "WRONG_FREQUENCY"
  | "WRONG_OFFSET"
  | "WRONG_SHIFT"
  | "WRONG_TONE"
  | "WRONG_RX"
  | "NO_REPEATER";

export interface RepeaterAccessResult {
  status: RepeaterAccessStatus;

  repeater:
    RepeaterDefinition | null;

  message: string;

  transmitting: boolean;

  inputMatched: boolean;

  toneMatched: boolean;

  receiveMatched: boolean;

  repeaterOutputActive: boolean;
}