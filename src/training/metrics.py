import torch


NUM_CLASSES = 5


def confusion_matrix(predictions, targets, num_classes=NUM_CLASSES):
    """
    Compute a pixel-level confusion matrix.

    Rows    = ground truth
    Columns = prediction
    """

    predictions = predictions.view(-1)
    targets = targets.view(-1)

    mask = (
        (targets >= 0)
        & (targets < num_classes)
    )

    indices = (
        targets[mask] * num_classes
        + predictions[mask]
    )

    matrix = torch.bincount(
        indices,
        minlength=num_classes * num_classes,
    )

    return matrix.reshape(
        num_classes,
        num_classes,
    )


def calculate_iou(confusion):
    """
    Calculate IoU for each class.
    """

    true_positive = torch.diag(confusion)

    false_positive = (
        confusion.sum(dim=0) - true_positive
    )

    false_negative = (
        confusion.sum(dim=1) - true_positive
    )

    denominator = (
        true_positive
        + false_positive
        + false_negative
    )

    iou = true_positive.float() / denominator.clamp_min(1)

    return iou


def calculate_f1(confusion):
    """
    Calculate F1 score for each class.
    """

    true_positive = torch.diag(confusion).float()

    false_positive = (
        confusion.sum(dim=0)
        - torch.diag(confusion)
    ).float()

    false_negative = (
        confusion.sum(dim=1)
        - torch.diag(confusion)
    ).float()

    precision = (
        true_positive
        / (true_positive + false_positive).clamp_min(1)
    )

    recall = (
        true_positive
        / (true_positive + false_negative).clamp_min(1)
    )

    f1 = (
        2 * precision * recall
        / (precision + recall).clamp_min(1e-8)
    )

    return f1


def calculate_metrics(confusion):
    iou = calculate_iou(confusion)
    f1 = calculate_f1(confusion)

    # --------------------------------------------------
    # Non-background performance
    #
    # Classes:
    # 1 = no_damage
    # 2 = minor_damage
    # 3 = major_damage
    # 4 = destroyed
    # --------------------------------------------------

    non_background_miou = iou[1:].mean()
    non_background_mf1 = f1[1:].mean()

    # --------------------------------------------------
    # Actual damage performance
    #
    # Classes:
    # 2 = minor_damage
    # 3 = major_damage
    # 4 = destroyed
    # --------------------------------------------------

    damage_miou = iou[2:].mean()
    damage_mf1 = f1[2:].mean()

    return {
        "iou": iou,
        "f1": f1,

        "non_background_miou":
            non_background_miou,

        "non_background_mf1":
            non_background_mf1,

        "damage_miou":
            damage_miou,

        "damage_mf1":
            damage_mf1,
    }