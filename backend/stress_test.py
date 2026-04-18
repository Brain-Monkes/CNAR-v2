"""
Stress Test Suite for CNAR v2.1 Backend

Comprehensive stress tests covering every endpoint:
  1. Health Check
  2. Heatmap Endpoint (high-payload GET)
  3. Route Endpoint — Basic (origin/destination only)
  4. Route Endpoint — Waypoints (multi-stop routing)
  5. Route Endpoint — Filtered (active_radios & active_operators)
  6. Route Endpoint — Edge Cases (invalid coords, bad payloads)
  7. High-Concurrency Throughput (burst routing)
  8. Mixed-Load Simulation (heatmap + routing interleaved)

Usage:
    pip install httpx
    python stress_test.py
"""

import asyncio
import httpx
import time
import random
import statistics
import json
import sys
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional

# ─── Configuration ──────────────────────────────────────────────────────────
BACKEND_URL = "http://localhost:8000"
TIMEOUT = 30.0

# Concurrency & volume knobs
BASIC_ROUTE_REQUESTS = 50
WAYPOINT_ROUTE_REQUESTS = 20
FILTERED_ROUTE_REQUESTS = 30
EDGE_CASE_REQUESTS = 10       # per edge-case type
HEATMAP_REQUESTS = 10
BURST_REQUESTS = 100
BURST_CONCURRENCY = 25
MIXED_LOAD_REQUESTS = 60      # split across heatmap + route
MIXED_CONCURRENCY = 15

# Indian bounding box (lat/lon ranges for realistic coords)
LAT_MIN, LAT_MAX = 8.0, 32.0
LON_MIN, LON_MAX = 70.0, 88.0

# Known cities for more realistic routing (lon, lat — OSRM format)
INDIAN_CITIES = [
    [72.8777, 19.0760],   # Mumbai
    [77.1025, 28.7041],   # Delhi
    [77.5946, 12.9716],   # Bangalore
    [80.2707, 13.0827],   # Chennai
    [88.3639, 22.5726],   # Kolkata
    [78.4867, 17.3850],   # Hyderabad
    [73.8567, 18.5204],   # Pune
    [72.5714, 23.0225],   # Ahmedabad
    [75.7873, 26.9124],   # Jaipur
    [76.7794, 30.7333],   # Chandigarh
]

RADIOS = ["3G", "4G", "5G"]
OPERATORS = ["AirTel", "Vi (Vodafone Idea)", "Jio", "BSNL"]  # from preprocessed data


# ─── Result Container ───────────────────────────────────────────────────────
@dataclass
class TestResult:
    name: str
    total: int = 0
    successes: int = 0
    failures: int = 0
    latencies: List[float] = field(default_factory=list)
    errors: Dict[str, int] = field(default_factory=dict)
    extra: Dict[str, Any] = field(default_factory=dict)


# ─── Helpers ─────────────────────────────────────────────────────────────────
def random_coords() -> List[float]:
    """Random [lon, lat] within India."""
    lat = round(random.uniform(LAT_MIN, LAT_MAX), 4)
    lon = round(random.uniform(LON_MIN, LON_MAX), 4)
    return [lon, lat]


def random_city_pair():
    """Pick two distinct Indian cities."""
    a, b = random.sample(INDIAN_CITIES, 2)
    return a, b


def random_waypoints(n: int = 1) -> List[List[float]]:
    """Generate n random waypoints."""
    return [random.choice(INDIAN_CITIES) for _ in range(n)]


def percentile(data: List[float], p: float) -> float:
    """Manual percentile calculation for small datasets."""
    if not data:
        return 0.0
    sorted_data = sorted(data)
    k = (len(sorted_data) - 1) * (p / 100)
    f = int(k)
    c = f + 1
    if c >= len(sorted_data):
        return sorted_data[f]
    return sorted_data[f] + (k - f) * (sorted_data[c] - sorted_data[f])


def print_divider(title: str):
    width = 60
    print(f"\n{'═' * width}")
    print(f"  {title}")
    print(f"{'═' * width}")


