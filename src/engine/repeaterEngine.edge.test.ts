import {
  describe,
  expect,
  it,
} from "vitest";

import {
  evaluateFrostStatus,
} from "./repeaterEngine";

import type {
  FrostEvaluationInput,
  FrostEvaluationResult,
  RepeaterDefinition,
} from "../models/repeater";

/* =========================================================
   SHARED CONSTANTS
========================================================= */

const VHF_OUTPUT_HZ =
  146_940_000;

const VHF_INPUT_HZ =
  146_340_000;

const VHF_OFFSET_HZ =
  600_000;

const UHF_ZERO_HZ =
  446_500_000;

/* =========================================================
   SHARED REPEATER FIXTURES
========================================================= */

const correctMinusRepeater:
  RepeaterDefinition = {
  id:
    "test-vhf-minus",

  name:
    "Test VHF Minus Repeater",

  outputFrequencyHz:
    VHF_OUTPUT_HZ,

  inputFrequencyHz:
    VHF_INPUT_HZ,

  offsetHz:
    VHF_OFFSET_HZ,

  shiftDirection:
    "MINUS",

  requiredCtcssHz:
    100.0,

  enabled:
    true,
};

const toneLessMinusRepeater:
  RepeaterDefinition = {
  ...correctMinusRepeater,

  id:
    "test-vhf-no-tone",

  name:
    "Test VHF No-Tone Repeater",

  requiredCtcssHz:
    null,
};

const zeroOffsetRepeater:
  RepeaterDefinition = {
  id:
    "test-zero-offset",

  name:
    "Zero Offset Test Repeater",

  outputFrequencyHz:
    UHF_ZERO_HZ,

  inputFrequencyHz:
    UHF_ZERO_HZ,

  offsetHz:
    0,

  shiftDirection:
    "OFF",

  requiredCtcssHz:
    100.0,

  enabled:
    true,
};

/* =========================================================
   SHARED RADIO INPUT FIXTURES
========================================================= */

const correctMinusRadio:
  FrostEvaluationInput = {
  mode:
    "REPEATER",

  rxFrequencyHz:
    VHF_OUTPUT_HZ,

  txFrequencyHz:
    VHF_INPUT_HZ,

  offsetHz:
    VHF_OFFSET_HZ,

  shiftDirection:
    "MINUS",

  txCtcssHz:
    100.0,

  pttHeld:
    false,

  repeater:
    correctMinusRepeater,
};

const correctToneLessRadio:
  FrostEvaluationInput = {
  ...correctMinusRadio,

  txCtcssHz:
    null,

  repeater:
    toneLessMinusRepeater,
};

const correctZeroOffsetRadio:
  FrostEvaluationInput = {
  mode:
    "REPEATER",

  rxFrequencyHz:
    UHF_ZERO_HZ,

  txFrequencyHz:
    UHF_ZERO_HZ,

  offsetHz:
    0,

  shiftDirection:
    "OFF",

  txCtcssHz:
    100.0,

  pttHeld:
    false,

  repeater:
    zeroOffsetRepeater,
};

/* =========================================================
   SHARED ASSERTIONS
========================================================= */

function assertRepeaterTxInvariant(
  input:
    FrostEvaluationInput,

  result:
    FrostEvaluationResult
) {
  const repeaterEnabled =
    input.repeater?.enabled ===
    true;

  const shouldBeActive =
    input.mode ===
      "REPEATER" &&
    input.pttHeld ===
      true &&
    repeaterEnabled &&
    result.configurationValid ===
      true &&
    result.frequency ===
      "MATCH" &&
    result.offset ===
      "MATCH" &&
    result.shift ===
      "MATCH" &&
    result.tone ===
      "MATCH";

  expect(
    result.repeaterTx ===
      "ACTIVE"
  ).toBe(
    shouldBeActive
  );
}

function assertInvalidConfigurationInvariant(
  result:
    FrostEvaluationResult
) {
  if (
    result.configurationValid
  ) {
    return;
  }

  expect(
    result.accessStatus
  ).not.toBe(
    "READY"
  );

  expect(
    result.accessStatus
  ).not.toBe(
    "ACCESS GRANTED"
  );

  expect(
    result.repeaterTx
  ).toBe(
    "OFF"
  );
}

