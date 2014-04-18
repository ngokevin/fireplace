define('settings_local', [], function() {
    // TODO: Allow us to change languages, media url, languages from the settings

    return {
        api_url: 'https://marketplace.firefox.com',
        body_classes: 'package',
        media_url: 'https://marketplace.cdn.mozilla.net/',
        tracking_enabled: true,
        potatolytics_enabled: true,
        package_version: '{fireplace_package_version}'
    };
});
