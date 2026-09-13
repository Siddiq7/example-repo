import type {
  ShiftDirection,
} from "../models/radio";

import type {
  FrostAccessStatus,
  FrostEvaluationInput,
  FrostEvaluationResult,
  FrostMatchStatus,
  ProgrammingConsistencyStatus,
  RepeaterAccessResult,
  RepeaterDefinition,
} from "../models/repeater";

/* =========================================================
   ENGINE CONSTANTS
========================================================= */

const FREQUENCY_TOLERANCE_HZ =
  500;

const TONE_TOLERANCE_HZ =
  0.1;

/* =========================================================
   TRAINING REPEATERS
========================================================= */

export const TRAINING_REPEATERS:
  RepeaterDefinition[] = [
  {
    id:
      "black-sky-vhf-1",

    name:
      "Black Sky VHF Training Repeater",

    outputFrequencyHz:
      146_940_000,

    inputFrequencyHz:
      146_340_000,

    offsetHz:
      600_000,

    shiftDirection:
      "MINUS",

    requiredCtcssHz:
      100.0,

    enabled:
      true,
  },

  {
    id:
      "black-sky-uhf-1",

    name:
      "Black Sky UHF Training Repeater",

    outputFrequencyHz:
      444_500_000,

    inputFrequencyHz:
      449_500_000,

    offsetHz:
      5_000_000,

    shiftDirection:
      "PLUS",

    requiredCtcssHz:
      100.0,

    enabled:
      true,
  },
];

/* =========================================================
   BASIC HELPERS
========================================================= */

function isFiniteNumber(
  value: unknown
): value is number {
  return (
    typeof value ===
      "number" &&
    Number.isFinite(
      value
    )
  );
}

function isValidShift(
  value: unknown
): value is ShiftDirection {
  return (
    value ===
      "OFF" ||
    value ===
      "PLUS" ||
    value ===
      "MINUS"
  );
}

function frequenciesMatch(
  first:
    number | null,

  second:
    number | null
): boolean {
  if (
    first === null ||
    second === null
  ) {
    return false;
  }

  return (
    Math.abs(
      first -
        second
    ) <=
    FREQUENCY_TOLERANCE_HZ
  );
}

function exactNumberMatch(
  first:
    number | null,

  second:
    number | null
): boolean {
  if (
    first === null ||
    second === null
  ) {
    return false;
  }

  return first === second;
}

function toneMatches(
  radioTone:
    number | null,

  requiredTone:
    number | null
): boolean {
  /*
    Repeater requires NONE.

    Training rule:
    radio must have TX tone OFF.
  */

  if (
    requiredTone ===
    null
  ) {
    return (
      radioTone ===
      null
    );
  }

  /*
    Tone required but radio tone OFF.
  */

  if (
    radioTone ===
    null
  ) {
    return false;
  }

  const difference =
    Math.abs(
      radioTone -
        requiredTone
    );

  /*
    Small epsilon protects the exact
    0.1 boundary from floating-point
    rounding.
  */

  return (
    difference <=
    TONE_TOLERANCE_HZ +
      1e-9
  );
}

function toMatchStatus(
  value: boolean
): FrostMatchStatus {
  return value
    ? "MATCH"
    : "NO MATCH";
}

function formatRadioTone(
  tone:
    number | null
): string {
  if (
    tone === null
  ) {
    return "OFF";
  }

  return `${tone.toFixed(
    1
  )} Hz`;
}

function formatRequiredTone(
  tone:
    number | null
): string {
  if (
    tone === null
  ) {
    return "NONE";
  }

  return `${tone.toFixed(
    1
  )} Hz`;
}

/* =========================================================
   EXPECTED TX CALCULATION

   This uses the RADIO'S settings.

   It does not use the repeater definition.

   This is what allows manual B entry to remain independent
   from Offset and Shift validation.
========================================================= */

export function calculateExpectedTxFrequency(
  rxFrequencyHz:
    number,

  offsetHz:
    number,

  shiftDirection:
    ShiftDirection
): number {
  if (
    shiftDirection ===
    "PLUS"
  ) {
    return (
      rxFrequencyHz +
      offsetHz
    );
  }

  if (
    shiftDirection ===
    "MINUS"
  ) {
    return (
      rxFrequencyHz -
      offsetHz
    );
  }

  return rxFrequencyHz;
}

/* =========================================================
   REPEATER CONFIGURATION VALIDATION
========================================================= */

interface RepeaterValidation {
  complete: boolean;

