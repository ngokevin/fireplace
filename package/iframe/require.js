/**
 * @license almond 0.2.9 Copyright (c) 2011-2014, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice,
        jsSuffixRegExp = /\.js$/;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap, lastIndex,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseParts = baseParts.slice(0, baseParts.length - 1);
                name = name.split('/');
                lastIndex = name.length - 1;

                // Node .js allowance:
                if (config.nodeIdCompat && jsSuffixRegExp.test(name[lastIndex])) {
                    name[lastIndex] = name[lastIndex].replace(jsSuffixRegExp, '');
                }

                name = baseParts.concat(name);

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            callbackType = typeof callback,
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (callbackType === 'undefined' || callbackType === 'function') {
            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback ? callback.apply(defined[name], args) : undefined;

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (config.deps) {
                req(config.deps, config.callback);
            }
            if (!callback) {
                return;
            }

            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        return req(cfg);
    };

    /**
     * Expose module registry for debugging and tooling
     */
    requirejs._defined = defined;

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());
define('logger', [], function() {
    function log() {
        // `console.log` wrapper that prefixes log statements.
        console.log('[yulelog]', Array.prototype.slice.call(arguments, 0).join(' '));
    }

    return {
        log: log, 
    };
});
define('settings', [], function() {
    return {
        MKT_URL: document.body.dataset.mktUrl,
    };
});
define('messages', ['logger', 'settings'],
    function(logger, settings) {

    var activitiesInProgress = {};
    var activitiesToSend = [];

    function postMessage(msg) {
        logger.log('postMessaging to ' + settings.MKT_URL + ': ' + JSON.stringify(msg));
        document.querySelector('iframe').contentWindow.postMessage(msg, settings.MKT_URL);
    }

    function sendActivities() {
        logger.log('Sending activities: ' + JSON.stringify(activitiesToSend));
        while (activitiesToSend.length) {
            postMessage(activitiesToSend.pop());
        }
        // The next time we try to append something to `activitiesToSend`,
        // we'll have already called this function (`sendActivities`)
        // so just postMessage the message (`msg`) immediately.
        activitiesToSend = {
            push: function(msg) {
                postMessage(msg);
            }
        };
    }

    function queueMessage(msg) {
        activitiesToSend.push(msg);
    }

    function install() {
        window.addEventListener('message', function(e) {
            // Receive postMessage from the iframe contents and do something with it.
            logger.log('Handled post message from ' + e.origin + ': ' + JSON.stringify(e.data));
            if (e.origin !== settings.MKT_URL) {
                logger.log('Ignored post message from ' + e.origin + ': ' + JSON.stringify(e.data));
                return;
            }
            if (e.data === 'loaded') {
                logger.log('Preparing to send activities ...');
                sendActivities();
            } else if (e.data.type === 'fxa-watch') {
                logger.log('Registering FxA callbacks');
                navigator.mozId.watch({
                    wantIssuer: 'firefox-accounts',
                    loggedInUser: e.data.email,
                    onready: function() {},
                    onlogin: function(a) {logger.log('fxa-login'); postMessage({type: 'fxa-login', assertion: a});},
                    onlogout: function() {logger.log('fxa-logout'); postMessage({type: 'fxa-logout'});}
                });
            } else if (e.data.type === 'fxa-request') {
                navigator.mozId.request({oncancel: function(){postMessage({type: 'fxa-cancel'});}});
            } else if (e.data.type == 'activity-result' && e.data.id && activitiesInProgress[e.data.id]) {
                logger.log('Posting back result for activity id:', e.data.id);
                activitiesInProgress[e.data.id].postResult(e.data.result);
                delete activitiesInProgress[e.data.id];
            } else if (e.data.type == 'activity-error' && e.data.id && activitiesInProgress[e.data.id]) {
                logger.log('Posting back error for activity id:', e.data.id);
                activitiesInProgress[e.data.id].postError(e.data.result);
                delete activitiesInProgress[e.data.id];
            }
        }, false);
    }

    return {
        activitiesInProgress: activitiesInProgress,
        install: install,
        queueMessage: queueMessage,
    };
});
define('activities', ['logger', 'messages'], function(logger, messages) {
    function getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min)) + min;
    }

    function install() {
        logger.log('Activity support?', !!navigator.mozSetMessageHandler);
        if (navigator.mozSetMessageHandler) {
            navigator.mozSetMessageHandler('activity', function(req) {
                logger.log('Activity name: ', req.source.name);
                logger.log('Activity data: ', JSON.stringify(req.source.data));
                var msg = {
                    name: req.source.name || '',
                    data: req.source.data || {}
                };
                if (msg.name === 'marketplace-openmobile-acl') {
                    // For each activity expecting a returnValue (at the moment
                    // only "marketplace-openmobile-acl", keep the request around,
                    // generating an unique id. When we receive back a message
                    // saying an activity is done, if the id matches one we have,
                    // post the result back to the activity caller).
                    msg.id = getRandomInt(0, Number.MAX_SAFE_INTEGER);
                    messages.activitiesInProgress[msg.id] = req;
                    logger.log('This activity needs to return, generated id: ', msg.id);
                    // 'marketplace-openmobile-acl' also needs to wait on a
                    // getFeature() promise before sending the activity message.
                    if (typeof navigator.getFeature !== 'undefined') {
                        navigator.getFeature('acl.version').then(function(val) {
                            logger.log('Sending activity with acl.version: ', val);
                            msg.data.acl_version = val;
                            messages.queueMessage(msg);
                        });
                    }
                    // Don't bother sending this one if getFeature() is absent.
                    return;
                }
                messages.queueMessage(msg);
            });
        }
    }

    return {
        install: install,
    };
});
define('features', ['logger'], function(logger) {
    // Bump this number every time you add a feature. It must match zamboni's
    // settings.APP_FEATURES_VERSION.
    var APP_FEATURES_VERSION = 8;

    function buildFeaturesPromises() {
        var promises = [];
        // The order matters - we'll push promises in the same order to
        // generate the features signature.
        var features = [
            // false,  // Hardcoded boolean value.
            // 'mozApps' in navigator,  // Dynamic boolean value.
            // ['hardware.memory', 512],  // getFeature() with comparison.
            // 'api.window.MozMobileNetworkInfo',  // hasFeature().

            // We are only interested in a few features for now. We're already
            // only doing this if getFeature() is present, and it was
            // introduced in 2.0, so we know we can hardcode anything that
            // comes with 2.0 and for which we don't need to know the exact
            // value.
            true, // 'getMobileIdAssertion' in window.navigator || 'api.window.Navigator.getMobileIdAssertion',
            true, // 'manifest.precompile',
            ['hardware.memory', 512],
            ['hardware.memory', 1024],
            true, // NFC
            'acl.version', // OpenMobile ACL
            // Don't add any more as long as bug 1172487 is not fixed, it won't
            // work correctly.
        ];

        features.forEach(function(key) {
            if (typeof key === 'boolean') {
                // Hardcoded boolean value, just pass it directly.
                promises.push(key);
            } else if (typeof key === 'string') {
                if (key === 'acl.version') {
                    // This feature has a value, so we need to call
                    // getFeature(), but we actually only care about the fact
                    // that it's not empty, so we can just use the getFeature()
                    // promise directly.
                    promises.push(navigator.getFeature(key));
                } else if (typeof navigator.hasFeature !== 'undefined') {
                    // Regular boolean feature: just call hasFeature().
                    promises.push(navigator.hasFeature(key));
                } else {
                    // We should be using hasFeature() but it's absent, return
                    // false.
                    promises.push(false);
                }
            } else {
                // We are dealing with a more complex case, where we need to
                // call getFeature() and compare against a value.
                var feature = key[0];
                var value = key[1];
                // We need to wrap the getFeature() Promise into one of our own
                // that does the comparison, so that we can just call
                // Promise.all later and get only booleans.
                promises.push(new Promise(function(resolve, reject) {
                    navigator.getFeature(feature).then(function(data) {
                        resolve(data >= value);
                    });
                }));
            }
        });
        return Promise.all(promises);
    }

    function generateFeatureProfile() {
        return buildFeaturesPromises().then(function(promises) {
            // Build the signature:
            // - First, get a binary representation of all the feature flags.
            //   the first 47 (!) are currently hardcoded as true.
            var hardcoded_signature_part = '11111111111111111111111111111111111111111111111';
            var features_int = parseInt(
                hardcoded_signature_part +
                promises.map(function(x) { return !!x ? '1' : '0'; }).join(''),
            2);
            var profile = [
                // First part is the hexadecimal string built from the array
                // containing the results from all the promises (which should
                // only be booleans);
                features_int.toString(16),
                // Second part is the number of features checked. The hardcoded
                // features are added to the number of promises we checked.
                promises.length + hardcoded_signature_part.length,
                // Last part is a hardcoded version number, to bump whenever
                // we make changes.
                APP_FEATURES_VERSION
            ].join('.');
            logger.log('Generated profile: ' + profile);
            return profile;
        });
    }

    return {
        generateFeatureProfile: generateFeatureProfile
    };
});
define('translations', [], function() {
    var languages = [
        'bg', 'bn-BD', 'ca', 'cs', 'da', 'de', 'el', 'en-US', 'es', 'eu', 'fr',
        'ga-IE', 'hr', 'hu', 'it', 'ja', 'ko', 'mk', 'nb-NO', 'nl', 'pa',
        'pl', 'pt-BR', 'ro', 'ru', 'sk', 'sq', 'sr', 'sr-Latn', 'ta', 'tr',
        'xh', 'zh-CN', 'zh-TW', 'zu', 'dbg'
    ];

    var lang_expander = {
         'en': 'en-US', 'ga': 'ga-IE',
         'pt': 'pt-BR', 'sv': 'sv-SE',
         'zh': 'zh-CN', 'sr': 'sr-Latn'
    };

    function get_locale(locale) {
        if (languages.indexOf(locale) !== -1) {
            return locale;
        }
        locale = locale.split('-')[0];
        if (languages.indexOf(locale) !== -1) {
            return locale;
        }
        if (locale in lang_expander) {
            locale = lang_expander[locale];
            if (languages.indexOf(locale) !== -1) {
                return locale;
            }
        }
        return 'en-US';
    }
    var qs_lang = /[\?&]lang=([\w\-]+)/i.exec(window.location.search);
    var locale = get_locale((qs_lang && qs_lang[1]) || navigator.language);

    var translations = {
        "offline-error-message": {
            "bg": "Извинявайте, трябва да сте свързани към мрежа, за да посетите Marketplace.",
            "cs": "Omlouváme se, ale pro přístup k Marketplace musíte být online.",
            "da": "Du skal være online for at få adgang til Marketplace.",
            "de": "Es tut uns leid, Sie müssen online sein, um auf den Marketplace zuzugreifen.",
            "el": "Λυπούμαστε, πρέπει να είστε συνδεδεμένοι στο διαδίκτυο για να χρησιμοποιήσετε το Marketplace.",
            "en-US": "Sorry, you need to be online to access the Marketplace.",
            "es": "Lo sentimos, necesitas estar conectado para acceder al Marketplace.",
            "eu": "Sentitzen dugu, Marketplace-era sartzeko linean egon behar duzu.",
            "fr": "Vous devez être en ligne pour accéder au Marketplace.",
            "hu": "Elnézést, a Marketplace eléréséhez internetkapcsolat szükséges.",
            "it": "Spiacenti, devi essere online per poter accedere al Marketplace.",
            "ja": "申し訳ありませんが、Marketplace へアクセスするにはインターネット接続が必要です。",
            "nb-NO": "Du må være tilkoblet for å få tilgang til Marketplace.",
            "nl": "Sorry, u dient online te zijn om de Marketplace te bezoeken.",
            "pa": "ਅਫਸੋਸ, ਮੰਡੀ ਵਰਤਣ ਲਈ ਤੁਹਾਨੂੰ ਆਨਲਾਈਨ ਹੋਣ ਦੀ ਲੋੜ ਹੈ।",
            "pl": "Przepraszamy, musisz być online, by mieć dostęp do Marketplace.",
            "pt-BR": "Desculpe, você precisa estar on-line para acessar o Marketplace.",
            "ru": "Для доступа к Marketplace вам необходимо подключиться к сети.",
            "sk": "Ospravedlňujeme sa, ale pre prístup k službe Marketplace musíte byť online.",
            "sq": "Na ndjeni, lypset të jeni i lidhur në linjë për të përdorur Marketplace-in.",
            "sr": "Жао нам је, морате бити на мрежи да бисте приступили Marketplace-у.",
            "sr-Latn": "Žao nam je, morate biti na mreži da biste pristupili Marketplace-u.",
            "tr": "Üzgünüz, Marketplace'e erişmek için çevrimiçi olmalısınız.",
            "xh": "Uxolo, kudingeka ube kwi-intaneti ukufikelela kwi-Marketplace",
            "zh-CN": "抱歉，您需要在线才能访问应用市场。",
            "zh-TW": "抱歉，您必須連線到網路才能使用 Marketplace。",
            "zu": "Siyaxolisa, kudingeka ukuthi ube semoyeni ukuze ukwazi ukufinyelela ku-Marketplace.",
            "dbg": "Şǿřřẏ, ẏǿŭ ƞḗḗḓ ŧǿ ƀḗ ǿƞŀīƞḗ ŧǿ ȧƈƈḗşş ŧħḗ Ḿȧřķḗŧƥŀȧƈḗ."
        },
        "date-error-message": {
            "bg": "Извинявайте, часовникът на устройството е неточен.",
            "cs": "Omlouváme se, ale čas na vašem zařízení není nastaven korektně.",
            "da": "Beklager, men uret på din enhed ser ud til at være forkert indstillet.",
            "de": "Es tut uns leid, die Uhr Ihres Geräts scheint falsch eingestellt zu sein.",
            "el": "Λυπούμαστε, το ρολόι της συσκευής σας έχει ρυθμιστεί λανθασμένα. ",
            "en-US": "Sorry, your device clock appears to be set incorrectly.",
            "es": "Lo sentimos, el reloj de tu dispositivo parece estar configurado incorrectamente.",
            "eu": "Sentitzen dugu, dirudienez zure gailuaren erlojua gaizki konfiguratuta dago.",
            "fr": "Désolé, il semblerait que l'horloge de votre périphérique ne soit pas correctement configurée.",
            "hu": "Elnézést, úgy tűnik a készülék órája nem jól jár.",
            "it": "Spiacenti, l’orologio del dispositivo in uso sembra non essere impostato correttamente.",
            "ja": "申し訳ありませんが、お使いの端末の時刻設定が正しくないようです。",
            "nb-NO": "Beklager, men klokken på din enhet ser ut til å være feilinnstilt.",
            "nl": "Sorry, uw apparaatklok lijkt niet juist te zijn ingesteld.",
            "pa": "ਅਫਸੋਸ, ਤੁਹਾਡੇ ਯੰਤਰ ਦੀ ਘੜੀ ਗਲਤ ਚੱਲਦੀ ਜਾਪਦੀ ਹੈ।",
            "pl": "Przepraszamy, wygląda na to, że zegar twojego urządzenia jest ustawiony niepoprawnie.",
            "pt-BR": "Desculpe, o relógio do seu aparelho parece estar configurado incorretamente.",
            "ru": "К сожалению, похоже, что часы на вашем устройстве установлены неправильно.",
            "sk": "Ospravedlňujeme sa, ale čas na vašom zariadení nie je nastavený správne.",
            "sq": "Na ndjeni, ora e pajisjes suaj duket se nuk është rregulluar saktë.",
            "sr": "Жао нам је, изгледа да је Ваш сат уређаја погрешно подешен.",
            "sr-Latn": "Žao nam je, izgleda da je Vaš sat uređaja pogrešno podešen.",
            "tr": "Üzgünüz, cihazınızın saati yanlış ayarlanmış görünüyor.",
            "xh": "Uxolo, ixesha lesixhobo sakho libonakala lisetwe ngokungachanekanga.",
            "zh-CN": "抱歉，您的设备时钟似乎有误。",
            "zh-TW": "抱歉，您的裝置時間錯誤。",
            "zu": "Siyaxolisa, kubonakala sengathi iwashi ledivayisi yakho alihambi kahle.",
            "dbg": "Şǿřřẏ, ẏǿŭř ḓḗṽīƈḗ ƈŀǿƈķ ȧƥƥḗȧřş ŧǿ ƀḗ şḗŧ īƞƈǿřřḗƈŧŀẏ."
        },
        "date-error-message-suggestion": {
            "bg": "Моля, настройте датата и часа на устройството ви, за да посетите Marketplace.",
            "cs": "Pro přístup k Marketplace si prosím nastavte na svém zařízení aktuální datum a čas.",
            "da": "Indstil dags dato og klokkeslæt på din enhed for at få adgang til Marketplace.",
            "de": "Bitte stellen Sie in Ihren Geräteeinstellungen das heutige Datum und die Uhrzeit ein, um auf den Marketplace zuzugreifen.",
            "el": "Παρακαλούμε ρυθμίστε την σημερινή ημερομηνία και ώρα από τις ρυθμίσεις της συσκευής σας, για να αποκτήσετε πρόσβαση στο Marketplace.",
            "en-US": "Please set today's date and time in your device settings to access the Marketplace.",
            "es": "Por favor establece la fecha y hora de hoy en las opciones de tu dispositivo para poder acceder a Marketplace.",
            "eu": "Ezarri gaurko eguna eta ordua zure gailuaren ezarpenetan Marketplace-era sartzeko.",
            "fr": "Merci de configurer correctement la date et l'heure dans les paramètres de votre appareil pour pouvoir accéder au Marketplace.",
            "hu": "Állítsa be a mai dátumot és időt a készülék beállításaiban a Marketplace eléréséhez.",
            "it": "Imposta ora e data correnti nelle impostazioni del dispositivo per accedere al Marketplace.",
            "ja": "端末の設定で現在の日時を正しく設定してから Marketplace へアクセスしてください。",
            "nb-NO": "Sett dagens dato og klokkeslett i enhetsinnstillingene for å få tilgang til Marketplace.",
            "nl": "Stel in uw apparaatinstellingen de datum en tijd van vandaag in om de Marketplace te benaderen.",
            "pa": "ਮੰਡੀ ਦੀ ਵਰਤੋਂ ਕਰਨ ਲਈ ਆਪਣੇ ਯੰਤਰ ਦੀ ਸੈਟਿੰਗ ਵਿੱਚ ਅੱਜ ਦਾ ਸਮਾਂ ਤੇ ਮਿਤੀ ਦਿਉ।",
            "pl": "Ustaw dzisiejszą datę i czas w ustawieniach swojego urządzenia, by mieć dostęp do Marketplace.",
            "pt-BR": "Por favor, atualize a data e a hora do seu aparelho para acessar o Marketplace.",
            "ru": "Пожалуйста, установите текущую дату и время в настройках вашего устройства для доступа к Marketplace.",
            "sk": "Pre prístup k službe Marketplace si prosím nastavte na svojom zariadení aktuálny dátum a čas.",
            "sq": "Ju lutemi, që të përdorni Marketplace-in, rregulloni te pajisja juaj datën e sotme dhe orën e tanishme.",
            "sr": "Молимо подесите данашњи датум и време у поставкама Вашег уређаја да бисте приступили Marketplace-у.",
            "sr-Latn": "Molimo podesite današnji datum i vreme u postavkama Vašeg uređaja da biste pristupili Marketplace-u.",
            "tr": "Marketplace'e erişmek için lütfen cihaz ayarlarınızdan bugünün tarihini ve saatini ayarlayın.",
            "xh": "Nceda usete umhla nexesha lanamhlanje kwiisetingi zesixhobo sakho ukufikelela kwi-Marketplace.",
            "zh-CN": "请在您的设备设置中设置今天的日期和时间以访问应用市场。",
            "zh-TW": "請將您的裝置時間設定至今天以使用 Marketplace。",
            "zu": "Uyacelwa usethe usuku lwanamuhla kanye nesikhathi kumasethingi edivayisi yakho ukuze ukwazi ukufinyelela ku-Marketplace.",
            "dbg": "Ƥŀḗȧşḗ şḗŧ ŧǿḓȧẏ'ş ḓȧŧḗ ȧƞḓ ŧīḿḗ īƞ ẏǿŭř ḓḗṽīƈḗ şḗŧŧīƞɠş ŧǿ ȧƈƈḗşş ŧħḗ Ḿȧřķḗŧƥŀȧƈḗ."
        },
        "try-again": {
            "bg": "Повторен опит",
            "cs": "Zkusit znovu",
            "da": "Prøv igen",
            "de": "Erneut versuchen",
            "el": "Προσπαθήστε ξανά",
            "en-US": "Try again",
            "es": "Intenta de nuevo",
            "eu": "Saiatu berriro",
            "fr": "Réessayer",
            "hu": "Újra",
            "it": "Riprova",
            "ja": "再読み込み",
            "nb-NO": "Prøv igjen",
            "nl": "Opnieuw proberen",
            "pa": "ਮੁੜ ਕੋਸ਼ਿਸ਼ ਕਰੋ",
            "pl": "Spróbuj ponownie",
            "pt-BR": "Tente novamente",
            "ru": "Попробовать снова",
            "sk": "Skúsiť znova",
            "sq": "Riprovoni",
            "sr": "Покушај поново",
            "sr-Latn": "Pokušaj ponovo",
            "tr": "Tekrar dene",
            "xh": "Zama kwakhona",
            "zh-CN": "重试",
            "zh-TW": "重試",
            "zu": "Zama futhi",
            "dbg": "Ŧřẏ ȧɠȧīƞ"
        }
    };

    var transName;
    var transBlocks = document.querySelectorAll('[data-l10n]');
    for (var i = 0; i < transBlocks.length; i++) {
        transName = transBlocks[i].dataset.l10n;
        if (transName in translations && locale in translations[transName]) {
            transBlocks[i].innerHTML = translations[transName][locale];
        }
    }
});
require(
    ['activities', 'features', 'logger', 'messages', 'settings', 'translations'],
    function(activities, features, logger, messages, settings, translations) {

    logger.log('MKT_URL:', settings.MKT_URL);

    function buildQS(profile) {
        var qs = [];

        try {
            // navigator.mozMobileConnections is the new API.
            // navigator.mozMobileConnection is the legacy API.
            var conn = navigator.mozMobileConnections;
            var network;
            if (conn) {
                logger.log('navigator.mozMobileConnections available');
                var mccs = [];
                var connData;
                for (var i = 0; i < conn.length; i++) {
                    connData = conn[i];
                    // Testing lastKnownHomeNetwork first is important, because it's the
                    // only one which contains the SPN.
                    network = (connData.lastKnownHomeNetwork || connData.lastKnownNetwork || '-').split('-');
                    logger.log('navigator.mozMobileConnections[' + i + '].lastKnownNetwork:',
                        connData.lastKnownNetwork);
                    logger.log('navigator.mozMobileConnections[' + i + '].lastKnownHomeNetwork:',
                        conn.lastKnownHomeNetwork);
                    mccs.push({mcc: network[0], mnc: network[1], spn: network[2]});
                }
                mccs = JSON.stringify(mccs);
                qs.push('mccs=' + mccs);
                logger.log('MCCs: ' + mccs);
            } else {
                logger.log('navigator.mozMobileConnections unavailable');

                conn = navigator.mozMobileConnection;
                if (conn) {
                    logger.log('navigator.mozMobileConnection available');
                    // `MCC`: Mobile Country Code
                    // `MNC`: Mobile Network Code
                    // `lastKnownHomeNetwork`: `{MCC}-{MNC}` (SIM's origin)
                    // `lastKnownNetwork`: `{MCC}-{MNC}` (could be different network if roaming)
                    network = (conn.lastKnownHomeNetwork || conn.lastKnownNetwork || '-').split('-');
                    qs.push('mcc=' + (network[0] || ''));
                    qs.push('mnc=' + (network[1] || ''));
                    logger.log('navigator.mozMobileConnection.lastKnownNetwork:',
                        conn.lastKnownNetwork);
                    logger.log('navigator.mozMobileConnection.lastKnownHomeNetwork:',
                        conn.lastKnownHomeNetwork);
                    logger.log('MCC: "' + network[0] + '", MNC: "' + network[1] + '"');
                } else {
                    logger.log('navigator.mozMobileConnection unavailable');
                }
            }
        } catch(e) {
            // Fail gracefully if `navigator.mozMobileConnection(s)`
            // gives us problems.
        }

        if ('id' in navigator) {
            qs.push('nativepersona=true');
        }

        if (profile) {
            qs.push('pro=' + profile);
        }

        return qs.join('&');
    }

    // The iframe src is served over https, which means that if the system date
    // is too far behind, the user will just end up seeing a certificate error.
    // We check against an hardcoded year corresponding to the current certificate
    // creation date, and display an error message if necessary.
    function isSystemDateIncorrect() {
        logger.log('Checking for system date ...');
        var rval = new Date().getFullYear() < 2015;
        if (rval) {
            logger.log('System date appears to be incorrect!');
        } else {
            logger.log('System date appears to be OK.');
        }
        return rval;
    }

    if (isSystemDateIncorrect()) {
        document.body.classList.add('dateerror');

        document.querySelector('.try-again').addEventListener('click', function() {
            if (!isSystemDateIncorrect()) {
                window.location.reload();
            }
        }, false);
    } else {
        // Build the iframe. If we have Promise and getFeature, we build the
        // profile signature first.
        if (typeof window.Promise !== 'undefined' &&
            typeof navigator.getFeature !== 'undefined') {
            logger.log('navigator.getFeature and window.Promise available');
            features.generateFeatureProfile().then(function(profile) {
                launchIframe(profile);
            });
        } else {
            logger.log('navigator.getFeature or window.Promise unavailable :(');
            launchIframe();
        }

        // When refocussing the app, toggle the iframe based on `navigator.onLine`.
        window.addEventListener('focus', toggleOffline, false);

        toggleOffline(true);

        document.querySelector('.try-again').addEventListener('click', function() {
            toggleOffline();
        }, false);
    }

    function launchIframe(profile) {
        // Set the iframe src to the actual Marketplace.
        var iframe = document.getElementById('iframe');
        iframe.onerror = function() {
            document.body.classList.add('offline');
        };
        iframe.src = settings.MKT_URL + '/?' + buildQS(profile);
    }

    function toggleOffline(init) {
        logger.log('Checking for network connection ...');
        if (navigator.onLine === false) {
            // Hide iframe.
            logger.log('Network connection not found; hiding iframe ...');
            document.body.classList.add('offline');
        } else {
            // Show iframe.
            logger.log('Network connection found; showing iframe ...');
            if (!init) {
                // Reload the page to reload the iframe.
                window.location.reload();
            }
        }
    }

    // Set up messages and activities late in order to load the iframe as
    // quickly as possible.
    messages.install();
    activities.install();
})();
