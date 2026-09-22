# The judge sandbox image: every submission (compile + run) executes inside a fresh
# container built from this image, in JUDGE_RUNTIME=docker mode - see server/judge.ts.
#
# Design choices:
# - Single toolchain image (Python + gcc/g++ + JDK) rather than per-language images, so a
#   submission never needs a docker pull mid-judge. Trades a larger image for lower latency.
# - Non-root user: even though the container also runs with --cap-drop ALL and
#   --security-opt no-new-privileges (set by server/judge.ts at `docker run` time), running
#   as non-root inside the image itself is defense in depth, not the only line of defense.
# - No network tools, no package managers left reachable in a way that matters, since the
#   container also runs with --network none - there's nowhere for a submission to reach
#   even if it tried.
#
# Build: docker build -t skillforge-judge:latest -f docker/judge.Dockerfile .
# (or just run scripts/build-judge-image.sh, which does exactly that)

FROM ubuntu:24.04

RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 \
        gcc \
        g++ \
        openjdk-21-jdk-headless \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --no-create-home --shell /usr/sbin/nologin --uid 10001 judge

USER judge
WORKDIR /tmp

# No ENTRYPOINT/CMD: server/judge.ts always passes the full command explicitly
# (e.g. `/bin/bash -c "ulimit -v ...; exec python3 main.py"` or `gcc ... -o main.out`)
# as the trailing arguments to `docker run`, so nothing here needs to be a default.