  hasOutput: boolean;
  hasInput: boolean;
  hasOffset: boolean;
  hasShift: boolean;
}

function validateRepeater(
  repeater:
    RepeaterDefinition | null | undefined
): RepeaterValidation {
  if (
    !repeater
  ) {
    return {
      complete:
        false,

      hasOutput:
        false,

      hasInput:
        false,

      hasOffset:
        false,

      hasShift:
        false,
    };
  }

  const hasOutput =
    isFiniteNumber(
      repeater.outputFrequencyHz
    );

  const hasInput =
    isFiniteNumber(
      repeater.inputFrequencyHz
    );

  const hasOffset =
    isFiniteNumber(
      repeater.offsetHz
    ) &&
    repeater.offsetHz >=
      0;

  const hasShift =
    isValidShift(
      repeater.shiftDirection
    );

  return {
    complete:
      hasOutput &&
      hasInput &&
      hasOffset &&
      hasShift,

    hasOutput,
    hasInput,
    hasOffset,
    hasShift,
  };
}

/* =========================================================
   SIMPLEX EVALUATION
========================================================= */

function evaluateSimplex(
  input:
    FrostEvaluationInput
): FrostEvaluationResult {
  /*
    Simplex rules:

    Frequency:
    A and B must be equal.

    Offset:
    0.

    Shift:
    OFF.

    Tone:
    We currently do not have a separate
    simplex-channel tone requirement,
    so the tone portion passes.
  */

  const frequencyMatched =
    frequenciesMatch(
      input.rxFrequencyHz,
      input.txFrequencyHz
    );

  const offsetMatched =
    input.offsetHz ===
    0;

  const shiftMatched =
    input.shiftDirection ===
    "OFF";

  const toneMatched =
    true;

  const expectedTxHz =
    calculateExpectedTxFrequency(
      input.rxFrequencyHz,
      input.offsetHz,
      input.shiftDirection
    );

  const consistencyMatched =
    frequenciesMatch(
      expectedTxHz,
      input.txFrequencyHz
    );

  const frequency =
    toMatchStatus(
      frequencyMatched
    );

  const offset =
    toMatchStatus(
      offsetMatched
    );

  const shift =
    toMatchStatus(
      shiftMatched
    );

  const tone =
    toMatchStatus(
      toneMatched
    );

  const programmingConsistency:
    ProgrammingConsistencyStatus =
    toMatchStatus(
      consistencyMatched
    );

  const allMatch =
    frequencyMatched &&
    offsetMatched &&
    shiftMatched &&
    toneMatched;

  let accessStatus:
    FrostAccessStatus;

  if (
    !input.pttHeld
  ) {
    accessStatus =
      allMatch
        ? "SIMPLEX READY"
        : "SIMPLEX NOT READY";
  } else if (
    !frequencyMatched
  ) {
    accessStatus =
      "WRONG FREQUENCY";
  } else if (
    !offsetMatched
  ) {
    accessStatus =
      "WRONG OFFSET";
  } else if (
    !shiftMatched
  ) {
    accessStatus =
      "WRONG SHIFT";
  } else if (
    !toneMatched
  ) {
    accessStatus =
      "WRONG TONE";
  } else {
    accessStatus =
      "SIMPLEX TX";
  }

  return {
    configurationValid:
      true,

    frequency,

    offset,

    shift,

    tone,

    rxOutputMatch:
      frequency,

    txInputMatch:
      frequency,

    expectedTxHz,

    programmingConsistency,

    accessStatus,

    repeaterTx:
      "OFF",

    requiredToneDisplay:
      "NONE",

    radioToneDisplay:
      formatRadioTone(
        input.txCtcssHz
      ),

    requiredOffsetHz:
      0,

    requiredShiftDirection:
      "OFF",

    repeaterInputHz:
      null,

    repeaterOutputHz:
      null,

    repeaterName:
      null,

    error:
      null,
  };
}

/* =========================================================
   FULL Fr.O.S.T EVALUATION
========================================================= */