/* =========================================================
   TEST 21
   MISSING INPUT
========================================================= */

describe(
  "Fr.O.S.T incomplete repeater configuration",
  () => {

    it(
      "21 - missing repeater input fails safely",
      () => {
        const repeater = {
          ...correctMinusRepeater,

          inputFrequencyHz:
            null,
        } as unknown as RepeaterDefinition;

        const input:
          FrostEvaluationInput = {
          ...correctMinusRadio,

          repeater,
        };

        const result =
          evaluateFrostStatus(
            input
          );

        expect(
          result.configurationValid
        ).toBe(
          false
        );

        expect(
          result.frequency
        ).toBe(
          "NO MATCH"
        );

        expect(
          result.accessStatus
        ).toBe(
          "NOT READY"
        );

        expect(
          result.repeaterTx
        ).toBe(
          "OFF"
        );

        expect(
          result.error
        ).toBe(
          "REPEATER CONFIGURATION INCOMPLETE"
        );

        assertInvalidConfigurationInvariant(
          result
        );
      }
    );

    /* =====================================================
       TEST 22
       MISSING OUTPUT
    ===================================================== */

    it(
      "22 - missing repeater output fails safely",
      () => {
        const repeater = {
          ...correctMinusRepeater,

          outputFrequencyHz:
            null,
        } as unknown as RepeaterDefinition;

        const before =
          evaluateFrostStatus({
            ...correctMinusRadio,

            repeater,

            pttHeld:
              false,
          });

        expect(
          before.configurationValid
        ).toBe(
          false
        );

        expect(
          before.frequency
        ).toBe(
          "NO MATCH"
        );

        expect(
          before.accessStatus
        ).toBe(
          "NOT READY"
        );

        const during =
          evaluateFrostStatus({
            ...correctMinusRadio,

            repeater,

            pttHeld:
              true,
          });

        expect(
          during.accessStatus
        ).toBe(
          "WRONG FREQUENCY"
        );

        expect(
          during.repeaterTx
        ).toBe(
          "OFF"
        );
      }
    );

    /* =====================================================
       TEST 23
       MISSING OFFSET
    ===================================================== */

    it(
      "23 - missing repeater offset is not inferred",
      () => {
        const repeater = {
          ...correctMinusRepeater,

          offsetHz:
            null,
        } as unknown as RepeaterDefinition;

        const result =
          evaluateFrostStatus({
            ...correctMinusRadio,

            repeater,
          });

        expect(
          result.configurationValid
        ).toBe(
          false
        );

        expect(
          result.frequency
        ).toBe(
          "MATCH"
        );

        expect(
          result.offset
        ).toBe(
          "NO MATCH"
        );

        expect(
          result.accessStatus
        ).toBe(
          "NOT READY"
        );
      }
    );

    /* =====================================================
       TEST 24
       MISSING SHIFT
    ===================================================== */

    it(
      "24 - missing repeater shift is not inferred",
      () => {
        const repeater = {
          ...correctMinusRepeater,

          shiftDirection:
            null,
        } as unknown as RepeaterDefinition;

        const result =
          evaluateFrostStatus({
            ...correctMinusRadio,

            repeater,
          });

        expect(
          result.configurationValid
        ).toBe(
          false
        );

        expect(
          result.frequency
        ).toBe(
          "MATCH"
        );

        expect(
          result.offset
        ).toBe(
          "MATCH"
        );

        expect(
          result.shift
        ).toBe(
          "NO MATCH"
        );

        expect(
          result.accessStatus
        ).toBe(
          "NOT READY"
        );
      }
    );

    /* =====================================================
       TEST 25
       NULL TONE MEANS NONE
    ===================================================== */

    it(
      "25 - null required CTCSS means no tone required",
      () => {
        const result =
          evaluateFrostStatus(
            correctToneLessRadio
          );

        expect(
          result.configurationValid
        ).toBe(
          true
        );

        expect(
          result.requiredToneDisplay
        ).toBe(
          "NONE"
        );

        expect(
          result.radioToneDisplay
        ).toBe(
          "OFF"
        );

        expect(
          result.tone
        ).toBe(
          "MATCH"
        );

        expect(
          result.accessStatus
        ).toBe(
          "READY"
        );
      }
    );
  }
);

