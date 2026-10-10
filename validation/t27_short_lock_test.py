#!/usr/bin/env python3
"""Read-only test+prod observations for the user-requested 10-minute lock test."""
import argparse
import concurrent.futures
import json
import os
from pathlib import Path
import plistlib
import re
import subprocess
import sys
import time
import urllib.request


def request(url, marker):
    start = time.monotonic()
    try:
        with urllib.request.urlopen(url, timeout=4) as response:
            body = response.read(2_000_000)
            return {"ok": response.status == 200 and (not marker or marker.encode() in body),
                    "status": response.status, "ms": round((time.monotonic() - start) * 1000)}
    except Exception as exc:
        return {"ok": False, "error": type(exc).__name__}


def external(args):
    checks = {}
    for env in ("test", "prod"):
        url, marker = os.environ[env.upper() + "_URL"], os.environ[env.upper() + "_MARKER"]
        if not re.fullmatch(r"https://[a-z0-9-]+\.trycloudflare\.com/?", url) or not marker:
            raise ValueError("current tunnel URL and DB marker are required")
        checks[env + "-page"] = (url.rstrip("/") + "/", "")
        checks[env + "-db"] = (url.rstrip("/") + "/api/guestbook", marker)
    # The extra observation window covers runner startup and the user's lock action.
    # The final report selects the actual 600-second locked interval from both artifacts.
    start, rounds, failures = time.monotonic(), 0, 0
    with (args.output / "http.jsonl").open("x") as log, concurrent.futures.ThreadPoolExecutor(4) as pool:
        while args.once or time.monotonic() - start < 15 * 60:
            stamp = time.time()
            jobs = {name: pool.submit(request, *values) for name, values in checks.items()}
            results = {name: job.result() for name, job in jobs.items()}
            failures += sum(not result["ok"] for result in results.values())
            log.write(json.dumps({"time": stamp, "completed_at": time.time(), "checks": results}) + "\n")
            log.flush()
            rounds += 1
            if rounds % 12 == 1:
                print(json.dumps({"rounds": rounds, "failed_requests": failures}), flush=True)
            if args.once:
                break
            time.sleep(max(0, start + rounds * 5 - time.monotonic()))
    summary = {"scope": "test+prod", "rounds": rounds, "failed_requests": failures,
               "seconds": round(time.monotonic() - start), "requested_locked_seconds": 600}
    (args.output / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    print(json.dumps(summary), flush=True)
    return int(failures > 0)


def locked():
    raw = subprocess.run(["/usr/sbin/ioreg", "-n", "Root", "-d", "1", "-a"],
                         capture_output=True, check=True, timeout=8).stdout
    result = plistlib.loads(raw).get("IOConsoleLocked")
    if type(result) is not bool:
        raise RuntimeError("screen lock state is unavailable")
    return result


def diagnostic(args):
    home = Path.home() / "Library/Application Support/one-tatchi/onprem/secondary"
    sys.path.insert(0, str(home / "bin"))
    import onpremctl as ctl
    from compare import identity
    config = ctl.load_config(home / "config.json")
    if config["profile"] != "secondary" or set(config["environments"]) != {"test", "prod"}:
        raise ValueError("expected the secondary test+prod profile")
    os.environ["PATH"] = config["path"]
    markers = {env: os.environ[env.upper() + "_MARKER"] for env in ("test", "prod")}
    if any(not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", marker) for marker in markers.values()):
        raise ValueError("invalid validation marker")

    def counts():
        ctl.prepare_kubeconfig(config)
        return {env: int(ctl.run([
            "kubectl", "exec", "-n", "platform", f"{config['service']}-db-{env}-0", "--",
            "psql", "-U", "app", "-d", "demo", "-Atc",
            f"SELECT count(*) FROM guestbook WHERE message = '{marker}';"
        ]).stdout.strip()) for env, marker in markers.items()}

    def snapshot():
        state = ctl.status(config)
        state["screen_locked"] = locked()
        state["observed_at"] = time.time()
        if state["errors"] or not state.get("sleep_prevented") or not state.get("ac_power"):
            raise RuntimeError("power/service diagnostic failed: " + "; ".join(state["errors"]))
        return state

    before = counts()
    if any(count != 1 for count in before.values()):
        raise ValueError("each validation marker must exist exactly once in PostgreSQL")
    baseline = snapshot()
    expected = identity(baseline)
    if not expected["pods"] or not expected["nodes"]:
        raise ValueError("missing pod/node baseline")
    (args.output / "baseline.json").write_text(json.dumps(baseline, indent=2) + "\n")
    if args.once:
        print(json.dumps({"preflight": "passed", "postgres": before, "urls": baseline["urls"]}), flush=True)
        return 0
    print(json.dumps({"phase": "waiting-for-screen-lock", "timeout_seconds": 240}), flush=True)
    deadline = time.monotonic() + 240
    while not locked():
        if time.monotonic() >= deadline:
            raise RuntimeError("screen lock was not observed within four minutes")
        time.sleep(1)
    start, samples = time.monotonic(), []
    while True:
        if not locked():
            raise RuntimeError("screen unlocked before the 10-minute observation completed")
        state = snapshot()
        path = args.output / f"{len(samples):03d}.json"
        path.write_text(json.dumps(state, indent=2) + "\n")
        samples.append(state)
        if not state["screen_locked"]:
            raise RuntimeError("screen unlocked during a diagnostic snapshot")
        if identity(state) != expected:
            raise RuntimeError("pod/node identity, start time or restart counter changed")
        if len(samples) > 1 and not 0 < samples[-1]["observed_at"] - samples[-2]["observed_at"] <= 30:
            raise RuntimeError("diagnostic observation gap exceeded 30 seconds or clock moved backwards")
        span = samples[-1]["observed_at"] - samples[0]["observed_at"]
        if len(samples) % 6 == 1:
            print(json.dumps({"phase": "locked", "seconds": round(span), "samples": len(samples)}), flush=True)
        if span >= 600:
            break
        time.sleep(max(0, start + len(samples) * 10 - time.monotonic()))
    after = counts()
    if after != before:
        raise RuntimeError("PostgreSQL marker counts changed")
    summary = {"scope": "test+prod", "requested_locked_seconds": 600,
               "locked_start": samples[0]["observed_at"], "locked_end": samples[-1]["observed_at"],
               "continuous_locked_seconds": round(span, 3), "snapshots": len(samples),
               "postgres_before": before, "postgres_after": after,
               "pods": len(expected["pods"]), "nodes": len(expected["nodes"]),
               "restarts_or_replacements": 0, "result": "passed"}
    (args.output / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    print(json.dumps(summary), flush=True)
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["external", "diagnostic"])
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=False)
    try:
        return external(args) if args.mode == "external" else diagnostic(args)
    except Exception as exc:
        (args.output / "error.json").write_text(json.dumps({"result": "failed", "error": str(exc)}) + "\n")
        raise


if __name__ == "__main__":
    raise SystemExit(main())