export function evaluateFrostStatus(
  input:
    FrostEvaluationInput
): FrostEvaluationResult {
  if (
    input.mode ===
    "SIMPLEX"
  ) {
    return evaluateSimplex(
      input
    );
  }

  const repeater =
    input.repeater ??
    null;

  const validation =
    validateRepeater(
      repeater
    );

  /*
    Runtime-safe versions of repeater fields.

    The test suite deliberately injects malformed
    definitions using casts.
  */

  const repeaterOutputHz =
    repeater &&
    isFiniteNumber(
      repeater.outputFrequencyHz
    )
      ? repeater.outputFrequencyHz
      : null;

  const repeaterInputHz =
    repeater &&
    isFiniteNumber(
      repeater.inputFrequencyHz
    )
      ? repeater.inputFrequencyHz
      : null;

  const requiredOffsetHz =
    repeater &&
    isFiniteNumber(
      repeater.offsetHz
    ) &&
    repeater.offsetHz >=
      0
      ? repeater.offsetHz
      : null;

  const requiredShiftDirection:
    ShiftDirection | null =
    repeater &&
    isValidShift(
      repeater.shiftDirection
    )
      ? repeater.shiftDirection
      : null;

  /*
    null requiredCtcssHz means:
    NONE REQUIRED.

    That is valid configuration,
    not a missing field.
  */

  const requiredTone =
    repeater
      ? repeater.requiredCtcssHz
      : null;

  /* =======================================================
     Fr — FREQUENCY
  ======================================================= */

  const rxOutputMatched =
    validation.hasOutput &&
    frequenciesMatch(
      input.rxFrequencyHz,
      repeaterOutputHz
    );

  const txInputMatched =
    validation.hasInput &&
    frequenciesMatch(
      input.txFrequencyHz,
      repeaterInputHz
    );

  const frequencyMatched =
    rxOutputMatched &&
    txInputMatched;

  /* =======================================================
     O — OFFSET

     Manual B entry does NOT bypass this comparison.
  ======================================================= */

  const offsetMatched =
    validation.hasOffset &&
    exactNumberMatch(
      input.offsetHz,
      requiredOffsetHz
    );

  /* =======================================================
     S — SHIFT

     Manual B entry does NOT bypass this comparison.
  ======================================================= */

  const shiftMatched =
    validation.hasShift &&
    input.shiftDirection ===
      requiredShiftDirection;

  /* =======================================================
     T — TONE
  ======================================================= */

  const toneMatched =
    validation.complete &&
    toneMatches(
      input.txCtcssHz,
      requiredTone
    );

  /* =======================================================
     EXPECTED TX / PROGRAMMING CONSISTENCY
  ======================================================= */

  const expectedTxHz =
    calculateExpectedTxFrequency(
      input.rxFrequencyHz,
      input.offsetHz,
      input.shiftDirection
    );

  const consistencyMatched =
    frequenciesMatch(
      expectedTxHz,
      input.txFrequencyHz
    );

  const programmingConsistency:
    ProgrammingConsistencyStatus =
    toMatchStatus(
      consistencyMatched
    );

  /* =======================================================
     MATCH STRINGS
  ======================================================= */

  const frequency =
    toMatchStatus(
      frequencyMatched
    );

  const offset =
    toMatchStatus(
      offsetMatched
    );

  const shift =
    toMatchStatus(
      shiftMatched
    );

  const tone =
    toMatchStatus(
      toneMatched
    );

  const rxOutputMatch =
    toMatchStatus(
      rxOutputMatched
    );

  const txInputMatch =
    toMatchStatus(
      txInputMatched
    );

  /* =======================================================
     OVERALL Fr.O.S.T
  ======================================================= */

  const allFrostMatched =
    validation.complete &&
    frequencyMatched &&
    offsetMatched &&
    shiftMatched &&
    toneMatched;

  const repeaterEnabled =
    repeater?.enabled ===
    true;

  const ready =
    allFrostMatched &&
    repeaterEnabled;

  /* =======================================================
     ACCESS STATUS

     BEFORE PTT:

     all good:
     READY

     anything bad:
     NOT READY

     DURING PTT FAILURE PRIORITY:

     1 Frequency
     2 Offset
     3 Shift
     4 Tone
  ======================================================= */

  let accessStatus:
    FrostAccessStatus;

  if (
    !input.pttHeld
  ) {
    accessStatus =
      ready
        ? "READY"
        : "NOT READY";
  } else if (
    !validation.hasOutput ||
    !validation.hasInput ||
    !frequencyMatched
  ) {
    accessStatus =
      "WRONG FREQUENCY";
  } else if (
    !validation.hasOffset ||
    !offsetMatched
  ) {
    accessStatus =
      "WRONG OFFSET";
  } else if (
    !validation.hasShift ||
    !shiftMatched
  ) {
    accessStatus =
      "WRONG SHIFT";
  } else if (
    !toneMatched
  ) {
    accessStatus =
      "WRONG TONE";
  } else if (
    !repeaterEnabled
  ) {
    /*
      There is not yet a dedicated
      REPEATER DISABLED status.

      Fail safely.
    */
    accessStatus =
      "WRONG FREQUENCY";
  } else {
    accessStatus =
      "ACCESS GRANTED";
  }

  /* =======================================================
     REPEATER TRANSMITTER
  ======================================================= */

  const repeaterTx =
    input.pttHeld &&
    ready
      ? "ACTIVE"
      : "OFF";

  return {
    configurationValid:
      validation.complete,

    frequency,

    offset,

    shift,

    tone,

    rxOutputMatch,

    txInputMatch,

    expectedTxHz,

    programmingConsistency,

    accessStatus,

    repeaterTx,

    requiredToneDisplay:
      formatRequiredTone(
        requiredTone
      ),

    radioToneDisplay:
      formatRadioTone(
        input.txCtcssHz
      ),

    requiredOffsetHz,

    requiredShiftDirection,

    repeaterInputHz,

    repeaterOutputHz,

    repeaterName:
      repeater?.name ??
      null,

    error:
      validation.complete
        ? null
        : "REPEATER CONFIGURATION INCOMPLETE",
  };
}

