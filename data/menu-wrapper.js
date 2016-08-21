const ss = require('sdk/simple-storage');
const { Class } = require('sdk/core/heritage');
const { defer } = require("sdk/core/promise");
const { search } = require('sdk/places/bookmarks');
const { sha256 } = require("./sha256.js");
const { firefoxIcons } = require("./firefox-icons.js");

//Parse given URL
function extractDomain(url) {
    var objUrl = require("sdk/url").URL(url);
    var domain = objUrl.scheme + "://" + objUrl.host;
    return domain;
}

//Search user's bookmarks for specified keyword
function searchBookmarks(keyword) {
    var deferred = defer();
    try {
        search({
                query: keyword
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

var SWBMenuItem = Class({
    initialize: function initialize(title, url, tags, orphan, favicon, order) {
        this.identity = sha256.convert(url);
        this.domain = extractDomain(url);
        this.title = title;
        this.url = url;
        this.tags = typeof tags !== 'undefined' ? tags : [];
        this.orphan = typeof orphan !== 'undefined' ? orphan : false;
        this.favicon = typeof favicon !== 'undefined' ? favicon : firefoxIcons.BOOKMARKDEFAULT;
        this.order = typeof order !== 'undefined' ? order : 0;
    },
    type: 'SWBMenuItem',
    toString: function toString() {
        return "{ 'identity' : '" + this.identity + "','name':'" + this.title + "'}";
    }
});

var SWBMenu = Class({
    initialize: function initialize(name) {
        this.name = name;
        this.menu = {
            'items': [],
            'count': 0
        };
        if (ss.storage['swbmenu'] != null) {
            this.menu = JSON.parse(ss.storage['swbmenu']);
        };
    },
    type: 'SWBMenu',
    updateByBookmarks: function updateByBookmarks(searchKeyword) {
        var deferredSearchBookmarks = searchBookmarks(searchKeyword);
        var thisRef = this;
        deferredSearchBookmarks.then(function(foundBookmarks) {
            if (thisRef.menu.count == 0) {
                for (var i = 0; i < foundBookmarks.length; i++) {
                    var swbMenuItem = new SWBMenuItem(foundBookmarks[i].title, foundBookmarks[i].url, foundBookmarks[i].tags, false);
                    thisRef.insertMenuItem(swbMenuItem);
                }
            }
            if (thisRef.menu.count > 0) {
                for (var j = 0; j < thisRef.menu.items.length; j++) {
                    thisRef.menu.items[j].orphan = true;
                }
                for (var k = 0; k < foundBookmarks.length; k++) {
                    var swbMenuItem = new SWBMenuItem(foundBookmarks[k].title, foundBookmarks[k].url, foundBookmarks[k].tags, false);
                    thisRef.updateMenuItem(swbMenuItem);
                }
            }
            thisRef.save();
        }, function(e) {
            //console.log(e.message);
        });
    },
    insertMenuItem: function insertMenuItem(menuItem) {
        if (menuItem instanceof SWBMenuItem) {
            this.menu.items.push(menuItem);
            this.menu.count++;
        }
    },
    updateMenuItem: function updateMenuItem(menuItem) {
        if (menuItem instanceof SWBMenuItem) {
            var idx = this.menu.items.indexOf(menuItem.identity);
            var idx = this.menu.items.map((el) => el.identity).indexOf(menuItem.identity);
            if (idx !== -1) {
                this.menu.items[idx].title = menuItem.title;
                this.menu.items[idx].url = menuItem.url;
                this.menu.items[idx].tags = menuItem.tags;
                this.menu.items[idx].orphan = menuItem.orphan;
            }
        }
    },
    updateMenuItemFavIcon: function updateMenuItemFavIcon(menuItem) {
        if (menuItem instanceof SWBMenuItem) {
            var itemsWithSameDomain = this.menu.items.filter(x => x.domain === menuItem.domain);
            for (var l = 0; l < itemsWithSameDomain.length; l++) {
                var idx = this.menu.items.map((el) => el.identity).indexOf(itemsWithSameDomain[l].identity);
                if (idx !== -1) {
                    this.menu.items[idx].favicon = menuItem.favicon;
                }
            }
        }
        this.save();
    },
    updateMenuItemOrder: function updateMenuItemFavIcon(itemId, itemOrder) {
        var idx = this.menu.items.map((el) => el.identity).indexOf(itemId);
        if (idx !== -1) {
            this.menu.items[idx].order = itemOrder;
            this.save();
        }
    },
    findById: function findById(menuId) {
        var idx = this.menu.items.map((el) => el.identity).indexOf(menuId);
        if (idx !== -1) {
            return this.menu.items[idx];
        }
        return null;
    },
    sortItems: function sortItems(a, b) {
        if (a.order < b.order)
            return -1;
        if (a.order > b.order)
            return 1;
        return 0;
    },
    save: function save() {
        //remove orphan entries and save
        this.menu.items = this.menu.items.filter(x => x.orphan === false);
        this.menu.items = this.menu.items.sort(this.sortItems);
        this.menu.count = this.menu.items.length;
        ss.storage['swbmenu'] = JSON.stringify(this.menu);
    }
});


exports.SWBMenu = SWBMenu;
exports.SWBMenuItem = SWBMenuItem;
