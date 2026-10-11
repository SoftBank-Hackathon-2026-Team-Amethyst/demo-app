#!/usr/bin/env bash
# 이번 실행의 배포 대상 matrix를 정한다 (platform T39, ADR-0020).
#   test: test에 배포할 대상, prod: test가 모두 통과한 뒤 prod에 배포할 대상 (JSON 배열)
# 대상 목록은 DEPLOY_TARGETS(쉼표 구분) → DEPLOY_TARGET → aws. 첫 대상이 기준 대상(yolo 리포트 · main PR)이다.
# push는 바뀐 경로로 대상을 거른다: 공통 경로는 모든 대상, deploy/<scope>/**는 그 대상만. test 값만 바뀌면 prod는 없다.
set -euo pipefail

if [ "$EVENT" = workflow_dispatch ] && [ -n "${REQUESTED:-}" ] && [ "$REQUESTED" != all ]; then TARGETS="$REQUESTED"; fi

test='[]'; prod='[]'; seen=' '
for label in $(tr ',' ' ' <<<"$TARGETS"); do
  case "$label" in
    aws) target=aws cluster=one-tatchi runner=onprem
         preview_test=green-yolo.onetatchi.soulee.dev preview_prod=green.onetatchi.soulee.dev auth=true ;;
    gcp) target=gcp cluster="${GCP_CLUSTER:-}" runner=onprem
         preview_test=green-yolo-gcp.onetatchi.soulee.dev preview_prod=green-gcp.onetatchi.soulee.dev auth=true
         [ -n "$cluster" ] || { echo "::error::gcp 대상에는 레포 변수 GCP_CLUSTER가 필요하다"; exit 1; } ;;
    onprem) target=onprem cluster="${ONPREM_CLUSTER:-k3d-onetouch}" runner=onprem
         preview_test=green-yolo-onprem.soulee.dev preview_prod=green-onprem.soulee.dev auth=true ;;
    onprem-secondary) target=onprem cluster="${ONPREM_SECONDARY_CLUSTER:-missing-onprem-secondary-cluster}" runner=onprem-secondary
         preview_test=green-yolo-onprem.soulee.dev preview_prod=green-onprem.soulee.dev auth=false ;;
    onprem-wsl) target=onprem cluster="${ONPREM_WSL_CLUSTER:-missing-onprem-wsl-cluster}" runner=onprem-wsl
         preview_test=green-yolo-onprem.soulee.dev preview_prod=green-onprem.soulee.dev auth=false ;;
    *) echo "::error::지원하지 않는 배포 대상: $label (aws | gcp | onprem | onprem-secondary | onprem-wsl)"; exit 1 ;;
  esac
  case "$seen" in *" $label "*) echo "::error::배포 대상이 중복됐다: $label"; exit 1 ;; esac
  seen="$seen$label "

  run_test=false; run_prod=false
  case "$EVENT" in
    workflow_dispatch)
      if [ "$REF" = refs/heads/main ]; then
        run_test=true
        [ "${ENVIRONMENT:-prod}" = test ] || [ "${VERIFY:-false}" = true ] || run_prod=true
      fi ;;
    push)
      if [ "${CHANGES_RESULT:-}" = success ]; then
        case "$target" in aws) own="${CHANGED_AWS:-false}" ;; gcp) own="${CHANGED_GCP:-false}" ;; onprem) own="${CHANGED_ONPREM:-false}" ;; esac
        { [ "${COMMON:-false}" = true ] || [ "$own" = true ]; } && run_test=true
        { [ "$REF" = refs/heads/main ] && { [ "${PROD_COMMON:-false}" = true ] || [ "$own" = true ]; }; } && run_prod=true
      fi ;;
  esac

  # 기준 대상은 test에 들어가는 첫 대상이다.
  entry="$(jq -nc --arg label "$label" --arg target "$target" --arg cluster "$cluster" --arg runner "$runner" \
    --arg pt "$preview_test" --arg pp "$preview_prod" --argjson auth "$auth" --argjson primary "$([ "$test" = '[]' ] && echo true || echo false)" \
    '{label: $label, target: $target, cluster: $cluster, runner: $runner, preview_test: $pt, preview_prod: $pp, preview_auth: $auth, primary: $primary}')"
  [ "$run_test" = false ] || test="$(jq -c --argjson e "$entry" '. + [$e]' <<<"$test")"
  [ "$run_prod" = false ] || prod="$(jq -c --argjson e "$entry" '. + [$e]' <<<"$prod")"
done
[ "$seen" != ' ' ] || { echo "::error::배포 대상이 없다"; exit 1; }

echo "test=$test" >> "$GITHUB_OUTPUT"
echo "prod=$prod" >> "$GITHUB_OUTPUT"
echo "### 배포 대상: test [$(jq -r 'map(.label) | join(", ")' <<<"$test")] · prod [$(jq -r 'map(.label) | join(", ")' <<<"$prod")]" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