/* =========================================================
   LEGACY REPEATER API

   Your current App.tsx still uses this.

   Keep it until the panel is converted fully to
   evaluateFrostStatus().
========================================================= */

export function evaluateRepeaterAccess(
  transmitting:
    boolean,

  receiveFrequencyHz:
    number | null,

  transmitFrequencyHz:
    number | null,

  txCtcssHz:
    number | null,

  repeaters:
    RepeaterDefinition[] =
      TRAINING_REPEATERS
): RepeaterAccessResult {
  if (
    !transmitting
  ) {
    return {
      status:
        "IDLE",

      repeater:
        null,

      message:
        "Waiting for PTT",

      transmitting:
        false,

      inputMatched:
        false,

      toneMatched:
        false,

      receiveMatched:
        false,

      repeaterOutputActive:
        false,
    };
  }

  if (
    transmitFrequencyHz ===
    null
  ) {
    return {
      status:
        "NO_REPEATER",

      repeater:
        null,

      message:
        "No transmit frequency available",

      transmitting:
        true,

      inputMatched:
        false,

      toneMatched:
        false,

      receiveMatched:
        false,

      repeaterOutputActive:
        false,
    };
  }

  const repeater =
    repeaters.find(
      candidate =>
        candidate.enabled &&
        frequenciesMatch(
          transmitFrequencyHz,
          candidate.inputFrequencyHz
        )
    ) ?? null;

  if (
    !repeater
  ) {
    return {
      status:
        "NO_REPEATER",

      repeater:
        null,

      message:
        "No configured repeater matches this TX frequency",

      transmitting:
        true,

      inputMatched:
        false,

      toneMatched:
        false,

      receiveMatched:
        false,

      repeaterOutputActive:
        false,
    };
  }

  const correctTone =
    toneMatches(
      txCtcssHz,
      repeater.requiredCtcssHz
    );

  if (
    !correctTone
  ) {
    return {
      status:
        "WRONG_TONE",

      repeater,

      message:
        repeater.requiredCtcssHz ===
        null
          ? "Repeater requires no TX tone"
          : `Repeater input matched, but TX tone must be ${repeater.requiredCtcssHz.toFixed(
              1
            )} Hz`,

      transmitting:
        true,

      inputMatched:
        true,

      toneMatched:
        false,

      receiveMatched:
        false,

      repeaterOutputActive:
        false,
    };
  }

  const correctReceive =
    receiveFrequencyHz !==
      null &&
    frequenciesMatch(
      receiveFrequencyHz,
      repeater.outputFrequencyHz
    );

  if (
    !correctReceive
  ) {
    return {
      status:
        "WRONG_RX",

      repeater,

      message:
        "Repeater keyed, but A/RX is not tuned to the repeater output",

      transmitting:
        true,

      inputMatched:
        true,

      toneMatched:
        true,

      receiveMatched:
        false,

      repeaterOutputActive:
        true,
    };
  }

  return {
    status:
      "ACCESS_GRANTED",

    repeater,

    message:
      "Repeater access granted",

    transmitting:
      true,

    inputMatched:
      true,

    toneMatched:
      true,

    receiveMatched:
      true,

    repeaterOutputActive:
      true,
  };
}