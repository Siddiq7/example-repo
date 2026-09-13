import type {
  EditableMenuKind,
  MainMenuId,
  MemoryChannel,
  OperatingMode,
  RadioEvent,
  RadioState,
  ShiftDirection,
  VFOState,
} from "../models/radio";

const REQUIRED_FREQUENCY_DIGITS = 6;
const REQUIRED_OFFSET_DIGITS = 6;

const MAX_OFFSET_HZ = 69_990_000;

const MIN_MEMORY_CHANNEL = 1;
const MAX_MEMORY_CHANNEL = 64;

/* =========================================
   MAIN MENUS
========================================= */

export interface MainMenuItem {
  id: MainMenuId;
  label: string;
}

export const VFO_MAIN_MENU_ITEMS: MainMenuItem[] = [
  { id: "SCAN", label: "Scan" },
  { id: "RADIO_SETTING", label: "Radio Setting" },
  { id: "PROGRAM_CHANNEL", label: "Program Channel" },
  { id: "RADIO_INFORMATION", label: "Radio Info" },
  { id: "GNSS", label: "GNSS" },
  { id: "NOAA_WEATHER", label: "NOAA Weather" },
];

export const MR_MAIN_MENU_ITEMS: MainMenuItem[] = [
  { id: "ZONE", label: "Zone" },
  { id: "SCAN", label: "Scan" },
  { id: "RADIO_SETTING", label: "Radio Setting" },
  { id: "PROGRAM_CHANNEL", label: "Program Channel" },
  { id: "RADIO_INFORMATION", label: "Radio Info" },
  { id: "GNSS", label: "GNSS" },
  { id: "NOAA_WEATHER", label: "NOAA Weather" },
];

export function getMainMenuItems(
  mode: OperatingMode
): MainMenuItem[] {
  return mode === "MR"
    ? MR_MAIN_MENU_ITEMS
    : VFO_MAIN_MENU_ITEMS;
}

/* =========================================
   SECTION MENUS
========================================= */

export interface SectionMenuItem {
  number: number;
  label: string;
  editable?: EditableMenuKind;
}

export const ZONE_ITEMS: SectionMenuItem[] = [
  { number: 1, label: "Zone01" },
];

export const SCAN_ITEMS: SectionMenuItem[] = [
  { number: 1, label: "Freq Range" },
  { number: 2, label: "Chan Range" },
  { number: 3, label: "Scan Mode" },
  { number: 4, label: "Scan Sub-Code" },
  { number: 5, label: "Scan Memory" },
];

export const RADIO_SETTING_ITEMS: SectionMenuItem[] = [
  { number: 1, label: "Squelch" },
  { number: 2, label: "Power Save" },
  { number: 3, label: "TX Power" },
  { number: 4, label: "VOX" },
  { number: 5, label: "Bandwidth" },
  { number: 6, label: "Step" },
  { number: 7, label: "Beep" },
  { number: 8, label: "TOT" },
  { number: 9, label: "Roger" },
  { number: 10, label: "Radio Setting" },
  { number: 11, label: "Display" },
  { number: 12, label: "Backlight" },
  { number: 13, label: "Voice" },
  { number: 14, label: "Language" },
  { number: 15, label: "DTMF" },
  { number: 16, label: "PTT-ID" },
  { number: 17, label: "PTT Delay" },
  { number: 18, label: "Dual Watch" },
  { number: 19, label: "MDF-A" },
  { number: 20, label: "MDF-B" },
  { number: 21, label: "Busy Lockout" },
  { number: 22, label: "Auto Lock" },
  { number: 23, label: "Alarm" },
  { number: 24, label: "SK1 Press" },
  { number: 25, label: "SK1 Long" },
  { number: 26, label: "SK2 Press" },
  { number: 27, label: "SK2 Long" },
  { number: 28, label: "Power Message" },
  { number: 29, label: "Display Direction" },
  { number: 30, label: "FM Radio" },
  { number: 31, label: "Radio Interrupt" },
  { number: 32, label: "APO" },
  { number: 33, label: "Password" },
  { number: 34, label: "Reset" },
];

export const PROGRAM_CHANNEL_ITEMS: SectionMenuItem[] = [
  { number: 1, label: "RX Frequency" },
  { number: 2, label: "TX Frequency" },
  { number: 3, label: "Trans Power" },
  { number: 4, label: "Bandwidth" },
  { number: 5, label: "RX CTCSS" },
  { number: 6, label: "RX DCS" },

  {
    number: 7,
    label: "TX CTCSS",
    editable: "TX_CTCSS",
  },

  { number: 8, label: "TX DCS" },
  { number: 9, label: "Signaling" },
  { number: 10, label: "SP-Mute" },
  { number: 11, label: "Busy Lockout" },
  { number: 12, label: "Step" },

  {
    number: 13,
    label: "Offset",
    editable: "OFFSET",
  },

  {
    number: 14,
    label: "Direction",
    editable: "SHIFT_DIRECTION",
  },

  { number: 15, label: "Skip Freq" },

  {
    number: 16,
    label: "CH Memory",
    editable: "CH_MEMORY",
  },
];

