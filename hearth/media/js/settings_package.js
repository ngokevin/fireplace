define('settings_local', [], function() {
    // TODO: Allow us to change languages, media url, languages from the settings

    return {
        api_url: 'https://marketplace-dev.allizom.org',
        body_classes: 'package',
        media_url: 'https://marketplace-dev.mozflare.net/media/',
        tracking_enabled: true,
        potatolytics_enabled: true,
        package_version: '{fireplace_package_version}'
    };
});