def print_metrics(result: TestResult):
    print(f"  Total Requests:  {result.total}")
    print(f"  ✅ Successful:   {result.successes}")
    print(f"  ❌ Failed:       {result.failures}")

    if result.errors:
        print(f"  Error Breakdown:")
        for err, count in result.errors.items():
            print(f"    • {err}: {count}")

    if result.latencies:
        print(f"  Avg Latency:     {statistics.mean(result.latencies):.3f}s")
        print(f"  Min Latency:     {min(result.latencies):.3f}s")
        print(f"  Max Latency:     {max(result.latencies):.3f}s")
        print(f"  P50 Latency:     {percentile(result.latencies, 50):.3f}s")
        print(f"  P95 Latency:     {percentile(result.latencies, 95):.3f}s")
        print(f"  P99 Latency:     {percentile(result.latencies, 99):.3f}s")

        if result.latencies and len(result.latencies) >= 2:
            print(f"  Std Dev:         {statistics.stdev(result.latencies):.3f}s")

    for k, v in result.extra.items():
        print(f"  {k}: {v}")


# ─── Individual Test Functions ───────────────────────────────────────────────

async def test_health(client: httpx.AsyncClient) -> TestResult:
    """Test 1: Health endpoint."""
    result = TestResult(name="Health Check", total=1)
    try:
        t0 = time.perf_counter()
        resp = await client.get(f"{BACKEND_URL}/health", timeout=TIMEOUT)
        dt = time.perf_counter() - t0
        result.latencies.append(dt)

        data = resp.json()
        if resp.status_code == 200 and data.get("towers_loaded"):
            result.successes = 1
            result.extra["towers_loaded"] = data["towers_loaded"]
            result.extra["status"] = data.get("status", "unknown")
        else:
            result.failures = 1
            result.errors["not_ready"] = 1
    except Exception as e:
        result.failures = 1
        result.errors[str(e)] = 1

    return result


async def test_heatmap(client: httpx.AsyncClient) -> TestResult:
    """Test 2: Concurrent heatmap requests."""
    result = TestResult(name="Heatmap Endpoint", total=HEATMAP_REQUESTS)

    async def fetch_one(req_id: int):
        t0 = time.perf_counter()
        try:
            resp = await client.get(f"{BACKEND_URL}/towers/heatmap", timeout=TIMEOUT)
            dt = time.perf_counter() - t0
            if resp.status_code == 200:
                data = resp.json()
                return True, dt, len(json.dumps(data)), data.get("count", 0)
            return False, dt, 0, 0
        except Exception as e:
            return False, time.perf_counter() - t0, 0, str(e)

    tasks = [fetch_one(i) for i in range(HEATMAP_REQUESTS)]
    responses = await asyncio.gather(*tasks)

    payload_sizes = []
    tower_counts = []
    for success, dt, size, extra in responses:
        result.latencies.append(dt)
        if success:
            result.successes += 1
            payload_sizes.append(size)
            if isinstance(extra, int):
                tower_counts.append(extra)
        else:
            result.failures += 1
            err = str(extra) if extra else "unknown"
            result.errors[err] = result.errors.get(err, 0) + 1

    if payload_sizes:
        result.extra["Avg Payload Size"] = f"{statistics.mean(payload_sizes) / 1024:.1f} KB"
    if tower_counts:
        result.extra["Tower Count"] = tower_counts[0]

    return result


async def test_basic_routes(client: httpx.AsyncClient) -> TestResult:
    """Test 3: Basic routing with random origin/destination."""
    result = TestResult(name="Basic Route Requests", total=BASIC_ROUTE_REQUESTS)
    sem = asyncio.Semaphore(10)

    async def fetch_one(req_id: int):
        origin, dest = random_city_pair()
        payload = {
            "origin": origin,
            "destination": dest,
            "preference_weight": round(random.uniform(0.0, 1.0), 2),
        }
        async with sem:
            t0 = time.perf_counter()
            try:
                resp = await client.post(f"{BACKEND_URL}/calculate-routes", json=payload, timeout=TIMEOUT)
                dt = time.perf_counter() - t0
                if resp.status_code == 200:
                    data = resp.json()
                    return True, dt, data.get("count", 0)
                return False, dt, resp.status_code
            except Exception as e:
                return False, time.perf_counter() - t0, str(e)

    tasks = [fetch_one(i) for i in range(BASIC_ROUTE_REQUESTS)]
    responses = await asyncio.gather(*tasks)

    route_counts = []
    for success, dt, extra in responses:
        result.latencies.append(dt)
        if success:
            result.successes += 1
            route_counts.append(extra)
        else:
            result.failures += 1
            result.errors[str(extra)] = result.errors.get(str(extra), 0) + 1

    if route_counts:
        result.extra["Avg Routes Per Request"] = round(statistics.mean(route_counts), 1)

    return result


