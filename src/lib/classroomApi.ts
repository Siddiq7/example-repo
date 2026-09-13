const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://tcvobctcwahhzhhwtpun.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_q0gp7l_KNLVxpDf7bEzD8A_76aZhwW1";

async function rpc<T>(
  functionName: string,
  body: Record<string, unknown>
): Promise<T> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/${functionName}`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(
      parsed?.message ??
        parsed?.error ??
        `Classroom request failed (${response.status})`
    );
  }

  return parsed as T;
}

export interface ClassroomRoom {
  id: string;
  room_code: string;
  status: "OPEN" | "CLOSED";
  active_assignment: unknown | null;
  timer_seconds: number;
  expires_at: string;
}

export interface ClassroomParticipant {
  id: string;
  student_name: string;
  class_name: string | null;
  connected: boolean;
  frost_status: Record<string, unknown> | null;
  attempt_count: number;
  session_status: string;
  joined_at: string;
  last_seen: string;
}

export async function createRoom(timerSeconds: number) {
  return rpc<{
    id: string;
    room_code: string;
    instructor_token: string;
    status: string;
    timer_seconds: number;
    expires_at: string;
  }>("bs_create_room", {
    p_timer_seconds: timerSeconds,
  });
}

export async function joinRoom(
  roomCode: string,
  studentName: string,
  className: string
) {
  return rpc<{
    room: ClassroomRoom;
    participant: {
      id: string;
      participant_token: string;
      student_name: string;
      class_name: string | null;
      attempt_count: number;
      session_status: string;
    };
  }>("bs_join_room", {
    p_room_code: roomCode,
    p_student_name: studentName,
    p_class_name: className,
  });
}

export async function getInstructorStatus(
  roomId: string,
  instructorToken: string
) {
  return rpc<{
    room: ClassroomRoom;
    students: ClassroomParticipant[];
  }>("bs_instructor_status", {
    p_room_id: roomId,
    p_instructor_token: instructorToken,
  });
}

export async function getStudentStatus(
  participantId: string,
  participantToken: string
) {
  return rpc<{
    room: ClassroomRoom;
    participant: {
      id: string;
      student_name: string;
      class_name: string | null;
      attempt_count: number;
      session_status: string;
    };
  }>("bs_student_status", {
    p_participant_id: participantId,
    p_participant_token: participantToken,
  });
}

export async function updateAssignment(
  roomId: string,
  instructorToken: string,
  assignmentPayload: unknown,
  timerSeconds: number
) {
  return rpc<boolean>("bs_update_assignment", {
    p_room_id: roomId,
    p_instructor_token: instructorToken,
    p_assignment: assignmentPayload,
    p_timer_seconds: timerSeconds,
  });
}

export async function recordAttempt(
  participantId: string,
  participantToken: string,
  attempt: unknown,
  frostStatus: unknown
) {
  return rpc<boolean>("bs_record_attempt", {
    p_participant_id: participantId,
    p_participant_token: participantToken,
    p_attempt: attempt,
    p_frost_status: frostStatus,
  });
}

export async function updateStudentLiveStatus(
  participantId: string,
  participantToken: string,
  frostStatus: unknown,
  sessionStatus: string
) {
  return rpc<boolean>("bs_update_student_live_status", {
    p_participant_id: participantId,
    p_participant_token: participantToken,
    p_frost_status: frostStatus,
    p_session_status: sessionStatus,
  });
}

export async function heartbeat(
  participantId: string,
  participantToken: string
) {
  return rpc<boolean>("bs_heartbeat", {
    p_participant_id: participantId,
    p_participant_token: participantToken,
  });
}

export async function leaveRoom(
  participantId: string,
  participantToken: string
) {
  return rpc<boolean>("bs_leave_room", {
    p_participant_id: participantId,
    p_participant_token: participantToken,
  });
}

export async function closeRoom(
  roomId: string,
  instructorToken: string
) {
  return rpc<boolean>("bs_close_room", {
    p_room_id: roomId,
    p_instructor_token: instructorToken,
  });
}