/* =========================================================
   TESTS 26–28
   ZERO OFFSET
========================================================= */

describe(
  "Fr.O.S.T zero-offset repeater",
  () => {

    it(
      "26 - zero offset with Shift OFF passes",
      () => {
        const result =
          evaluateFrostStatus(
            correctZeroOffsetRadio
          );

        expect(
          result.frequency
        ).toBe(
          "MATCH"
        );

        expect(
          result.offset
        ).toBe(
          "MATCH"
        );

        expect(
          result.shift
        ).toBe(
          "MATCH"
        );

        expect(
          result.tone
        ).toBe(
          "MATCH"
        );

        expect(
          result.expectedTxHz
        ).toBe(
          UHF_ZERO_HZ
        );

        expect(
          result.programmingConsistency
        ).toBe(
          "MATCH"
        );

        expect(
          result.accessStatus
        ).toBe(
          "READY"
        );

        expect(
          result.repeaterTx
        ).toBe(
          "OFF"
        );

        const during =
          evaluateFrostStatus({
            ...correctZeroOffsetRadio,

            pttHeld:
              true,
          });

        expect(
          during.accessStatus
        ).toBe(
          "ACCESS GRANTED"
        );

        expect(
          during.repeaterTx
        ).toBe(
          "ACTIVE"
        );
      }
    );

    it(
      "27 - zero-offset repeater rejects PLUS",
      () => {
        const base:
          FrostEvaluationInput = {
          ...correctZeroOffsetRadio,

          shiftDirection:
            "PLUS",
        };

        const before =
          evaluateFrostStatus(
            base
          );

        expect(
          before.shift
        ).toBe(
          "NO MATCH"
        );

        expect(
          before.accessStatus
        ).toBe(
          "NOT READY"
        );

        const during =
          evaluateFrostStatus({
            ...base,

            pttHeld:
              true,
          });

        expect(
          during.accessStatus
        ).toBe(
          "WRONG SHIFT"
        );

        expect(
          during.repeaterTx
        ).toBe(
          "OFF"
        );
      }
    );

    it(
      "28 - zero-offset repeater rejects non-zero programmed offset",
      () => {
        const base:
          FrostEvaluationInput = {
          ...correctZeroOffsetRadio,

          offsetHz:
            600_000,
        };

        const before =
          evaluateFrostStatus(
            base
          );

        expect(
          before.offset
        ).toBe(
          "NO MATCH"
        );

        expect(
          before.accessStatus
        ).toBe(
          "NOT READY"
        );

        const during =
          evaluateFrostStatus({
            ...base,

            pttHeld:
              true,
          });

        expect(
          during.accessStatus
        ).toBe(
          "WRONG OFFSET"
        );

        expect(
          during.repeaterTx
        ).toBe(
          "OFF"
        );
      }
    );
  }
);

/* =========================================================
   TESTS 29–36
   PARAMETERIZED TONE BOUNDARIES
========================================================= */

