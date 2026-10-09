#!/usr/bin/env python3
"""Read-only, test-only continuity evidence for the isolated T27 validation branch."""
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
    url, marker = os.environ["TEST_URL"], os.environ["TEST_MARKER"]
    if not re.fullmatch(r"https://[a-z0-9-]+\.trycloudflare\.com/?", url):
        raise ValueError("expected the current test Quick Tunnel URL")
    if not marker:
        raise ValueError("test DB marker is required")
    start, rounds, failures = time.monotonic(), 0, 0
    with (args.output / "http.jsonl").open("w") as log, concurrent.futures.ThreadPoolExecutor(2) as pool:
        while args.once or time.monotonic() - start < args.minutes * 60:
            jobs = [pool.submit(request, url.rstrip("/") + "/", ""),
                    pool.submit(request, url.rstrip("/") + "/api/guestbook", marker)]
            results = {name: job.result() for name, job in zip(("test-page", "test-db"), jobs)}
            failures += sum(not value["ok"] for value in results.values())
            log.write(json.dumps({"time": time.time(), "scope": "test-only", "checks": results}) + "\n")
            log.flush()
            rounds += 1
            if rounds % 12 == 1:
                print(json.dumps({"rounds": rounds, "failed_requests": failures}), flush=True)
            if args.once:
                break
            time.sleep(max(0, start + rounds * 5 - time.monotonic()))
    summary = {"scope": "test-only", "rounds": rounds, "failed_requests": failures,
               "seconds": round(time.monotonic() - start)}
    (args.output / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    print(json.dumps(summary), flush=True)
    return int(failures > 0)


def longest_locked(snapshots):
    start, previous, best = None, None, 0
    for snapshot in snapshots:
        now = snapshot["observed_at"]
        if snapshot.get("screen_locked") is not True:
            start = None
        else:
            if start is None or (previous is not None and now - previous > 90):
                start = now
            best = max(best, now - start)
        previous = now
    return best


def diagnostic(args):
    home = Path.home() / "Library/Application Support/one-tatchi/onprem/secondary"
    sys.path.insert(0, str(home / "bin"))
    import onpremctl as ctl
    import compare
    config = ctl.load_config(home / "config.json")
    config["environments"] = ["test"]  # Only this in-memory observation; installed config is unchanged.
    marker = os.environ["TEST_MARKER"]
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", marker):
        raise ValueError("expected the pre-created validation marker")

    def count_marker():
        ctl.prepare_kubeconfig(config)
        sql = f"SELECT count(*) FROM guestbook WHERE message = '{marker}';"
        return int(ctl.run(["kubectl", "exec", "-n", "platform", f"{config['service']}-db-test-0", "--",
                            "psql", "-U", "app", "-d", "demo", "-Atc", sql]).stdout.strip())

    before = count_marker()
    if before < 1:
        raise ValueError("validation marker is absent from PostgreSQL")
    start, snapshots, paths = time.monotonic(), [], []
    for number in range(1 if args.once else args.minutes + 1):
        state = ctl.status(config)
        raw = subprocess.run(["/usr/sbin/ioreg", "-n", "Root", "-d", "1", "-a"], capture_output=True, check=True, timeout=10).stdout
        registry = plistlib.loads(raw)
        state["screen_locked"] = registry.get("IOConsoleLocked")
        if type(state["screen_locked"]) is not bool:
            raise ValueError("macOS did not return a usable screen lock state")
        state["scope"] = "test-only"
        path = args.output / f"{number:03d}.json"
        path.write_text(json.dumps(state, indent=2) + "\n")
        snapshots.append(state)
        paths.append(path)
        print(json.dumps({"sample": number, "screen_locked": state["screen_locked"],
                          "errors": state["errors"], "time": state["observed_at"]}), flush=True)
        if not args.once and number < args.minutes:
            time.sleep(max(0, start + (number + 1) * 60 - time.monotonic()))
    after = count_marker()
    locked_seconds = longest_locked(snapshots)
    summary = {"scope": "test-only", "postgres_before": before, "postgres_after": after,
               "continuous_locked_seconds": round(locked_seconds), "snapshots": len(snapshots)}
    (args.output / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    if not args.once:
        compare.compare(paths)
        if locked_seconds < 1800:
            raise ValueError("less than 30 continuous minutes of observed screen lock")
    if after < 1 or any(s["errors"] for s in snapshots):
        raise ValueError("DB preservation or service diagnostic failed")
    print(json.dumps(summary), flush=True)
    return 0


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["external", "diagnostic"])
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--minutes", type=int, default=35, choices=range(30, 46))
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    return external(args) if args.mode == "external" else diagnostic(args)


if __name__ == "__main__":
    raise SystemExit(main())
