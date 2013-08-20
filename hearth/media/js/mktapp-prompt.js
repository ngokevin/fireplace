/*
    Marketplace app prompt.

    If the user opens Marketplace via the browser, ask the user via a closable
    banner prompt whether they want to install or launch the Marketplace.
*/
define('mktapp-prompt',
    ['apps', 'capabilities', 'jquery',  'l10n', 'log', 'settings', 'storage', 'templates',
     'utils', 'z'],
    function(apps, capabilities, $, l10n, log, settings, storage, nunjucks,
             utils, z) {
    'use strict';

    var gettext = l10n.gettext;
    var console = log('mktapp-prompt');

    var mktInstalledApp;
    var $mktappPrompt = $('#mktapp-prompt');

    if (canShowPrompt()) {
        renderPrompt();
    }

    apps.checkInstalled(settings.mkt_packaged_url).then(function(app) {
        // Check whether Marketplace app is installed.
        // But assume it is already installed for fxOS.
        if (capabilities.firefoxOS || app) {
            mktInstalledApp = app;
            $('.install-or-launch').text(gettext('Launch now'));
        }
    });

    z.body.on('click', '.prompt-close', utils._pd(function() {
        // Close the prompt on click of the close button.
        $mktappPrompt.remove();
        storage.setItem('mktapp-prompt-closed', true);
    })).on('click', '.install-or-launch', utils._pd(function() {
        if (capabilities.firefoxOS) {
            // Use WebActivities to launch the preloaded Marketplace.
            var act = new MozActivity({
                name: 'marketplace-category',
                data: {slug: 'all'}
            });
            act.onerror = function() {
                console.log(this.error.name);
            };
        }
        else if (mktInstalledApp) {
            // Launch Marketplace if it is installed.
            mktInstalledApp.launch();
        } else {
            // Install Marketplace if it is not installed.
            apps.install({
                'name': 'Marketplace',
                'manifest_url': settings.mkt_packaged_url,
                'is_packaged': true,
            });
        }
    }));

    function canShowPrompt() {
        // Show if from the browser, if capable of installing packaged webapps,
        // and if prompt hasn't been closed before.
        var cap = capabilities;
        var onFxOS = cap.firefoxOS;
        var canPackaged = cap.packagedWebapps;
        var promptClosed = storage.getItem('mktapp-prompt-closed');
        return !promptClosed && !cap.chromeless && (onFxOS || canPackaged);
    }

    function renderPrompt() {
        // Load the prompt.
        $mktappPrompt.html(
            nunjucks.env.getTemplate('mktapp_prompt.html').render());
        $mktappPrompt.show();
    }

    return {
        canShowPrompt: canShowPrompt,
    };
});
