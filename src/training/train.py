import argparse
import json
import time
from pathlib import Path

import torch
from torch.utils.data import DataLoader

from dataset import XBDDataset
from model import create_model
from losses import CombinedLoss
from losses_v8 import CombinedLossV8
from losses_v9 import CombinedLossV9
from metrics import confusion_matrix, calculate_metrics


CLASS_NAMES = [
    "background",
    "no_damage",
    "minor_damage",
    "major_damage",
    "destroyed",
]


def train_one_epoch(
    model,
    loader,
    criterion,
    optimizer,
    scaler,
    device,
    epoch,
):
    model.train()

    running_loss = 0.0
    running_ce = 0.0
    running_secondary = 0.0
    
    running_diagnostics = {
        "selected_damage": 0,
        "selected_non_damage": 0,
        "selected_minor": 0,
        "selected_major": 0,
        "selected_destroyed": 0,
    }

    start_time = time.time()

    for step, batch in enumerate(loader, start=1):
        images = batch["image"].to(
            device,
            non_blocking=True,
        )

        masks = batch["mask"].to(
            device,
            non_blocking=True,
        )

        optimizer.zero_grad(set_to_none=True)

        # Mixed precision
        with torch.amp.autocast(
            device_type="cuda",
            enabled=device.type == "cuda",
        ):
            predictions = model(images)

            total_loss, ce_loss, secondary_loss = criterion(
                predictions,
                masks,
            )

        scaler.scale(total_loss).backward()

        scaler.step(optimizer)
        scaler.update()

        running_loss += total_loss.item()
        running_ce += ce_loss.item()
        running_secondary += secondary_loss.item()
        
        if hasattr(criterion, "last_diagnostics"):
            for k, v in criterion.last_diagnostics.items():
                running_diagnostics[k] += v

        if step % 50 == 0 or step == len(loader):
            print(
                f"Epoch {epoch} | "
                f"Step {step}/{len(loader)} | "
                f"Loss {total_loss.item():.4f}"
            )

    elapsed = time.time() - start_time

    return {
        "loss": running_loss / len(loader),
        "ce": running_ce / len(loader),
        "secondary_loss": running_secondary / len(loader),
        "diagnostics": running_diagnostics,
        "time": elapsed,
    }


@torch.no_grad()
def validate(
    model,
    loader,
    criterion,
    device,
):
    model.eval()

    running_loss = 0.0
    running_ce = 0.0
    running_secondary = 0.0

    confusion = torch.zeros(
        5,
        5,
        dtype=torch.int64,
        device=device,
    )

    for batch in loader:
        images = batch["image"].to(
            device,
            non_blocking=True,
        )

        masks = batch["mask"].to(
            device,
            non_blocking=True,
        )

        with torch.amp.autocast(
            device_type="cuda",
            enabled=device.type == "cuda",
        ):
            predictions = model(images)

            total_loss, ce_loss, secondary_loss = criterion(
                predictions,
                masks,
            )

        running_loss += total_loss.item()
        running_ce += ce_loss.item()
        running_secondary += secondary_loss.item()

        predicted_classes = predictions.argmax(dim=1)

        confusion += confusion_matrix(
            predicted_classes,
            masks,
        )

    results = calculate_metrics(confusion)

    return {
    "loss": running_loss / len(loader),
    "ce": running_ce / len(loader),
    "secondary_loss": running_secondary / len(loader),

    "iou": results["iou"].detach().cpu(),
    "f1": results["f1"].detach().cpu(),

    "non_background_miou":
        results["non_background_miou"].item(),

    "non_background_mf1":
        results["non_background_mf1"].item(),

    "damage_miou":
        results["damage_miou"].item(),

    "damage_mf1":
        results["damage_mf1"].item(),
    }


def save_checkpoint(
    path,
    model,
    optimizer,
    scheduler,
    epoch,
    metrics,
):
    checkpoint = {
        "epoch": epoch,
        "model_state_dict": model.state_dict(),
        "optimizer_state_dict": optimizer.state_dict(),
        "scheduler_state_dict": scheduler.state_dict(),
        "metrics": metrics,
    }

    torch.save(checkpoint, path)


