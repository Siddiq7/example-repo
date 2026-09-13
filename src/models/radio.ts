export type VFOSelection = "A" | "B";

export type OperatingMode =
  | "VFO"
  | "MR";

export type RadioActivity =
  | "RX"
  | "TX";

export type NumericDigit =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9";

export type ShiftDirection =
  | "OFF"
  | "PLUS"
  | "MINUS";

export interface VFOState {
  id: VFOSelection;

  frequencyHz: number;

  shiftDirection: ShiftDirection;

  offsetHz: number;

  txCtcssHz: number | null;
}

export interface MemoryChannel {
  channelNumber: number;

  rxFrequencyHz: number;

  txFrequencyHz: number;

  shiftDirection: ShiftDirection;

  offsetHz: number;

  txCtcssHz: number | null;
}

export interface FrequencyEntryState {
  buffer: string;

  targetVfo:
    VFOSelection | null;
}

export type MainMenuId =
  | "ZONE"
  | "SCAN"
  | "RADIO_SETTING"
  | "PROGRAM_CHANNEL"
  | "RADIO_INFORMATION"
  | "GNSS"
  | "NOAA_WEATHER";

export type MenuMode =
  | "CLOSED"
  | "MAIN"
  | "SECTION"
  | "EDIT";

export type EditableMenuKind =
  | "TX_CTCSS"
  | "SHIFT_DIRECTION"
  | "OFFSET"
  | "CH_MEMORY";

export interface MenuEditState {
  kind:
    EditableMenuKind | null;

  pendingToneHz:
    number | null;

  pendingShiftDirection:
    ShiftDirection | null;

  pendingOffsetHz:
    number | null;

  offsetEntryBuffer:
    string;

  pendingMemoryChannel:
    number | null;

  memoryChannelEntryBuffer:
    string;
}

export interface MenuState {
  mode: MenuMode;

  mainSelectedIndex: number;

  section:
    MainMenuId | null;

  selectedItemNumber: number;

  shortcutBuffer: string;

  edit: MenuEditState;

  message:
    string | null;
}

export interface RadioState {
  operatingMode:
    OperatingMode;

  radioActivity:
    RadioActivity;

  selectedVfo:
    VFOSelection;

  /*
    VFO A is always the
    RECEIVE side.

    VFO B is always the
    TRANSMIT side.
  */

  vfoA:
    VFOState;

  vfoB:
    VFOState;

  memories:
    Record<number, MemoryChannel>;

  selectedMemoryChannel:
    number;

  memoryRecallBuffer:
    string;

  frequencyEntry:
    FrequencyEntryState;

  menu:
    MenuState;

  lastError:
    string | null;
}

export type RadioEvent =
  | {
      type: "TOGGLE_VFO";
    }
  | {
      type: "SELECT_VFO";
      vfo: VFOSelection;
    }
  | {
      type: "VFO_MR_PRESSED";
    }
  | {
      type: "PTT_DOWN";
    }
  | {
      type: "PTT_UP";
    }
  | {
      type: "KEYPAD_DIGIT";
      digit: NumericDigit;
    }
  | {
      type: "MENU_PRESSED";
    }
  | {
      type: "MENU_UP";
    }
  | {
      type: "MENU_DOWN";
    }
  | {
      type: "EXIT_PRESSED";
    };

export function createInitialRadioState(): RadioState {
  return {
    operatingMode:
      "VFO",

    radioActivity:
      "RX",

    selectedVfo:
      "A",

    /*
      A = RECEIVE
    */

    vfoA: {
      id: "A",

      frequencyHz:
        146_520_000,

      shiftDirection:
        "OFF",

      offsetHz:
        600_000,

      txCtcssHz:
        null,
    },

    /*
      B = TRANSMIT

      Initial shift is OFF,
      therefore TX = RX.
    */

    vfoB: {
      id: "B",

      frequencyHz:
        146_520_000,

      shiftDirection:
        "OFF",

      offsetHz:
        600_000,

      txCtcssHz:
        null,
    },

    memories: {},

    selectedMemoryChannel:
      1,

    memoryRecallBuffer:
      "",

    frequencyEntry: {
      buffer: "",

      targetVfo:
        null,
    },

    menu: {
      mode:
        "CLOSED",

      mainSelectedIndex:
        0,

      section:
        null,

      selectedItemNumber:
        1,

      shortcutBuffer:
        "",

      edit: {
        kind:
          null,

        pendingToneHz:
          null,

        pendingShiftDirection:
          null,

        pendingOffsetHz:
          null,

        offsetEntryBuffer:
          "",

        pendingMemoryChannel:
          null,

        memoryChannelEntryBuffer:
          "",
      },

      message:
        null,
    },

    lastError:
      null,
  };
}