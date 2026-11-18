# MO-1c Director e2e investigation

## Cause and change

The test installed Playwright's clock but left it running with wall time between calls. The S07 Director timer lasts 1,125 ms, so time spent waiting for the S07, focus and history assertions can consume its dwell before the later `playing` assertion. The test also advanced time immediately after seeking to S06 without first establishing the scene and Director state. The runtime schedules a fresh timeout in the scene-dependent effect; inspection did not establish a slow-frame runtime defect.

The test now installs the clock at a fixed time and pauses it before starting the Director. It advances the clock to let the S06 update settle, checks S06 and `playing`, then explicitly advances through the S06 and S07 dwell. The original S07 `playing`, focus, history, and final `idle` assertions remain. This removes wall-time consumption from the dwell assertions. The proposed timing cause is supported by the clock behavior and code inspection, but the requested clean stress run has not been obtained.

## Verification

- `pnpm.cmd install --frozen-lockfile`: passed. PowerShell blocked the `pnpm.ps1` shim, so the Windows command shim was used.
- Focused Director test, one worker: 1 passed.
- Full spec, `--repeat-each=30 --workers=4`: started 390 tests, then interrupted after multiple failures of the first test waiting for `[data-experience]` to become `data-ready=true` (15-second assertion timeout). This is not a passing 30-repeat run.
- Director only, `--repeat-each=30 --workers=4`: first 8 passed; subsequent attempts failed at the initial `data-ready=true` check before clock installation. Interrupted after 8 passes and 8 reported failures.
- Director only, `--repeat-each=30 --workers=8`: 2 passes and at least 4 reported failures before interruption; inspected failures were the same initial readiness assertion, before clock installation. This is not a passing pressure run.
- `pnpm.cmd test`: 39 files, 343 tests passed.
- `npm.cmd run build`: passed, including TypeScript and static page generation.

The host was heavily loaded during browser runs, and a separate process launch failed during the four-worker full-spec run. The readiness failures prevent concluding that the change is stable for 30 repeats or under eight-worker pressure; repeat the requested full-spec and pressure runs on a host where the experience reliably reaches readiness. No screenshot baselines were modified, and no commit was made.

