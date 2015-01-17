define('helpers_local',
    ['apps', 'feed', 'compatibility_filtering', 'content-ratings', 'models',
     'nunjucks', 'regions', 'settings', 'urls', 'user_helpers', 'utils_local', 'z'],
    function(apps, feed, compatibility_filtering, iarc, models,
             nunjucks, regions, settings, urls, user_helpers, utils_local, z) {
    var filters = nunjucks.require('filters');
    var globals = nunjucks.require('globals');

    var rewriteCdnUrlMappings = [
        {
            name: 'Privacy Policy',
            pattern: /\/media\/docs\/privacy\/.+\.html/g,
            replacement: '/privacy-policy'
        },
        {
            name: 'Terms of Use',
            pattern: /\/media\/docs\/terms\/.+\.html/g,
            replacement: '/terms-of-use'
        }
    ];

    /* Register filters. */
    filters.json = JSON.stringify;
    if (nunjucks.env) {
        // For damper when rendering templates outside builder.
        nunjucks.env.addFilter('json', JSON.stringify);
    }

    filters.items = utils_local.items;

    filters.rewriteCdnUrls = function(text){
        // When we get a page back from legal docs stored on the CDN, we
        // need to rewrite them to work locally within a packaged version
        // of Marketplace.
        var rewriteCdnUrlMappings = [
            {
                name: 'Privacy Policy',
                pattern: /\/media\/docs\/privacy\/.+\.html/g,
                replacement: '/privacy-policy'
            },
            {
                name: 'Terms of Use',
                pattern: /\/media\/docs\/terms\/.+\.html/g,
                replacement: '/terms-of-use'
            }
        ];
        rewriteCdnUrlMappings.forEach(function(mapping){
            text = text.replace(mapping.pattern, mapping.replacement);
        });
        return text;
    };

    function has_installed(manifestURL) {
        return z.apps.indexOf(manifestURL) !== -1;
    }

    /* Global variables, provided in default context. */
    globals.feed = feed;
    globals.iarc_names = iarc.names;
    globals.NEWSLETTER_LANGUAGES = settings.NEWSLETTER_LANGUAGES;
    globals.REGIONS = regions.REGION_CHOICES_SLUG;
    globals.user_helpers = user_helpers;
    globals.PLACEHOLDER_ICON = urls.media('fireplace/img/icons/placeholder.png');
    globals.compatibility_filtering = compatibility_filtering;

    /* Helpers functions, provided in the default context. */
    function indexOf(arr, val) {
        return arr.indexOf(val);
    }

    function app_notices(app) {
        // App notices for the app detail page (e.g., not available,
        // works offline). Returns an array of gettext/classes.
        var notices = [];
        // Positive notices.
        if (app.is_offline) {
            notices.push([gettext('Works offline'), 'positive']);
        }
        // Negative notices.
        var incompat_notices = apps.incompat(app) || [];
        incompat_notices.forEach(function(notice) {
            notices.push([notice, 'negative']);
        });
        return notices;
    }

    var helpers = {
        app_incompat: apps.incompat,
        app_notices: app_notices,
        cast_app: models('app').cast,
        has_installed: has_installed,
        indexOf: indexOf,
    };

    for (var i in helpers) {
        // Put the helpers into the nunjucks global.
        if (helpers.hasOwnProperty(i)) {
            globals[i] = helpers[i];
        }
    }

    return helpers;
});