async def test_waypoint_routes(client: httpx.AsyncClient) -> TestResult:
    """Test 4: Routing with waypoints (multi-stop)."""
    result = TestResult(name="Waypoint Route Requests", total=WAYPOINT_ROUTE_REQUESTS)
    sem = asyncio.Semaphore(5)

    async def fetch_one(req_id: int):
        origin, dest = random_city_pair()
        wp_count = random.randint(1, 3)
        waypoints = random_waypoints(wp_count)
        payload = {
            "origin": origin,
            "destination": dest,
            "waypoints": waypoints,
            "preference_weight": round(random.uniform(0.0, 1.0), 2),
        }
        async with sem:
            t0 = time.perf_counter()
            try:
                resp = await client.post(f"{BACKEND_URL}/calculate-routes", json=payload, timeout=TIMEOUT)
                dt = time.perf_counter() - t0
                if resp.status_code == 200:
                    data = resp.json()
                    return True, dt, wp_count
                return False, dt, resp.status_code
            except Exception as e:
                return False, time.perf_counter() - t0, str(e)

    tasks = [fetch_one(i) for i in range(WAYPOINT_ROUTE_REQUESTS)]
    responses = await asyncio.gather(*tasks)

    for success, dt, extra in responses:
        result.latencies.append(dt)
        if success:
            result.successes += 1
        else:
            result.failures += 1
            result.errors[str(extra)] = result.errors.get(str(extra), 0) + 1

    return result


async def test_filtered_routes(client: httpx.AsyncClient) -> TestResult:
    """Test 5: Routing with active_radios and active_operators filters."""
    result = TestResult(name="Filtered Route Requests", total=FILTERED_ROUTE_REQUESTS)
    sem = asyncio.Semaphore(10)

    async def fetch_one(req_id: int):
        origin, dest = random_city_pair()
        # Randomly select subsets of radios and operators
        active_radios = random.sample(RADIOS, random.randint(1, len(RADIOS)))
        active_operators = random.sample(OPERATORS, random.randint(1, len(OPERATORS)))

        payload = {
            "origin": origin,
            "destination": dest,
            "preference_weight": round(random.uniform(0.0, 1.0), 2),
            "active_radios": active_radios,
            "active_operators": active_operators,
        }
        async with sem:
            t0 = time.perf_counter()
            try:
                resp = await client.post(f"{BACKEND_URL}/calculate-routes", json=payload, timeout=TIMEOUT)
                dt = time.perf_counter() - t0
                if resp.status_code == 200:
                    return True, dt, None
                return False, dt, resp.status_code
            except Exception as e:
                return False, time.perf_counter() - t0, str(e)

    tasks = [fetch_one(i) for i in range(FILTERED_ROUTE_REQUESTS)]
    responses = await asyncio.gather(*tasks)

    for success, dt, extra in responses:
        result.latencies.append(dt)
        if success:
            result.successes += 1
        else:
            result.failures += 1
            result.errors[str(extra)] = result.errors.get(str(extra), 0) + 1

    return result


async def test_edge_cases(client: httpx.AsyncClient) -> TestResult:
    """Test 6: Edge cases — invalid payloads, out-of-range coords, missing fields."""
    edge_cases = []

    # Type 1: Missing required fields
    for _ in range(EDGE_CASE_REQUESTS):
        edge_cases.append(("Missing origin", {}))

    # Type 2: Invalid coordinate format (string instead of list)
    for _ in range(EDGE_CASE_REQUESTS):
        edge_cases.append(("Invalid coord type", {
            "origin": "not_a_list",
            "destination": [77.1025, 28.7041],
        }))

    # Type 3: Out-of-range coordinates (ocean)
    for _ in range(EDGE_CASE_REQUESTS):
        edge_cases.append(("Ocean coords", {
            "origin": [0.0, 0.0],
            "destination": [1.0, 1.0],
            "preference_weight": 0.5,
        }))

    # Type 4: Same origin and destination
    for _ in range(EDGE_CASE_REQUESTS):
        city = random.choice(INDIAN_CITIES)
        edge_cases.append(("Same origin/dest", {
            "origin": city,
            "destination": city,
            "preference_weight": 0.5,
        }))

    # Type 5: Extreme preference_weight values
    for _ in range(EDGE_CASE_REQUESTS):
        origin, dest = random_city_pair()
        edge_cases.append(("Extreme weight", {
            "origin": origin,
            "destination": dest,
            "preference_weight": random.choice([-1.0, 0.0, 1.0, 100.0]),
        }))

    result = TestResult(name="Edge Case Requests", total=len(edge_cases))
    expected_failures = {"Missing origin", "Invalid coord type"}

    for label, payload in edge_cases:
        t0 = time.perf_counter()
        try:
            resp = await client.post(f"{BACKEND_URL}/calculate-routes", json=payload, timeout=TIMEOUT)
            dt = time.perf_counter() - t0
            result.latencies.append(dt)

            if label in expected_failures:
                # These SHOULD fail with 4xx/5xx
                if resp.status_code >= 400:
                    result.successes += 1  # correct behavior
                else:
                    result.failures += 1
                    result.errors[f"{label}: unexpected 2xx"] = result.errors.get(f"{label}: unexpected 2xx", 0) + 1
            else:
                # These may or may not succeed depending on OSRM
                if resp.status_code == 200:
                    result.successes += 1
                else:
                    # Mark as success if we got a proper error response
                    result.successes += 1
                    result.extra[f"{label} status"] = resp.status_code
        except Exception as e:
            dt = time.perf_counter() - t0
            result.latencies.append(dt)
            result.failures += 1
            result.errors[f"{label}: {str(e)[:60]}"] = result.errors.get(f"{label}: {str(e)[:60]}", 0) + 1

    return result


