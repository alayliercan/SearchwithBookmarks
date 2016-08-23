"use strict";


var _ = require("sdk/l10n").get;
var cm = require('sdk/context-menu');
var ss = require('sdk/simple-storage');
const tabs = require('sdk/tabs');
const self = require("sdk/self");
const data = self.data;
let { getFavicon } = require('sdk/places/favicon');
let { getMostRecentBrowserWindow } = require("sdk/window/utils");

const { firefoxIcons } = require("./data/firefox-icons.js");
const { showDialog } = require("./data/alert.js")
const { SWBMenu, SWBMenuItem } = require('./data/menu-wrapper.js');
const swbMenu = new SWBMenu("Search with Bookmarks");
const ADDON_URL = "https://addons.mozilla.org/en-GB/firefox/addon/search-with-bookmarks/";
const SEARCH_KEY = "%s";

// Save advanced settings
function saveAdvancedSettings(menuItemsOrdered) {
    try {
        for (let i = 0; i < menuItemsOrdered.length; i++) {
            let splittedItem = menuItemsOrdered[i].split('_');
            let identity = splittedItem[0];
            swbMenu.updateMenuItemOrder(identity, i);
        }
    } catch (e) {
        showDialog("An unexpected error has occurred while saving settings.");
        console.error("Search with Bookmarks: " + e.message);
    }
}

//Open advanced settings page
function openAdvancedSettings() {
    tabs.open({
        url: data.url("settings.html"),
        onReady: function (tab) {
            let worker = tab.attach({
                contentScriptFile: [data.url("./lib/jquery-2.2.4.min.js"),
                    data.url("./lib/jquery-ui.min.js"),
                    data.url("./lib/bootstrap.min.js"),
                    data.url("./lib/showdown.min.js"),
                    data.url("settings.js")
                ]
            });
            worker.port.emit("currentmenuitems", swbMenu.menu.items);
            worker.port.emit("addonversion", self.version);
            worker.port.on("btnSave", saveAdvancedSettings);
        }
    });
}

//Listen advanced settings button on add-on page
var sp = require("sdk/simple-prefs");
sp.on("openSettings", function () {
    openAdvancedSettings();
});

//Create default form of menu
var mainMenu = cm.Menu({
    label: swbMenu.name,
    context: cm.SelectionContext(),
    items: [cm.Item({
        label: "No searchable bookmark found!",
        data: ADDON_URL,
        image: firefoxIcons.BOOKMARKDEFAULT,
        contentScript: 'self.on("click", function (node, data) { alert("You will now be redirected to the add-on\'s homepage where you can find instructions on how to add a searchable bookmark."); self.postMessage(data); });',
        onMessage: function (data) {
            tabs.open({ url: data });
        }
    })]
});

//Retrieve favIcon of a tab, save it into storage, and set the image of menu item
function setFavIcon(swbItem, tab) {
    getFavicon(tab)
        .then(function (url) {
            var cmitems = getMostRecentBrowserWindow().document.querySelectorAll(".addon-context-menu-item[value*='" + swbItem.domain + "']");
            for (let i = 0; i < cmitems.length; i++) {
                cmitems[i].image = url;
                swbItem.favicon = url;
                swbMenu.updateMenuItemFavIcon(swbItem);
            }
        });
}

//Open a web page
function openWebPage(swbItemId, altTextSelected) {
    var swbItem = swbMenu.findById(swbItemId);

    var selectedText = "none";
    try {
        /*  This is the best way to retrieve selected texts and does work on latest FF v48.
        *   However, it's not completely multiprocess-compatible,
        *   and has thrown an exception on FF Developer Edition v50.0a2 and FF Nightly v51.0a1.
        *   https://developer.mozilla.org/en-US/Add-ons/SDK/Guides/Multiprocess_Firefox_and_the_SDK#SDK_internal_incompatibilities
        */
        var currentSelection = require("sdk/selection");
        selectedText = currentSelection.text;
    } catch (e) {
        // Alternative method doesn't work on selected texts within input elements but it's better than nothing.
        selectedText = altTextSelected;
    }

    var encodedSelection = encodeURIComponent(selectedText);
    var searchURL = swbItem.url.replace(SEARCH_KEY, encodedSelection);
    var openInNewTab = require('sdk/simple-prefs').prefs['openInNewTab'];
    var openInBackground = require('sdk/simple-prefs').prefs['openInBackground'];
    if (openInNewTab) {
        tabs.open({
            inBackground: openInBackground,
            url: searchURL,
            onOpen: function (tab) {
                tab.index = tabs.activeTab.index + 1;
            },
            onReady: function (tab) {
                setFavIcon(swbItem, tab);
            }
        });
    } else {
        tabs.activeTab.url = searchURL;
        tabs.on('ready', function () {
            setFavIcon(swbItem, tabs.activeTab);
        });
    }
}

//Add settings menu short-cut
function AddSettingsShortcut() {
    var ShowSettingsShortcut = require('sdk/simple-prefs').prefs['showSettingsMenuShortcut'];
    if (ShowSettingsShortcut) {
        var separatorSubMenuItem = cm.Separator();
        mainMenu.addItem(separatorSubMenuItem);

        var settingsSubMenuItem = cm.Item({
            label: 'Advanced Settings',
            data: '',
            contentScript: 'self.on("click", function (node, data) { self.postMessage(); });',
            onMessage: function (data) {
                openAdvancedSettings();
            }
        });
        mainMenu.addItem(settingsSubMenuItem);
    }
}
//Build sub-menu items
function buildSubMenu() {
    if (swbMenu.menu.count > 0) {
        mainMenu.destroy();
        mainMenu = cm.Menu({
            label: swbMenu.name,
            context: cm.SelectionContext()
        });
        for (let i = 0; i < swbMenu.menu.count; i++) {
            let identity = swbMenu.menu.items[i].identity;
            let subMenuItem = cm.Item({
                label: swbMenu.menu.items[i].title,
                data: swbMenu.menu.items[i].url,
                contentScript: 'self.on("click", function (node, data) { ' +
                ' var altTextSelected  = window.getSelection().toString(); ' +
                ' self.postMessage(altTextSelected); });',
                image: swbMenu.menu.items[i].favicon,
                onMessage: function (altTextSelected) {
                    openWebPage(identity, altTextSelected);
                }
            });
            mainMenu.addItem(subMenuItem);
        }
        AddSettingsShortcut();
    }
}

//Refresh context-menu if required
tabs.on('ready', function (tab) {
    swbMenu.updateByBookmarks(SEARCH_KEY);
    buildSubMenu();
});

function main(options) {
    //option.loadReason
    /*
    install
    enable
    startup
    upgrade
    downgrade
    */
    swbMenu.updateByBookmarks(SEARCH_KEY);
    buildSubMenu();
}

function exit(reason) {
    //reason
    /*
    uninstall
    disable
    shutdown
    upgrade
    downgrade
    */
    if (reason === "disable") {
        mainMenu.destroy();
    }
}

exports.main = main;
exports.onUnload = exit;