def main():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--epochs",
        type=int,
        default=20,
    )

    parser.add_argument(
        "--experiment",
        type=str,
        default="v9_ohem",
        choices=["v3_baseline", "v8_lovasz", "v9_ohem", "v9_ohem_5ep"],
    )

    parser.add_argument(
        "--batch-size",
        type=int,
        default=2,
    )

    parser.add_argument(
        "--image-size",
        type=int,
        default=512,
    )

    parser.add_argument(
        "--lr",
        type=float,
        default=1e-4,
    )

    args = parser.parse_args()

    # --------------------------------------------------
    # Device
    # --------------------------------------------------

    device = torch.device(
        "cuda" if torch.cuda.is_available() else "cpu"
    )

    print("=" * 70)
    print(f"DISHA DAMAGE SEGMENTATION TRAINING - {args.experiment.upper()}")
    print("=" * 70)

    print("Device:", device)

    if device.type == "cuda":
        print(
            "GPU:",
            torch.cuda.get_device_name(0),
        )

    # --------------------------------------------------
    # Output directory
    # --------------------------------------------------

    if args.experiment == "v9_ohem_5ep":
        output_dir = Path("models/disha_unet_v9_ohem_5ep")
    elif args.experiment == "v9_ohem":
        output_dir = Path("models/disha_unet_v9_ohem")
    elif args.experiment == "v8_lovasz":
        output_dir = Path("models/disha_unet_v8_lovasz")
    else:
        output_dir = Path("models/disha_unet_v3_baseline")
        
    output_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    # Save training configuration
    config = vars(args)

    with open(
        output_dir / "training_config.json",
        "w",
        encoding="utf-8",
    ) as f:
        json.dump(
            config,
            f,
            indent=4,
        )

    # --------------------------------------------------
    # Datasets
    # --------------------------------------------------

    print("\nLoading datasets...")

    train_dataset = XBDDataset(
    root_dir="data/processed/xbd_disha/train",
    image_size=args.image_size,
    train_mode=True,
    )

    val_dataset = XBDDataset(
    root_dir="data/processed/xbd_disha/val",
    image_size=args.image_size,
    train_mode=False,
    )

    print("Train samples:", len(train_dataset))
    print("Val samples:", len(val_dataset))

    # --------------------------------------------------
    # DataLoaders
    # --------------------------------------------------

    train_loader = DataLoader(
        train_dataset,
        batch_size=args.batch_size,
        shuffle=True,
        num_workers=0,
        pin_memory=True,
    )

    val_loader = DataLoader(
        val_dataset,
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=0,
        pin_memory=True,
    )

    # --------------------------------------------------
    # Model
    # --------------------------------------------------

    print("\nCreating model...")

    model = create_model().to(device)

    parameter_count = sum(
        parameter.numel()
        for parameter in model.parameters()
    )

    print(
        "Parameters:",
        f"{parameter_count:,}",
    )

    # --------------------------------------------------
    # Loss
    # --------------------------------------------------

    if args.experiment in ["v9_ohem", "v9_ohem_5ep"]:
        criterion = CombinedLossV9().to(device)
    elif args.experiment == "v8_lovasz":
        criterion = CombinedLossV8().to(device)
    else:
        criterion = CombinedLoss().to(device)

    # --------------------------------------------------
    # Optimizer
    # --------------------------------------------------

    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=args.lr,
        weight_decay=1e-4,
    )

    # --------------------------------------------------
    # Scheduler
    # --------------------------------------------------

    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer,
        mode="max",
        factor=0.5,
        patience=2,
        min_lr=1e-6,
    )

    # --------------------------------------------------
    # Mixed precision scaler
    # --------------------------------------------------

    scaler = torch.amp.GradScaler(
        "cuda",
        enabled=device.type == "cuda",
    )

    # --------------------------------------------------
    # Training
    # --------------------------------------------------

    best_damage_miou = -1.0

    history = []

    print("\nStarting training...")
    print("=" * 70)

    for epoch in range(
        1,
        args.epochs + 1,
    ):
        epoch_start = time.time()

        train_results = train_one_epoch(
            model,
            train_loader,
            criterion,
            optimizer,
            scaler,
            device,
            epoch,
        )

        val_results = validate(
            model,
            val_loader,
            criterion,
            device,
        )

        scheduler.step(
            val_results["damage_miou"]
        )

        current_lr = optimizer.param_groups[0]["lr"]

        epoch_time = time.time() - epoch_start

        print("\n" + "-" * 70)
        print(f"Epoch {epoch}/{args.epochs}")
        print("-" * 70)

        print(
            f"Train Loss : {train_results['loss']:.4f}"
        )

        print(
            f"Train CE   : {train_results['ce']:.4f}"
        )

        print(
            f"Train Sec  : {train_results['secondary_loss']:.4f}"
        )

        print(
            f"Val Loss   : {val_results['loss']:.4f}"
        )

        print(
            f"Val CE     : {val_results['ce']:.4f}"
        )

        print(
            f"Val Sec    : {val_results['secondary_loss']:.4f}"
        )

        print(
            f"Damage mIoU: "
            f"{val_results['damage_miou']:.4f}"
        )

        print(
            f"Damage mF1 : "
            f"{val_results['damage_mf1']:.4f}"
        )

        print(
            f"Non-bg mIoU: "
            f"{val_results['non_background_miou']:.4f}"
        )

        print(
            f"Non-bg mF1 : "
            f"{val_results['non_background_mf1']:.4f}"
        )

        print(
            f"Learning rate: {current_lr:.7f}"
        )

        print(
            f"Epoch time: {epoch_time:.1f}s"
        )
        
        if args.experiment in ["v9_ohem", "v9_ohem_5ep"]:
            print("\nOHEM Diagnostics (Epoch Aggregate):")
            for k, v in train_results["diagnostics"].items():
                print(f"  {k:20s}: {v}")

        print("\nPer-class metrics:")

        for class_id, class_name in enumerate(
            CLASS_NAMES
        ):
            print(
                f"  {class_name:15s} "
                f"IoU={val_results['iou'][class_id]:.4f} "
                f"F1={val_results['f1'][class_id]:.4f}"
            )

        # --------------------------------------------------
        # Save latest checkpoint
        # --------------------------------------------------

        save_checkpoint(
            output_dir / "last_model.pth",
            model,
            optimizer,
            scheduler,
            epoch,
            val_results,
        )

        # --------------------------------------------------
        # Save best checkpoint
        # --------------------------------------------------

        if (
            val_results["damage_miou"]
            > best_damage_miou
        ):
            best_damage_miou = (
                val_results["damage_miou"]
            )

            save_checkpoint(
                output_dir / "best_model.pth",
                model,
                optimizer,
                scheduler,
                epoch,
                val_results,
            )

            print(
                f"\n** New best model! "
                f"Damage mIoU = {best_damage_miou:.4f}"
            )

        history.append(
            {
                "epoch": epoch,
                "train": train_results,
                "val": {
                    "loss": val_results["loss"],
                    "ce": val_results["ce"],
                    "secondary_loss": val_results["secondary_loss"],
                    "damage_miou": val_results[
                        "damage_miou"
                    ],

                    "damage_mf1": val_results[
                        "damage_mf1"
                    ],

                    "non_background_miou": val_results[
                        "non_background_miou"
                    ],

                    "non_background_mf1": val_results[
                        "non_background_mf1"
                    ],
                    "iou": val_results[
                        "iou"
                    ].tolist(),
                    "f1": val_results[
                        "f1"
                    ].tolist(),
                },
                "lr": current_lr,
                "time": epoch_time,
            }
        )

        with open(
            output_dir / "history.json",
            "w",
            encoding="utf-8",
        ) as f:
            json.dump(
                history,
                f,
                indent=4,
            )

    print("\n" + "=" * 70)
    print("TRAINING COMPLETE")
    print("=" * 70)

    print(
        "Best damage mIoU:",
        f"{best_damage_miou:.4f}",
    )

    print(
        "Best checkpoint:",
        output_dir / "best_model.pth",
    )


if __name__ == "__main__":
    main()