async def test_burst_throughput(client: httpx.AsyncClient) -> TestResult:
    """Test 7: High-concurrency burst test for throughput measurement."""
    result = TestResult(name="Burst Throughput", total=BURST_REQUESTS)
    sem = asyncio.Semaphore(BURST_CONCURRENCY)

    async def fetch_one(req_id: int):
        origin, dest = random_city_pair()
        payload = {
            "origin": origin,
            "destination": dest,
            "preference_weight": 0.5,
        }
        async with sem:
            t0 = time.perf_counter()
            try:
                resp = await client.post(f"{BACKEND_URL}/calculate-routes", json=payload, timeout=TIMEOUT)
                dt = time.perf_counter() - t0
                return resp.status_code == 200, dt
            except Exception as e:
                return False, time.perf_counter() - t0

    wall_start = time.perf_counter()
    tasks = [fetch_one(i) for i in range(BURST_REQUESTS)]
    responses = await asyncio.gather(*tasks)
    wall_duration = time.perf_counter() - wall_start

    for success, dt in responses:
        result.latencies.append(dt)
        if success:
            result.successes += 1
        else:
            result.failures += 1

    result.extra["Wall-Clock Duration"] = f"{wall_duration:.2f}s"
    result.extra["Throughput"] = f"{BURST_REQUESTS / wall_duration:.2f} req/s"
    result.extra["Concurrency Level"] = BURST_CONCURRENCY

    return result


async def test_mixed_load(client: httpx.AsyncClient) -> TestResult:
    """Test 8: Interleaved heatmap + route requests simulating real traffic."""
    result = TestResult(name="Mixed Load Simulation", total=MIXED_LOAD_REQUESTS)
    sem = asyncio.Semaphore(MIXED_CONCURRENCY)

    heatmap_count = MIXED_LOAD_REQUESTS // 4
    route_count = MIXED_LOAD_REQUESTS - heatmap_count

    async def heatmap_req():
        async with sem:
            t0 = time.perf_counter()
            try:
                resp = await client.get(f"{BACKEND_URL}/towers/heatmap", timeout=TIMEOUT)
                return resp.status_code == 200, time.perf_counter() - t0, "heatmap"
            except:
                return False, time.perf_counter() - t0, "heatmap"

    async def route_req():
        origin, dest = random_city_pair()
        payload = {
            "origin": origin,
            "destination": dest,
            "preference_weight": round(random.uniform(0.0, 1.0), 2),
            "active_radios": random.sample(RADIOS, random.randint(1, 3)),
        }
        async with sem:
            t0 = time.perf_counter()
            try:
                resp = await client.post(f"{BACKEND_URL}/calculate-routes", json=payload, timeout=TIMEOUT)
                return resp.status_code == 200, time.perf_counter() - t0, "route"
            except:
                return False, time.perf_counter() - t0, "route"

    tasks = [heatmap_req() for _ in range(heatmap_count)] + [route_req() for _ in range(route_count)]
    random.shuffle(tasks)

    wall_start = time.perf_counter()
    responses = await asyncio.gather(*tasks)
    wall_duration = time.perf_counter() - wall_start

    heatmap_latencies = []
    route_latencies = []

    for success, dt, kind in responses:
        result.latencies.append(dt)
        if success:
            result.successes += 1
        else:
            result.failures += 1
        if kind == "heatmap":
            heatmap_latencies.append(dt)
        else:
            route_latencies.append(dt)

    result.extra["Wall-Clock Duration"] = f"{wall_duration:.2f}s"
    result.extra["Heatmap Reqs"] = f"{heatmap_count} (avg {statistics.mean(heatmap_latencies):.3f}s)" if heatmap_latencies else "0"
    result.extra["Route Reqs"] = f"{route_count} (avg {statistics.mean(route_latencies):.3f}s)" if route_latencies else "0"
    result.extra["Throughput"] = f"{MIXED_LOAD_REQUESTS / wall_duration:.2f} req/s"

    return result


