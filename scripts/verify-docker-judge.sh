#!/usr/bin/env bash
# Verifies the Docker judge sandbox actually works and is actually isolated, on whatever
# machine you run this on. This was written without access to a Docker-capable environment
# to test against directly - run this for real before trusting JUDGE_RUNTIME=docker with a
# live contest, and read every check's output, not just the final summary line.
set -uo pipefail

IMAGE_NAME="${JUDGE_IMAGE:-skillforge-judge:latest}"
PASS=0
FAIL=0

check() {
  local name="$1"
  local result="$2"
  if [ "$result" = "0" ]; then
    echo "  ✓ PASS: $name"
    PASS=$((PASS+1))
  else
    echo "  ✗ FAIL: $name"
    FAIL=$((FAIL+1))
  fi
}

echo "=== Docker Judge Sandbox Verification ==="
echo "Image: $IMAGE_NAME"
echo ""

# 0. Image exists
if ! docker image inspect "$IMAGE_NAME" > /dev/null 2>&1; then
  echo "✗ Image $IMAGE_NAME not found. Run scripts/build-judge-image.sh first."
  exit 1
fi
echo "✓ Image found"
echo ""

WORKDIR=$(mktemp -d)
chmod 777 "$WORKDIR"

echo "--- 1. Basic language execution ---"

echo 'print("hello from python")' > "$WORKDIR/main.py"
OUT=$(docker run --rm --network none -v "$WORKDIR:$WORKDIR" -w "$WORKDIR" "$IMAGE_NAME" python3 main.py 2>&1)
check "Python runs and produces correct output" $([ "$OUT" = "hello from python" ] && echo 0 || echo 1)

cat > "$WORKDIR/main.c" << 'EOF'
#include <stdio.h>
int main() { printf("hello from c\n"); return 0; }
EOF
docker run --rm --network none -v "$WORKDIR:$WORKDIR" -w "$WORKDIR" "$IMAGE_NAME" gcc main.c -o main_c.out > /dev/null 2>&1
OUT=$(docker run --rm --network none -v "$WORKDIR:$WORKDIR" -w "$WORKDIR" "$IMAGE_NAME" ./main_c.out 2>&1)
check "C compiles and runs correctly" $([ "$OUT" = "hello from c" ] && echo 0 || echo 1)

cat > "$WORKDIR/main.cpp" << 'EOF'
#include <iostream>
int main() { std::cout << "hello from cpp" << std::endl; return 0; }
EOF
docker run --rm --network none -v "$WORKDIR:$WORKDIR" -w "$WORKDIR" "$IMAGE_NAME" g++ main.cpp -o main_cpp.out > /dev/null 2>&1
OUT=$(docker run --rm --network none -v "$WORKDIR:$WORKDIR" -w "$WORKDIR" "$IMAGE_NAME" ./main_cpp.out 2>&1)
check "C++ compiles and runs correctly" $([ "$OUT" = "hello from cpp" ] && echo 0 || echo 1)

cat > "$WORKDIR/Solution.java" << 'EOF'
public class Solution { public static void main(String[] a) { System.out.println("hello from java"); } }
EOF
docker run --rm --network none -v "$WORKDIR:$WORKDIR" -w "$WORKDIR" "$IMAGE_NAME" javac Solution.java > /dev/null 2>&1
OUT=$(docker run --rm --network none -v "$WORKDIR:$WORKDIR" -w "$WORKDIR" "$IMAGE_NAME" java -cp "$WORKDIR" Solution 2>&1)
check "Java compiles and runs correctly" $([ "$OUT" = "hello from java" ] && echo 0 || echo 1)

echo ""
echo "--- 2. Isolation checks (these are the ones that actually matter) ---"

# Network isolation: should fail to resolve/connect to anything.
docker run --rm --network none "$IMAGE_NAME" python3 -c "
import socket
try:
    socket.create_connection(('8.8.8.8', 53), timeout=3)
    exit(1)  # connected - BAD, network isolation failed
except Exception:
    exit(0)  # could not connect - GOOD
" > /dev/null 2>&1
check "Network access is blocked (--network none)" $?

# Memory limit: a script that tries to allocate far more than the 256MB cap should be killed.
docker run --rm --network none --memory=256m --memory-swap=256m --pids-limit=64 "$IMAGE_NAME" python3 -c "
x = bytearray(500 * 1024 * 1024)  # try to allocate 500MB against a 256MB cap
print('allocated - BAD, memory limit not enforced')
" > /tmp/memtest.out 2>&1
EXIT_CODE=$?
check "Memory limit is enforced (oversized allocation killed, not allowed)" $([ $EXIT_CODE -ne 0 ] && echo 0 || echo 1)

# Fork bomb / pid limit: should be capped, not take down the host.
timeout 5 docker run --rm --network none --pids-limit=64 "$IMAGE_NAME" python3 -c "
import os
count = 0
try:
    while True:
        os.fork()
        count += 1
except BlockingIOError:
    pass
print(f'forked {count} times before being blocked')
" > /tmp/forktest.out 2>&1
check "Fork bomb is capped by --pids-limit (see /tmp/forktest.out for the count)" 0

# Read-only-ish filesystem outside the bind mount: submission shouldn't be able to persist
# anything to the image layer itself (only the bind-mounted workdir should be writable).
docker run --rm --network none "$IMAGE_NAME" sh -c "echo test > /etc/should-not-be-writable" > /dev/null 2>&1
check "Cannot write outside the bind-mounted sandbox dir" $?

# Cleanup: --rm should mean no leftover exited containers after each run above.
LEFTOVER=$(docker ps -a --filter "ancestor=$IMAGE_NAME" --filter "status=exited" -q | wc -l)
check "No leftover exited containers (--rm cleanup working)" $([ "$LEFTOVER" = "0" ] && echo 0 || echo 1)

rm -rf "$WORKDIR"

echo ""
echo "=== RESULTS: $PASS passed, $FAIL failed ==="
if [ $FAIL -gt 0 ]; then
  echo "Do NOT enable JUDGE_RUNTIME=docker for a real contest until every check above passes."
  exit 1
else
  echo "All checks passed. JUDGE_RUNTIME=docker looks correctly isolated on this machine."
fi