export const RADIO_INFORMATION_ITEMS: SectionMenuItem[] = [
  { number: 1, label: "Versions" },
  { number: 2, label: "My Radio" },
];

export const GNSS_ITEMS: SectionMenuItem[] = [
  { number: 1, label: "GNSS On/Off" },
  { number: 2, label: "GPS Info" },
  { number: 3, label: "Time Zone" },
];

export const NOAA_ITEMS: SectionMenuItem[] = [
  { number: 1, label: "Weather On/Off" },
  { number: 2, label: "Weather Alert" },
];

export function getSectionItems(
  section: MainMenuId | null
): SectionMenuItem[] {
  switch (section) {
    case "ZONE":
      return ZONE_ITEMS;

    case "SCAN":
      return SCAN_ITEMS;

    case "RADIO_SETTING":
      return RADIO_SETTING_ITEMS;

    case "PROGRAM_CHANNEL":
      return PROGRAM_CHANNEL_ITEMS;

    case "RADIO_INFORMATION":
      return RADIO_INFORMATION_ITEMS;

    case "GNSS":
      return GNSS_ITEMS;

    case "NOAA_WEATHER":
      return NOAA_ITEMS;

    default:
      return [];
  }
}

export function getSectionLabel(
  section: MainMenuId | null
): string {
  if (section === "ZONE") {
    return "Zone";
  }

  const all = [
    ...VFO_MAIN_MENU_ITEMS,
    ...MR_MAIN_MENU_ITEMS,
  ];

  return (
    all.find(
      item =>
        item.id === section
    )?.label ?? ""
  );
}

export function getSelectedSectionItem(
  state: RadioState
): SectionMenuItem | undefined {
  return getSectionItems(
    state.menu.section
  ).find(
    item =>
      item.number ===
      state.menu.selectedItemNumber
  );
}

/* =========================================
   CTCSS
========================================= */

export const CTCSS_TONES: Array<number | null> = [
  null,
  67.0,
  69.3,
  71.9,
  74.4,
  77.0,
  79.7,
  82.5,
  85.4,
  88.5,
  91.5,
  94.8,
  97.4,
  100.0,
  103.5,
  107.2,
  110.9,
  114.8,
  118.8,
  123.0,
  127.3,
  131.8,
  136.5,
  141.3,
  146.2,
  151.4,
  156.7,
  159.8,
  162.2,
  165.5,
  167.9,
  171.3,
  173.8,
  177.3,
  179.9,
  183.5,
  186.2,
  189.9,
  192.8,
  196.6,
  199.5,
  203.5,
  206.5,
  210.7,
  218.1,
  225.7,
  229.1,
  233.6,
  241.8,
  250.3,
  254.1,
];

const SHIFT_VALUES: ShiftDirection[] = [
  "OFF",
  "PLUS",
  "MINUS",
];

/* =========================================
   TX CALCULATION
========================================= */

export function calculateTransmitFrequency(
  rxVfo: VFOState
): number {
  if (
    rxVfo.shiftDirection ===
    "PLUS"
  ) {
    return (
      rxVfo.frequencyHz +
      rxVfo.offsetHz
    );
  }

  if (
    rxVfo.shiftDirection ===
    "MINUS"
  ) {
    return (
      rxVfo.frequencyHz -
      rxVfo.offsetHz
    );
  }

  return rxVfo.frequencyHz;
}

/*
  IMPORTANT:

  This function is ONLY used when
  the operator intentionally changes
  repeater settings such as:

  - offset
  - shift direction

  Direct keypad entry into A does
  NOT call this anymore.
*/

function syncTransmitVfoFromRepeaterSettings(
  state: RadioState
): RadioState {
  return {
    ...state,

    vfoB: {
      ...state.vfoB,

      frequencyHz:
        calculateTransmitFrequency(
          state.vfoA
        ),

      shiftDirection:
        state.vfoA
          .shiftDirection,

      offsetHz:
        state.vfoA
          .offsetHz,

      txCtcssHz:
        state.vfoA
          .txCtcssHz,
    },
  };
}

export function getActiveVfo(
  state: RadioState
): VFOState {
  return state.selectedVfo ===
    "A"
    ? state.vfoA
    : state.vfoB;
}

