(function() {
var a = require('assert');
var assert = a.assert;
var eq_ = a.eq_;
var mock = a.mock;


test('mktapp-prompt.canShowPrompt fxos-browser-true', function(done, fail) {
    mock(
        'mktapp-prompt',
        {
            capabilities: {
                firefoxOS: true,
                chromeless: false
            }
        },
        function(mktappPrompt) {
            eq_(mktappPrompt.canShowPrompt(), true);
            done();
        }, fail
    );
});


test('mktapp-prompt.canShowPrompt fxos-app-false', function(done, fail) {
    mock(
        'mktapp-prompt',
        {
            capabilities: {
                firefoxOS: true,
                chromeless: true
            }
        },
        function(mktappPrompt) {
            eq_(mktappPrompt.canShowPrompt(), false);
            done();
        }, fail
    );
});


test('mktapp-prompt.canShowPrompt browser-can-pacakged-true', function(done, fail) {
    mock(
        'mktapp-prompt',
        {
            capabilities: {
                firefoxOS: false,
                chromeless: false,
                packagedWebapps: true
            }
        },
        function(mktappPrompt) {
            eq_(mktappPrompt.canShowPrompt(), true);
            done();
        }, fail
    );
});


test('mktapp-prompt.canShowPrompt browser-can-packaged-false', function(done, fail) {
    mock(
        'mktapp-prompt',
        {
            capabilities: {
                firefoxOS: false,
                chromeless: false,
                packagedWebapps: false
            }
        },
        function(mktappPrompt) {
            eq_(mktappPrompt.canShowPrompt(), false);
            done();
        }, fail
    );
});


test('mktapp-prompt.canShowPrompt prompt-closed-false', function(done, fail) {
    mock(
        'mktapp-prompt',
        {
            capabilities: {
                firefoxOS: true,
                chromeless: false,
            },
            storage: {
                getItem: function(key) {
                    return true;
                },
                setItem: function() {
                    return;
                }
            }
        },
        function(mktappPrompt) {
            eq_(mktappPrompt.canShowPrompt(), false);
            done();
        }, fail
    );
});

})();