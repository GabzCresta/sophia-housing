import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import type { ClassSlot, StudyDetail } from "@/lib/types";

// GET /api/apartments/[id]/study — profundidade de Estudos: perfil (fibra, foco, luz,
// coworkings a 10min), biblioteca/campus e o horário de aulas (class_schedule).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [profile, schedule] = await Promise.all([
    queryOne<Omit<StudyDetail, "schedule">>(
      `select sp.desk_space, sp.fiber_internet, sp.fiber_speed, sp.quiet_focus_1_5, sp.natural_light_1_5,
              sp.coworking_count_10min, sp.campus_days_per_week, sp.typical_class_hours, sp.early_or_night,
              sa.nearest_library_min,
              (select duration_min from v_apartment_nearest n where n.apartment_id = $1 and n.category = 'campus') as campus_min
         from study_profile sp
         left join v_study_access sa on sa.apartment_id = sp.apartment_id
        where sp.apartment_id = $1`,
      [id],
    ),
    query<ClassSlot>(
      `select course_name, weekday, start_time, end_time from class_schedule order by weekday, start_time`,
    ),
  ]);

  const result: StudyDetail = {
    desk_space: profile?.desk_space ?? null,
    fiber_internet: profile?.fiber_internet ?? null,
    fiber_speed: profile?.fiber_speed ?? null,
    quiet_focus_1_5: profile?.quiet_focus_1_5 ?? null,
    natural_light_1_5: profile?.natural_light_1_5 ?? null,
    coworking_count_10min: profile?.coworking_count_10min ?? null,
    campus_days_per_week: profile?.campus_days_per_week ?? null,
    typical_class_hours: profile?.typical_class_hours ?? null,
    early_or_night: profile?.early_or_night ?? null,
    nearest_library_min: profile?.nearest_library_min ?? null,
    campus_min: profile?.campus_min ?? null,
    schedule,
  };
  return NextResponse.json(result);
}