const toneCases = [
  {
    number:
      29,

    name:
      "exact tone",

    required:
      100.0,

    radio:
      100.0,

    expected:
      "MATCH",

    pttStatus:
      "ACCESS GRANTED",
  },

  {
    number:
      30,

    name:
      "+0.1 Hz boundary",

    required:
      100.0,

    radio:
      100.1,

    expected:
      "MATCH",

    pttStatus:
      "ACCESS GRANTED",
  },

  {
    number:
      31,

    name:
      "-0.1 Hz boundary",

    required:
      100.0,

    radio:
      99.9,

    expected:
      "MATCH",

    pttStatus:
      "ACCESS GRANTED",
  },

  {
    number:
      32,

    name:
      "+0.11 Hz outside boundary",

    required:
      100.0,

    radio:
      100.11,

    expected:
      "NO MATCH",

    pttStatus:
      "WRONG TONE",
  },

  {
    number:
      33,

    name:
      "-0.11 Hz outside boundary",

    required:
      100.0,

    radio:
      99.89,

    expected:
      "NO MATCH",

    pttStatus:
      "WRONG TONE",
  },

  {
    number:
      34,

    name:
      "tone required but radio OFF",

    required:
      100.0,

    radio:
      null,

    expected:
      "NO MATCH",

    pttStatus:
      "WRONG TONE",
  },

  {
    number:
      35,

    name:
      "repeater NONE and radio OFF",

    required:
      null,

    radio:
      null,

    expected:
      "MATCH",

    pttStatus:
      "ACCESS GRANTED",
  },

  {
    number:
      36,

    name:
      "repeater NONE but radio sends tone",

    required:
      null,

    radio:
      100.0,

    expected:
      "NO MATCH",

    pttStatus:
      "WRONG TONE",
  },
] as const;

describe(
  "Fr.O.S.T tone boundaries",
  () => {

    it.each(
      toneCases
    )(
      "$number - $name",
      testCase => {
        const repeater:
          RepeaterDefinition = {
          ...correctMinusRepeater,

          requiredCtcssHz:
            testCase.required,
        };

        const beforeInput:
          FrostEvaluationInput = {
          ...correctMinusRadio,

          txCtcssHz:
            testCase.radio,

          repeater,

          pttHeld:
            false,
        };

        const before =
          evaluateFrostStatus(
            beforeInput
          );

        expect(
          before.tone
        ).toBe(
          testCase.expected
        );

        expect(
          before.accessStatus
        ).toBe(
          testCase.expected ===
            "MATCH"
            ? "READY"
            : "NOT READY"
        );

        const duringInput:
          FrostEvaluationInput = {
          ...beforeInput,

          pttHeld:
            true,
        };

        const during =
          evaluateFrostStatus(
            duringInput
          );

        expect(
          during.accessStatus
        ).toBe(
          testCase.pttStatus
        );

        expect(
          during.repeaterTx
        ).toBe(
          testCase.expected ===
            "MATCH"
            ? "ACTIVE"
            : "OFF"
        );

        assertRepeaterTxInvariant(
          duringInput,
          during
        );
      }
    );
  }
);

/* =========================================================
   TESTS 37–42
   PTT TRANSITIONS
========================================================= */

