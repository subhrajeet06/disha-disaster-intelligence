"""
DISHA — Shared utilities for the xBD dataset preparation pipeline.
"""

import yaml
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def load_config(config_path=None):
    """Load the YAML configuration file."""
    if config_path is None:
        config_path = PROJECT_ROOT / "configs" / "xbd_config.yaml"
    else:
        config_path = Path(config_path)

    with open(config_path, "r") as f:
        config = yaml.safe_load(f)

    # Resolve paths relative to project root
    config["_project_root"] = PROJECT_ROOT
    config["_raw_path"] = PROJECT_ROOT / config["raw_dataset_path"]
    config["_output_path"] = PROJECT_ROOT / config["output_dataset_path"]
    config["_reports_path"] = PROJECT_ROOT / config["reports_path"]

    return config


def ensure_dirs(config):
    """Create all required output directories."""
    out = config["_output_path"]
    reports = config["_reports_path"]

    dirs = [
        reports,
        out / "train" / "pre",
        out / "train" / "post",
        out / "train" / "labels",
        out / "val" / "pre",
        out / "val" / "post",
        out / "val" / "labels",
        out / "test" / "pre",
        out / "test" / "post",
        out / "test" / "labels",
        out / "metadata",
        out / "visualizations" / "no_damage",
        out / "visualizations" / "minor_damage",
        out / "visualizations" / "major_damage",
        out / "visualizations" / "destroyed",
    ]

    for d in dirs:
        d.mkdir(parents=True, exist_ok=True)


def parse_filename(filename):
    """
    Parse an xBD filename into components.
    Example: 'guatemala-volcano_00000000_post_disaster.png'
    Returns: {'event': 'guatemala-volcano', 'id': '00000000', 'phase': 'post', 'ext': '.png'}
    """
    stem = Path(filename).stem  # remove extension
    ext = Path(filename).suffix

    # Pattern: {event}_{id}_{pre|post}_disaster[_target]
    # Handle target suffix
    is_target = stem.endswith("_target")
    if is_target:
        stem = stem.replace("_target", "")

    # Split from the right to handle multi-word event names (e.g., "socal-fire")
    parts = stem.rsplit("_", 2)  # ['event_name', 'id_phase', 'disaster'] or similar

    # More robust: find _disaster suffix, then _pre or _post before it
    if "_post_disaster" in stem:
        phase = "post"
        prefix = stem.replace("_post_disaster", "")
    elif "_pre_disaster" in stem:
        phase = "pre"
        prefix = stem.replace("_pre_disaster", "")
    else:
        return None

    # prefix is now "{event}_{id}"
    # Split event name from numeric ID
    # The ID is always 8 digits
    parts = prefix.rsplit("_", 1)
    if len(parts) == 2:
        event = parts[0]
        sample_id = parts[1]
    else:
        return None

    return {
        "event": event,
        "id": sample_id,
        "phase": phase,
        "ext": ext,
        "is_target": is_target,
        "sample_key": f"{event}_{sample_id}",
    }


def get_sample_pairs(raw_path):
    """
    Scan the raw dataset and return a dict of sample pairs.
    Key: 'event_id' (e.g., 'guatemala-volcano_00000000')
    Value: dict with paths to pre/post images, labels, targets
    """
    images_dir = Path(raw_path) / "images"
    labels_dir = Path(raw_path) / "labels"
    targets_dir = Path(raw_path) / "targets"

    pairs = {}

    if images_dir.exists():
        for img_file in sorted(images_dir.glob("*.png")):
            parsed = parse_filename(img_file.name)
            if parsed is None:
                continue

            key = parsed["sample_key"]
            if key not in pairs:
                pairs[key] = {
                    "event": parsed["event"],
                    "id": parsed["id"],
                    "pre_image": None,
                    "post_image": None,
                    "pre_label": None,
                    "post_label": None,
                    "pre_target": None,
                    "post_target": None,
                }

            if parsed["phase"] == "pre":
                pairs[key]["pre_image"] = img_file
            else:
                pairs[key]["post_image"] = img_file

    # Match labels
    if labels_dir.exists():
        for lbl_file in sorted(labels_dir.glob("*.json")):
            parsed = parse_filename(lbl_file.name)
            if parsed is None:
                continue
            key = parsed["sample_key"]
            if key in pairs:
                if parsed["phase"] == "pre":
                    pairs[key]["pre_label"] = lbl_file
                else:
                    pairs[key]["post_label"] = lbl_file

    # Match targets
    if targets_dir.exists():
        for tgt_file in sorted(targets_dir.glob("*.png")):
            parsed = parse_filename(tgt_file.name)
            if parsed is None:
                continue
            key = parsed["sample_key"]
            if key in pairs:
                if parsed["phase"] == "pre":
                    pairs[key]["pre_target"] = tgt_file
                else:
                    pairs[key]["post_target"] = tgt_file

    return pairs


def print_header(title):
    """Print a formatted section header."""
    width = max(len(title) + 4, 60)
    print("=" * width)
    print(f"  {title}")
    print("=" * width)
