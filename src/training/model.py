import segmentation_models_pytorch as smp


def create_model():
    model = smp.Unet(
        encoder_name="resnet18",
        encoder_weights=None,
        in_channels=6,
        classes=5,
        activation=None,
    )

    return model