export function getSelectedMemoryChannel(
  state: RadioState
): MemoryChannel | null {
  return (
    state.memories[
      state.selectedMemoryChannel
    ] ?? null
  );
}

export function getCurrentReceiveFrequency(
  state: RadioState
): number | null {
  if (
    state.operatingMode ===
    "MR"
  ) {
    return (
      getSelectedMemoryChannel(
        state
      )?.rxFrequencyHz ??
      null
    );
  }

  return state.vfoA
    .frequencyHz;
}

export function getCurrentTransmitFrequency(
  state: RadioState
): number | null {
  if (
    state.operatingMode ===
    "MR"
  ) {
    return (
      getSelectedMemoryChannel(
        state
      )?.txFrequencyHz ??
      null
    );
  }

  return state.vfoB
    .frequencyHz;
}

export function getCurrentTransmitTone(
  state: RadioState
): number | null {
  if (
    state.operatingMode ===
    "MR"
  ) {
    return (
      getSelectedMemoryChannel(
        state
      )?.txCtcssHz ??
      null
    );
  }

  return state.vfoB
    .txCtcssHz;
}

/* =========================================
   DIRECT VFO ENTRY

   A changes A only.
   B changes B only.
========================================= */

function updateSelectedVfoFrequency(
  state: RadioState,
  frequencyHz: number
): RadioState {
  if (
    state.selectedVfo ===
    "A"
  ) {
    /*
      THIS IS THE IMPORTANT FIX.

      Do not calculate or touch B
      when manually programming A.
    */

    return {
      ...state,

      vfoA: {
        ...state.vfoA,

        frequencyHz,
      },
    };
  }

  /*
    B selected.

    Change B only.
  */

  return {
    ...state,

    vfoB: {
      ...state.vfoB,

      frequencyHz,
    },
  };
}

function isFrequencyAllowed(
  frequencyHz: number
): boolean {
  const vhf =
    frequencyHz >=
      136_000_000 &&
    frequencyHz <=
      174_000_000;

  const uhf =
    frequencyHz >=
      400_000_000 &&
    frequencyHz <=
      520_000_000;

  return vhf || uhf;
}

function digitsToFrequencyHz(
  digits: string
): number {
  return (
    Number(digits) *
    1_000
  );
}

/* =========================================
   MEMORY
========================================= */

function nextMemoryChannel(
  channel: number,
  direction: 1 | -1
): number {
  let next =
    channel + direction;

  if (
    next >
    MAX_MEMORY_CHANNEL
  ) {
    next =
      MIN_MEMORY_CHANNEL;
  }

  if (
    next <
    MIN_MEMORY_CHANNEL
  ) {
    next =
      MAX_MEMORY_CHANNEL;
  }

  return next;
}

/* =========================================
   EDIT HELPERS
========================================= */

function cycleCtcss(
  current: number | null,
  direction: 1 | -1
): number | null {
  let index =
    CTCSS_TONES.findIndex(
      tone =>
        tone === current
    );

  if (
    index < 0
  ) {
    index = 0;
  }

  let next =
    index + direction;

  if (
    next >=
    CTCSS_TONES.length
  ) {
    next = 0;
  }

  if (
    next < 0
  ) {
    next =
      CTCSS_TONES.length -
      1;
  }

  return CTCSS_TONES[next];
}

function cycleShift(
  current: ShiftDirection,
  direction: 1 | -1
): ShiftDirection {
  let index =
    SHIFT_VALUES.indexOf(
      current
    );

  let next =
    index + direction;

  if (
    next >=
    SHIFT_VALUES.length
  ) {
    next = 0;
  }

  if (
    next < 0
  ) {
    next =
      SHIFT_VALUES.length -
      1;
  }

  return SHIFT_VALUES[next];
}

function clearEditState() {
  return {
    kind:
      null as EditableMenuKind | null,

    pendingToneHz:
      null as number | null,

    pendingShiftDirection:
      null as ShiftDirection | null,

    pendingOffsetHz:
      null as number | null,

    offsetEntryBuffer:
      "",

    pendingMemoryChannel:
      null as number | null,

    memoryChannelEntryBuffer:
      "",
  };
}

function openEditMode(
  state: RadioState,
  item: SectionMenuItem
): RadioState {
  return {
    ...state,

    menu: {
      ...state.menu,

      mode:
        "EDIT",

      shortcutBuffer:
        "",

      message:
        null,

      edit: {
        kind:
          item.editable ??
          null,

        pendingToneHz:
          state.vfoB
            .txCtcssHz,

        pendingShiftDirection:
          state.vfoA
            .shiftDirection,

        pendingOffsetHz:
          state.vfoA
            .offsetHz,

        offsetEntryBuffer:
          "",

        pendingMemoryChannel:
          state.selectedMemoryChannel,

        memoryChannelEntryBuffer:
          "",
      },
    },
  };
}