describe(
  "Fr.O.S.T PTT transitions",
  () => {

    it(
      "37 - READY becomes ACCESS GRANTED",
      () => {
        const before =
          evaluateFrostStatus({
            ...correctMinusRadio,

            pttHeld:
              false,
          });

        const during =
          evaluateFrostStatus({
            ...correctMinusRadio,

            pttHeld:
              true,
          });

        expect(
          before.accessStatus
        ).toBe(
          "READY"
        );

        expect(
          before.repeaterTx
        ).toBe(
          "OFF"
        );

        expect(
          during.accessStatus
        ).toBe(
          "ACCESS GRANTED"
        );

        expect(
          during.repeaterTx
        ).toBe(
          "ACTIVE"
        );

        expect(
          during.frequency
        ).toBe(
          before.frequency
        );

        expect(
          during.offset
        ).toBe(
          before.offset
        );

        expect(
          during.shift
        ).toBe(
          before.shift
        );

        expect(
          during.tone
        ).toBe(
          before.tone
        );
      }
    );

    it(
      "38 - ACCESS GRANTED returns to READY after release",
      () => {
        const sequence = [
          false,
          true,
          false,
        ];

        const results =
          sequence.map(
            pttHeld =>
              evaluateFrostStatus({
                ...correctMinusRadio,

                pttHeld,
              })
          );

        expect(
          results.map(
            result =>
              result.accessStatus
          )
        ).toEqual([
          "READY",
          "ACCESS GRANTED",
          "READY",
        ]);

        expect(
          results.map(
            result =>
              result.repeaterTx
          )
        ).toEqual([
          "OFF",
          "ACTIVE",
          "OFF",
        ]);
      }
    );

    it(
      "39 - wrong shift becomes WRONG SHIFT during PTT",
      () => {
        const base:
          FrostEvaluationInput = {
          ...correctMinusRadio,

          shiftDirection:
            "PLUS",
        };

        const before =
          evaluateFrostStatus({
            ...base,

            pttHeld:
              false,
          });

        const during =
          evaluateFrostStatus({
            ...base,

            pttHeld:
              true,
          });

        const after =
          evaluateFrostStatus({
            ...base,

            pttHeld:
              false,
          });

        expect(
          before.accessStatus
        ).toBe(
          "NOT READY"
        );

        expect(
          during.accessStatus
        ).toBe(
          "WRONG SHIFT"
        );

        expect(
          after.accessStatus
        ).toBe(
          "NOT READY"
        );

        expect(
          during.repeaterTx
        ).toBe(
          "OFF"
        );
      }
    );

    it(
      "40 - PTT cannot make failed Fr.O.S.T programming pass",
      () => {
        const badInputs:
          FrostEvaluationInput[] = [
          {
            ...correctMinusRadio,

            txFrequencyHz:
              146_520_000,
          },

          {
            ...correctMinusRadio,

            offsetHz:
              5_000_000,
          },

          {
            ...correctMinusRadio,

            shiftDirection:
              "PLUS",
          },

          {
            ...correctMinusRadio,

            txCtcssHz:
              103.5,
          },
        ];

        for (
          const bad of
          badInputs
        ) {
          const input = {
            ...bad,

            pttHeld:
              true,
          };

          const result =
            evaluateFrostStatus(
              input
            );

          expect(
            result.accessStatus
          ).not.toBe(
            "ACCESS GRANTED"
          );

          expect(
            result.repeaterTx
          ).toBe(
            "OFF"
          );
        }
      }
    );

    it(
      "41 - rapid PTT toggling leaves no stale ACTIVE state",
      () => {
        const sequence = [
          false,
          true,
          false,
          true,
          false,
        ];

        const results =
          sequence.map(
            pttHeld =>
              evaluateFrostStatus({
                ...correctMinusRadio,

                pttHeld,
              })
          );

        expect(
          results.map(
            result =>
              result.accessStatus
          )
        ).toEqual([
          "READY",
          "ACCESS GRANTED",
          "READY",
          "ACCESS GRANTED",
          "READY",
        ]);

        expect(
          results.map(
            result =>
              result.repeaterTx
          )
        ).toEqual([
          "OFF",
          "ACTIVE",
          "OFF",
          "ACTIVE",
          "OFF",
        ]);
      }
    );

    it(
      "42 - malformed repeater cannot transmit",
      () => {
        const badRepeater = {
          ...correctMinusRepeater,

          inputFrequencyHz:
            null,
        } as unknown as RepeaterDefinition;

        const result =
          evaluateFrostStatus({
            ...correctMinusRadio,

            repeater:
              badRepeater,

            pttHeld:
              true,
          });

        expect(
          result.configurationValid
        ).toBe(
          false
        );

        expect(
          result.accessStatus
        ).toBe(
          "WRONG FREQUENCY"
        );

        expect(
          result.repeaterTx
        ).toBe(
          "OFF"
        );

        expect(
          result.error
        ).toBe(
          "REPEATER CONFIGURATION INCOMPLETE"
        );
      }
    );
  }
);

/* =========================================================
   FOCUSED DISABLED REPEATER TESTS
========================================================= */

