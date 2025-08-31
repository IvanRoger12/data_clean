type Job = {
  id: string;
  filename: string;
  startedAt: number;
  finishedAt: number;
  rows: number;
  cols: number;
  scoreBefore: number;
  scoreAfter: number;
  diffCount: number;
  outPathCsv?: string;
  outPathLog?: string;
};

const LS_JOBS = "dc_jobs_v1";
const LS_SCHEDULE = "dc_schedule_v1";

export function listJobs(): Job[] {
  const raw = localStorage.getItem(LS_JOBS);
  return raw ? JSON.parse(raw) : [];
}
export function saveJob(job: Job) {
  const all = listJobs();
  const next = [job, ...all].slice(0, 100);
  localStorage.setItem(LS_JOBS, JSON.stringify(next));
}
export function clearJobs() {
  localStorage.removeItem(LS_JOBS);
}

export type Schedule = {
  enabled: boolean;
  everyMinutes: number; // ex: 60
  lastRun?: number;
};
export function getSchedule(): Schedule {
  const raw = localStorage.getItem(LS_SCHEDULE);
  return raw ? JSON.parse(raw) : { enabled: false, everyMinutes: 60 };
}
export function saveSchedule(s: Schedule) {
  localStorage.setItem(LS_SCHEDULE, JSON.stringify(s));
}
