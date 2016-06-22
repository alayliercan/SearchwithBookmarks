var cm = require('sdk/context-menu');
var ss = require('sdk/simple-storage');
var tabs = require('sdk/tabs');
let { search } = require('sdk/places/bookmarks');
let { getFavicon } = require('sdk/places/favicon');
let { defer } = require('sdk/core/promise');
let { getMostRecentBrowserWindow } = require("sdk/window/utils");
const DEFAULT_FAVICON = "chrome://mozapps/skin/places/defaultFavicon.png";
const SEARCH_KEY = "%s";

var foundBookmarkTotal = 0;

var mainMenu = cm.Menu({
    label: 'Search with Bookmarks',
    context: cm.SelectionContext(),
    items: [cm.Item({ label: "No searchable bookmark found!", data: "", image: DEFAULT_FAVICON })]
});

tabs.on('ready', function(tab) {
    var contextMenuBuilder = searchBookmarks(SEARCH_KEY);
    contextMenuBuilder.then(function(foundBookmarks) {
        if (foundBookmarkTotal < foundBookmarks.length) {
            buildSubMenu(foundBookmarks);
        }
    }, function(e) {
        //console.log(e.message);
    });
});

function setFavIcon(searchURL, tab) {
    var searchURLDomain = extractDomain(searchURL);
    if (ss.storage[searchURLDomain] == null) {
        getFavicon(tab)
            .then(function(url) {
                ss.storage[searchURLDomain] = url;
                var cmitems = getMostRecentBrowserWindow().document.querySelectorAll(".addon-context-menu-item[value*='" + searchURLDomain + "']");
                for (var i = 0; i < cmitems.length; i++) {
                    cmitems[i].image = url;
                }
            });
    }
}

function searchBookmarks(strSearch) {
    var deferred = defer();
    try {
        search({
                query: strSearch
            }, {
                sort: 'title'
            })
            .on('end', function(foundBookmarks) {
                deferred.resolve(foundBookmarks);
            });

    } catch (e) {
        //console.log(e.message);
        deferred.reject(e);
    } finally {
        return deferred.promise;
    }
}

function extractDomain(url) {
    var domain;
    //find & remove protocol (http, ftp, etc.) and get domain
    if (url.indexOf("://") > -1) {
        domain = url.split('/')[2];
    } else {
        domain = url.split('/')[0];
    }
    //find & remove port number
    domain = domain.split(':')[0];
    return domain;
}

function buildSubMenu(foundBookmarks) {
    mainMenu.destroy();
    mainMenu = cm.Menu({
        label: 'Search with Bookmarks',
        context: cm.SelectionContext()
    });

    for (var i = 0; i < foundBookmarks.length; i++) {
        var foundBookmarkDomain = extractDomain(foundBookmarks[i].url);
        var subMenuItem = cm.Item({
            label: foundBookmarks[i].title,
            data: foundBookmarks[i].url,
            contentScript: 'self.on("click", function (node, data) {' +
                '  var text = window.getSelection().toString();' +
                '  var searchURL = data.replace("%s",text); ' +
                '  self.postMessage(searchURL); ' + '});',
            image: (ss.storage[foundBookmarkDomain] != null ? ss.storage[foundBookmarkDomain] :
                DEFAULT_FAVICON),
            onMessage: function(searchURL) {
                var openInNewTab = require('sdk/simple-prefs').prefs['openInNewTab'];
                if (openInNewTab) {
                    tabs.open({
                        url: searchURL,
                        onReady: function(tab) {
                            setFavIcon(searchURL, tab);
                        }
                    });
                } else {
                    tabs.activeTab.url = searchURL;
                    tabs.on('ready', function() {
                        setFavIcon(searchURL, tabs.activeTab);
                    });
                }
            }
        });
        foundBookmarkTotal = foundBookmarks.length;
        mainMenu.addItem(subMenuItem);
    }
}

exports.main = function() {
    var contextMenuBuilder = searchBookmarks(SEARCH_KEY);
    contextMenuBuilder.then(function(foundBookmarks) {
        if (foundBookmarkTotal < foundBookmarks.length) {
            buildSubMenu(foundBookmarks);
        }
    }, function(e) {
        //console.log(e.message);
    });
};


exports.onUnload = function() {
    mainMenu.destroy();
};