describe(
  "Fr.O.S.T disabled repeater behavior",
  () => {

    it(
      "correctly programmed disabled repeater stays NOT READY",
      () => {
        const disabled:
          RepeaterDefinition = {
          ...correctMinusRepeater,

          enabled:
            false,
        };

        const input:
          FrostEvaluationInput = {
          ...correctMinusRadio,

          repeater:
            disabled,

          pttHeld:
            false,
        };

        const result =
          evaluateFrostStatus(
            input
          );

        expect(
          result.configurationValid
        ).toBe(
          true
        );

        expect(
          result.frequency
        ).toBe(
          "MATCH"
        );

        expect(
          result.offset
        ).toBe(
          "MATCH"
        );

        expect(
          result.shift
        ).toBe(
          "MATCH"
        );

        expect(
          result.tone
        ).toBe(
          "MATCH"
        );

        expect(
          result.accessStatus
        ).toBe(
          "NOT READY"
        );

        expect(
          result.repeaterTx
        ).toBe(
          "OFF"
        );

        assertRepeaterTxInvariant(
          input,
          result
        );
      }
    );

    it(
      "disabled repeater cannot grant access during PTT",
      () => {
        const disabled:
          RepeaterDefinition = {
          ...correctMinusRepeater,

          enabled:
            false,
        };

        const input:
          FrostEvaluationInput = {
          ...correctMinusRadio,

          repeater:
            disabled,

          pttHeld:
            true,
        };

        const result =
          evaluateFrostStatus(
            input
          );

        expect(
          result.accessStatus
        ).not.toBe(
          "ACCESS GRANTED"
        );

        expect(
          result.accessStatus
        ).toBe(
          "WRONG FREQUENCY"
        );

        expect(
          result.repeaterTx
        ).toBe(
          "OFF"
        );

        assertRepeaterTxInvariant(
          input,
          result
        );
      }
    );
  }
);

/* =========================================================
   FOCUSED TONE-LESS REPEATER TESTS
========================================================= */

describe(
  "Fr.O.S.T tone-less repeater behavior",
  () => {

    it(
      "tone-less repeater is READY with radio tone OFF",
      () => {
        const result =
          evaluateFrostStatus({
            ...correctToneLessRadio,

            pttHeld:
              false,
          });

        expect(
          result.requiredToneDisplay
        ).toBe(
          "NONE"
        );

        expect(
          result.radioToneDisplay
        ).toBe(
          "OFF"
        );

        expect(
          result.tone
        ).toBe(
          "MATCH"
        );

        expect(
          result.accessStatus
        ).toBe(
          "READY"
        );
      }
    );

    it(
      "tone-less repeater becomes ACTIVE during correct PTT",
      () => {
        const result =
          evaluateFrostStatus({
            ...correctToneLessRadio,

            pttHeld:
              true,
          });

        expect(
          result.accessStatus
        ).toBe(
          "ACCESS GRANTED"
        );

        expect(
          result.repeaterTx
        ).toBe(
          "ACTIVE"
        );
      }
    );

    it(
      "tone-less repeater rejects unnecessary programmed tone",
      () => {
        const before =
          evaluateFrostStatus({
            ...correctToneLessRadio,

            txCtcssHz:
              100.0,

            pttHeld:
              false,
          });

        expect(
          before.tone
        ).toBe(
          "NO MATCH"
        );

        expect(
          before.accessStatus
        ).toBe(
          "NOT READY"
        );

        const during =
          evaluateFrostStatus({
            ...correctToneLessRadio,

            txCtcssHz:
              100.0,

            pttHeld:
              true,
          });

        expect(
          during.accessStatus
        ).toBe(
          "WRONG TONE"
        );

        expect(
          during.repeaterTx
        ).toBe(
          "OFF"
        );
      }
    );
  }
);

/* =========================================================
   FOCUSED MALFORMED CONFIGURATION TESTS
========================================================= */

