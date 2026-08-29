#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
site_root="$(cd "$script_dir/.." && pwd)"
app_root="${1:-$(cd "$site_root/.." && pwd)/nekokintai}"
assets_dir="$site_root/assets/lp"
frame_template="$assets_dir/screen-month.png"

for command_name in magick identify; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Required command not found: $command_name" >&2
    exit 1
  fi
done

for required_file in \
  "$app_root/docs/store/screenshots/final-1.png" \
  "$app_root/docs/store/screenshots/final-4.png" \
  "$frame_template"; do
  if [[ ! -f "$required_file" ]]; then
    echo "Required image not found: $required_file" >&2
    exit 1
  fi
done

assert_dimensions() {
  local image_path="$1"
  local expected_dimensions="$2"
  local actual_dimensions

  actual_dimensions="$(identify -format '%wx%h' "$image_path")"
  if [[ "$actual_dimensions" != "$expected_dimensions" ]]; then
    echo "Unexpected dimensions for $image_path: $actual_dimensions (expected $expected_dimensions)" >&2
    exit 1
  fi
}

assert_dimensions "$app_root/docs/store/screenshots/final-1.png" "1290x2796"
assert_dimensions "$app_root/docs/store/screenshots/final-4.png" "1290x2796"
assert_dimensions "$frame_template" "720x1205"

work_dir="$(mktemp -d)"
trap 'rm -rf -- "$work_dir"' EXIT

mask_path="$work_dir/mask.png"
magick -size 684x1164 xc:black \
  -fill white \
  -draw 'roundrectangle 0,0,683,1163,17,17' \
  "$mask_path"

rebuild_screenshot() {
  local source_path="$1"
  local destination_path="$2"
  local image_key="$3"
  local cropped_path="$work_dir/$image_key-cropped.png"
  local masked_path="$work_dir/$image_key-masked.png"
  local output_path="$work_dir/$image_key-output.png"

  magick "$source_path" \
    -crop 952x1626+171+551 +repage \
    -resize '684x1164!' \
    "$cropped_path"

  magick "$cropped_path" "$mask_path" \
    -alpha off \
    -compose CopyOpacity \
    -composite \
    "$masked_path"

  magick "$frame_template" "$masked_path" \
    -geometry +12+20 \
    -compose over \
    -composite \
    "$output_path"

  assert_dimensions "$output_path" "720x1205"
  cp "$output_path" "$destination_path"
}

rebuild_screenshot \
  "$app_root/docs/store/screenshots/final-1.png" \
  "$assets_dir/screen-home.png" \
  "home"

rebuild_screenshot \
  "$app_root/docs/store/screenshots/final-4.png" \
  "$assets_dir/screen-shop.png" \
  "shop"

assert_dimensions "$assets_dir/screen-home.png" "720x1205"
assert_dimensions "$assets_dir/screen-month.png" "720x1205"
assert_dimensions "$assets_dir/screen-shop.png" "720x1205"

echo "Rebuilt LP screenshots:"
echo "  $assets_dir/screen-home.png"
echo "  $assets_dir/screen-shop.png"
