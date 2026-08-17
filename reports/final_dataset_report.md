# DISHA — Final Dataset Report

**Processing date:** 2026-08-17 01:49:14
**Processing time:** 578.9 seconds
**Processing command:** `python scripts/prepare_xbd.py`

## 1. Source Dataset
- xView2 / xBD Challenge Training Set
- Raw path: `train_images_labels_targets/train`

## 2. Original Dataset
- Total image files: 5598
- Total pairs: 2799

## 3. Valid Samples
- Valid pairs: 2799

## 4. Selected Samples
- Target: 2000
- Actual selected: 2000
- Removed/ignored: 799

## 5. Train/Val/Test Splits
- Train: 1659 pairs (83.0%)
- Val: 247 pairs (12.3%)
- Test: 94 pairs (4.7%)

## 6. Disaster Event Distribution

| Split | Events |
|---|---|
| Train | socal-fire, hurricane-michael, hurricane-florence, hurricane-harvey, midwest-flooding, hurricane-matthew |
| Val | santa-rosa-wildfire, mexico-earthquake |
| Test | palu-tsunami, guatemala-volcano |

## 7. Damage Classes

- 0: background
- 1: no_damage
- 2: minor_damage
- 3: major_damage
- 4: destroyed

## 8. Duplicate Detection
- Duplicate pairs found: 1

## 9. Annotation/Image Problems
- Issues logged: 44
- See: `reports/invalid_samples.csv`

## 10. Mask Cross-Validation
- Significant discrepancies: 0

## 11. Final Dataset Size
- Total size: 5.59 GB
- Location: `data/processed/xbd_disha`

## 12. Known Limitations
- Event-level splitting gives ~83/12/5 ratio instead of 80/10/10 due to only 10 events
- Small test set (palu-tsunami + guatemala-volcano)
- Masks generated from WKT polygons may have minor differences from pre-computed targets
- This is a hackathon-sized subset, not the full xBD dataset

## 13. Processing Steps Performed
1. [x] Dataset inspection
2. [x] Integrity verification
3. [x] Duplicate detection
4. [x] Sample selection (~2000 pairs, stratified)
5. [x] Event-level train/val/test split
6. [x] Annotation processing & mask generation
7. [x] Mask cross-validation against existing targets
8. [x] Statistics generation
9. [x] Visualization generation
10. [x] Documentation