/* =========================================
   CONFIRM EDIT
========================================= */

function confirmEdit(
  state: RadioState
): RadioState {
  const edit =
    state.menu.edit;

  /* =====================================
     TX CTCSS

     Tone belongs to TX / B.
  ===================================== */

  if (
    edit.kind ===
    "TX_CTCSS"
  ) {
    return {
      ...state,

      vfoA: {
        ...state.vfoA,

        /*
          Keep a matching copy
          because some existing menu
          logic uses A as repeater
          configuration storage.
        */

        txCtcssHz:
          edit.pendingToneHz,
      },

      vfoB: {
        ...state.vfoB,

        txCtcssHz:
          edit.pendingToneHz,
      },

      menu: {
        ...state.menu,

        mode:
          "SECTION",

        edit:
          clearEditState(),

        shortcutBuffer:
          "",

        message:
          "SAVED",
      },
    };
  }

  /* =====================================
     SHIFT DIRECTION

     Intentional repeater operation:
     changing direction recalculates B.
  ===================================== */

  if (
    edit.kind ===
    "SHIFT_DIRECTION"
  ) {
    if (
      edit.pendingShiftDirection ===
      null
    ) {
      return state;
    }

    const updated:
      RadioState = {
      ...state,

      vfoA: {
        ...state.vfoA,

        shiftDirection:
          edit.pendingShiftDirection,
      },
    };

    const synchronized =
      syncTransmitVfoFromRepeaterSettings(
        updated
      );

    return {
      ...synchronized,

      menu: {
        ...synchronized.menu,

        mode:
          "SECTION",

        edit:
          clearEditState(),

        shortcutBuffer:
          "",

        message:
          "SAVED",
      },
    };
  }

  /* =====================================
     OFFSET

     Intentional repeater operation:
     changing offset recalculates B.
  ===================================== */

  if (
    edit.kind ===
    "OFFSET"
  ) {
    if (
      edit.offsetEntryBuffer.length >
        0 &&
      edit.offsetEntryBuffer.length <
        REQUIRED_OFFSET_DIGITS
    ) {
      return {
        ...state,

        menu: {
          ...state.menu,

          message:
            "ENTER 6 DIGITS",
        },
      };
    }

    const updated:
      RadioState = {
      ...state,

      vfoA: {
        ...state.vfoA,

        offsetHz:
          edit.pendingOffsetHz ??
          state.vfoA
            .offsetHz,
      },
    };

    const synchronized =
      syncTransmitVfoFromRepeaterSettings(
        updated
      );

    return {
      ...synchronized,

      menu: {
        ...synchronized.menu,

        mode:
          "SECTION",

        edit:
          clearEditState(),

        shortcutBuffer:
          "",

        message:
          "SAVED",
      },
    };
  }

  /* =====================================
     CH MEMORY

     Save exactly what is in A and B.
  ===================================== */

  if (
    edit.kind ===
    "CH_MEMORY"
  ) {
    const channel =
      edit.pendingMemoryChannel;

    if (
      channel === null ||
      channel <
        MIN_MEMORY_CHANNEL ||
      channel >
        MAX_MEMORY_CHANNEL
    ) {
      return {
        ...state,

        menu: {
          ...state.menu,

          message:
            "INVALID CHANNEL",
        },
      };
    }

    const memory:
      MemoryChannel = {
      channelNumber:
        channel,

      rxFrequencyHz:
        state.vfoA
          .frequencyHz,

      txFrequencyHz:
        state.vfoB
          .frequencyHz,

      shiftDirection:
        state.vfoA
          .shiftDirection,

      offsetHz:
        state.vfoA
          .offsetHz,

      txCtcssHz:
        state.vfoB
          .txCtcssHz,
    };

    return {
      ...state,

      memories: {
        ...state.memories,

        [channel]:
          memory,
      },

      selectedMemoryChannel:
        channel,

      selectedVfo:
        "A",

      menu: {
        ...state.menu,

        mode:
          "SECTION",

        edit:
          clearEditState(),

        shortcutBuffer:
          "",

        message:
          `SAVED CH ${channel
            .toString()
            .padStart(
              2,
              "0"
            )}`,
      },
    };
  }

  return state;
}

/* =========================================
   REDUCER
========================================= */

