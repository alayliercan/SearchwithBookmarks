let { Cc, Ci } = require('chrome');

var promptService = Cc['@mozilla.org/embedcomp/prompt-service;1']
    .getService(Ci.nsIPromptService);

// Because alert is not defined in component/module scope.
function alert (msg) {
	promptService.alert(null, 'Search with Bookmarks', msg);
}

exports.showDialog = alert;
