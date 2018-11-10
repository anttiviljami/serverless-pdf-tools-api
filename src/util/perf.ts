import hrtimeDiff from 'diff-hrtime';

interface Timer {
  start: [number, number];
}
const timers: { [label: string]: Timer } = {};

export function time(label: string) {
  timers[label] = { start: process.hrtime() };
  return timers[label];
}

export function timeLog(label: string, ...message: any[]) {
  const timer = timers[label] || time(label);
  const curr = process.hrtime();
  const [sec, ns] = hrtimeDiff(timer.start, curr);
  const ms = sec * 1000 + Math.round(ns / 1000000);
  console.log(`[${label}]: ${ms}ms`, ...message);
}

export function timeEnd(label: string, ...message: any[]) {
  timeLog(label, ...message);
  delete timers[label];
}
