// Timers for every Nuvio runtime. The phone/tablet app has setTimeout (a native sleep), the Android TV
// app (NuvioTV) has none at all: there a timer is a promise job that re-checks the clock until it is
// due. TV's fetch blocks, so nothing else is pending while a timer waits. When getStreams ends, all
// fallback timers are dropped (cancelAll), otherwise the TV runtime would keep running them.
var NATIVE = typeof setTimeout === "function" && typeof clearTimeout === "function";
var live = {};
var seq = 0;
// TV: fetch blocks the whole JS thread, so wall-clock time spent inside a blocking request must not
// count towards timeouts (they would all be overdue the moment the thread is free again)
var blocked = 0;
function vnow() { return Date.now() - blocked; }
export function addBlocked(ms) { if (!NATIVE && ms > 0) blocked += ms; }

function fbSet(cb, ms) {
  var args = Array.prototype.slice.call(arguments, 2);
  var id = ++seq;
  var due = vnow() + Math.max(0, Number(ms) || 0);
  live[id] = true;
  (function spin() {
    if (!live[id]) return;
    if (vnow() >= due) {
      delete live[id];
      try { cb.apply(null, args); } catch (e) {}
      return;
    }
    Promise.resolve().then(spin);
  })();
  return id;
}
function fbClear(id) { delete live[id]; }
function fbInterval(cb, ms) {
  var args = Array.prototype.slice.call(arguments, 2);
  var id = ++seq;
  var every = Math.max(1, Number(ms) || 0);
  var due = vnow() + every;
  live[id] = true;
  (function spin() {
    if (!live[id]) return;
    if (vnow() >= due) {
      due = vnow() + every;
      try { cb.apply(null, args); } catch (e) {}
    }
    Promise.resolve().then(spin);
  })();
  return id;
}

export var setT = NATIVE ? function () { return setTimeout.apply(null, arguments); } : fbSet;
export var clearT = NATIVE ? function (id) { return clearTimeout(id); } : fbClear;
export var setI = NATIVE && typeof setInterval === "function" ? function () { return setInterval.apply(null, arguments); } : fbInterval;
export var clearI = NATIVE && typeof clearInterval === "function" ? function (id) { return clearInterval(id); } : fbClear;
export function cancelAll() { live = {}; }
export var nativeTimers = NATIVE;