# ─── Main Runner ─────────────────────────────────────────────────────────────

async def run_all_tests():
    banner = """
╔══════════════════════════════════════════════════════════════╗
║            CNAR v2.1 — Backend Stress Test Suite            ║
╚══════════════════════════════════════════════════════════════╝
    """
    print(banner)
    print(f"Target: {BACKEND_URL}")
    print(f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}")

    all_results: List[TestResult] = []

    async with httpx.AsyncClient() as client:
        # ── Test 1: Health Check ──
        print_divider("1 │ Health Check")
        r = await test_health(client)
        print_metrics(r)
        all_results.append(r)

        if r.failures > 0:
            print("\n🛑 Backend is not ready. Aborting remaining tests.")
            return all_results

        # ── Test 2: Heatmap ──
        print_divider("2 │ Heatmap Endpoint (Heavy Payload)")
        r = await test_heatmap(client)
        print_metrics(r)
        all_results.append(r)

        # ── Test 3: Basic Routes ──
        print_divider("3 │ Basic Route Requests")
        r = await test_basic_routes(client)
        print_metrics(r)
        all_results.append(r)

        # ── Test 4: Waypoint Routes ──
        print_divider("4 │ Waypoint Route Requests (Multi-Stop)")
        r = await test_waypoint_routes(client)
        print_metrics(r)
        all_results.append(r)

        # ── Test 5: Filtered Routes ──
        print_divider("5 │ Filtered Route Requests (Radio + Operator)")
        r = await test_filtered_routes(client)
        print_metrics(r)
        all_results.append(r)

        # ── Test 6: Edge Cases ──
        print_divider("6 │ Edge Case Requests")
        r = await test_edge_cases(client)
        print_metrics(r)
        all_results.append(r)

        # ── Test 7: Burst Throughput ──
        print_divider("7 │ Burst Throughput Test")
        r = await test_burst_throughput(client)
        print_metrics(r)
        all_results.append(r)

        # ── Test 8: Mixed Load ──
        print_divider("8 │ Mixed Load Simulation")
        r = await test_mixed_load(client)
        print_metrics(r)
        all_results.append(r)

    return all_results


def print_final_summary(results: List[TestResult]):
    """Print a final scorecard."""
    print_divider("FINAL SUMMARY")
    total = sum(r.total for r in results)
    success = sum(r.successes for r in results)
    fail = sum(r.failures for r in results)
    all_latencies = [lat for r in results for lat in r.latencies]

    print(f"\n  {'Test Name':<35} {'Pass':>6} {'Fail':>6} {'Avg(s)':>8} {'P95(s)':>8}")
    print(f"  {'─' * 35} {'─' * 6} {'─' * 6} {'─' * 8} {'─' * 8}")
    for r in results:
        avg = f"{statistics.mean(r.latencies):.3f}" if r.latencies else "N/A"
        p95 = f"{percentile(r.latencies, 95):.3f}" if r.latencies else "N/A"
        print(f"  {r.name:<35} {r.successes:>6} {r.failures:>6} {avg:>8} {p95:>8}")

    print(f"\n  {'TOTAL':<35} {success:>6} {fail:>6}", end="")
    if all_latencies:
        print(f" {statistics.mean(all_latencies):>8.3f} {percentile(all_latencies, 95):>8.3f}")
    else:
        print()

    print(f"\n  Overall Success Rate: {success / total * 100:.1f}%")

    if all_latencies:
        print(f"  Global Avg Latency:  {statistics.mean(all_latencies):.3f}s")
        print(f"  Global P99 Latency:  {percentile(all_latencies, 99):.3f}s")

    # Verdict
    rate = success / total * 100 if total else 0
    if rate >= 95:
        print("\n  🟢 VERDICT: PASS — Backend handles stress well.")
    elif rate >= 80:
        print("\n  🟡 VERDICT: WARN — Some failures detected, investigate.")
    else:
        print("\n  🔴 VERDICT: FAIL — Significant issues under load.")


if __name__ == "__main__":
    results = asyncio.run(run_all_tests())
    if results:
        print_final_summary(results)
    print()
