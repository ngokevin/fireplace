var sherlocked = require('sherlocked');

var PORT = require('./config').PORT;

var environments = [
    {
        browserName: 'firefox',
        platform: 'OS X 10.9'
    },
    {
        browserName: 'chrome',
        platform: 'OS X 10.9'
    }
];


var captures = {
    homePageOnMobile: function(client) {
        return client.setViewportSize({width: 320, height: 960})
            .url('http://localhost:' + PORT)
            .waitForExist('.feed-home', 30000);
    },
    homePageOnDesktop: function(client) {
        return client.setViewportSize({width: 1050, height: 2048})
            .url('http://localhost:' + PORT)
            .waitForExist('.feed-home', 30000);
    },
    popularPageOnMobile: function(client) {
        return client.setViewportSize({width: 320, height: 960})
            .url('http://localhost:' + PORT + '/popular')
            .waitForExist('.app-list', 30000);
    },
    popularPageOnDesktop: function(client) {
        return client.setViewportSize({width: 1050, height: 2048})
            .url('http://localhost:' + PORT + '/popular')
            .waitForExist('.app-list', 30000);
    },
    appDetailOnMobile: function(client) {
        // App detail page on mobile.
        return client.setViewportSize({width: 320, height: 960})
            .url('http://localhost:' + PORT + '/app/swanky-chocolate-9')
            .waitForExist('.mkt-tile', 30000);
    },
    appDetailOnDesktop: function(client) {
        // App detail page on desktop.
        return client.setViewportSize({width: 1050, height: 2048})
            .url('http://localhost:' + PORT + '/app/swanky-chocolate-9')
            .waitForExist('.mkt-tile', 30000);
    }
};


sherlocked.run({
    captures: captures,
    environments: environments
});