export function radioReducer(
  state: RadioState,
  event: RadioEvent
): RadioState {
  switch (
    event.type
  ) {

    /* =====================================
       PTT
    ===================================== */

    case "PTT_DOWN": {
      if (
        state.menu.mode !==
        "CLOSED"
      ) {
        return state;
      }

      const tx =
        getCurrentTransmitFrequency(
          state
        );

      if (
        tx === null
      ) {
        return {
          ...state,

          radioActivity:
            "RX",

          lastError:
            "NO CHANNEL",
        };
      }

      return {
        ...state,

        radioActivity:
          "TX",

        selectedVfo:
          "B",

        lastError:
          null,
      };
    }

    case "PTT_UP": {
      return {
        ...state,

        radioActivity:
          "RX",

        selectedVfo:
          "A",
      };
    }

    /* =====================================
       VFO / MR
    ===================================== */

    case "VFO_MR_PRESSED": {
      if (
        state.menu.mode !==
          "CLOSED" ||
        state.radioActivity ===
          "TX"
      ) {
        return state;
      }

      const nextMode:
        OperatingMode =
        state.operatingMode ===
        "VFO"
          ? "MR"
          : "VFO";

      return {
        ...state,

        operatingMode:
          nextMode,

        selectedVfo:
          "A",

        radioActivity:
          "RX",

        frequencyEntry: {
          buffer:
            "",

          targetVfo:
            null,
        },

        memoryRecallBuffer:
          "",

        menu: {
          ...state.menu,

          mainSelectedIndex:
            0,

          section:
            null,

          shortcutBuffer:
            "",

          message:
            null,
        },

        lastError:
          null,
      };
    }

    /* =====================================
       A/B
    ===================================== */

    case "TOGGLE_VFO": {
      if (
        state.menu.mode !==
          "CLOSED" ||
        state.operatingMode !==
          "VFO" ||
        state.radioActivity ===
          "TX"
      ) {
        return state;
      }

      return {
        ...state,

        selectedVfo:
          state.selectedVfo ===
          "A"
            ? "B"
            : "A",

        frequencyEntry: {
          buffer:
            "",

          targetVfo:
            null,
        },

        lastError:
          null,
      };
    }

    case "SELECT_VFO": {
      if (
        state.radioActivity ===
        "TX"
      ) {
        return state;
      }

      return {
        ...state,

        selectedVfo:
          event.vfo,

        frequencyEntry: {
          buffer:
            "",

          targetVfo:
            null,
        },
      };
    }

    /* =====================================
       KEYPAD
    ===================================== */

    case "KEYPAD_DIGIT": {
      if (
        state.radioActivity ===
        "TX"
      ) {
        return state;
      }

      /* MAIN MENU */

      if (
        state.menu.mode ===
        "MAIN"
      ) {
        const items =
          getMainMenuItems(
            state.operatingMode
          );

        const number =
          Number(
            event.digit
          );

        if (
          number >= 1 &&
          number <=
            items.length
        ) {
          return {
            ...state,

            menu: {
              ...state.menu,

              mainSelectedIndex:
                number -
                1,

              message:
                null,
            },
          };
        }

        return state;
      }

      /* SECTION SHORTCUT */

      if (
        state.menu.mode ===
        "SECTION"
      ) {
        const items =
          getSectionItems(
            state.menu.section
          );

        const previous =
          state.menu
            .shortcutBuffer;

        const buffer =
          previous.length >=
          2
            ? event.digit
            : previous +
              event.digit;

        const number =
          Number(buffer);

        const found =
          items.find(
            item =>
              item.number ===
              number
          );

        return {
          ...state,

          menu: {
            ...state.menu,

            shortcutBuffer:
              buffer,

            selectedItemNumber:
              found
                ? found.number
                : state.menu
                    .selectedItemNumber,

            message:
              found
                ? null
                : state.menu
                    .message,
          },
        };
      }

      /* OFFSET ENTRY */

      if (
        state.menu.mode ===
          "EDIT" &&
        state.menu.edit.kind ===
          "OFFSET"
      ) {
        const previous =
          state.menu.edit
            .offsetEntryBuffer;

        const buffer =
          previous.length >=
          REQUIRED_OFFSET_DIGITS
            ? event.digit
            : previous +
              event.digit;

        let pending =
          state.menu.edit
            .pendingOffsetHz;

        let message:
          string | null =
          null;

        if (
          buffer.length ===
          REQUIRED_OFFSET_DIGITS
        ) {
          const value =
            Number(buffer) *
            1_000;

          if (
            value >
            MAX_OFFSET_HZ
          ) {
            message =
              "INVALID OFFSET";
          } else {
            pending =
              value;
          }
        }

        return {
          ...state,

          menu: {
            ...state.menu,

            message,

            edit: {
              ...state.menu.edit,

              offsetEntryBuffer:
                buffer,

              pendingOffsetHz:
                pending,
            },
          },
        };
      }

      /* MEMORY SLOT */

      if (
        state.menu.mode ===
          "EDIT" &&
        state.menu.edit.kind ===
          "CH_MEMORY"
      ) {
        const previous =
          state.menu.edit
            .memoryChannelEntryBuffer;

        const buffer =
          previous.length >=
          2
            ? event.digit
            : previous +
              event.digit;

        const number =
          Number(buffer);

        return {
          ...state,

          menu: {
            ...state.menu,

            edit: {
              ...state.menu.edit,

              memoryChannelEntryBuffer:
                buffer,

              pendingMemoryChannel:
                number >=
                  MIN_MEMORY_CHANNEL &&
                number <=
                  MAX_MEMORY_CHANNEL
                  ? number
                  : state.menu.edit
                      .pendingMemoryChannel,
            },
          },
        };
      }

      /* SHIFT ENTRY */

      if (
        state.menu.mode ===
          "EDIT" &&
        state.menu.edit.kind ===
          "SHIFT_DIRECTION"
      ) {
        let direction:
          ShiftDirection | null =
          null;

        if (
          event.digit ===
          "0"
        ) {
          direction =
            "OFF";
        }

        if (
          event.digit ===
          "1"
        ) {
          direction =
            "PLUS";
        }

        if (
          event.digit ===
          "2"
        ) {
          direction =
            "MINUS";
        }

        if (
          direction ===
          null
        ) {
          return state;
        }

        return {
          ...state,

          menu: {
            ...state.menu,

            edit: {
              ...state.menu.edit,

              pendingShiftDirection:
                direction,
            },
          },
        };
      }

      if (
        state.menu.mode ===
        "EDIT"
      ) {
        return state;
      }

      /* MR CHANNEL ENTRY */

      if (
        state.operatingMode ===
        "MR"
      ) {
        const previous =
          state.memoryRecallBuffer;

        const buffer =
          previous.length >=
          2
            ? event.digit
            : previous +
              event.digit;

        const channel =
          Number(buffer);

        if (
          buffer.length ===
            2 &&
          channel >=
            MIN_MEMORY_CHANNEL &&
          channel <=
            MAX_MEMORY_CHANNEL
        ) {
          return {
            ...state,

            selectedMemoryChannel:
              channel,

            selectedVfo:
              "A",

            memoryRecallBuffer:
              buffer,

            lastError:
              null,
          };
        }

        return {
          ...state,

          memoryRecallBuffer:
            buffer,
        };
      }

      /* =================================
         VFO FREQUENCY ENTRY

         The selected VFO remains
         completely independent.

         A entry never modifies B.
         B entry never modifies A.
      ================================= */

      const previous =
        state.frequencyEntry
          .buffer;

      const startingNewEntry =
        previous.length ===
          0 ||
        previous.length >=
          REQUIRED_FREQUENCY_DIGITS;

      const existing =
        startingNewEntry
          ? ""
          : previous;

      const target =
        startingNewEntry
          ? state.selectedVfo
          : state.frequencyEntry
              .targetVfo ??
            state.selectedVfo;

      const buffer =
        existing +
        event.digit;

      if (
        buffer.length <
        REQUIRED_FREQUENCY_DIGITS
      ) {
        return {
          ...state,

          frequencyEntry: {
            buffer,

            targetVfo:
              target,
          },

          lastError:
            null,
        };
      }

      const frequencyHz =
        digitsToFrequencyHz(
          buffer
        );

      if (
        !isFrequencyAllowed(
          frequencyHz
        )
      ) {
        return {
          ...state,

          frequencyEntry: {
            buffer,

            targetVfo:
              target,
          },

          lastError:
            "INVALID FREQUENCY",
        };
      }

      const targetState:
        RadioState = {
        ...state,

        selectedVfo:
          target,
      };

      const updated =
        updateSelectedVfoFrequency(
          targetState,
          frequencyHz
        );

      return {
        ...updated,

        frequencyEntry: {
          buffer,

          targetVfo:
            target,
        },

        lastError:
          null,
      };
    }

    /* =====================================
       MENU
    ===================================== */

    case "MENU_PRESSED": {
      if (
        state.radioActivity ===
        "TX"
      ) {
        return state;
      }

      if (
        state.menu.mode ===
        "CLOSED"
      ) {
        return {
          ...state,

          frequencyEntry: {
            buffer:
              "",
            targetVfo:
              null,
          },

          memoryRecallBuffer:
            "",

          menu: {
            ...state.menu,

            mode:
              "MAIN",

            mainSelectedIndex:
              0,

            section:
              null,

            shortcutBuffer:
              "",

            message:
              null,
          },
        };
      }

      if (
        state.menu.mode ===
        "MAIN"
      ) {
        const items =
          getMainMenuItems(
            state.operatingMode
          );

        const selected =
          items[
            state.menu
              .mainSelectedIndex
          ];

        if (
          !selected
        ) {
          return state;
        }

        const sectionItems =
          getSectionItems(
            selected.id
          );

        return {
          ...state,

          menu: {
            ...state.menu,

            mode:
              "SECTION",

            section:
              selected.id,

            selectedItemNumber:
              sectionItems[0]
                ?.number ??
              1,

            shortcutBuffer:
              "",

            message:
              null,
          },
        };
      }

      if (
        state.menu.mode ===
        "SECTION"
      ) {
        const item =
          getSelectedSectionItem(
            state
          );

        if (
          !item
        ) {
          return state;
        }

        if (
          item.editable
        ) {
          return openEditMode(
            state,
            item
          );
        }

        return {
          ...state,

          menu: {
            ...state.menu,

            message:
              `${item.label} - COMING SOON`,
          },
        };
      }

      if (
        state.menu.mode ===
        "EDIT"
      ) {
        return confirmEdit(
          state
        );
      }

      return state;
    }

    /* =====================================
       UP
    ===================================== */

    case "MENU_UP": {
      if (
        state.radioActivity ===
        "TX"
      ) {
        return state;
      }

      if (
        state.menu.mode ===
          "CLOSED" &&
        state.operatingMode ===
          "MR"
      ) {
        return {
          ...state,

          selectedMemoryChannel:
            nextMemoryChannel(
              state.selectedMemoryChannel,
              1
            ),

          selectedVfo:
            "A",

          memoryRecallBuffer:
            "",
        };
      }

      if (
        state.menu.mode ===
        "MAIN"
      ) {
        const items =
          getMainMenuItems(
            state.operatingMode
          );

        const next =
          state.menu
            .mainSelectedIndex <=
          0
            ? items.length -
              1
            : state.menu
                .mainSelectedIndex -
              1;

        return {
          ...state,

          menu: {
            ...state.menu,

            mainSelectedIndex:
              next,

            message:
              null,
          },
        };
      }

      if (
        state.menu.mode ===
        "SECTION"
      ) {
        const items =
          getSectionItems(
            state.menu.section
          );

        if (
          items.length ===
          0
        ) {
          return state;
        }

        const index =
          items.findIndex(
            item =>
              item.number ===
              state.menu
                .selectedItemNumber
          );

        const next =
          index <= 0
            ? items.length -
              1
            : index -
              1;

        return {
          ...state,

          menu: {
            ...state.menu,

            selectedItemNumber:
              items[next]
                .number,

            shortcutBuffer:
              "",

            message:
              null,
          },
        };
      }

      if (
        state.menu.mode ===
          "EDIT" &&
        state.menu.edit.kind ===
          "TX_CTCSS"
      ) {
        return {
          ...state,

          menu: {
            ...state.menu,

            edit: {
              ...state.menu.edit,

              pendingToneHz:
                cycleCtcss(
                  state.menu.edit
                    .pendingToneHz,
                  1
                ),
            },
          },
        };
      }

      if (
        state.menu.mode ===
          "EDIT" &&
        state.menu.edit.kind ===
          "SHIFT_DIRECTION"
      ) {
        return {
          ...state,

          menu: {
            ...state.menu,

            edit: {
              ...state.menu.edit,

              pendingShiftDirection:
                cycleShift(
                  state.menu.edit
                    .pendingShiftDirection ??
                    "OFF",
                  1
                ),
            },
          },
        };
      }

      if (
        state.menu.mode ===
          "EDIT" &&
        state.menu.edit.kind ===
          "OFFSET"
      ) {
        const current =
          state.menu.edit
            .pendingOffsetHz ??
          0;

        return {
          ...state,

          menu: {
            ...state.menu,

            edit: {
              ...state.menu.edit,

              pendingOffsetHz:
                Math.min(
                  MAX_OFFSET_HZ,
                  current +
                    10_000
                ),

              offsetEntryBuffer:
                "",
            },
          },
        };
      }

      if (
        state.menu.mode ===
          "EDIT" &&
        state.menu.edit.kind ===
          "CH_MEMORY"
      ) {
        return {
          ...state,

          menu: {
            ...state.menu,

            edit: {
              ...state.menu.edit,

              pendingMemoryChannel:
                nextMemoryChannel(
                  state.menu.edit
                    .pendingMemoryChannel ??
                    1,
                  1
                ),

              memoryChannelEntryBuffer:
                "",
            },
          },
        };
      }

      return state;
    }

    /* =====================================
       DOWN
    ===================================== */

    case "MENU_DOWN": {
      if (
        state.radioActivity ===
        "TX"
      ) {
        return state;
      }

      if (
        state.menu.mode ===
          "CLOSED" &&
        state.operatingMode ===
          "MR"
      ) {
        return {
          ...state,

          selectedMemoryChannel:
            nextMemoryChannel(
              state.selectedMemoryChannel,
              -1
            ),

          selectedVfo:
            "A",

          memoryRecallBuffer:
            "",
        };
      }

      if (
        state.menu.mode ===
        "MAIN"
      ) {
        const items =
          getMainMenuItems(
            state.operatingMode
          );

        const next =
          state.menu
            .mainSelectedIndex >=
          items.length -
            1
            ? 0
            : state.menu
                .mainSelectedIndex +
              1;

        return {
          ...state,

          menu: {
            ...state.menu,

            mainSelectedIndex:
              next,

            message:
              null,
          },
        };
      }

      if (
        state.menu.mode ===
        "SECTION"
      ) {
        const items =
          getSectionItems(
            state.menu.section
          );

        if (
          items.length ===
          0
        ) {
          return state;
        }

        const index =
          items.findIndex(
            item =>
              item.number ===
              state.menu
                .selectedItemNumber
          );

        const next =
          index >=
          items.length -
            1
            ? 0
            : index +
              1;

        return {
          ...state,

          menu: {
            ...state.menu,

            selectedItemNumber:
              items[next]
                .number,

            shortcutBuffer:
              "",

            message:
              null,
          },
        };
      }

      if (
        state.menu.mode ===
          "EDIT" &&
        state.menu.edit.kind ===
          "TX_CTCSS"
      ) {
        return {
          ...state,

          menu: {
            ...state.menu,

            edit: {
              ...state.menu.edit,

              pendingToneHz:
                cycleCtcss(
                  state.menu.edit
                    .pendingToneHz,
                  -1
                ),
            },
          },
        };
      }

      if (
        state.menu.mode ===
          "EDIT" &&
        state.menu.edit.kind ===
          "SHIFT_DIRECTION"
      ) {
        return {
          ...state,

          menu: {
            ...state.menu,

            edit: {
              ...state.menu.edit,

              pendingShiftDirection:
                cycleShift(
                  state.menu.edit
                    .pendingShiftDirection ??
                    "OFF",
                  -1
                ),
            },
          },
        };
      }

      if (
        state.menu.mode ===
          "EDIT" &&
        state.menu.edit.kind ===
          "OFFSET"
      ) {
        const current =
          state.menu.edit
            .pendingOffsetHz ??
          0;

        return {
          ...state,

          menu: {
            ...state.menu,

            edit: {
              ...state.menu.edit,

              pendingOffsetHz:
                Math.max(
                  0,
                  current -
                    10_000
                ),

              offsetEntryBuffer:
                "",
            },
          },
        };
      }

      if (
        state.menu.mode ===
          "EDIT" &&
        state.menu.edit.kind ===
          "CH_MEMORY"
      ) {
        return {
          ...state,

          menu: {
            ...state.menu,

            edit: {
              ...state.menu.edit,

              pendingMemoryChannel:
                nextMemoryChannel(
                  state.menu.edit
                    .pendingMemoryChannel ??
                    1,
                  -1
                ),

              memoryChannelEntryBuffer:
                "",
            },
          },
        };
      }

      return state;
    }

    /* =====================================
       EXIT
    ===================================== */

    case "EXIT_PRESSED": {
      if (
        state.radioActivity ===
        "TX"
      ) {
        return state;
      }

      if (
        state.menu.mode ===
        "EDIT"
      ) {
        return {
          ...state,

          menu: {
            ...state.menu,

            mode:
              "SECTION",

            edit:
              clearEditState(),

            shortcutBuffer:
              "",

            message:
              null,
          },
        };
      }

      if (
        state.menu.mode ===
        "SECTION"
      ) {
        return {
          ...state,

          menu: {
            ...state.menu,

            mode:
              "MAIN",

            section:
              null,

            shortcutBuffer:
              "",

            message:
              null,
          },
        };
      }

      if (
        state.menu.mode ===
        "MAIN"
      ) {
        return {
          ...state,

          menu: {
            ...state.menu,

            mode:
              "CLOSED",

            mainSelectedIndex:
              0,

            section:
              null,

            shortcutBuffer:
              "",

            message:
              null,
          },
        };
      }

      return {
        ...state,

        frequencyEntry: {
          buffer:
            "",

          targetVfo:
            null,
        },

        memoryRecallBuffer:
          "",

        lastError:
          null,
      };
    }

    default:
      return state;
  }
}