describe(
  "Fr.O.S.T malformed repeater behavior",
  () => {

    it(
      "null repeater object fails safely",
      () => {
        const result =
          evaluateFrostStatus({
            ...correctMinusRadio,

            repeater:
              null,

            pttHeld:
              false,
          });

        expect(
          result.configurationValid
        ).toBe(
          false
        );

        expect(
          result.frequency
        ).toBe(
          "NO MATCH"
        );

        expect(
          result.offset
        ).toBe(
          "NO MATCH"
        );

        expect(
          result.shift
        ).toBe(
          "NO MATCH"
        );

        expect(
          result.tone
        ).toBe(
          "NO MATCH"
        );

        expect(
          result.accessStatus
        ).toBe(
          "NOT READY"
        );

        expect(
          result.error
        ).toBe(
          "REPEATER CONFIGURATION INCOMPLETE"
        );

        assertInvalidConfigurationInvariant(
          result
        );
      }
    );

    it(
      "negative repeater offset is invalid",
      () => {
        const malformed = {
          ...correctMinusRepeater,

          offsetHz:
            -600_000,
        };

        const result =
          evaluateFrostStatus({
            ...correctMinusRadio,

            repeater:
              malformed,
          });

        expect(
          result.configurationValid
        ).toBe(
          false
        );

        expect(
          result.offset
        ).toBe(
          "NO MATCH"
        );

        expect(
          result.accessStatus
        ).toBe(
          "NOT READY"
        );

        expect(
          result.repeaterTx
        ).toBe(
          "OFF"
        );
      }
    );

    it(
      "NaN repeater input is invalid",
      () => {
        const malformed = {
          ...correctMinusRepeater,

          inputFrequencyHz:
            Number.NaN,
        };

        const result =
          evaluateFrostStatus({
            ...correctMinusRadio,

            repeater:
              malformed,
          });

        expect(
          result.configurationValid
        ).toBe(
          false
        );

        expect(
          result.frequency
        ).toBe(
          "NO MATCH"
        );

        expect(
          result.accessStatus
        ).toBe(
          "NOT READY"
        );
      }
    );

    it(
      "invalid shift string is rejected",
      () => {
        const malformed = {
          ...correctMinusRepeater,

          shiftDirection:
            "SIDEWAYS",
        } as unknown as RepeaterDefinition;

        const result =
          evaluateFrostStatus({
            ...correctMinusRadio,

            repeater:
              malformed,
          });

        expect(
          result.configurationValid
        ).toBe(
          false
        );

        expect(
          result.shift
        ).toBe(
          "NO MATCH"
        );

        expect(
          result.error
        ).toBe(
          "REPEATER CONFIGURATION INCOMPLETE"
        );
      }
    );
  }
);

/* =========================================================
   FOCUSED STATUS SEQUENCE TESTS
========================================================= */

