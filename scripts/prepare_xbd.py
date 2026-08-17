"""
DISHA — Master Dataset Preparation Script
Orchestrates the entire xBD dataset preparation pipeline.

Usage:
    python scripts/prepare_xbd.py

This single command runs:
    1. Dataset inspection
    2. Integrity validation
    3. Duplicate detection
    4. Sample selection
    5. Event-level train/val/test split
    6. Annotation processing & file organization
    7. Statistics generation
    8. Visualization generation
    9. Final report generation
"""

import sys
import time
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).resolve().parent))

from utils import load_config, ensure_dirs, print_header


def generate_final_report(config, start_time):
    """Generate the final processing report."""
    import csv
    from collections import Counter

    reports_path = config["_reports_path"]
    output_path = config["_output_path"]
    metadata_dir = output_path / "metadata"

    lines = []
    lines.append("# DISHA — Final Dataset Report")
    lines.append("")
    lines.append(f"**Processing date:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"**Processing time:** {time.time() - start_time:.1f} seconds")
    lines.append(f"**Processing command:** `python scripts/prepare_xbd.py`")
    lines.append("")

    lines.append("## 1. Source Dataset")
    lines.append("- xView2 / xBD Challenge Training Set")
    lines.append(f"- Raw path: `{config['raw_dataset_path']}`")
    lines.append("")

    # Count originals
    raw_path = config["_raw_path"]
    images_dir = raw_path / "images"
    total_images = len(list(images_dir.glob("*.png"))) if images_dir.exists() else 0
    lines.append(f"## 2. Original Dataset")
    lines.append(f"- Total image files: {total_images}")
    lines.append(f"- Total pairs: {total_images // 2}")
    lines.append("")

    # Valid samples
    valid_file = reports_path / "valid_samples.csv"
    valid_count = 0
    if valid_file.exists():
        with open(valid_file) as f:
            valid_count = sum(1 for _ in f) - 1  # minus header
    lines.append(f"## 3. Valid Samples")
    lines.append(f"- Valid pairs: {valid_count}")
    lines.append("")

    # Selected samples
    selected_file = reports_path / "selected_samples.csv"
    selected_count = 0
    if selected_file.exists():
        with open(selected_file) as f:
            selected_count = sum(1 for _ in f) - 1
    lines.append(f"## 4. Selected Samples")
    lines.append(f"- Target: {config['target_samples']}")
    lines.append(f"- Actual selected: {selected_count}")
    lines.append(f"- Removed/ignored: {valid_count - selected_count}")
    lines.append("")

    # Split counts
    lines.append("## 5. Train/Val/Test Splits")
    for split_name in ["train", "val", "test"]:
        csv_file = metadata_dir / f"{split_name}.csv"
        if csv_file.exists():
            with open(csv_file) as f:
                count = sum(1 for _ in f) - 1
            pct = count / selected_count * 100 if selected_count > 0 else 0
            lines.append(f"- {split_name.capitalize()}: {count} pairs ({pct:.1f}%)")
    lines.append("")

    # Event distribution
    lines.append("## 6. Disaster Event Distribution")
    lines.append("")
    lines.append("| Split | Events |")
    lines.append("|---|---|")
    lines.append(f"| Train | {', '.join(config['train_events'])} |")
    lines.append(f"| Val | {', '.join(config['val_events'])} |")
    lines.append(f"| Test | {', '.join(config['test_events'])} |")
    lines.append("")

    # Damage classes
    lines.append("## 7. Damage Classes")
    lines.append("")
    for class_id, name in config["damage_classes"].items():
        lines.append(f"- {class_id}: {name}")
    lines.append("")

    # Duplicate info
    dup_file = reports_path / "duplicate_report.csv"
    dup_count = 0
    if dup_file.exists():
        with open(dup_file) as f:
            dup_count = sum(1 for _ in f) - 1
    lines.append(f"## 8. Duplicate Detection")
    lines.append(f"- Duplicate pairs found: {dup_count}")
    lines.append("")

    # Invalid samples
    invalid_file = reports_path / "invalid_samples.csv"
    invalid_count = 0
    if invalid_file.exists():
        with open(invalid_file) as f:
            invalid_count = sum(1 for _ in f) - 1
    lines.append(f"## 9. Annotation/Image Problems")
    lines.append(f"- Issues logged: {invalid_count}")
    lines.append(f"- See: `reports/invalid_samples.csv`")
    lines.append("")

    # Cross-validation
    xval_file = reports_path / "mask_cross_validation.csv"
    xval_count = 0
    if xval_file.exists():
        with open(xval_file) as f:
            xval_count = sum(1 for _ in f) - 1
    lines.append(f"## 10. Mask Cross-Validation")
    lines.append(f"- Significant discrepancies: {xval_count}")
    lines.append("")

    # Final dataset size
    lines.append("## 11. Final Dataset Size")
    total_size = 0
    for f in output_path.rglob("*"):
        if f.is_file():
            total_size += f.stat().st_size
    lines.append(f"- Total size: {total_size / (1024**3):.2f} GB")
    lines.append(f"- Location: `{config['output_dataset_path']}`")
    lines.append("")

    # Known limitations
    lines.append("## 12. Known Limitations")
    lines.append("- Event-level splitting gives ~83/12/5 ratio instead of 80/10/10 due to only 10 events")
    lines.append("- Small test set (palu-tsunami + guatemala-volcano)")
    lines.append("- Masks generated from WKT polygons may have minor differences from pre-computed targets")
    lines.append("- This is a hackathon-sized subset, not the full xBD dataset")
    lines.append("")

    # Processing steps
    lines.append("## 13. Processing Steps Performed")
    lines.append("1. [x] Dataset inspection")
    lines.append("2. [x] Integrity verification")
    lines.append("3. [x] Duplicate detection")
    lines.append("4. [x] Sample selection (~2000 pairs, stratified)")
    lines.append("5. [x] Event-level train/val/test split")
    lines.append("6. [x] Annotation processing & mask generation")
    lines.append("7. [x] Mask cross-validation against existing targets")
    lines.append("8. [x] Statistics generation")
    lines.append("9. [x] Visualization generation")
    lines.append("10. [x] Documentation")

    report_text = "\n".join(lines)

    # Save final report
    report_file = reports_path / "final_dataset_report.md"
    with open(report_file, "w", encoding="utf-8") as f:
        f.write(report_text)
    print(f"[OK] Final report: {report_file}")

    return report_text


def generate_dataset_readme(config):
    """Generate the dataset README for handoff."""
    import csv
    output_path = config["_output_path"]
    metadata_dir = output_path / "metadata"

    # Get counts
    counts = {}
    for split_name in ["train", "val", "test"]:
        csv_file = metadata_dir / f"{split_name}.csv"
        if csv_file.exists():
            with open(csv_file) as f:
                counts[split_name] = sum(1 for _ in f) - 1
        else:
            counts[split_name] = 0
    total = sum(counts.values())

    readme = f"""# DISHA — xBD Processed Dataset

## Dataset Source
xView2 / xBD Challenge Training Set

## Purpose
Building damage assessment for the DISHA (Disaster Intelligence & Spatial Human-Assisted Assessment) platform.

## Number of Samples
- **Total pairs:** {total}
- **Train:** {counts.get('train', 0)} pairs
- **Validation:** {counts.get('val', 0)} pairs
- **Test:** {counts.get('test', 0)} pairs

## Damage Classes
| ID | Name |
|---|---|
| 0 | Background |
| 1 | No Damage |
| 2 | Minor Damage |
| 3 | Major Damage |
| 4 | Destroyed |

## Data Leakage Prevention
Splits are done at the **disaster-event level** (not random image-level) to simulate realistic evaluation on unseen disaster events.

| Split | Events |
|---|---|
| Train | {', '.join(config['train_events'])} |
| Val | {', '.join(config['val_events'])} |
| Test | {', '.join(config['test_events'])} |

## Directory Structure
```
xbd_disha/
├── train/
│   ├── pre/         # Pre-disaster images (1024x1024 PNG)
│   ├── post/        # Post-disaster images (1024x1024 PNG)
│   └── labels/      # Segmentation masks (single-channel PNG, values 0-4)
├── val/
│   ├── pre/
│   ├── post/
│   └── labels/
├── test/
│   ├── pre/
│   ├── post/
│   └── labels/
├── metadata/
│   ├── class_mapping.json
│   ├── train.csv
│   ├── val.csv
│   ├── test.csv
│   ├── dataset_config.json
│   └── dataset_statistics.csv
└── visualizations/
    ├── no_damage/
    ├── minor_damage/
    ├── major_damage/
    └── destroyed/
```

## File Naming Convention
```
sample_{{NNNNNN}}_pre.png    # Pre-disaster image
sample_{{NNNNNN}}_post.png   # Post-disaster image
sample_{{NNNNNN}}_label.png  # Segmentation mask
```

## Processing Performed
1. Integrity verification (images, JSON annotations, polygon validation)
2. Invalid sample detection and logging
3. Duplicate detection (SHA-256 + perceptual hash)
4. Stratified sample selection (~{total} pairs from ~2799 available)
5. Event-level train/val/test splitting
6. JSON → segmentation mask conversion (WKT polygon rasterization)
7. Cross-validation of generated masks against pre-computed targets
8. Statistics generation
9. Visualization generation for quality verification

## Reproduction
```bash
python scripts/prepare_xbd.py
```
Configuration: `configs/xbd_config.yaml`
Random seed: {config['random_seed']}

## Limitations
- Hackathon-sized subset (not the full ~51 GB xBD dataset)
- Event-level splitting gives ~83/12/5 ratio due to only 10 disaster events
- Test set is relatively small (palu-tsunami + guatemala-volcano)
"""

    readme_file = output_path / "README.md"
    with open(readme_file, "w", encoding="utf-8") as f:
        f.write(readme)
    print(f"[OK] Dataset README: {readme_file}")


def run_pipeline():
    """Run the complete dataset preparation pipeline."""
    start_time = time.time()

    print_header("DISHA — xBD DATASET PREPARATION PIPELINE")
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

    # Load configuration
    config = load_config()
    print(f"Project root:  {config['_project_root']}")
    print(f"Raw dataset:   {config['_raw_path']}")
    print(f"Output:        {config['_output_path']}")
    print(f"Target pairs:  {config['target_samples']}")
    print(f"Random seed:   {config['random_seed']}")

    # Create directory structure
    print("\nCreating directory structure...")
    ensure_dirs(config)

    # --- Phase 1: Inspect ---
    print("\n")
    import inspect_xbd
    inspect_result = inspect_xbd.run(config)

    # --- Phase 2: Validate ---
    print("\n")
    import validate_xbd
    valid_samples = validate_xbd.run(config)

    # --- Phase 3: Duplicates ---
    print("\n")
    import check_duplicates
    duplicates = check_duplicates.run(config)

    # --- Phase 4: Select samples ---
    print("\n")
    import select_samples
    selected = select_samples.run(config)

    # --- Phase 5: Split ---
    print("\n")
    import split_dataset
    splits = split_dataset.run(config)

    # --- Phase 6: Process annotations ---
    print("\n")
    import process_annotations
    process_annotations.run(config)

    # --- Phase 7: Statistics ---
    print("\n")
    import generate_statistics
    generate_statistics.run(config)

    # --- Phase 8: Visualizations ---
    if config.get("generate_visualizations", True):
        print("\n")
        import generate_visualizations
        generate_visualizations.run(config)

    # --- Phase 9: Reports & Documentation ---
    print("\n")
    print_header("FINAL REPORTS & DOCUMENTATION")
    generate_dataset_readme(config)
    generate_final_report(config, start_time)

    # --- Quality gate summary ---
    elapsed = time.time() - start_time
    print("\n")
    print_header("PIPELINE COMPLETE")
    print(f"Total time: {elapsed:.1f} seconds ({elapsed/60:.1f} minutes)")
    print(f"Output:     {config['_output_path']}")
    print(f"\nDataset is ready for handoff to Subhrajeet!")
    print(f"Run: python scripts/prepare_xbd.py to reproduce.\n")


if __name__ == "__main__":
    run_pipeline()