describe(
  "Fr.O.S.T exact PTT status sequences",
  () => {

    it(
      "correct radio follows READY -> ACCESS GRANTED -> READY",
      () => {
        const results =
          [
            false,
            true,
            false,
          ].map(
            pttHeld =>
              evaluateFrostStatus({
                ...correctMinusRadio,

                pttHeld,
              })
          );

        expect(
          results.map(
            result =>
              result.accessStatus
          )
        ).toEqual([
          "READY",
          "ACCESS GRANTED",
          "READY",
        ]);
      }
    );

    it(
      "wrong frequency follows NOT READY -> WRONG FREQUENCY -> NOT READY",
      () => {
        const base:
          FrostEvaluationInput = {
          ...correctMinusRadio,

          txFrequencyHz:
            146_520_000,
        };

        const results =
          [
            false,
            true,
            false,
          ].map(
            pttHeld =>
              evaluateFrostStatus({
                ...base,

                pttHeld,
              })
          );

        expect(
          results.map(
            result =>
              result.accessStatus
          )
        ).toEqual([
          "NOT READY",
          "WRONG FREQUENCY",
          "NOT READY",
        ]);
      }
    );

    it(
      "wrong offset follows NOT READY -> WRONG OFFSET -> NOT READY",
      () => {
        const base:
          FrostEvaluationInput = {
          ...correctMinusRadio,

          offsetHz:
            5_000_000,
        };

        const results =
          [
            false,
            true,
            false,
          ].map(
            pttHeld =>
              evaluateFrostStatus({
                ...base,

                pttHeld,
              })
          );

        expect(
          results.map(
            result =>
              result.accessStatus
          )
        ).toEqual([
          "NOT READY",
          "WRONG OFFSET",
          "NOT READY",
        ]);
      }
    );

    it(
      "wrong shift follows NOT READY -> WRONG SHIFT -> NOT READY",
      () => {
        const base:
          FrostEvaluationInput = {
          ...correctMinusRadio,

          shiftDirection:
            "PLUS",
        };

        const results =
          [
            false,
            true,
            false,
          ].map(
            pttHeld =>
              evaluateFrostStatus({
                ...base,

                pttHeld,
              })
          );

        expect(
          results.map(
            result =>
              result.accessStatus
          )
        ).toEqual([
          "NOT READY",
          "WRONG SHIFT",
          "NOT READY",
        ]);
      }
    );

    it(
      "wrong tone follows NOT READY -> WRONG TONE -> NOT READY",
      () => {
        const base:
          FrostEvaluationInput = {
          ...correctMinusRadio,

          txCtcssHz:
            103.5,
        };

        const results =
          [
            false,
            true,
            false,
          ].map(
            pttHeld =>
              evaluateFrostStatus({
                ...base,

                pttHeld,
              })
          );

        expect(
          results.map(
            result =>
              result.accessStatus
          )
        ).toEqual([
          "NOT READY",
          "WRONG TONE",
          "NOT READY",
        ]);
      }
    );

    it(
      "PTT does not change Fr.O.S.T match results",
      () => {
        const released =
          evaluateFrostStatus({
            ...correctMinusRadio,

            pttHeld:
              false,
          });

        const pressed =
          evaluateFrostStatus({
            ...correctMinusRadio,

            pttHeld:
              true,
          });

        expect(
          pressed.frequency
        ).toBe(
          released.frequency
        );

        expect(
          pressed.offset
        ).toBe(
          released.offset
        );

        expect(
          pressed.shift
        ).toBe(
          released.shift
        );

        expect(
          pressed.tone
        ).toBe(
          released.tone
        );

        expect(
          pressed.programmingConsistency
        ).toBe(
          released.programmingConsistency
        );

        expect(
          released.accessStatus
        ).toBe(
          "READY"
        );

        expect(
          pressed.accessStatus
        ).toBe(
          "ACCESS GRANTED"
        );
      }
    );
  }
);

/* =========================================================
   GLOBAL INVARIANTS
========================================================= */

describe(
  "Fr.O.S.T global invariants",
  () => {

    it(
      "Repeater TX ACTIVE requires PTT and all Fr.O.S.T checks",
      () => {
        const scenarios:
          FrostEvaluationInput[] = [
          {
            ...correctMinusRadio,

            pttHeld:
              true,
          },

          {
            ...correctMinusRadio,

            txFrequencyHz:
              146_520_000,

            pttHeld:
              true,
          },

          {
            ...correctMinusRadio,

            offsetHz:
              5_000_000,

            pttHeld:
              true,
          },

          {
            ...correctMinusRadio,

            shiftDirection:
              "PLUS",

            pttHeld:
              true,
          },

          {
            ...correctMinusRadio,

            txCtcssHz:
              103.5,

            pttHeld:
              true,
          },
        ];

        scenarios.forEach(
          input => {
            const result =
              evaluateFrostStatus(
                input
              );

            assertRepeaterTxInvariant(
              input,
              result
            );
          }
        );
      }
    );

    it(
      "invalid repeater definitions never produce READY or ACCESS GRANTED",
      () => {
        const malformed = [
          {
            ...correctMinusRepeater,

            inputFrequencyHz:
              null,
          },

          {
            ...correctMinusRepeater,

            outputFrequencyHz:
              null,
          },

          {
            ...correctMinusRepeater,

            offsetHz:
              null,
          },

          {
            ...correctMinusRepeater,

            shiftDirection:
              null,
          },
        ];

        malformed.forEach(
          repeater => {
            [
              false,
              true,
            ].forEach(
              pttHeld => {
                const result =
                  evaluateFrostStatus({
                    ...correctMinusRadio,

                    repeater:
                      repeater as unknown as RepeaterDefinition,

                    pttHeld,
                  });

                assertInvalidConfigurationInvariant(
                  result
                );
              }
            );
          }
        );
      }
    );
  }
);